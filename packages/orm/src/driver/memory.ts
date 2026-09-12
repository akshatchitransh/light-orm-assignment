import { DatabaseDriver, QueryResult } from "./types.js";
import { QueryError } from "../errors.js";

interface TableSchema {
  name: string;
  columns: string[];
  autoIncrementCol?: string;
  currentSeq: number;
}

/**
 * High-fidelity in-memory PostgreSQL emulator for zero-dependency local testing,
 * developer onboarding, and seamless execution without requiring immediate cloud credentials.
 */
export class MemoryPostgresDriver implements DatabaseDriver {
  readonly driverName = "memory-postgres";
  private tables = new Map<string, any[]>();
  private schemas = new Map<string, TableSchema>();

  constructor(initialData?: Record<string, any[]>) {
    if (initialData) {
      for (const [table, rows] of Object.entries(initialData)) {
        this.tables.set(table.toLowerCase(), rows.map((r) => ({ ...r })));
        this.schemas.set(table.toLowerCase(), {
          name: table.toLowerCase(),
          columns: rows[0] ? Object.keys(rows[0]) : [],
          currentSeq: rows.length,
        });
      }
    }
  }

  private getTable(name: string): any[] {
    const key = name.toLowerCase().replace(/"/g, "");
    if (!this.tables.has(key)) {
      this.tables.set(key, []);
      this.schemas.set(key, {
        name: key,
        columns: [],
        currentSeq: 0,
      });
    }
    return this.tables.get(key)!;
  }

  private getSchema(name: string): TableSchema {
    const key = name.toLowerCase().replace(/"/g, "");
    if (!this.schemas.has(key)) {
      this.schemas.set(key, {
        name: key,
        columns: [],
        currentSeq: 0,
      });
    }
    return this.schemas.get(key)!;
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    const trimmed = sql.trim();

    // 1. CREATE TABLE
    if (trimmed.toUpperCase().startsWith("CREATE TABLE")) {
      const match = trimmed.match(/CREATE TABLE (?:IF NOT EXISTS )?"?([a-zA-Z0-9_]+)"?/i);
      if (match && match[1]) {
        const table = match[1].toLowerCase();
        if (!this.tables.has(table)) {
          this.tables.set(table, []);
          this.schemas.set(table, {
            name: table,
            columns: [],
            currentSeq: 0,
          });
        }
      }
      return { rows: [] as T[], rowCount: 0 };
    }

    // Replace $1, $2, ... in SQL with parameters for emulation matching
    try {
      if (trimmed.toUpperCase().startsWith("INSERT INTO")) {
        return this.handleInsert<T>(trimmed, params);
      }
      if (trimmed.toUpperCase().startsWith("SELECT")) {
        return this.handleSelect<T>(trimmed, params);
      }
      if (trimmed.toUpperCase().startsWith("UPDATE")) {
        return this.handleUpdate<T>(trimmed, params);
      }
      if (trimmed.toUpperCase().startsWith("DELETE FROM")) {
        return this.handleDelete<T>(trimmed, params);
      }

      return { rows: [] as T[], rowCount: 0 };
    } catch (err: any) {
      throw new QueryError(`In-memory query execution failed: ${err.message}`, sql, params, err);
    }
  }

  private handleInsert<T>(sql: string, params: any[]): QueryResult<T> {
    const match = sql.match(/INSERT INTO "?([a-zA-Z0-9_]+)"?\s*(?:\(([^)]+)\))?\s*VALUES\s*(.+?)(?:\s*RETURNING.*)?$/is);
    if (!match || !match[1]) {
      throw new Error("Unable to parse INSERT statement");
    }

    const table = match[1];
    const rows = this.getTable(table);
    const schema = this.getSchema(table);

    const colsRaw = match[2];
    const columns = colsRaw ? colsRaw.split(",").map((c) => c.trim().replace(/"/g, "")) : [];

    // Parse values groups: ($1, $2), ($3, $4)
    const valuesPart = match[3] ?? "";
    const groupMatches = valuesPart.match(/\(([^)]+)\)/g);
    if (!groupMatches) {
      // Default values insert
      schema.currentSeq++;
      const newRow: any = { id: schema.currentSeq };
      rows.push(newRow);
      return { rows: [newRow] as T[], rowCount: 1 };
    }

    let pIdx = 0;
    const insertedRows: any[] = [];

    for (const group of groupMatches) {
      const tokens = group.replace(/^\(|\)$/g, "").split(",").map((t) => t.trim());
      const row: Record<string, any> = {};

      for (let i = 0; i < columns.length; i++) {
        const col = columns[i]!;
        const token = tokens[i]!;
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

      if (row.id === undefined) {
        schema.currentSeq++;
        row.id = schema.currentSeq;
      } else if (typeof row.id === "number" && row.id > schema.currentSeq) {
        schema.currentSeq = row.id;
      }

      if (row.created_at === undefined && row.createdAt === undefined) {
        row.created_at = new Date();
        row.createdAt = new Date();
      }

      rows.push(row);
      insertedRows.push(row);
    }

    return {
      rows: insertedRows as T[],
      rowCount: insertedRows.length,
    };
  }

  private handleSelect<T>(sql: string, params: any[]): QueryResult<T> {
    // Check count query
    const isCount = /SELECT COUNT\(\*\)/i.test(sql);

    const fromMatch = sql.match(/FROM "?([a-zA-Z0-9_]+)"?/i);
    if (!fromMatch || !fromMatch[1]) {
      return { rows: [] as T[], rowCount: 0 };
    }

    const table = fromMatch[1];
    let rows = [...this.getTable(table)];

    // Evaluate WHERE filters
    rows = this.filterRows(sql, rows, params);

    if (isCount) {
      return {
        rows: [{ count: rows.length }] as any as T[],
        rowCount: 1,
      };
    }

    // ORDER BY
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
          if (valA === undefined || valA === null) return 1 * dir;
          if (valB === undefined || valB === null) return -1 * dir;
          if (valA > valB) return 1 * dir;
          if (valA < b) return -1 * dir;
        }
        return 0;
      });
    }

    // LIMIT & OFFSET
    let limit: number | undefined;
    let offset: number | undefined;

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

    // Map column selection if specified
    const selectMatch = sql.match(/SELECT (.+?) FROM/i);
    if (selectMatch && selectMatch[1] && selectMatch[1].trim() !== "*") {
      const cols = selectMatch[1].split(",").map((c) => c.trim().replace(/"/g, ""));
      rows = rows.map((r) => {
        const out: any = {};
        for (const c of cols) {
          out[c] = r[c];
        }
        return out;
      });
    }

    return {
      rows: rows as T[],
      rowCount: rows.length,
    };
  }

  private handleUpdate<T>(sql: string, params: any[]): QueryResult<T> {
    const tableMatch = sql.match(/UPDATE "?([a-zA-Z0-9_]+)"?/i);
    if (!tableMatch || !tableMatch[1]) {
      throw new Error("Unable to parse UPDATE statement");
    }

    const table = tableMatch[1];
    const rows = this.getTable(table);

    // Extract SET clauses
    const setMatch = sql.match(/SET (.+?) WHERE/is);
    if (!setMatch || !setMatch[1]) {
      throw new Error("Unable to parse UPDATE SET clause");
    }

    const setClauses = setMatch[1].split(",").map((c) => c.trim());
    const updates: Record<string, any> = {};

    for (const clause of setClauses) {
      const parts = clause.split("=");
      const col = parts[0]!.trim().replace(/"/g, "");
      const valToken = parts[1]!.trim();

      const pMatch = valToken.match(/\$(\d+)/);
      if (pMatch && pMatch[1]) {
        const pIndex = parseInt(pMatch[1], 10) - 1;
        updates[col] = params[pIndex];
      }
    }

    // Filter matching rows
    const matchedRows = this.filterRows(sql, rows, params);
    for (const row of matchedRows) {
      Object.assign(row, updates);
    }

    return {
      rows: matchedRows as T[],
      rowCount: matchedRows.length,
    };
  }

  private handleDelete<T>(sql: string, params: any[]): QueryResult<T> {
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
      rows: matchedRows as T[],
      rowCount: matchedRows.length,
    };
  }

  private filterRows(sql: string, rows: any[], params: any[]): any[] {
    const whereMatch = sql.match(/WHERE (.+?)(?: ORDER BY| LIMIT| OFFSET| RETURNING|$)/is);
    if (!whereMatch || !whereMatch[1]) {
      return rows;
    }

    const whereClause = whereMatch[1].trim();
    return rows.filter((row) => this.matchesWhere(row, whereClause, params));
  }

  private matchesWhere(row: any, whereClause: string, params: any[]): boolean {
    const unwrap = (s: string): string => {
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

    // Support OR clauses
    if (whereClause.includes(" OR ")) {
      const orParts = whereClause.split(" OR ");
      return orParts.some((part) => this.matchesWhere(row, unwrap(part), params));
    }

    // Support AND clauses
    const andParts = whereClause.split(" AND ").map(unwrap);

    return andParts.every((cond) => {
      // 1. IS NULL / IS NOT NULL
      const isNullMatch = cond.match(/"?([a-zA-Z0-9_]+)"?\s+IS NULL/i);
      if (isNullMatch && isNullMatch[1]) {
        const col = isNullMatch[1];
        return row[col] === null || row[col] === undefined;
      }
      const isNotNullMatch = cond.match(/"?([a-zA-Z0-9_]+)"?\s+IS NOT NULL/i);
      if (isNotNullMatch && isNotNullMatch[1]) {
        const col = isNotNullMatch[1];
        return row[col] !== null && row[col] !== undefined;
      }

      // 2. IN / NOT IN
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

      // 3. ILIKE
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

      // 4. Comparison operators: =, <>, >, >=, <, <=
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

  async transaction<T>(callback: (txDriver: DatabaseDriver) => Promise<T>): Promise<T> {
    // Snapshot state for rollback safety
    const snapshotTables = new Map<string, any[]>();
    for (const [k, v] of this.tables.entries()) {
      snapshotTables.set(k, v.map((r) => ({ ...r })));
    }

    try {
      const result = await callback(this);
      return result;
    } catch (err) {
      // Rollback snapshot
      this.tables = snapshotTables;
      throw err;
    }
  }

  async close(): Promise<void> {
    this.tables.clear();
    this.schemas.clear();
  }
}
