// serverless/index.ts
import express from "express";
import cors from "cors";

// apps/todo-app/src/server/api.ts
import { Router } from "express";

// apps/todo-app/src/server/db.ts
import {
  defineModel,
  createClient,
  string,
  number,
  boolean,
  timestamp
} from "@light-orm/core";
try {
  process.loadEnvFile?.();
} catch {
}
var TodoModel = defineModel("todos", {
  id: number().primaryKey().autoIncrement(),
  title: string().notNull(),
  completed: boolean().default(false),
  priority: string().default("medium"),
  // "low" | "medium" | "high"
  category: string().default("General"),
  dueDate: string().nullable(),
  createdAt: timestamp().default("NOW()")
});
var queryLogBuffer = [];
var DEFAULT_DATABASE_URL = "postgresql://neondb_owner:npg_jl8HOInRT9rU@ep-wild-cell-aeagzyae-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
var db = createClient({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
  schema: {
    todo: TodoModel
  },
  logging: true,
  onQuery: (evt) => {
    const item = {
      ...evt,
      id: Math.random().toString(36).substring(2, 9)
    };
    queryLogBuffer.unshift(item);
    if (queryLogBuffer.length > 50) {
      queryLogBuffer.pop();
    }
  }
});
async function initDb() {
  console.log(`[Database] Initializing schema via @light-orm/core using driver: ${db.driver.driverName}`);
  await db.syncSchema();
  const count = await db.todo.count();
  if (count === 0) {
    console.log("[Database] Seeding initial demo tasks...");
    await seedDemoData();
  }
}
async function seedDemoData() {
  await db.todo.createMany([
    {
      title: "Design the mobile dashboard",
      completed: false,
      priority: "medium",
      category: "Engineering",
      dueDate: "Today"
    },
    {
      title: "Review Neon database schema",
      completed: false,
      priority: "high",
      category: "Engineering",
      dueDate: "Tomorrow"
    },
    {
      title: "Write onboarding copy",
      completed: true,
      priority: "low",
      category: "Product",
      dueDate: "Fri, Mar 15"
    },
    {
      title: "Set up CI pipeline",
      completed: false,
      priority: "high",
      category: "DevOps",
      dueDate: "Mar 18"
    },
    {
      title: "Share sprint recap",
      completed: true,
      priority: "medium",
      category: "General",
      dueDate: "Mar 20"
    },
    {
      title: "Evaluate @light-orm/core type safety & telemetry",
      completed: true,
      priority: "high",
      category: "Architecture",
      dueDate: "Today"
    }
  ]);
}

// apps/todo-app/src/server/api.ts
var apiRouter = Router();
apiRouter.get("/todos", async (req, res) => {
  try {
    const { status, priority, search } = req.query;
    const where = {};
    if (status === "active") {
      where.completed = false;
    } else if (status === "completed") {
      where.completed = true;
    }
    if (priority && priority !== "all" && typeof priority === "string") {
      where.priority = priority;
    }
    if (search && typeof search === "string" && search.trim()) {
      where.title = { contains: search.trim() };
    }
    const todos = await db.todo.findMany({
      where: Object.keys(where).length > 0 ? where : void 0,
      orderBy: { id: "desc" }
    });
    res.json({ success: true, data: todos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/todos", async (req, res) => {
  try {
    const { title, priority, category, dueDate } = req.body;
    if (!title || typeof title !== "string" || !title.trim()) {
      res.status(400).json({ success: false, error: "Task title is required" });
      return;
    }
    const newTodo = await db.todo.create({
      title: title.trim(),
      completed: false,
      priority: priority || "medium",
      category: category || "General",
      dueDate: dueDate || null
    });
    res.status(201).json({ success: true, data: newTodo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.patch("/todos/:id", async (req, res) => {
  try {
    const idParam = req.params.id ?? "";
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid todo id" });
      return;
    }
    const { title, completed, priority, category, dueDate } = req.body;
    const updateData = {};
    if (typeof title === "string") updateData.title = title.trim();
    if (typeof completed === "boolean") updateData.completed = completed;
    if (typeof priority === "string") updateData.priority = priority;
    if (typeof category === "string") updateData.category = category;
    if (dueDate !== void 0) updateData.dueDate = dueDate;
    const updated = await db.todo.update({
      where: { id },
      data: updateData
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.delete("/todos/:id", async (req, res) => {
  try {
    const idParam = req.params.id ?? "";
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid todo id" });
      return;
    }
    const deleted = await db.todo.delete({
      where: { id }
    });
    res.json({ success: true, data: deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.delete("/todos-completed", async (_req, res) => {
  try {
    const count = await db.todo.deleteMany({
      where: { completed: true }
    });
    res.json({ success: true, deletedCount: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post("/seed", async (_req, res) => {
  try {
    await seedDemoData();
    const all = await db.todo.findMany({ orderBy: { id: "desc" } });
    res.json({ success: true, message: "Demo data seeded", data: all });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/stats", async (_req, res) => {
  try {
    const total = await db.todo.count();
    const completed = await db.todo.count({ where: { completed: true } });
    const active = total - completed;
    res.json({
      success: true,
      stats: {
        total,
        completed,
        active,
        driver: db.driver.driverName,
        isPostgres: db.driver.driverName.includes("postgres")
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get("/telemetry/queries", (_req, res) => {
  res.json({ success: true, queries: queryLogBuffer });
});
apiRouter.post("/raw-query", async (req, res) => {
  const start = performance.now();
  try {
    const { sql, params } = req.body;
    if (!sql || typeof sql !== "string") {
      res.status(400).json({ success: false, error: "SQL string is required" });
      return;
    }
    const boundParams = Array.isArray(params) ? params : [];
    const result = await db.driver.query(sql, boundParams);
    const duration = performance.now() - start;
    queryLogBuffer.unshift({
      id: Math.random().toString(36).substring(2, 9),
      sql,
      params: boundParams,
      durationMs: duration,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      rowCount: result.rowCount,
      source: db.driver.driverName
    });
    if (queryLogBuffer.length > 50) queryLogBuffer.pop();
    res.json({
      success: true,
      rowCount: result.rowCount,
      rows: result.rows,
      durationMs: duration
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// serverless/index.ts
try {
  process.loadEnvFile?.();
} catch {
}
var app = express();
app.use(cors());
app.use(express.json());
app.use((req, _res, next) => {
  console.log(`[Vercel Serverless] ${req.method} ${req.url} (matched: ${req.headers["x-matched-path"]})`);
  next();
});
var isDbInitialized = false;
app.use(async (_req, _res, next) => {
  if (!isDbInitialized) {
    try {
      await initDb();
      isDbInitialized = true;
    } catch (err) {
      console.error("Vercel Serverless Database initialization error:", err);
    }
  }
  next();
});
app.use((req, _res, next) => {
  const matchedPath = req.headers["x-matched-path"] || "";
  if (matchedPath && req.url === "/") {
    const queryIndex = req.originalUrl?.indexOf("?") ?? -1;
    const queryString = queryIndex !== -1 ? req.originalUrl.slice(queryIndex) : "";
    req.url = matchedPath + queryString;
  }
  next();
});
app.use("/api", apiRouter);
app.use("/", apiRouter);
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", serverless: true, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
var index_default = app;
export {
  app,
  index_default as default
};
