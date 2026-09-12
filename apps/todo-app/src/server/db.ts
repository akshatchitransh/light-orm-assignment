import {
  defineModel,
  createClient,
  string,
  number,
  boolean,
  timestamp,
  InferModel,
  QueryEvent,
} from "@light-orm/core";

// Auto-load .env file in Node.js
try {
  process.loadEnvFile?.();
} catch {
  // ignore if .env does not exist
}

/**
 * 1. Define Todo Model using @light-orm/core fluent schema definition
 */
export const TodoModel = defineModel("todos", {
  id: number().primaryKey().autoIncrement(),
  title: string().notNull(),
  completed: boolean().default(false),
  priority: string().default("medium"), // "low" | "medium" | "high"
  category: string().default("General"),
  dueDate: string().nullable(),
  createdAt: timestamp().default("NOW()"),
});

export type TodoItem = InferModel<typeof TodoModel>;

/**
 * In-memory buffer for real-time SQL query telemetry
 */
export interface QueryTelemetryItem extends QueryEvent {
  id: string;
}

export const queryLogBuffer: QueryTelemetryItem[] = [];

/**
 * 2. Initialize the ORM Database Client
 * Automatically connects to DATABASE_URL (Neon / Supabase / Postgres)
 * or falls back to the high-fidelity in-memory Postgres emulator for instant zero-config evaluation!
 */
export const db = createClient({
  connectionString: process.env.DATABASE_URL,
  schema: {
    todo: TodoModel,
  },
  logging: true,
  onQuery: (evt) => {
    const item: QueryTelemetryItem = {
      ...evt,
      id: Math.random().toString(36).substring(2, 9),
    };
    queryLogBuffer.unshift(item);
    if (queryLogBuffer.length > 50) {
      queryLogBuffer.pop();
    }
  },
});

/**
 * Auto-sync database tables and populate sample tasks if empty
 */
export async function initDb() {
  console.log(`[Database] Initializing schema via @light-orm/core using driver: ${db.driver.driverName}`);
  await db.syncSchema();

  const count = await db.todo.count();
  if (count === 0) {
    console.log("[Database] Seeding initial demo tasks...");
    await seedDemoData();
  }
}

export async function seedDemoData() {
  await db.todo.createMany([
    {
      title: "Evaluate @light-orm/core API ergonomics & type safety",
      completed: true,
      priority: "high",
      category: "Work",
      dueDate: "2026-09-15",
    },
    {
      title: "Inspect live SQL queries & parameterization in Query Inspector",
      completed: false,
      priority: "high",
      category: "Engineering",
      dueDate: "2026-09-16",
    },
    {
      title: "Verify serverless Postgres compatibility (Neon / Supabase)",
      completed: false,
      priority: "medium",
      category: "DevOps",
      dueDate: "2026-09-18",
    },
    {
      title: "Review ARCHITECTURE.md for type inference & AST compiler design",
      completed: false,
      priority: "low",
      category: "Documentation",
      dueDate: "2026-09-20",
    },
  ]);
}
