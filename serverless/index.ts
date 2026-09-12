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

// Log incoming requests in Vercel for instant debugging
app.use((req, _res, next) => {
  console.log(`[Vercel Serverless] ${req.method} ${req.url} (matched: ${req.headers["x-matched-path"]})`);
  next();
});

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

// Resilient path normalization for Vercel edge rewrite / sub-routing
app.use((req, _res, next) => {
  const matchedPath = (req.headers["x-matched-path"] as string) || "";
  if (matchedPath && req.url === "/") {
    const queryIndex = req.originalUrl?.indexOf("?") ?? -1;
    const queryString = queryIndex !== -1 ? req.originalUrl.slice(queryIndex) : "";
    req.url = matchedPath + queryString;
  }
  next();
});

// Mount the Todo API routes at both root and /api for total resilience on Vercel
app.use("/api", apiRouter);
app.use("/", apiRouter);

// Root health check
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", serverless: true, timestamp: new Date().toISOString() });
});

export { app };
export default app;
