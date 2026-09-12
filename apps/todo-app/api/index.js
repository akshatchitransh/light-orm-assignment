// serverless/index.ts
import express from "express";
import cors from "cors";

// apps/todo-app/src/server/api.ts
import { Router } from "express";

// packages/orm/src/driver/postgres.ts
import pg from "pg";

// packages/orm/src/errors.ts
var OrmError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "OrmError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
};
var ValidationError = class extends OrmError {
  constructor(message, field) {
    super(message);
    this.field = field;
    this.name = "ValidationError";
  }
  field;
};
var NotFoundError = class extends OrmError {
  constructor(modelName, queryDescription) {
    const desc = queryDescription ? ` with criteria: ${queryDescription}` : "";
    super(`Record not found in '${modelName}'${desc}`);
    this.name = "NotFoundError";
  }
};
var QueryError = class extends OrmError {
  constructor(message, sql, params, originalError) {
    super(message);
    this.sql = sql;
    this.params = params;
    this.originalError = originalError;
    this.name = "QueryError";
  }
  sql;
  params;
  originalError;
};
var ConnectionError = class extends OrmError {
  constructor(message, originalError) {
    super(message);
    this.originalError = originalError;
    this.name = "ConnectionError";
  }
  originalError;
};

// packages/orm/src/driver/postgres.ts
var { Pool } = pg;
var PostgresDriver = class {
  driverName = "postgres";
  pool;
  constructor(config) {
    try {
      if (typeof config === "string") {
        this.pool = new Pool({
          connectionString: config,
          ssl: config.includes("neon.tech") || config.includes("supabase.co") ? { rejectUnauthorized: false } : void 0,
          max: 5,
          idleTimeoutMillis: 3e4,
          connectionTimeoutMillis: 1e4
        });
      } else {
        this.pool = new Pool(config);
      }
    } catch (err) {
      throw new ConnectionError("Failed to initialize PostgreSQL pool", err);
    }
  }
  async query(sql, params) {
    try {
      const res = await this.pool.query(sql, params);
      return {
        rows: res.rows,
        rowCount: res.rowCount ?? res.rows.length
      };
    } catch (err) {
      throw new QueryError(
        `Database query failed: ${err.message}`,
        sql,
        params,
        err
      );
    }
  }
  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const txDriver = {
        driverName: "postgres:transaction",
        query: async (sql, params) => {
          try {
            const res = await client.query(sql, params);
            return {
              rows: res.rows,
              rowCount: res.rowCount ?? res.rows.length
            };
          } catch (err) {
            throw new QueryError(
              `Transaction query failed: ${err.message}`,
              sql,
              params,
              err
            );
          }
        },
        transaction: async () => {
          throw new Error("Nested transactions are not currently supported");
        },
        close: async () => {
        }
      };
      const result = await callback(txDriver);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
      }
      throw err;
    } finally {
      client.release();
    }
  }
  async close() {
    await this.pool.end();
  }
};

// packages/orm/src/driver/memory.ts
var MemoryPostgresDriver = class {
  driverName = "memory-postgres";
  tables = /* @__PURE__ */ new Map();
  schemas = /* @__PURE__ */ new Map();
  constructor(initialData) {
    if (initialData) {
      for (const [table, rows] of Object.entries(initialData)) {
        this.tables.set(table.toLowerCase(), rows.map((r) => ({ ...r })));
        this.schemas.set(table.toLowerCase(), {
          name: table.toLowerCase(),
          columns: rows[0] ? Object.keys(rows[0]) : [],
          currentSeq: rows.length
        });
      }
    }
  }
  getTable(name) {
    const key = name.toLowerCase().replace(/"/g, "");
    if (!this.tables.has(key)) {
      this.tables.set(key, []);
      this.schemas.set(key, {
        name: key,
        columns: [],
        currentSeq: 0
      });
    }
    return this.tables.get(key);
  }
  getSchema(name) {
    const key = name.toLowerCase().replace(/"/g, "");
    if (!this.schemas.has(key)) {
      this.schemas.set(key, {
        name: key,
        columns: [],
        currentSeq: 0
      });
    }
    return this.schemas.get(key);
  }
  async query(sql, params = []) {
    const trimmed = sql.trim();
    if (trimmed.toUpperCase().startsWith("CREATE TABLE")) {
      const match = trimmed.match(/CREATE TABLE (?:IF NOT EXISTS )?"?([a-zA-Z0-9_]+)"?/i);
      if (match && match[1]) {
        const table = match[1].toLowerCase();
        if (!this.tables.has(table)) {
          this.tables.set(table, []);
          this.schemas.set(table, {
            name: table,
            columns: [],
            currentSeq: 0
          });
        }
      }
      return { rows: [], rowCount: 0 };
    }
    try {
      if (trimmed.toUpperCase().startsWith("INSERT INTO")) {
        return this.handleInsert(trimmed, params);
      }
      if (trimmed.toUpperCase().startsWith("SELECT")) {
        return this.handleSelect(trimmed, params);
      }
      if (trimmed.toUpperCase().startsWith("UPDATE")) {
        return this.handleUpdate(trimmed, params);
      }
      if (trimmed.toUpperCase().startsWith("DELETE FROM")) {
        return this.handleDelete(trimmed, params);
      }
      return { rows: [], rowCount: 0 };
    } catch (err) {
      throw new QueryError(`In-memory query execution failed: ${err.message}`, sql, params, err);
    }
  }
  handleInsert(sql, params) {
    const match = sql.match(/INSERT INTO "?([a-zA-Z0-9_]+)"?\s*(?:\(([^)]+)\))?\s*VALUES\s*(.+?)(?:\s*RETURNING.*)?$/is);
    if (!match || !match[1]) {
      throw new Error("Unable to parse INSERT statement");
    }
    const table = match[1];
    const rows = this.getTable(table);
    const schema = this.getSchema(table);
    const colsRaw = match[2];
    const columns = colsRaw ? colsRaw.split(",").map((c) => c.trim().replace(/"/g, "")) : [];
    const valuesPart = match[3] ?? "";
    const groupMatches = valuesPart.match(/\(([^)]+)\)/g);
    if (!groupMatches) {
      schema.currentSeq++;
      const newRow = { id: schema.currentSeq };
      rows.push(newRow);
      return { rows: [newRow], rowCount: 1 };
    }
    let pIdx = 0;
    const insertedRows = [];
    for (const group of groupMatches) {
      const tokens = group.replace(/^\(|\)$/g, "").split(",").map((t) => t.trim());
      const row = {};
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const token = tokens[i];
        if (token.startsWith("$")) {
          row[col] = params[pIdx++];
        } else if (token.toUpperCase() === "NULL") {
          row[col] = null;
        } else if (token.toUpperCase() === "TRUE") {
          row[col] = true;
        } else if (token.toUpperCase() === "FALSE") {
          row[col] = false;
        } else {
          row[col] = token.replace(/^'|'$/g, "");
        }
      }
      if (row.id === void 0) {
        schema.currentSeq++;
        row.id = schema.currentSeq;
      } else if (typeof row.id === "number" && row.id > schema.currentSeq) {
        schema.currentSeq = row.id;
      }
      if (row.created_at === void 0 && row.createdAt === void 0) {
        row.created_at = /* @__PURE__ */ new Date();
        row.createdAt = /* @__PURE__ */ new Date();
      }
      rows.push(row);
      insertedRows.push(row);
    }
    return {
      rows: insertedRows,
      rowCount: insertedRows.length
    };
  }
  handleSelect(sql, params) {
    const isCount = /SELECT COUNT\(\*\)/i.test(sql);
    const fromMatch = sql.match(/FROM "?([a-zA-Z0-9_]+)"?/i);
    if (!fromMatch || !fromMatch[1]) {
      return { rows: [], rowCount: 0 };
    }
    const table = fromMatch[1];
    let rows = [...this.getTable(table)];
    rows = this.filterRows(sql, rows, params);
    if (isCount) {
      return {
        rows: [{ count: rows.length }],
        rowCount: 1
      };
    }
    const orderMatch = sql.match(/ORDER BY ([^LIMIT^OFFSET]+)/i);
    if (orderMatch && orderMatch[1]) {
      const orderClauses = orderMatch[1].split(",").map((c) => c.trim());
      rows.sort((a, b) => {
        for (const clause of orderClauses) {
          const parts = clause.split(/\s+/);
          const col = parts[0]?.replace(/"/g, "") ?? "";
          const dir = parts[1]?.toUpperCase() === "DESC" ? -1 : 1;
          const valA = a[col];
          const valB = b[col];
          if (valA === valB) continue;
          if (valA === void 0 || valA === null) return 1 * dir;
          if (valB === void 0 || valB === null) return -1 * dir;
          if (valA > valB) return 1 * dir;
          if (valA < b) return -1 * dir;
        }
        return 0;
      });
    }
    let limit;
    let offset;
    const limitMatch = sql.match(/LIMIT\s+(?:\$(\d+)|(\d+))/i);
    if (limitMatch) {
      if (limitMatch[1]) {
        limit = params[parseInt(limitMatch[1], 10) - 1];
      } else if (limitMatch[2]) {
        limit = parseInt(limitMatch[2], 10);
      }
    }
    const offsetMatch = sql.match(/OFFSET\s+(?:\$(\d+)|(\d+))/i);
    if (offsetMatch) {
      if (offsetMatch[1]) {
        offset = params[parseInt(offsetMatch[1], 10) - 1];
      } else if (offsetMatch[2]) {
        offset = parseInt(offsetMatch[2], 10);
      }
    }
    if (typeof offset === "number" && offset > 0) {
      rows = rows.slice(offset);
    }
    if (typeof limit === "number" && limit >= 0) {
      rows = rows.slice(0, limit);
    }
    const selectMatch = sql.match(/SELECT (.+?) FROM/i);
    if (selectMatch && selectMatch[1] && selectMatch[1].trim() !== "*") {
      const cols = selectMatch[1].split(",").map((c) => c.trim().replace(/"/g, ""));
      rows = rows.map((r) => {
        const out = {};
        for (const c of cols) {
          out[c] = r[c];
        }
        return out;
      });
    }
    return {
      rows,
      rowCount: rows.length
    };
  }
  handleUpdate(sql, params) {
    const tableMatch = sql.match(/UPDATE "?([a-zA-Z0-9_]+)"?/i);
    if (!tableMatch || !tableMatch[1]) {
      throw new Error("Unable to parse UPDATE statement");
    }
    const table = tableMatch[1];
    const rows = this.getTable(table);
    const setMatch = sql.match(/SET (.+?) WHERE/is);
    if (!setMatch || !setMatch[1]) {
      throw new Error("Unable to parse UPDATE SET clause");
    }
    const setClauses = setMatch[1].split(",").map((c) => c.trim());
    const updates = {};
    for (const clause of setClauses) {
      const parts = clause.split("=");
      const col = parts[0].trim().replace(/"/g, "");
      const valToken = parts[1].trim();
      const pMatch = valToken.match(/\$(\d+)/);
      if (pMatch && pMatch[1]) {
        const pIndex = parseInt(pMatch[1], 10) - 1;
        updates[col] = params[pIndex];
      }
    }
    const matchedRows = this.filterRows(sql, rows, params);
    for (const row of matchedRows) {
      Object.assign(row, updates);
    }
    return {
      rows: matchedRows,
      rowCount: matchedRows.length
    };
  }
  handleDelete(sql, params) {
    const tableMatch = sql.match(/DELETE FROM "?([a-zA-Z0-9_]+)"?/i);
    if (!tableMatch || !tableMatch[1]) {
      throw new Error("Unable to parse DELETE statement");
    }
    const table = tableMatch[1];
    const rows = this.getTable(table);
    const matchedRows = this.filterRows(sql, rows, params);
    const matchedSet = new Set(matchedRows);
    const remaining = rows.filter((r) => !matchedSet.has(r));
    this.tables.set(table.toLowerCase(), remaining);
    return {
      rows: matchedRows,
      rowCount: matchedRows.length
    };
  }
  filterRows(sql, rows, params) {
    const whereMatch = sql.match(/WHERE (.+?)(?: ORDER BY| LIMIT| OFFSET| RETURNING|$)/is);
    if (!whereMatch || !whereMatch[1]) {
      return rows;
    }
    const whereClause = whereMatch[1].trim();
    return rows.filter((row) => this.matchesWhere(row, whereClause, params));
  }
  matchesWhere(row, whereClause, params) {
    const unwrap = (s) => {
      const trimmed = s.trim();
      if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
        let depth = 0;
        for (let i = 0; i < trimmed.length - 1; i++) {
          if (trimmed[i] === "(") depth++;
          else if (trimmed[i] === ")") depth--;
          if (depth === 0) return trimmed;
        }
        return trimmed.slice(1, -1).trim();
      }
      return trimmed;
    };
    if (whereClause.includes(" OR ")) {
      const orParts = whereClause.split(" OR ");
      return orParts.some((part) => this.matchesWhere(row, unwrap(part), params));
    }
    const andParts = whereClause.split(" AND ").map(unwrap);
    return andParts.every((cond) => {
      const isNullMatch = cond.match(/"?([a-zA-Z0-9_]+)"?\s+IS NULL/i);
      if (isNullMatch && isNullMatch[1]) {
        const col = isNullMatch[1];
        return row[col] === null || row[col] === void 0;
      }
      const isNotNullMatch = cond.match(/"?([a-zA-Z0-9_]+)"?\s+IS NOT NULL/i);
      if (isNotNullMatch && isNotNullMatch[1]) {
        const col = isNotNullMatch[1];
        return row[col] !== null && row[col] !== void 0;
      }
      const inMatch = cond.match(/"?([a-zA-Z0-9_]+)"?\s+IN\s*\(([^)]+)\)/i);
      if (inMatch && inMatch[1] && inMatch[2]) {
        const col = inMatch[1];
        const pIndices = (inMatch[2].match(/\$(\d+)/g) || []).map((p) => parseInt(p.slice(1), 10) - 1);
        const inVals = pIndices.map((idx) => params[idx]);
        return inVals.includes(row[col]);
      }
      const notInMatch = cond.match(/"?([a-zA-Z0-9_]+)"?\s+NOT IN\s*\(([^)]+)\)/i);
      if (notInMatch && notInMatch[1] && notInMatch[2]) {
        const col = notInMatch[1];
        const pIndices = (notInMatch[2].match(/\$(\d+)/g) || []).map((p) => parseInt(p.slice(1), 10) - 1);
        const inVals = pIndices.map((idx) => params[idx]);
        return !inVals.includes(row[col]);
      }
      const ilikeMatch = cond.match(/"?([a-zA-Z0-9_]+)"?\s+ILIKE\s+\$(\d+)/i);
      if (ilikeMatch && ilikeMatch[1] && ilikeMatch[2]) {
        const col = ilikeMatch[1];
        const pattern = String(params[parseInt(ilikeMatch[2], 10) - 1] ?? "").toLowerCase();
        const val = String(row[col] ?? "").toLowerCase();
        if (pattern.startsWith("%") && pattern.endsWith("%")) {
          return val.includes(pattern.slice(1, -1));
        }
        if (pattern.startsWith("%")) {
          return val.endsWith(pattern.slice(1));
        }
        if (pattern.endsWith("%")) {
          return val.startsWith(pattern.slice(0, -1));
        }
        return val === pattern;
      }
      const compMatch = cond.match(/"?([a-zA-Z0-9_]+)"?\s*(=|<>|>=|<=|>|<)\s*\$(\d+)/);
      if (compMatch && compMatch[1] && compMatch[2] && compMatch[3]) {
        const col = compMatch[1];
        const op = compMatch[2];
        const targetVal = params[parseInt(compMatch[3], 10) - 1];
        const actualVal = row[col];
        switch (op) {
          case "=":
            return actualVal === targetVal;
          case "<>":
            return actualVal !== targetVal;
          case ">":
            return actualVal > targetVal;
          case ">=":
            return actualVal >= targetVal;
          case "<":
            return actualVal < targetVal;
          case "<=":
            return actualVal <= targetVal;
        }
      }
      return true;
    });
  }
  async transaction(callback) {
    const snapshotTables = /* @__PURE__ */ new Map();
    for (const [k, v] of this.tables.entries()) {
      snapshotTables.set(k, v.map((r) => ({ ...r })));
    }
    try {
      const result = await callback(this);
      return result;
    } catch (err) {
      this.tables = snapshotTables;
      throw err;
    }
  }
  async close() {
    this.tables.clear();
    this.schemas.clear();
  }
};

// packages/orm/src/query-builder.ts
var QueryCompiler = class {
  paramIndex = 1;
  params = [];
  constructor(initialParamIndex = 1) {
    this.paramIndex = initialParamIndex;
  }
  addParam(value) {
    const placeholder = `$${this.paramIndex++}`;
    this.params.push(value);
    return placeholder;
  }
  getParams() {
    return [...this.params];
  }
  escapeIdentifier(identifier) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new ValidationError(`Invalid SQL identifier: ${identifier}`);
    }
    return `"${identifier}"`;
  }
  compileWhere(where) {
    const conditions = this.compileConditions(where);
    return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  }
  compileConditions(where) {
    if (!where || Object.keys(where).length === 0) {
      return [];
    }
    const conditions = [];
    for (const [key, value] of Object.entries(where)) {
      if (key === "AND" && Array.isArray(value)) {
        const nested = value.flatMap((clause) => this.compileConditions(clause)).filter(Boolean);
        if (nested.length > 0) {
          conditions.push(`(${nested.join(" AND ")})`);
        }
        continue;
      }
      if (key === "OR" && Array.isArray(value)) {
        const nested = value.map((clause) => {
          const inner = this.compileConditions(clause);
          return inner.length > 1 ? `(${inner.join(" AND ")})` : inner[0];
        }).filter(Boolean);
        if (nested.length > 0) {
          conditions.push(`(${nested.join(" OR ")})`);
        }
        continue;
      }
      const fieldCondition = this.compileFieldCondition(key, value);
      if (fieldCondition) {
        conditions.push(fieldCondition);
      }
    }
    return conditions;
  }
  compileFieldCondition(column, condition) {
    const colName = this.escapeIdentifier(column);
    if (condition === null) {
      return `${colName} IS NULL`;
    }
    if (typeof condition !== "object" || condition instanceof Date) {
      const p = this.addParam(condition);
      return `${colName} = ${p}`;
    }
    const opConditions = [];
    const ops = condition;
    if (ops.eq !== void 0) {
      if (ops.eq === null) {
        opConditions.push(`${colName} IS NULL`);
      } else {
        opConditions.push(`${colName} = ${this.addParam(ops.eq)}`);
      }
    }
    if (ops.ne !== void 0) {
      if (ops.ne === null) {
        opConditions.push(`${colName} IS NOT NULL`);
      } else {
        opConditions.push(`${colName} <> ${this.addParam(ops.ne)}`);
      }
    }
    if (ops.gt !== void 0) {
      opConditions.push(`${colName} > ${this.addParam(ops.gt)}`);
    }
    if (ops.gte !== void 0) {
      opConditions.push(`${colName} >= ${this.addParam(ops.gte)}`);
    }
    if (ops.lt !== void 0) {
      opConditions.push(`${colName} < ${this.addParam(ops.lt)}`);
    }
    if (ops.lte !== void 0) {
      opConditions.push(`${colName} <= ${this.addParam(ops.lte)}`);
    }
    if (ops.in !== void 0 && Array.isArray(ops.in)) {
      if (ops.in.length === 0) {
        opConditions.push("1 = 0");
      } else {
        const placeholders = ops.in.map((item) => this.addParam(item)).join(", ");
        opConditions.push(`${colName} IN (${placeholders})`);
      }
    }
    if (ops.notIn !== void 0 && Array.isArray(ops.notIn)) {
      if (ops.notIn.length === 0) {
        opConditions.push("1 = 1");
      } else {
        const placeholders = ops.notIn.map((item) => this.addParam(item)).join(", ");
        opConditions.push(`${colName} NOT IN (${placeholders})`);
      }
    }
    if (ops.contains !== void 0) {
      opConditions.push(`${colName} ILIKE ${this.addParam(`%${ops.contains}%`)}`);
    }
    if (ops.startsWith !== void 0) {
      opConditions.push(`${colName} ILIKE ${this.addParam(`${ops.startsWith}%`)}`);
    }
    if (ops.endsWith !== void 0) {
      opConditions.push(`${colName} ILIKE ${this.addParam(`%${ops.endsWith}`)}`);
    }
    if (ops.isNull !== void 0) {
      opConditions.push(ops.isNull ? `${colName} IS NULL` : `${colName} IS NOT NULL`);
    }
    return opConditions.join(" AND ");
  }
  compileOrderBy(orderBy) {
    if (!orderBy || Object.keys(orderBy).length === 0) {
      return "";
    }
    const clauses = Object.entries(orderBy).map(([key, dir]) => {
      const col = this.escapeIdentifier(key);
      const direction = String(dir).toUpperCase() === "DESC" ? "DESC" : "ASC";
      return `${col} ${direction}`;
    });
    return `ORDER BY ${clauses.join(", ")}`;
  }
};
var QueryBuilder = class {
  static select(tableName, options) {
    const compiler = new QueryCompiler();
    const table = compiler.escapeIdentifier(tableName);
    let cols = "*";
    if (options?.select && options.select.length > 0) {
      cols = options.select.map((c) => compiler.escapeIdentifier(String(c))).join(", ");
    }
    const parts = [`SELECT ${cols} FROM ${table}`];
    if (options?.where) {
      const whereSql = compiler.compileWhere(options.where);
      if (whereSql) parts.push(whereSql);
    }
    if (options?.orderBy) {
      const orderSql = compiler.compileOrderBy(options.orderBy);
      if (orderSql) parts.push(orderSql);
    }
    if (typeof options?.limit === "number") {
      parts.push(`LIMIT ${compiler.addParam(options.limit)}`);
    }
    if (typeof options?.offset === "number") {
      parts.push(`OFFSET ${compiler.addParam(options.offset)}`);
    }
    return {
      sql: parts.join(" "),
      params: compiler.getParams()
    };
  }
  static insert(tableName, data) {
    const compiler = new QueryCompiler();
    const table = compiler.escapeIdentifier(tableName);
    const keys = Object.keys(data).filter((k) => data[k] !== void 0);
    if (keys.length === 0) {
      return {
        sql: `INSERT INTO ${table} DEFAULT VALUES RETURNING *`,
        params: []
      };
    }
    const columns = keys.map((k) => compiler.escapeIdentifier(k)).join(", ");
    const placeholders = keys.map((k) => compiler.addParam(data[k])).join(", ");
    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
    return {
      sql,
      params: compiler.getParams()
    };
  }
  static insertMany(tableName, records) {
    if (records.length === 0) {
      throw new ValidationError("Cannot insert empty records array");
    }
    const compiler = new QueryCompiler();
    const table = compiler.escapeIdentifier(tableName);
    const allKeys = Array.from(
      new Set(records.flatMap((r) => Object.keys(r).filter((k) => r[k] !== void 0)))
    );
    if (allKeys.length === 0) {
      throw new ValidationError("Records have no valid column values to insert");
    }
    const columns = allKeys.map((k) => compiler.escapeIdentifier(k)).join(", ");
    const rowPlaceholders = [];
    for (const record of records) {
      const row = allKeys.map((key) => compiler.addParam(record[key] !== void 0 ? record[key] : null)).join(", ");
      rowPlaceholders.push(`(${row})`);
    }
    const sql = `INSERT INTO ${table} (${columns}) VALUES ${rowPlaceholders.join(", ")} RETURNING *`;
    return {
      sql,
      params: compiler.getParams()
    };
  }
  static update(tableName, where, data) {
    const compiler = new QueryCompiler();
    const table = compiler.escapeIdentifier(tableName);
    const keys = Object.keys(data).filter((k) => data[k] !== void 0);
    if (keys.length === 0) {
      throw new ValidationError("Update data must contain at least one field");
    }
    const setClauses = keys.map((key) => {
      const col = compiler.escapeIdentifier(key);
      const placeholder = compiler.addParam(data[key]);
      return `${col} = ${placeholder}`;
    });
    const whereSql = compiler.compileWhere(where);
    if (!whereSql) {
      throw new ValidationError("Update requires a non-empty where condition to avoid accidental table-wide updates");
    }
    const sql = `UPDATE ${table} SET ${setClauses.join(", ")} ${whereSql} RETURNING *`;
    return {
      sql,
      params: compiler.getParams()
    };
  }
  static delete(tableName, where) {
    const compiler = new QueryCompiler();
    const table = compiler.escapeIdentifier(tableName);
    const whereSql = compiler.compileWhere(where);
    if (!whereSql) {
      throw new ValidationError("Delete requires a non-empty where condition to avoid accidental table truncates");
    }
    const sql = `DELETE FROM ${table} ${whereSql} RETURNING *`;
    return {
      sql,
      params: compiler.getParams()
    };
  }
  static count(tableName, where) {
    const compiler = new QueryCompiler();
    const table = compiler.escapeIdentifier(tableName);
    const parts = [`SELECT COUNT(*)::int as count FROM ${table}`];
    if (where) {
      const whereSql = compiler.compileWhere(where);
      if (whereSql) parts.push(whereSql);
    }
    return {
      sql: parts.join(" "),
      params: compiler.getParams()
    };
  }
  /**
   * Generates PostgreSQL DDL for table creation based on model definition
   */
  static createTableDdl(model) {
    const compiler = new QueryCompiler();
    const tableName = compiler.escapeIdentifier(model.tableName);
    const columnDefs = [];
    for (const [colName, colBuilder] of Object.entries(model.columns)) {
      const col = compiler.escapeIdentifier(colName);
      const opts = colBuilder.options;
      let sqlType;
      if (opts.autoIncrement && opts.primaryKey) {
        sqlType = "SERIAL PRIMARY KEY";
        columnDefs.push(`${col} ${sqlType}`);
        continue;
      }
      switch (opts.dataType) {
        case "number":
          sqlType = "INTEGER";
          break;
        case "string":
          sqlType = "VARCHAR(255)";
          break;
        case "text":
          sqlType = "TEXT";
          break;
        case "boolean":
          sqlType = "BOOLEAN";
          break;
        case "timestamp":
          sqlType = "TIMESTAMP WITH TIME ZONE";
          break;
        case "json":
          sqlType = "JSONB";
          break;
        default:
          sqlType = "TEXT";
      }
      const clauses = [col, sqlType];
      if (opts.primaryKey) {
        clauses.push("PRIMARY KEY");
      } else {
        if (!opts.nullable) {
          clauses.push("NOT NULL");
        }
        if (opts.unique) {
          clauses.push("UNIQUE");
        }
        if (opts.hasDefault && opts.defaultValue !== void 0) {
          if (opts.defaultValue === "NOW()" || opts.defaultValue === "CURRENT_TIMESTAMP") {
            clauses.push("DEFAULT CURRENT_TIMESTAMP");
          } else if (typeof opts.defaultValue === "string") {
            clauses.push(`DEFAULT '${opts.defaultValue.replace(/'/g, "''")}'`);
          } else if (typeof opts.defaultValue === "boolean") {
            clauses.push(opts.defaultValue ? "DEFAULT TRUE" : "DEFAULT FALSE");
          } else {
            clauses.push(`DEFAULT ${opts.defaultValue}`);
          }
        }
      }
      columnDefs.push(clauses.join(" "));
    }
    return `CREATE TABLE IF NOT EXISTS ${tableName} (
  ${columnDefs.join(",\n  ")}
);`;
  }
};

// packages/orm/src/client.ts
var ModelRepositoryImpl = class {
  constructor(modelName, modelDef, executeQuery) {
    this.modelDef = modelDef;
    this.executeQuery = executeQuery;
    this.modelName = modelName;
    this.tableName = modelDef.tableName;
  }
  modelDef;
  executeQuery;
  modelName;
  tableName;
  async findMany(options) {
    const q = QueryBuilder.select(this.tableName, options);
    const res = await this.executeQuery(q.sql, q.params);
    return res.rows;
  }
  async findFirst(options) {
    const q = QueryBuilder.select(this.tableName, {
      ...options,
      limit: 1
    });
    const res = await this.executeQuery(q.sql, q.params);
    return res.rows[0] ?? null;
  }
  async findUnique(options) {
    if (!options || !options.where || Object.keys(options.where).length === 0) {
      throw new ValidationError("findUnique requires a specific 'where' filter");
    }
    const q = QueryBuilder.select(this.tableName, {
      where: options.where,
      select: options.select,
      limit: 1
    });
    const res = await this.executeQuery(q.sql, q.params);
    return res.rows[0] ?? null;
  }
  applyDefaults(data) {
    const record = { ...data };
    for (const [colName, colBuilder] of Object.entries(this.modelDef.columns)) {
      if (record[colName] === void 0 && colBuilder?.options?.hasDefault) {
        const defVal = colBuilder.options.defaultValue;
        if (defVal === "NOW()" || defVal === "CURRENT_TIMESTAMP") {
          record[colName] = /* @__PURE__ */ new Date();
        } else if (defVal !== void 0) {
          record[colName] = defVal;
        }
      }
    }
    return record;
  }
  async create(data) {
    if (!data || typeof data !== "object") {
      throw new ValidationError("create requires a valid data object");
    }
    const withDefaults = this.applyDefaults(data);
    const q = QueryBuilder.insert(this.tableName, withDefaults);
    const res = await this.executeQuery(q.sql, q.params);
    if (!res.rows[0]) {
      throw new Error(`Failed to create record in ${this.modelName}`);
    }
    return res.rows[0];
  }
  async createMany(data) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new ValidationError("createMany requires a non-empty array of records");
    }
    const withDefaults = data.map((d) => this.applyDefaults(d));
    const q = QueryBuilder.insertMany(this.tableName, withDefaults);
    const res = await this.executeQuery(q.sql, q.params);
    return res.rows;
  }
  async update(options) {
    if (!options || !options.where) {
      throw new ValidationError("update requires a 'where' filter");
    }
    if (!options.data || Object.keys(options.data).length === 0) {
      throw new ValidationError("update requires non-empty 'data'");
    }
    const q = QueryBuilder.update(this.tableName, options.where, options.data);
    const res = await this.executeQuery(q.sql, q.params);
    if (!res.rows[0]) {
      throw new NotFoundError(this.modelName, JSON.stringify(options.where));
    }
    return res.rows[0];
  }
  async updateMany(options) {
    if (!options || !options.where) {
      throw new ValidationError("updateMany requires a 'where' filter");
    }
    const q = QueryBuilder.update(this.tableName, options.where, options.data);
    const res = await this.executeQuery(q.sql, q.params);
    return res.rowCount;
  }
  async delete(options) {
    if (!options || !options.where) {
      throw new ValidationError("delete requires a 'where' filter");
    }
    const q = QueryBuilder.delete(this.tableName, options.where);
    const res = await this.executeQuery(q.sql, q.params);
    return res.rows[0] ?? null;
  }
  async deleteMany(options) {
    const where = options?.where ?? {};
    if (Object.keys(where).length === 0) {
      throw new ValidationError("deleteMany requires a non-empty 'where' condition for safety");
    }
    const q = QueryBuilder.delete(this.tableName, where);
    const res = await this.executeQuery(q.sql, q.params);
    return res.rowCount;
  }
  async count(options) {
    const q = QueryBuilder.count(this.tableName, options?.where);
    const res = await this.executeQuery(q.sql, q.params);
    const countVal = res.rows[0]?.count ?? 0;
    return typeof countVal === "number" ? countVal : parseInt(countVal, 10);
  }
};
var ClientImpl = class {
  driver;
  schema;
  listeners = [];
  logging;
  constructor(config, driverOverride) {
    this.schema = config.schema;
    this.logging = !!config.logging;
    if (driverOverride) {
      this.driver = driverOverride;
    } else if (config.driver) {
      this.driver = config.driver;
    } else {
      const connStr = config.connectionString || (typeof process !== "undefined" ? process.env?.DATABASE_URL : void 0);
      if (connStr) {
        this.driver = new PostgresDriver(connStr);
      } else {
        this.driver = new MemoryPostgresDriver();
      }
    }
    if (config.onQuery) {
      this.listeners.push(config.onQuery);
    }
  }
  async executeWithTelemetry(sql, params = []) {
    const start = Date.now();
    try {
      const result = await this.driver.query(sql, params);
      const durationMs = Date.now() - start;
      const event = {
        sql,
        params,
        durationMs,
        timestamp: /* @__PURE__ */ new Date(),
        rowCount: result.rowCount,
        source: this.driver.driverName
      };
      if (this.logging) {
        console.log(`[LightORM] (${durationMs}ms) ${sql} -- [${params.join(", ")}]`);
      }
      for (const listener of this.listeners) {
        try {
          listener(event);
        } catch {
        }
      }
      return result;
    } catch (err) {
      const durationMs = Date.now() - start;
      if (this.logging) {
        console.error(`[LightORM ERROR] (${durationMs}ms) ${sql}`, err);
      }
      throw err;
    }
  }
  async raw(sql, params = []) {
    return this.executeWithTelemetry(sql, params);
  }
  async syncSchema() {
    for (const [, modelDef] of Object.entries(this.schema)) {
      const ddl = QueryBuilder.createTableDdl(modelDef);
      await this.executeWithTelemetry(ddl);
    }
  }
  async transaction(callback) {
    return this.driver.transaction(async (txDriver) => {
      const txClient = createClientInternal(
        {
          schema: this.schema,
          logging: this.logging
        },
        txDriver,
        this.listeners
      );
      return callback(txClient);
    });
  }
  onQuery(listener) {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) {
        this.listeners.splice(idx, 1);
      }
    };
  }
  async close() {
    await this.driver.close();
  }
  _bindModels() {
    const repos = {};
    for (const [modelKey, modelDef] of Object.entries(this.schema)) {
      repos[modelKey] = new ModelRepositoryImpl(
        modelKey,
        modelDef,
        (sql, params) => this.executeWithTelemetry(sql, params)
      );
    }
    return repos;
  }
};
function createClientInternal(config, driverOverride, inheritedListeners) {
  const clientImpl = new ClientImpl(config, driverOverride);
  if (inheritedListeners) {
    for (const l of inheritedListeners) {
      clientImpl.onQuery(l);
    }
  }
  const modelRepos = clientImpl._bindModels();
  return new Proxy(clientImpl, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && prop in modelRepos) {
        return modelRepos[prop];
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}
function createClient(config) {
  return createClientInternal(config);
}

// packages/orm/src/schema.ts
var ColumnBuilderImpl = class _ColumnBuilderImpl {
  _type;
  options;
  constructor(options) {
    this.options = { ...options };
  }
  primaryKey() {
    return new _ColumnBuilderImpl({
      ...this.options,
      primaryKey: true,
      nullable: false
    });
  }
  autoIncrement() {
    return new _ColumnBuilderImpl({
      ...this.options,
      autoIncrement: true,
      hasDefault: true,
      nullable: false
    });
  }
  notNull() {
    return new _ColumnBuilderImpl({
      ...this.options,
      nullable: false
    });
  }
  nullable() {
    return new _ColumnBuilderImpl({
      ...this.options,
      nullable: true
    });
  }
  default(val) {
    return new _ColumnBuilderImpl({
      ...this.options,
      hasDefault: true,
      defaultValue: val
    });
  }
  unique() {
    return new _ColumnBuilderImpl({
      ...this.options,
      unique: true
    });
  }
};
function createColumn(dataType) {
  return new ColumnBuilderImpl({
    dataType,
    nullable: false,
    hasDefault: false,
    autoIncrement: false,
    primaryKey: false,
    unique: false
  });
}
function string() {
  return createColumn("string");
}
function number() {
  return createColumn("number");
}
function boolean() {
  return createColumn("boolean");
}
function timestamp() {
  return createColumn("timestamp");
}
function defineModel(tableName, columns) {
  if (!tableName || typeof tableName !== "string") {
    throw new Error("Model must have a non-empty string tableName");
  }
  if (!columns || typeof columns !== "object" || Object.keys(columns).length === 0) {
    throw new Error(`Model '${tableName}' must define at least one column`);
  }
  return {
    tableName,
    columns
  };
}

// apps/todo-app/src/server/db.ts
try {
  process.loadEnvFile?.();
} catch {
}
var TodoModel = defineModel("todos", {
  id: number().primaryKey().autoIncrement(),
  title: string().notNull(),
  completed: boolean().default(false),
  priority: string().default("medium"),
  // "low" | "medium" | "high"
  category: string().default("General"),
  dueDate: string().nullable(),
  createdAt: timestamp().default("NOW()")
});
var queryLogBuffer = [];
var DEFAULT_DATABASE_URL = "postgresql://neondb_owner:npg_jl8HOInRT9rU@ep-wild-cell-aeagzyae-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
var db = createClient({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
  schema: {
    todo: TodoModel
  },
  logging: true,
  onQuery: (evt) => {
    const item = {
      ...evt,
      id: Math.random().toString(36).substring(2, 9)
    };
    queryLogBuffer.unshift(item);
    if (queryLogBuffer.length > 50) {
      queryLogBuffer.pop();
    }
  }
});
async function initDb() {
  console.log(`[Database] Initializing schema via @light-orm/core using driver: ${db.driver.driverName}`);
  await db.syncSchema();
  const count = await db.todo.count();
  if (count === 0) {
    console.log("[Database] Seeding initial demo tasks...");
    await seedDemoData();
  }
}
async function seedDemoData() {
  await db.todo.createMany([
    {
      title: "Design the mobile dashboard",
      completed: false,
      priority: "medium",
      category: "Engineering",
      dueDate: "Today"
    },
    {
      title: "Review Neon database schema",
      completed: false,
      priority: "high",
      category: "Engineering",
      dueDate: "Tomorrow"
    },
    {
      title: "Write onboarding copy",
      completed: true,
      priority: "low",
      category: "Product",
      dueDate: "Fri, Mar 15"
    },
    {
      title: "Set up CI pipeline",
      completed: false,
      priority: "high",
      category: "DevOps",
      dueDate: "Mar 18"
    },
    {
      title: "Share sprint recap",
      completed: true,
      priority: "medium",
      category: "General",
      dueDate: "Mar 20"
    },
    {
      title: "Evaluate @light-orm/core type safety & telemetry",
      completed: true,
      priority: "high",
      category: "Architecture",
      dueDate: "Today"
    }
  ]);
}

// apps/todo-app/src/server/api.ts
var apiRouter = Router();
apiRouter.get("/todos", async (req, res) => {
  try {
    const { status, priority, search } = req.query;
    const where = {};
    if (status === "active") {
      where.completed = false;
    } else if (status === "completed") {
      where.completed = true;
    }
    if (priority && priority !== "all" && typeof priority === "string") {
      where.priority = priority;
    }
    if (search && typeof search === "string" && search.trim()) {
      where.title = { contains: search.trim() };
    }
    const todos = await db.todo.findMany({
      where: Object.keys(where).length > 0 ? where : void 0,
      orderBy: { id: "desc" }
    });
    res.json({ success: true, data: todos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/todos", async (req, res) => {
  try {
    const { title, priority, category, dueDate } = req.body;
    if (!title || typeof title !== "string" || !title.trim()) {
      res.status(400).json({ success: false, error: "Task title is required" });
      return;
    }
    const newTodo = await db.todo.create({
      title: title.trim(),
      completed: false,
      priority: priority || "medium",
      category: category || "General",
      dueDate: dueDate || null
    });
    res.status(201).json({ success: true, data: newTodo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.patch("/todos/:id", async (req, res) => {
  try {
    const idParam = req.params.id ?? "";
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid todo id" });
      return;
    }
    const { title, completed, priority, category, dueDate } = req.body;
    const updateData = {};
    if (typeof title === "string") updateData.title = title.trim();
    if (typeof completed === "boolean") updateData.completed = completed;
    if (typeof priority === "string") updateData.priority = priority;
    if (typeof category === "string") updateData.category = category;
    if (dueDate !== void 0) updateData.dueDate = dueDate;
    const updated = await db.todo.update({
      where: { id },
      data: updateData
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.delete("/todos/:id", async (req, res) => {
  try {
    const idParam = req.params.id ?? "";
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid todo id" });
      return;
    }
    const deleted = await db.todo.delete({
      where: { id }
    });
    res.json({ success: true, data: deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.delete("/todos-completed", async (_req, res) => {
  try {
    const count = await db.todo.deleteMany({
      where: { completed: true }
    });
    res.json({ success: true, deletedCount: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/seed", async (_req, res) => {
  try {
    await seedDemoData();
    const all = await db.todo.findMany({ orderBy: { id: "desc" } });
    res.json({ success: true, message: "Demo data seeded", data: all });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/stats", async (_req, res) => {
  try {
    const total = await db.todo.count();
    const completed = await db.todo.count({ where: { completed: true } });
    const active = total - completed;
    res.json({
      success: true,
      stats: {
        total,
        completed,
        active,
        driver: db.driver.driverName,
        isPostgres: db.driver.driverName.includes("postgres")
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/telemetry/queries", (_req, res) => {
  res.json({ success: true, queries: queryLogBuffer });
});
apiRouter.post("/raw-query", async (req, res) => {
  const start = performance.now();
  try {
    const { sql, params } = req.body;
    if (!sql || typeof sql !== "string") {
      res.status(400).json({ success: false, error: "SQL string is required" });
      return;
    }
    const boundParams = Array.isArray(params) ? params : [];
    const result = await db.driver.query(sql, boundParams);
    const duration = performance.now() - start;
    queryLogBuffer.unshift({
      id: Math.random().toString(36).substring(2, 9),
      sql,
      params: boundParams,
      durationMs: duration,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      rowCount: result.rowCount,
      source: db.driver.driverName
    });
    if (queryLogBuffer.length > 50) queryLogBuffer.pop();
    res.json({
      success: true,
      rowCount: result.rowCount,
      rows: result.rows,
      durationMs: duration
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// serverless/index.ts
try {
  process.loadEnvFile?.();
} catch {
}
var app = express();
app.use(cors());
app.use(express.json());
app.use((req, _res, next) => {
  console.log(`[Vercel Serverless] ${req.method} ${req.url} (matched: ${req.headers["x-matched-path"]})`);
  next();
});
var isDbInitialized = false;
app.use(async (_req, _res, next) => {
  if (!isDbInitialized) {
    try {
      await initDb();
      isDbInitialized = true;
    } catch (err) {
      console.error("Vercel Serverless Database initialization error:", err);
    }
  }
  next();
});
app.use((req, _res, next) => {
  const matchedPath = req.headers["x-matched-path"] || "";
  if (matchedPath && req.url === "/") {
    const queryIndex = req.originalUrl?.indexOf("?") ?? -1;
    const queryString = queryIndex !== -1 ? req.originalUrl.slice(queryIndex) : "";
    req.url = matchedPath + queryString;
  }
  next();
});
app.use("/api", apiRouter);
app.use("/", apiRouter);
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", serverless: true, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
var index_default = (req, res) => {
  return new Promise((resolve, reject) => {
    res.on("finish", resolve);
    res.on("close", resolve);
    res.on("error", reject);
    app(req, res);
  });
};
export {
  app,
  index_default as default
};
