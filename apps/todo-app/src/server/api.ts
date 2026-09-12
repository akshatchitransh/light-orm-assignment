import { Router, Request, Response } from "express";
import { db, queryLogBuffer, seedDemoData, TodoItem } from "./db.js";
import { WhereClause } from "@light-orm/core";

export const apiRouter = Router();

/**
 * GET /api/todos
 * List todos with optional status filter, priority filter, and substring search
 */
apiRouter.get("/todos", async (req: Request, res: Response) => {
  try {
    const { status, priority, search } = req.query;

    const where: WhereClause<TodoItem> = {};

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
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { id: "desc" },
    });

    res.json({ success: true, data: todos });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/todos
 * Create a new todo record
 */
apiRouter.post("/todos", async (req: Request, res: Response): Promise<void> => {
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
      dueDate: dueDate || null,
    });

    res.status(201).json({ success: true, data: newTodo });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.patch("/todos/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const idParam = req.params.id ?? "";
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid todo id" });
      return;
    }

    const { title, completed, priority, category, dueDate } = req.body;
    const updateData: Partial<TodoItem> = {};

    if (typeof title === "string") updateData.title = title.trim();
    if (typeof completed === "boolean") updateData.completed = completed;
    if (typeof priority === "string") updateData.priority = priority;
    if (typeof category === "string") updateData.category = category;
    if (dueDate !== undefined) updateData.dueDate = dueDate;

    const updated = await db.todo.update({
      where: { id },
      data: updateData,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.delete("/todos/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const idParam = req.params.id ?? "";
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid todo id" });
      return;
    }

    const deleted = await db.todo.delete({
      where: { id },
    });

    res.json({ success: true, data: deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/todos-completed
 * Clear all completed todos
 */
apiRouter.delete("/todos-completed", async (_req: Request, res: Response) => {
  try {
    const count = await db.todo.deleteMany({
      where: { completed: true },
    });
    res.json({ success: true, deletedCount: count });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/seed
 * Reset/Seed demo tasks
 */
apiRouter.post("/seed", async (_req: Request, res: Response) => {
  try {
    await seedDemoData();
    const all = await db.todo.findMany({ orderBy: { id: "desc" } });
    res.json({ success: true, message: "Demo data seeded", data: all });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/stats
 * Aggregate dashboard statistics & ORM driver info
 */
apiRouter.get("/stats", async (_req: Request, res: Response) => {
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
        isPostgres: db.driver.driverName.includes("postgres"),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/telemetry/queries
 * Live query telemetry stream for SQL Query Inspector
 */
apiRouter.get("/telemetry/queries", (_req: Request, res: Response) => {
  res.json({ success: true, queries: queryLogBuffer });
});

/**
 * POST /api/raw-query
 * Execute custom SQL (e.g. INSERT INTO ...) directly from SQL Inspector console
 */
apiRouter.post("/raw-query", async (req: Request, res: Response): Promise<void> => {
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

    // Push into telemetry buffer
    queryLogBuffer.unshift({
      id: Math.random().toString(36).substring(2, 9),
      sql,
      params: boundParams,
      durationMs: duration,
      timestamp: new Date().toISOString(),
      rowCount: result.rowCount,
      source: db.driver.driverName,
    });
    if (queryLogBuffer.length > 50) queryLogBuffer.pop();

    res.json({
      success: true,
      rowCount: result.rowCount,
      rows: result.rows,
      durationMs: duration,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

