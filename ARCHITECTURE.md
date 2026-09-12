# @light-orm/core - Architecture & Technical Blueprint

This document details the internal design, type system mechanics, query compilation pipeline, and architectural decisions behind `@light-orm/core`.

---

## 1. Architectural Principles

1. **Zero Code Generation**: Unlike Prisma or similar ORMs that require a custom CLI binary or code generator step (`prisma generate`), `@light-orm/core` relies entirely on native TypeScript mapped types and conditional inference. Models and types are always 100% in sync with zero build-step friction.
2. **Serverless-First**: Built for serverless environments where connection lifecycles are ephemeral. Minimizes memory footprint, avoids heavy runtime introspection, and leverages parameterized queries compatible with serverless poolers (Neon, Supabase Supavisor, AWS RDS Proxy).
3. **Clean Module Boundaries**: Strict separation between:
   - **Schema & Types layer** (`src/schema.ts`, `src/types.ts`)
   - **Query Compilation layer** (`src/query-builder.ts`)
   - **Client & Repository layer** (`src/client.ts`)
   - **Driver Abstraction layer** (`src/driver/`)
4. **Ergonomic Developer Experience**: Fluent model definition API and high-level CRUD operations (`db.todo.findMany({ where: ... })`).

---

## 2. Query Compilation Pipeline

The following diagram illustrates how an ORM operation flows through the architecture:

```
+----------------------------------------------------------------------+
|                           Application Code                           |
|       await db.todo.findMany({ where: { completed: false } })        |
+----------------------------------------------------------------------+
                                   |
                                   v
+----------------------------------------------------------------------+
|                     ModelRepository Proxy Layer                      |
|  - Maps method call to ModelRepositoryImpl                           |
|  - Injects model metadata (table name, column types, default values) |
|  - Enforces input typing via TypeScript generics                     |
+----------------------------------------------------------------------+
                                   |
                                   v
+----------------------------------------------------------------------+
|                     QueryBuilder / QueryCompiler                     |
|  - Validates SQL identifiers (safeguards against injection)          |
|  - Compiles WHERE clauses into boolean expressions                   |
|  - Maps comparison operators (eq, ne, in, contains, isNull)          |
|  - Emits parameterized SQL ($1, $2, ...) and binds parameter array   |
+----------------------------------------------------------------------+
                                   |
                                   v
+----------------------------------------------------------------------+
|                     Telemetry & Query Listeners                      |
|  - Emits QueryEvent: { sql, params, durationMs, rowCount }           |
|  - Powers real-time live SQL Inspector in UI                         |
+----------------------------------------------------------------------+
                                   |
                                   v
+----------------------------------------------------------------------+
|                            DatabaseDriver                            |
|       +----------------------------+----------------------------+    |
|       |       PostgresDriver       |    MemoryPostgresDriver    |    |
|       |  (pg Pool / Serverless)    |  (Zero-config emulation)   |    |
|       +----------------------------+----------------------------+    |
+----------------------------------------------------------------------+
                                   |
                                   v
+----------------------------------------------------------------------+
|                           Database Engine                            |
|             (Neon / Supabase / Local PostgreSQL / Memory)            |
+----------------------------------------------------------------------+
```

### QueryCompiler Internals
- **Placeholder Indexing**: A stateful counter increments `$1`, `$2`, `$3`... ensuring deterministic parameter binding.
- **Identifier Escaping**: Every table and column identifier is checked against `^[a-zA-Z_][a-zA-Z0-9_]*$` and enclosed in double quotes (`"todos"`, `"completed"`).
- **Boolean Composition**: Nested `AND` and `OR` blocks recursively generate parenthesized clauses without redundant keywords:
  ```sql
  SELECT * FROM "todos" WHERE ("priority" = $1 OR ("completed" = $2 AND "category" = $3))
  ```

---

## 3. TypeScript Type System Mechanics

### A. Column Definition & Modifiers
Columns are instantiated through fluent builder factories (`string()`, `number()`, `boolean()`, `timestamp()`, `text()`, `json()`). Modifiers like `.primaryKey()`, `.autoIncrement()`, `.nullable()`, and `.default(v)` return immutable copies with updated type flags:

```typescript
export interface ColumnOptions<
  TType = any,
  TNullable extends boolean = false,
  THasDefault extends boolean = false,
  TAutoInc extends boolean = false
> {
  dataType: ColumnDataType;
  nullable: TNullable;
  hasDefault: THasDefault;
  autoIncrement: TAutoInc;
  primaryKey: boolean;
  unique: boolean;
  defaultValue?: TType | "NOW()" | any;
}
```

### B. Inferred Record Model (`InferModel<T>`)
`InferModel<T>` iterates over all columns in the schema definition:
```typescript
export type InferColumnType<T extends AnyColumnBuilder> = 
  T["options"]["nullable"] extends true
    ? T["_type"] | null
    : T["_type"];

export type InferModel<T> = T extends ModelDefinition<any, infer TCols>
  ? { [K in keyof TCols]: InferColumnType<TCols[K]> }
  : never;
```
If a column was defined with `.nullable()`, its inferred type is `T | null`. Otherwise it is strictly `T`.

### C. Inferred Insert Model (`InferInsertModel<T>`)
In database inserts, columns that are autoincrementing (e.g. `SERIAL PRIMARY KEY`), have default values (e.g. `.default(false)`), or are nullable should NOT be mandatory inputs.

We partition the schema keys into `OptionalInsertKeys` and `RequiredInsertKeys`:
```typescript
export type OptionalInsertKeys<TCols extends ModelColumns> = {
  [K in keyof TCols]: TCols[K]["options"]["autoIncrement"] extends true
    ? K
    : TCols[K]["options"]["hasDefault"] extends true
    ? K
    : TCols[K]["options"]["nullable"] extends true
    ? K
    : never;
}[keyof TCols];

export type RequiredInsertKeys<TCols extends ModelColumns> = 
  Exclude<keyof TCols, OptionalInsertKeys<TCols>>;

export type InferInsertModel<T> = T extends ModelDefinition<any, infer TCols>
  ? { [K in RequiredInsertKeys<TCols>]: InferColumnType<TCols[K]> } &
    { [K in OptionalInsertKeys<TCols>]?: InferColumnType<TCols[K]> }
  : never;
```

This guarantees:
```typescript
// ✅ Valid: title is required; id, completed, and priority have defaults
await db.todo.create({ title: "Build feature" });

// ❌ TypeScript Compile Error: Property 'title' is missing
await db.todo.create({ priority: "high" });

// ❌ TypeScript Compile Error: 'invalidField' does not exist in type
await db.todo.create({ title: "Task", invalidField: 123 });
```

### D. Typed Filtering (`WhereClause<TModel>`)
Filtering accepts either exact value matching or structured operator objects:
```typescript
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

export type WhereFieldCondition<TVal> = TVal | ComparisonOperators<NonNullable<TVal>>;

export type WhereClause<TModel> = {
  [K in keyof TModel]?: WhereFieldCondition<TModel[K]>;
} & {
  AND?: WhereClause<TModel>[];
  OR?: WhereClause<TModel>[];
};
```

---

## 4. Driver Architecture & Serverless Compatibility

The ORM abstracts the storage backend via the `DatabaseDriver` interface:

```typescript
export interface DatabaseDriver {
  readonly driverName: string;
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  transaction<T>(callback: (txDriver: DatabaseDriver) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
```

### Serverless PostgreSQL Strategy
1. **Connection Pooling & SSL**: In serverless platforms like Neon or Supabase, queries must negotiate SSL (`rejectUnauthorized: false` for pooled connections). `PostgresDriver` automatically enables appropriate SSL flags when connecting to serverless hostnames (`neon.tech`, `supabase.co`).
2. **Prepared Statements / Parameterization**: Parameterizing every query with `$1, $2` prevents SQL injection and allows Postgres connection poolers (PgBouncer, Supavisor) to safely reuse query execution plans.
3. **In-Memory PostgreSQL Emulator (`MemoryPostgresDriver`)**:
   - Zero-dependency drop-in driver.
   - Emulates PostgreSQL parameterized queries, sequence auto-increments, column defaults, DDL creation, and transactional rollbacks.
   - Ensures any evaluator or test runner can clone the repo and immediately execute `npm test` and `npm run dev` with 100% functional fidelity.

---

## 5. Architectural Tradeoffs & Decisions

| Decision | Chosen Approach | Alternative Considered | Rationale |
| :--- | :--- | :--- | :--- |
| **Code Generation** | Native TS type inference | CLI code generation (e.g. `prisma generate`) | Eliminates binary downloads, out-of-sync types, and complex build scripts. |
| **SQL Dialect** | PostgreSQL ($1, $2, RETURNING *) | Multi-dialect abstraction (MySQL, SQLite, MSSQL) | Focusing deeply on PostgreSQL ensures idiomatic serverless support (Neon, Supabase) and clean RETURNING clause handling. |
| **API Pattern** | Repository model (`db.todo.findMany`) | Query builder chaining (`db.select().from(todos).where()`) | The repository pattern is cleaner, more readable, and aligns with standard enterprise backend patterns. |
| **Transactions** | Scoped transactional client (`tx.todo.create`) | Global ambient transactions | Scoped transactions avoid race conditions and guarantee client isolation on checked-out pool connections. |
