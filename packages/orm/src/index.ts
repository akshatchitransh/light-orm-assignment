/**
 * @light-orm/core - Lightweight TypeScript ORM for serverless SQL databases
 */

// Core client and model definition
export { createClient, Client, ClientConfig, ModelRepositoryImpl } from "./client.js";
export {
  defineModel,
  string,
  number,
  boolean,
  timestamp,
  text,
  json,
} from "./schema.js";

// Query generation & execution
export { QueryBuilder, QueryCompiler, ParameterizedQuery } from "./query-builder.js";

// Drivers
export { DatabaseDriver, QueryResult } from "./driver/types.js";
export { PostgresDriver, PostgresDriverConfig } from "./driver/postgres.js";
export { MemoryPostgresDriver } from "./driver/memory.js";

// Errors
export {
  OrmError,
  NotFoundError,
  ValidationError,
  QueryError,
  ConnectionError,
} from "./errors.js";

// Types
export type {
  ColumnDataType,
  ColumnOptions,
  ColumnBuilder,
  AnyColumnBuilder,
  ModelColumns,
  ModelDefinition,
  InferColumnType,
  InferModel,
  InferInsertModel,
  InferUpdateModel,
  ComparisonOperators,
  WhereClause,
  WhereFieldCondition,
  OrderByClause,
  OrderDirection,
  FindManyOptions,
  FindUniqueOptions,
  UpdateOptions,
  DeleteOptions,
  QueryEvent,
  QueryListener,
} from "./types.js";
