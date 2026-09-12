import express from "express";
import cors from "cors";

try {
  process.loadEnvFile?.();
} catch {}
import { apiRouter } from "../apps/todo-app/src/server/api.js";
import { initDb } from "../apps/todo-app/src/server/db.js";

const app = express();

app.use(cors());
app.use(express.json());

let isDbInitialized = false;

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

// Mount the Todo API routes
app.use("/api", apiRouter);

// Root health check
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", serverless: true, timestamp: new Date().toISOString() });
});

export default app;
