import {
  ColumnBuilder,
  ColumnDataType,
  ColumnOptions,
  ModelColumns,
  ModelDefinition,
} from "./types.js";

class ColumnBuilderImpl<
  TType,
  TNullable extends boolean = false,
  THasDefault extends boolean = false,
  TAutoInc extends boolean = false
> implements ColumnBuilder<TType, TNullable, THasDefault, TAutoInc> {
  readonly _type!: TType;
  readonly options: ColumnOptions<TType, TNullable, THasDefault, TAutoInc>;

  constructor(options: ColumnOptions<TType, TNullable, THasDefault, TAutoInc>) {
    this.options = { ...options };
  }

  primaryKey(): ColumnBuilder<TType, false, THasDefault, TAutoInc> {
    return new ColumnBuilderImpl({
      ...this.options,
      primaryKey: true,
      nullable: false as false,
    });
  }

  autoIncrement(): ColumnBuilder<TType, false, true, true> {
    return new ColumnBuilderImpl({
      ...this.options,
      autoIncrement: true as true,
      hasDefault: true as true,
      nullable: false as false,
    });
  }

  notNull(): ColumnBuilder<TType, false, THasDefault, TAutoInc> {
    return new ColumnBuilderImpl({
      ...this.options,
      nullable: false as false,
    });
  }

  nullable(): ColumnBuilder<TType, true, THasDefault, TAutoInc> {
    return new ColumnBuilderImpl({
      ...this.options,
      nullable: true as true,
    });
  }

  default(val: TType | "NOW()" | string | number | boolean): ColumnBuilder<TType, TNullable, true, TAutoInc> {
    return new ColumnBuilderImpl({
      ...this.options,
      hasDefault: true as true,
      defaultValue: val,
    });
  }

  unique(): ColumnBuilder<TType, TNullable, THasDefault, TAutoInc> {
    return new ColumnBuilderImpl({
      ...this.options,
      unique: true,
    });
  }
}

function createColumn<TType>(dataType: ColumnDataType): ColumnBuilder<TType, false, false, false> {
  return new ColumnBuilderImpl<TType, false, false, false>({
    dataType,
    nullable: false,
    hasDefault: false,
    autoIncrement: false,
    primaryKey: false,
    unique: false,
  });
}

/**
 * Column definition builders
 */
export function string(): ColumnBuilder<string, false, false, false> {
  return createColumn<string>("string");
}

export function number(): ColumnBuilder<number, false, false, false> {
  return createColumn<number>("number");
}

export function boolean(): ColumnBuilder<boolean, false, false, false> {
  return createColumn<boolean>("boolean");
}

export function timestamp(): ColumnBuilder<Date, false, false, false> {
  return createColumn<Date>("timestamp");
}

export function text(): ColumnBuilder<string, false, false, false> {
  return createColumn<string>("text");
}

export function json<T = any>(): ColumnBuilder<T, false, false, false> {
  return createColumn<T>("json");
}

/**
 * Define a schema model with tableName and columns definition
 *
 * @example
 * const Todo = defineModel("todos", {
 *   id: number().primaryKey().autoIncrement(),
 *   title: string().notNull(),
 *   completed: boolean().default(false),
 * });
 */
export function defineModel<TName extends string, TCols extends ModelColumns>(
  tableName: TName,
  columns: TCols
): ModelDefinition<TName, TCols> {
  if (!tableName || typeof tableName !== "string") {
    throw new Error("Model must have a non-empty string tableName");
  }
  if (!columns || typeof columns !== "object" || Object.keys(columns).length === 0) {
    throw new Error(`Model '${tableName}' must define at least one column`);
  }

  return {
    tableName,
    columns,
  };
}
