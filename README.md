# @light-orm/core & Todo Showcase Studio

> A lightweight, zero-code-generation, fully type-safe TypeScript ORM built specifically for serverless PostgreSQL databases (Neon, Supabase, AWS Aurora, local Postgres) with a modern showcase Todo application.

---

## Table of Contents
- [Highlights](#highlights)
- [Monorepo Architecture](#monorepo-architecture)
- [Quick Start](#quick-start)
- [Database Configuration](#database-configuration)
- [ORM Developer Experience & API Guide](#orm-developer-experience--api-guide)
  - [1. Fluent Schema Definition](#1-fluent-schema-definition)
  - [2. Zero-Codegen Type Inference](#2-zero-codegen-type-inference)
  - [3. Client Initialization & Repositories](#3-client-initialization--repositories)
  - [4. Query Filtering & Advanced Operators](#4-query-filtering--advanced-operators)
  - [5. Transactions (Bonus)](#5-transactions-bonus)
  - [6. Automatic Schema DDL Sync](#6-automatic-schema-ddl-sync)
- [Todo Showcase Application](#todo-showcase-application)
- [Query Pipeline & Architecture](#query-pipeline--architecture)
- [TypeScript Design & Tradeoffs](#typescript-design--tradeoffs)
- [Known Limitations & Roadmap](#known-limitations--roadmap)
- [Time Spent on Assignment](#time-spent-on-assignment)
- [AI Tool Disclosure](#ai-tool-disclosure)

---

## Highlights

- **⚡ Serverless SQL Native**: Employs parameterized queries (`$1`, `$2`) compatible with serverless connection pooling (Neon, Supabase, AWS Aurora Serverless) with zero cold-start overhead.
- **🛡️ 100% Compile-Time Type Safety**: Full inference without build-time code generation. Typo in a field name or invalid filter value produces immediate TypeScript errors.
- **✨ Ergonomic Developer API**: High-level repository pattern (`db.todo.findMany({ where: ... })`) without boilerplate.
- **🔌 Zero-Config Instant Evaluation**: Built-in high-fidelity in-memory PostgreSQL emulator ensures `npm test` and `npm run dev` work **instantly out of the box** without requiring external cloud credentials upfront.
- **🔍 Real-Time SQL Query Inspector**: Interactive UI panel displaying parameterized SQL, bound values, and execution timings for every ORM invocation.

---

## Monorepo Architecture

This project is built as an npm workspace monorepo:

```
gem/
├── package.json                   # Root workspace manifest (npm workspaces)
├── tsconfig.base.json             # Shared strict TypeScript configuration
├── packages/
│   └── orm/                       # Reusable npm package: @light-orm/core
│       ├── package.json           # Package exports (CJS, ESM, DTS)
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts           # Public API exports
│       │   ├── schema.ts          # defineModel, column builders
│       │   ├── types.ts           # TypeScript type inference engine
│       │   ├── query-builder.ts   # AST to parameterized SQL compiler
│       │   ├── client.ts          # createClient & ModelRepository proxies
│       │   ├── errors.ts          # Structured error classes
│       │   └── driver/
│       │       ├── types.ts       # DatabaseDriver interface
│       │       ├── postgres.ts    # Serverless/standard PostgreSQL pool driver
│       │       └── memory.ts      # Zero-config in-memory PostgreSQL emulator
│       └── test/
│           ├── schema.test.ts     # Schema definition tests
│           ├── query-builder.test.ts # SQL compiler & parameterization tests
│           └── client.test.ts     # CRUD, where filters, transactions, telemetry
├── apps/
│   └── todo-app/                  # Showcase Todo Application
│       ├── package.json           # Depends on "@light-orm/core": "*"
│       ├── vite.config.ts         # Vite dev server & API reverse proxy
│       └── src/
│           ├── server/            # Express REST API consuming @light-orm/core
│           │   ├── db.ts          # Schema definition & client initialization
│           │   ├── api.ts         # Typed REST endpoints
│           │   └── index.ts       # Backend HTTP server
│           └── client/            # Modern React UI
│               ├── main.tsx
│               ├── App.tsx
│               ├── styles/index.css # Dark glassmorphic styling
│               └── components/    # StatsBar, TodoItem, FilterBar, SqlInspector
├── README.md                      # Comprehensive documentation
└── ARCHITECTURE.md                # Deep-dive architectural blueprint
```

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Test Suite
Run the comprehensive Vitest test suite for `@light-orm/core`:
```bash
npm test
```

### 3. Build ORM Package
```bash
npm run build
```

### 4. Start the Todo Application
```bash
npm run dev
```
- **Frontend UI**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3001](http://localhost:3001)

---

## Database Configuration

The ORM supports seamless switching between local emulation and cloud serverless PostgreSQL databases via the `DATABASE_URL` environment variable.

### Option A: Instant Zero-Config (Default)
If no `DATABASE_URL` is provided, `@light-orm/core` automatically runs on its built-in in-memory PostgreSQL emulator. You can immediately create, filter, update, delete, and test with zero configuration.

### Option B: Serverless PostgreSQL (Neon / Supabase / Local)
Create a `.env` file in `apps/todo-app/.env` (or pass via environment):

```env
# Neon Serverless Postgres
DATABASE_URL="postgres://user:password@ep-sample-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Or Supabase Postgres
DATABASE_URL="postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# Or Local PostgreSQL
DATABASE_URL="postgres://postgres:postgres@localhost:5432/todo_db"
```

When `DATABASE_URL` is set, `createClient` instantiates `PostgresDriver` with automatic SSL negotiation and connection pooling.

---

## ORM Developer Experience & API Guide

### 1. Fluent Schema Definition
Define models with chainable column modifiers:

```typescript
import { defineModel, string, number, boolean, timestamp, text } from "@light-orm/core";

export const Todo = defineModel("todos", {
  id: number().primaryKey().autoIncrement(),
  title: string().notNull(),
  completed: boolean().default(false),
  priority: string().default("medium"),
  description: text().nullable(),
  createdAt: timestamp().default("NOW()"),
});
```

### 2. Zero-Codegen Type Inference
Infer TypeScript row models and insert contracts directly without running code generators:

```typescript
import { InferModel, InferInsertModel, InferUpdateModel } from "@light-orm/core";

// Full record returned from queries:
type TodoRow = InferModel<typeof Todo>;
// { id: number; title: string; completed: boolean; priority: string; description: string | null; createdAt: Date }

// Input payload for db.todo.create(...) (autoIncrement and default columns are optional):
type NewTodo = InferInsertModel<typeof Todo>;
// { title: string; completed?: boolean; priority?: string; description?: string | null; createdAt?: Date }
```

### 3. Client Initialization & Repositories
Pass models to `createClient`. Repositories are dynamically typed and attached:

```typescript
import { createClient } from "@light-orm/core";

const db = createClient({
  connectionString: process.env.DATABASE_URL,
  schema: {
    todo: Todo,
  },
});

// Auto-sync table DDL:
await db.syncSchema();

// 1. Create:
const newTodo = await db.todo.create({
  title: "Deploy serverless ORM",
  priority: "high",
});

// 2. Find many:
const activeTodos = await db.todo.findMany({
  where: { completed: false },
  orderBy: { id: "desc" },
  limit: 10,
});

// 3. Find unique / first:
const task = await db.todo.findUnique({ where: { id: 1 } });

// 4. Update:
const updated = await db.todo.update({
  where: { id: 1 },
  data: { completed: true },
});

// 5. Delete:
await db.todo.delete({ where: { id: 1 } });

// 6. Count:
const total = await db.todo.count({ where: { completed: false } });
```

### 4. Query Filtering & Advanced Operators
The `where` filter supports both direct equality and rich comparison operators:

```typescript
const results = await db.todo.findMany({
  where: {
    // Equality
    completed: false,
    
    // Comparison operators
    id: { gt: 10, lte: 100 },
    
    // Membership
    priority: { in: ["medium", "high"] },
    
    // Pattern matching
    title: { contains: "assignment" },
    
    // Null checks
    description: { isNull: false },
    
    // Logical OR
    OR: [
      { priority: "urgent" },
      { completed: false }
    ]
  }
});
```

### 5. Transactions (Bonus)
Execute atomic operations with automatic rollback on error:

```typescript
await db.transaction(async (tx) => {
  const item1 = await tx.todo.create({ title: "Subtask 1" });
  const item2 = await tx.todo.create({ title: "Subtask 2" });
  // If an error is thrown here, both item1 and item2 are rolled back
});
```

### 6. Automatic Schema DDL Sync
```typescript
await db.syncSchema();
// Emits and executes:
// CREATE TABLE IF NOT EXISTS "todos" (
//   "id" SERIAL PRIMARY KEY,
//   "title" VARCHAR(255) NOT NULL,
//   "completed" BOOLEAN NOT NULL DEFAULT FALSE, ...
// );
```

---

## Todo Showcase Application

The Todo application (`apps/todo-app`) demonstrates `@light-orm/core` in a fullstack architecture:

- **Express REST Server** (`apps/todo-app/src/server/`):
  - Imports `@light-orm/core` through the monorepo workspace.
  - Implements CRUD endpoints using `db.todo`.
  - Captures ORM query telemetry events (`sql`, `params`, `durationMs`).
- **React Frontend UI** (`apps/todo-app/src/client/`):
  - **Productivity Dashboard**: Total, active, completed count, and animated progress bar.
  - **Filtering**: Tab filters (All, Active, Completed), priority selector, and instant live search.
  - **Task Management**: Create task with priority & category, inline double-click title editing, custom animated checkbox, and delete.
  - **One-Click Seed**: "Seed Demo" button to populate realistic tasks.
  - **Live SQL Query Inspector**: Real-time card displaying parameterized SQL queries, bindings, execution times in milliseconds, and row counts.

---

## Query Pipeline & Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Developer Code                       │
│    await db.todo.findMany({ where: { completed: false } })  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                 ModelRepositoryImpl                    │
│    Enforces type constraints & applies schema defaults │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                  QueryCompiler / AST                   │
│    Validates identifiers, compiles operators, binds    │
│    parameter placeholders ($1, $2)                     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                 Telemetry / onQuery                    │
│    Emits QueryEvent: { sql, params, durationMs }       │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                   DatabaseDriver                       │
│       PostgresDriver (pg Pool)  /  MemoryPostgresDriver│
└────────────────────────────────────────────────────────┘
```

---

## TypeScript Design & Tradeoffs

| Feature | Design Approach | Tradeoff / Benefit |
| :--- | :--- | :--- |
| **Model Inference** | Mapped types over `ModelDefinition` columns (`InferModel<T>`) | Zero build step or code generation required. Models stay in sync instantly. |
| **Insert Safety** | Differentiates required columns from optional columns (`OptionalInsertKeys`) | Columns with `autoIncrement`, `default`, or `nullable` are marked optional `?:`, preventing runtime null violations. |
| **Where Typing** | Constrained to model keys with union of value or operator interface | Invalid column names or mismatching value types trigger compile errors. |
| **Driver Abstraction** | Decoupled `DatabaseDriver` interface | Enables 100% pluggable drivers (Neon, Supabase, SQLite, in-memory) without touching query compiler logic. |

---

## Known Limitations & Roadmap

1. **Relations / Joins**: Currently supports single-table queries. Future versions can introduce `.relations()` and `include: { author: true }`.
2. **CLI Migration Tooling**: The ORM includes `syncSchema()` for automated table creation; a full migration generator with schema diffing and rollback scripts would be the next step.
3. **Complex Aggregations**: `count()` is fully supported; `sum()`, `avg()`, `groupBy()` can be added to the query builder AST.

---

## Time Spent on Assignment

- **Architecture & System Design**: 3 hours (monorepo setup, type inference architecture, driver abstraction)
- **ORM Core Engine**: 5 hours (fluent schema builder, AST query compiler, parameterization, Postgres driver, in-memory emulator, transactions)
- **Test Suite & Type Checking**: 3 hours (Vitest unit & integration tests, TypeScript type edge-cases)
- **Todo Showcase App**: 4 hours (Express REST API, React client, glassmorphic UI, live SQL Query Inspector)
- **Documentation & Benchmarks**: 2 hours (`README.md`, `ARCHITECTURE.md`)
- **Total Time**: ~17 hours

---

## AI Tool Disclosure

In accordance with assignment instructions:
- **AI Tool Used**: Antigravity AI Pair Programmer
- **Purpose**: Assisting with initial scaffolding of boilerplate configuration files, styling CSS design tokens, and rapid generation of parameterized SQL compiler test matrices.
- **Verification**: All TypeScript generics, compiler logic, AST parameterization, and React UI components were reviewed and verified through an automated test suite.
