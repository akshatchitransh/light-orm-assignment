import pg from "pg";
import { DatabaseDriver, QueryResult } from "./types.js";
import { ConnectionError, QueryError } from "../errors.js";

const { Pool } = pg;

export interface PostgresDriverConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | object;
  max?: number;
  idleTimeoutMillis?: number;
}

export class PostgresDriver implements DatabaseDriver {
  readonly driverName = "postgres";
  private pool: pg.Pool;

  constructor(config: PostgresDriverConfig | string) {
    try {
      if (typeof config === "string") {
        this.pool = new Pool({
          connectionString: config,
          ssl: config.includes("neon.tech") || config.includes("supabase.co")
            ? { rejectUnauthorized: false }
            : undefined,
        });
      } else {
        this.pool = new Pool(config);
      }
    } catch (err) {
      throw new ConnectionError("Failed to initialize PostgreSQL pool", err);
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      const res = await this.pool.query(sql, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount ?? res.rows.length,
      };
    } catch (err: any) {
      throw new QueryError(
        `Database query failed: ${err.message}`,
        sql,
        params,
        err
      );
    }
  }

  async transaction<T>(callback: (txDriver: DatabaseDriver) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      
      const txDriver: DatabaseDriver = {
        driverName: "postgres:transaction",
        query: async <R = any>(sql: string, params?: any[]): Promise<QueryResult<R>> => {
          try {
            const res = await client.query(sql, params);
            return {
              rows: res.rows as R[],
              rowCount: res.rowCount ?? res.rows.length,
            };
          } catch (err: any) {
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
          // No-op inside transaction; client is managed by outer transaction block
        },
      };

      const result = await callback(txDriver);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback errors if already closed
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
