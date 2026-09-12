import express from "express";
import cors from "cors";
import { apiRouter } from "./api.js";
import { initDb } from "./db.js";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.use(cors());
app.use(express.json());

// API routes
app.use("/api", apiRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

async function start() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`🚀 Todo Backend API running on http://localhost:${PORT}`);
      console.log(`📊 ORM Query telemetry endpoint at http://localhost:${PORT}/api/telemetry/queries`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
