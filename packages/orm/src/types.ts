/**
 * Core type definitions for @light-orm/core
 */

export type ColumnDataType = "string" | "number" | "boolean" | "timestamp" | "text" | "json";

export interface ColumnOptions<TType = any, TNullable extends boolean = false, THasDefault extends boolean = false, TAutoInc extends boolean = false> {
  dataType: ColumnDataType;
  nullable: TNullable;
  hasDefault: THasDefault;
  autoIncrement: TAutoInc;
  primaryKey: boolean;
  unique: boolean;
  defaultValue?: TType | "NOW()" | any;
}

export interface ColumnBuilder<TType, TNullable extends boolean = false, THasDefault extends boolean = false, TAutoInc extends boolean = false> {
  readonly _type: TType;
  readonly options: ColumnOptions<TType, TNullable, THasDefault, TAutoInc>;
  primaryKey(): ColumnBuilder<TType, false, THasDefault, TAutoInc>;
  autoIncrement(): ColumnBuilder<TType, false, true, true>;
  notNull(): ColumnBuilder<TType, false, THasDefault, TAutoInc>;
  nullable(): ColumnBuilder<TType, true, THasDefault, TAutoInc>;
  default(val: TType | "NOW()" | string | number | boolean): ColumnBuilder<TType, TNullable, true, TAutoInc>;
  unique(): ColumnBuilder<TType, TNullable, THasDefault, TAutoInc>;
}

export type AnyColumnBuilder = ColumnBuilder<any, boolean, boolean, boolean>;

export type ModelColumns = Record<string, AnyColumnBuilder>;

export interface ModelDefinition<TName extends string = string, TColumns extends ModelColumns = ModelColumns> {
  readonly tableName: TName;
  readonly columns: TColumns;
}

/**
 * Maps ColumnBuilder to actual runtime TypeScript type
 */
export type InferColumnType<T extends AnyColumnBuilder> = 
  T["options"]["nullable"] extends true
    ? T["_type"] | null
    : T["_type"];

/**
 * Infer the full record model representation returned from queries
 */
export type InferModel<T> = T extends ModelDefinition<any, infer TCols>
  ? { [K in keyof TCols]: InferColumnType<TCols[K]> }
  : T extends ModelColumns
  ? { [K in keyof T]: InferColumnType<T[K]> }
  : never;

/**
 * Filter keys that are optional in INSERT queries:
 * Either autoIncrement = true, or hasDefault = true, or nullable = true
 */
export type OptionalInsertKeys<TCols extends ModelColumns> = {
  [K in keyof TCols]: TCols[K]["options"]["autoIncrement"] extends true
    ? K
    : TCols[K]["options"]["hasDefault"] extends true
    ? K
    : TCols[K]["options"]["nullable"] extends true
    ? K
    : never;
}[keyof TCols];

export type RequiredInsertKeys<TCols extends ModelColumns> = Exclude<keyof TCols, OptionalInsertKeys<TCols>>;

/**
 * Infer the input object for db.model.create(...)
 */
export type InferInsertModel<T> = T extends ModelDefinition<any, infer TCols>
  ? { [K in RequiredInsertKeys<TCols>]: InferColumnType<TCols[K]> } &
    { [K in OptionalInsertKeys<TCols>]?: InferColumnType<TCols[K]> }
  : T extends ModelColumns
  ? { [K in RequiredInsertKeys<T>]: InferColumnType<T[K]> } &
    { [K in OptionalInsertKeys<T>]?: InferColumnType<T[K]> }
  : never;

/**
 * Infer update fields: all properties are optional
 */
export type InferUpdateModel<T> = Partial<InferModel<T>>;

/**
 * Comparison operators for where clauses
 */
export interface ComparisonOperators<TVal> {
  eq?: TVal;
  ne?: TVal;
  gt?: TVal;
  gte?: TVal;
  lt?: TVal;
  lte?: TVal;
  in?: TVal[];
  notIn?: TVal[];
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  isNull?: boolean;
}

/**
 * Where filter clause supporting exact values or operator objects
 */
export type WhereFieldCondition<TVal> = TVal | ComparisonOperators<NonNullable<TVal>>;

export type WhereClause<TModel> = {
  [K in keyof TModel]?: WhereFieldCondition<TModel[K]>;
} & {
  AND?: WhereClause<TModel>[];
  OR?: WhereClause<TModel>[];
};

export type OrderDirection = "asc" | "desc" | "ASC" | "DESC";

export type OrderByClause<TModel> = {
  [K in keyof TModel]?: OrderDirection;
};

export interface FindManyOptions<TModel> {
  where?: WhereClause<TModel>;
  orderBy?: OrderByClause<TModel>;
  limit?: number;
  offset?: number;
  select?: (keyof TModel)[];
}

export interface FindUniqueOptions<TModel> {
  where: WhereClause<TModel>;
  select?: (keyof TModel)[];
}

export interface UpdateOptions<TModel, TUpdate> {
  where: WhereClause<TModel>;
  data: TUpdate;
}

export interface DeleteOptions<TModel> {
  where: WhereClause<TModel>;
}

/**
 * Model repository API providing high-level CRUD operations
 */
export interface ModelRepository<TModel, TInsert, TUpdate> {
  readonly modelName: string;
  readonly tableName: string;

  findMany(options?: FindManyOptions<TModel>): Promise<TModel[]>;
  findFirst(options?: FindManyOptions<TModel>): Promise<TModel | null>;
  findUnique(options: FindUniqueOptions<TModel>): Promise<TModel | null>;
  create(data: TInsert): Promise<TModel>;
  createMany(data: TInsert[]): Promise<TModel[]>;
  update(options: UpdateOptions<TModel, TUpdate>): Promise<TModel>;
  updateMany(options: { where: WhereClause<TModel>; data: TUpdate }): Promise<number>;
  delete(options: DeleteOptions<TModel>): Promise<TModel | null>;
  deleteMany(options?: { where: WhereClause<TModel> }): Promise<number>;
  count(options?: { where?: WhereClause<TModel> }): Promise<number>;
}

/**
 * Telemetry query log event
 */
export interface QueryEvent {
  sql: string;
  params: any[];
  durationMs: number;
  timestamp: Date;
  rowCount: number;
  source?: string;
}

export type QueryListener = (event: QueryEvent) => void;
