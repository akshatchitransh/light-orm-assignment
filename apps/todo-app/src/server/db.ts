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
      title: "Design the mobile dashboard",
      completed: false,
      priority: "medium",
      category: "Engineering",
      dueDate: "Today",
    },
    {
      title: "Review Neon database schema",
      completed: false,
      priority: "high",
      category: "Engineering",
      dueDate: "Tomorrow",
    },
    {
      title: "Write onboarding copy",
      completed: true,
      priority: "low",
      category: "Product",
      dueDate: "Fri, Mar 15",
    },
    {
      title: "Set up CI pipeline",
      completed: false,
      priority: "high",
      category: "DevOps",
      dueDate: "Mar 18",
    },
    {
      title: "Share sprint recap",
      completed: true,
      priority: "medium",
      category: "General",
      dueDate: "Mar 20",
    },
    {
      title: "Evaluate @light-orm/core type safety & telemetry",
      completed: true,
      priority: "high",
      category: "Architecture",
      dueDate: "Today",
    },
  ]);
}
