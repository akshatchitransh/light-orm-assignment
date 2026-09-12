import {
  DeleteOptions,
  FindManyOptions,
  FindUniqueOptions,
  InferInsertModel,
  InferModel,
  InferUpdateModel,
  ModelDefinition,
  ModelRepository,
  QueryEvent,
  QueryListener,
  UpdateOptions,
  WhereClause,
} from "./types.js";
import { DatabaseDriver, QueryResult } from "./driver/types.js";
import { PostgresDriver } from "./driver/postgres.js";
import { MemoryPostgresDriver } from "./driver/memory.js";
import { QueryBuilder } from "./query-builder.js";
import { NotFoundError, ValidationError } from "./errors.js";

export interface ClientConfig<TSchema extends Record<string, ModelDefinition<any, any>>> {
  connectionString?: string;
  driver?: DatabaseDriver;
  schema: TSchema;
  onQuery?: QueryListener;
  logging?: boolean;
}

export class ModelRepositoryImpl<
  TName extends string,
  TModel = any,
  TInsert = any,
  TUpdate = any
> implements ModelRepository<TModel, TInsert, TUpdate> {
  readonly modelName: string;
  readonly tableName: string;

  constructor(
    modelName: string,
    private readonly modelDef: ModelDefinition<TName, any>,
    private readonly executeQuery: <R = any>(sql: string, params?: any[]) => Promise<QueryResult<R>>
  ) {
    this.modelName = modelName;
    this.tableName = modelDef.tableName;
  }

  async findMany(options?: FindManyOptions<TModel>): Promise<TModel[]> {
    const q = QueryBuilder.select<TModel>(this.tableName, options);
    const res = await this.executeQuery<TModel>(q.sql, q.params);
    return res.rows;
  }

  async findFirst(options?: FindManyOptions<TModel>): Promise<TModel | null> {
    const q = QueryBuilder.select<TModel>(this.tableName, {
      ...options,
      limit: 1,
    });
    const res = await this.executeQuery<TModel>(q.sql, q.params);
    return res.rows[0] ?? null;
  }

  async findUnique(options: FindUniqueOptions<TModel>): Promise<TModel | null> {
    if (!options || !options.where || Object.keys(options.where).length === 0) {
      throw new ValidationError("findUnique requires a specific 'where' filter");
    }
    const q = QueryBuilder.select<TModel>(this.tableName, {
      where: options.where,
      select: options.select,
      limit: 1,
    });
    const res = await this.executeQuery<TModel>(q.sql, q.params);
    return res.rows[0] ?? null;
  }

  private applyDefaults(data: any): any {
    const record = { ...data };
    for (const [colName, colBuilder] of Object.entries(this.modelDef.columns) as [string, any][]) {
      if (record[colName] === undefined && colBuilder?.options?.hasDefault) {
        const defVal = colBuilder.options.defaultValue;
        if (defVal === "NOW()" || defVal === "CURRENT_TIMESTAMP") {
          record[colName] = new Date();
        } else if (defVal !== undefined) {
          record[colName] = defVal;
        }
      }
    }
    return record;
  }

  async create(data: TInsert): Promise<TModel> {
    if (!data || typeof data !== "object") {
      throw new ValidationError("create requires a valid data object");
    }
    const withDefaults = this.applyDefaults(data);
    const q = QueryBuilder.insert(this.tableName, withDefaults as Record<string, any>);
    const res = await this.executeQuery<TModel>(q.sql, q.params);
    if (!res.rows[0]) {
      throw new Error(`Failed to create record in ${this.modelName}`);
    }
    return res.rows[0];
  }

  async createMany(data: TInsert[]): Promise<TModel[]> {
    if (!Array.isArray(data) || data.length === 0) {
      throw new ValidationError("createMany requires a non-empty array of records");
    }
    const withDefaults = data.map((d) => this.applyDefaults(d));
    const q = QueryBuilder.insertMany(this.tableName, withDefaults as Record<string, any>[]);
    const res = await this.executeQuery<TModel>(q.sql, q.params);
    return res.rows;
  }

  async update(options: UpdateOptions<TModel, TUpdate>): Promise<TModel> {
    if (!options || !options.where) {
      throw new ValidationError("update requires a 'where' filter");
    }
    if (!options.data || Object.keys(options.data).length === 0) {
      throw new ValidationError("update requires non-empty 'data'");
    }

    const q = QueryBuilder.update(this.tableName, options.where, options.data as Record<string, any>);
    const res = await this.executeQuery<TModel>(q.sql, q.params);
    if (!res.rows[0]) {
      throw new NotFoundError(this.modelName, JSON.stringify(options.where));
    }
    return res.rows[0];
  }

  async updateMany(options: { where: WhereClause<TModel>; data: TUpdate }): Promise<number> {
    if (!options || !options.where) {
      throw new ValidationError("updateMany requires a 'where' filter");
    }
    const q = QueryBuilder.update(this.tableName, options.where, options.data as Record<string, any>);
    const res = await this.executeQuery(q.sql, q.params);
    return res.rowCount;
  }

  async delete(options: DeleteOptions<TModel>): Promise<TModel | null> {
    if (!options || !options.where) {
      throw new ValidationError("delete requires a 'where' filter");
    }
    const q = QueryBuilder.delete(this.tableName, options.where);
    const res = await this.executeQuery<TModel>(q.sql, q.params);
    return res.rows[0] ?? null;
  }

  async deleteMany(options?: { where: WhereClause<TModel> }): Promise<number> {
    const where = options?.where ?? ({} as WhereClause<TModel>);
    if (Object.keys(where).length === 0) {
      throw new ValidationError("deleteMany requires a non-empty 'where' condition for safety");
    }
    const q = QueryBuilder.delete(this.tableName, where);
    const res = await this.executeQuery(q.sql, q.params);
    return res.rowCount;
  }

  async count(options?: { where?: WhereClause<TModel> }): Promise<number> {
    const q = QueryBuilder.count(this.tableName, options?.where);
    const res = await this.executeQuery<{ count: number | string }>(q.sql, q.params);
    const countVal = res.rows[0]?.count ?? 0;
    return typeof countVal === "number" ? countVal : parseInt(countVal, 10);
  }
}

/**
 * Mapped type for client models
 */
export type ClientModels<TSchema extends Record<string, ModelDefinition<any, any>>> = {
  [K in keyof TSchema]: ModelRepository<
    InferModel<TSchema[K]>,
    InferInsertModel<TSchema[K]>,
    InferUpdateModel<TSchema[K]>
  >;
};

export interface BaseClientMethods<TSchema extends Record<string, ModelDefinition<any, any>>> {
  readonly driver: DatabaseDriver;
  readonly schema: TSchema;
  raw<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  syncSchema(): Promise<void>;
  transaction<T>(callback: (txClient: Client<TSchema>) => Promise<T>): Promise<T>;
  onQuery(listener: QueryListener): () => void;
  close(): Promise<void>;
}

export type Client<TSchema extends Record<string, ModelDefinition<any, any>>> =
  ClientModels<TSchema> & BaseClientMethods<TSchema>;

class ClientImpl<TSchema extends Record<string, ModelDefinition<any, any>>>
  implements BaseClientMethods<TSchema> {
  readonly driver: DatabaseDriver;
  readonly schema: TSchema;
  private readonly listeners: QueryListener[] = [];
  private readonly logging: boolean;

  constructor(config: ClientConfig<TSchema>, driverOverride?: DatabaseDriver) {
    this.schema = config.schema;
    this.logging = !!config.logging;

    if (driverOverride) {
      this.driver = driverOverride;
    } else if (config.driver) {
      this.driver = config.driver;
    } else {
      const connStr = config.connectionString || (typeof process !== "undefined" ? process.env?.DATABASE_URL : undefined);
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

  private async executeWithTelemetry<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.driver.query<T>(sql, params);
      const durationMs = Date.now() - start;

      const event: QueryEvent = {
        sql,
        params,
        durationMs,
        timestamp: new Date(),
        rowCount: result.rowCount,
        source: this.driver.driverName,
      };

      if (this.logging) {
        console.log(`[LightORM] (${durationMs}ms) ${sql} -- [${params.join(", ")}]`);
      }

      for (const listener of this.listeners) {
        try {
          listener(event);
        } catch {
          // ignore listener errors
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

  async raw<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    return this.executeWithTelemetry<T>(sql, params);
  }

  async syncSchema(): Promise<void> {
    for (const [, modelDef] of Object.entries(this.schema)) {
      const ddl = QueryBuilder.createTableDdl(modelDef);
      await this.executeWithTelemetry(ddl);
    }
  }

  async transaction<T>(callback: (txClient: Client<TSchema>) => Promise<T>): Promise<T> {
    return this.driver.transaction(async (txDriver) => {
      const txClient = createClientInternal(
        {
          schema: this.schema,
          logging: this.logging,
        },
        txDriver,
        this.listeners
      );
      return callback(txClient);
    });
  }

  onQuery(listener: QueryListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) {
        this.listeners.splice(idx, 1);
      }
    };
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  _bindModels(): Record<string, ModelRepository<any, any, any>> {
    const repos: Record<string, ModelRepository<any, any, any>> = {};
    for (const [modelKey, modelDef] of Object.entries(this.schema)) {
      repos[modelKey] = new ModelRepositoryImpl(
        modelKey,
        modelDef,
        (sql, params) => this.executeWithTelemetry(sql, params)
      );
    }
    return repos;
  }
}

function createClientInternal<TSchema extends Record<string, ModelDefinition<any, any>>>(
  config: ClientConfig<TSchema>,
  driverOverride?: DatabaseDriver,
  inheritedListeners?: QueryListener[]
): Client<TSchema> {
  const clientImpl = new ClientImpl(config, driverOverride);
  if (inheritedListeners) {
    for (const l of inheritedListeners) {
      clientImpl.onQuery(l);
    }
  }

  const modelRepos = clientImpl._bindModels();

  // Create a Proxy or merge to allow db.todo.findMany directly
  return new Proxy(clientImpl as any, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && prop in modelRepos) {
        return modelRepos[prop];
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as Client<TSchema>;
}

/**
 * Initialize a lightweight ORM client
 *
 * @example
 * const db = createClient({
 *   connectionString: process.env.DATABASE_URL,
 *   schema: { todo: TodoModel },
 * });
 *
 * const todos = await db.todo.findMany({ where: { completed: false } });
 */
export function createClient<TSchema extends Record<string, ModelDefinition<any, any>>>(
  config: ClientConfig<TSchema>
): Client<TSchema> {
  return createClientInternal(config);
}
