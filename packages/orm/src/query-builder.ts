import {
  ComparisonOperators,
  FindManyOptions,
  ModelColumns,
  ModelDefinition,
  OrderByClause,
  WhereClause,
  WhereFieldCondition,
} from "./types.js";
import { ValidationError } from "./errors.js";

export interface ParameterizedQuery {
  sql: string;
  params: any[];
}

export class QueryCompiler {
  private paramIndex = 1;
  private params: any[] = [];

  constructor(initialParamIndex = 1) {
    this.paramIndex = initialParamIndex;
  }

  addParam(value: any): string {
    const placeholder = `$${this.paramIndex++}`;
    this.params.push(value);
    return placeholder;
  }

  getParams(): any[] {
    return [...this.params];
  }

  escapeIdentifier(identifier: string): string {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new ValidationError(`Invalid SQL identifier: ${identifier}`);
    }
    return `"${identifier}"`;
  }

  compileWhere<TModel>(where?: WhereClause<TModel>): string {
    const conditions = this.compileConditions(where);
    return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  }

  compileConditions<TModel>(where?: WhereClause<TModel>): string[] {
    if (!where || Object.keys(where).length === 0) {
      return [];
    }

    const conditions: string[] = [];

    for (const [key, value] of Object.entries(where)) {
      if (key === "AND" && Array.isArray(value)) {
        const nested = value
          .flatMap((clause) => this.compileConditions(clause))
          .filter(Boolean);
        if (nested.length > 0) {
          conditions.push(`(${nested.join(" AND ")})`);
        }
        continue;
      }

      if (key === "OR" && Array.isArray(value)) {
        const nested = value
          .map((clause) => {
            const inner = this.compileConditions(clause);
            return inner.length > 1 ? `(${inner.join(" AND ")})` : inner[0];
          })
          .filter(Boolean);
        if (nested.length > 0) {
          conditions.push(`(${nested.join(" OR ")})`);
        }
        continue;
      }

      const fieldCondition = this.compileFieldCondition(key, value as WhereFieldCondition<any>);
      if (fieldCondition) {
        conditions.push(fieldCondition);
      }
    }

    return conditions;
  }

  private compileFieldCondition(column: string, condition: WhereFieldCondition<any>): string {
    const colName = this.escapeIdentifier(column);

    if (condition === null) {
      return `${colName} IS NULL`;
    }

    if (typeof condition !== "object" || condition instanceof Date) {
      const p = this.addParam(condition);
      return `${colName} = ${p}`;
    }

    // Condition is an operator object
    const opConditions: string[] = [];
    const ops = condition as ComparisonOperators<any>;

    if (ops.eq !== undefined) {
      if (ops.eq === null) {
        opConditions.push(`${colName} IS NULL`);
      } else {
        opConditions.push(`${colName} = ${this.addParam(ops.eq)}`);
      }
    }

    if (ops.ne !== undefined) {
      if (ops.ne === null) {
        opConditions.push(`${colName} IS NOT NULL`);
      } else {
        opConditions.push(`${colName} <> ${this.addParam(ops.ne)}`);
      }
    }

    if (ops.gt !== undefined) {
      opConditions.push(`${colName} > ${this.addParam(ops.gt)}`);
    }

    if (ops.gte !== undefined) {
      opConditions.push(`${colName} >= ${this.addParam(ops.gte)}`);
    }

    if (ops.lt !== undefined) {
      opConditions.push(`${colName} < ${this.addParam(ops.lt)}`);
    }

    if (ops.lte !== undefined) {
      opConditions.push(`${colName} <= ${this.addParam(ops.lte)}`);
    }

    if (ops.in !== undefined && Array.isArray(ops.in)) {
      if (ops.in.length === 0) {
        // Empty IN is always false
        opConditions.push("1 = 0");
      } else {
        const placeholders = ops.in.map((item) => this.addParam(item)).join(", ");
        opConditions.push(`${colName} IN (${placeholders})`);
      }
    }

    if (ops.notIn !== undefined && Array.isArray(ops.notIn)) {
      if (ops.notIn.length === 0) {
        // Empty NOT IN is always true
        opConditions.push("1 = 1");
      } else {
        const placeholders = ops.notIn.map((item) => this.addParam(item)).join(", ");
        opConditions.push(`${colName} NOT IN (${placeholders})`);
      }
    }

    if (ops.contains !== undefined) {
      opConditions.push(`${colName} ILIKE ${this.addParam(`%${ops.contains}%`)}`);
    }

    if (ops.startsWith !== undefined) {
      opConditions.push(`${colName} ILIKE ${this.addParam(`${ops.startsWith}%`)}`);
    }

    if (ops.endsWith !== undefined) {
      opConditions.push(`${colName} ILIKE ${this.addParam(`%${ops.endsWith}`)}`);
    }

    if (ops.isNull !== undefined) {
      opConditions.push(ops.isNull ? `${colName} IS NULL` : `${colName} IS NOT NULL`);
    }

    return opConditions.join(" AND ");
  }

  compileOrderBy<TModel>(orderBy?: OrderByClause<TModel>): string {
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
}

/**
 * Builds parameterized SQL queries for Postgres/Serverless SQL
 */
export class QueryBuilder {
  static select<TModel>(
    tableName: string,
    options?: FindManyOptions<TModel>
  ): ParameterizedQuery {
    const compiler = new QueryCompiler();
    const table = compiler.escapeIdentifier(tableName);

    let cols = "*";
    if (options?.select && options.select.length > 0) {
      cols = options.select
        .map((c) => compiler.escapeIdentifier(String(c)))
        .join(", ");
    }

    const parts: string[] = [`SELECT ${cols} FROM ${table}`];

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
      params: compiler.getParams(),
    };
  }

  static insert(tableName: string, data: Record<string, any>): ParameterizedQuery {
    const compiler = new QueryCompiler();
    const table = compiler.escapeIdentifier(tableName);

    const keys = Object.keys(data).filter((k) => data[k] !== undefined);
    if (keys.length === 0) {
      return {
        sql: `INSERT INTO ${table} DEFAULT VALUES RETURNING *`,
        params: [],
      };
    }

    const columns = keys.map((k) => compiler.escapeIdentifier(k)).join(", ");
    const placeholders = keys
      .map((k) => compiler.addParam(data[k]))
      .join(", ");

    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;

    return {
      sql,
      params: compiler.getParams(),
    };
  }

  static insertMany(tableName: string, records: Record<string, any>[]): ParameterizedQuery {
    if (records.length === 0) {
      throw new ValidationError("Cannot insert empty records array");
    }

    const compiler = new QueryCompiler();
    const table = compiler.escapeIdentifier(tableName);

    // Get union of all keys across records
    const allKeys = Array.from(
      new Set(records.flatMap((r) => Object.keys(r).filter((k) => r[k] !== undefined)))
    );

    if (allKeys.length === 0) {
      throw new ValidationError("Records have no valid column values to insert");
    }

    const columns = allKeys.map((k) => compiler.escapeIdentifier(k)).join(", ");
    const rowPlaceholders: string[] = [];

    for (const record of records) {
      const row = allKeys
        .map((key) => compiler.addParam(record[key] !== undefined ? record[key] : null))
        .join(", ");
      rowPlaceholders.push(`(${row})`);
    }

    const sql = `INSERT INTO ${table} (${columns}) VALUES ${rowPlaceholders.join(", ")} RETURNING *`;

    return {
      sql,
      params: compiler.getParams(),
    };
  }

  static update<TModel>(
    tableName: string,
    where: WhereClause<TModel>,
    data: Record<string, any>
  ): ParameterizedQuery {
    const compiler = new QueryCompiler();
    const table = compiler.escapeIdentifier(tableName);

    const keys = Object.keys(data).filter((k) => data[k] !== undefined);
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
      params: compiler.getParams(),
    };
  }

  static delete<TModel>(tableName: string, where: WhereClause<TModel>): ParameterizedQuery {
    const compiler = new QueryCompiler();
    const table = compiler.escapeIdentifier(tableName);

    const whereSql = compiler.compileWhere(where);
    if (!whereSql) {
      throw new ValidationError("Delete requires a non-empty where condition to avoid accidental table truncates");
    }

    const sql = `DELETE FROM ${table} ${whereSql} RETURNING *`;

    return {
      sql,
      params: compiler.getParams(),
    };
  }

  static count<TModel>(tableName: string, where?: WhereClause<TModel>): ParameterizedQuery {
    const compiler = new QueryCompiler();
    const table = compiler.escapeIdentifier(tableName);

    const parts: string[] = [`SELECT COUNT(*)::int as count FROM ${table}`];
    if (where) {
      const whereSql = compiler.compileWhere(where);
      if (whereSql) parts.push(whereSql);
    }

    return {
      sql: parts.join(" "),
      params: compiler.getParams(),
    };
  }

  /**
   * Generates PostgreSQL DDL for table creation based on model definition
   */
  static createTableDdl(model: ModelDefinition<any, ModelColumns>): string {
    const compiler = new QueryCompiler();
    const tableName = compiler.escapeIdentifier(model.tableName);

    const columnDefs: string[] = [];

    for (const [colName, colBuilder] of Object.entries(model.columns)) {
      const col = compiler.escapeIdentifier(colName);
      const opts = colBuilder.options;

      let sqlType: string;

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

      const clauses: string[] = [col, sqlType];

      if (opts.primaryKey) {
        clauses.push("PRIMARY KEY");
      } else {
        if (!opts.nullable) {
          clauses.push("NOT NULL");
        }
        if (opts.unique) {
          clauses.push("UNIQUE");
        }
        if (opts.hasDefault && opts.defaultValue !== undefined) {
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

    return `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${columnDefs.join(",\n  ")}\n);`;
  }
}
