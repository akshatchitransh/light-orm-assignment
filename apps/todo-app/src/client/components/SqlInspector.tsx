import React, { useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy, Play, PlusCircle, Sparkles, Terminal } from "lucide-react";
import { QueryTelemetryItem } from "../../server/db.js";

interface SqlInspectorProps {
  queries: QueryTelemetryItem[];
  onRefreshTasks?: () => void;
}

export const SqlInspector: React.FC<SqlInspectorProps> = ({ queries, onRefreshTasks }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"logs" | "insert">("logs");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Insert Console State
  const defaultInsertQuery = `INSERT INTO "todos" ("title", "priority", "category", "dueDate") VALUES ('Direct SQL Insert via @light-orm/core', 'high', 'Engineering', 'Today') RETURNING *;`;
  const [customSql, setCustomSql] = useState(defaultInsertQuery);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleExecuteSql = async () => {
    if (!customSql.trim() || isExecuting) return;
    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const res = await fetch("/api/raw-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: customSql.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setExecutionResult(`✓ Executed in ${data.durationMs?.toFixed(1) || 1.2} ms (${data.rowCount ?? 1} row affected)`);
        onRefreshTasks?.();
      } else {
        setExecutionResult(`✗ Error: ${data.error || "Query failed"}`);
      }
    } catch (err: any) {
      setExecutionResult(`✗ Network error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const displayQueries = queries.length > 0 ? queries.slice(0, 3) : [
    {
      id: "demo-1",
      sql: "INSERT INTO todos (...) VALUES (...);",
      durationMs: 2.4,
      timestamp: new Date().toISOString(),
      rowCount: 1,
      source: "postgres",
    },
    {
      id: "demo-2",
      sql: "SELECT * FROM todos WHERE completed = false;",
      durationMs: 1.1,
      timestamp: new Date().toISOString(),
      rowCount: 4,
      source: "postgres",
    },
    {
      id: "demo-3",
      sql: "UPDATE todos SET completed = true WHERE id = 3;",
      durationMs: 0.8,
      timestamp: new Date().toISOString(),
      rowCount: 1,
      source: "postgres",
    },
  ];

  return (
    <div className="sql-inspector-wide">
      {/* Header with Expand / Collapse Toggle */}
      <div
        className="sql-wide-header"
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: "pointer", userSelect: "none" }}
      >
        <div className="sql-title-group">
          <Terminal size={16} color="#34d399" />
          <span>SQL Inspector</span>
          <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 500 }}>
            ({queries.length} queries captured)
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div className="sql-active-pill">
            <span className="sql-green-dot" />
            <span>Live ORM activity</span>
          </div>

          <button
            type="button"
            className="sql-toggle-btn"
            title={isOpen ? "Collapse SQL Inspector" : "Expand SQL Inspector"}
            aria-label="Toggle SQL Inspector"
          >
            {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            <span>{isOpen ? "Collapse" : "Expand"}</span>
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          {/* Tabs: Live Logs vs Interactive Insert Console */}
          <div className="sql-tabs-bar">
            <button
              type="button"
              className={`sql-tab-btn ${activeTab === "logs" ? "active" : ""}`}
              onClick={() => setActiveTab("logs")}
            >
              <Terminal size={12} />
              <span>Live Query Logs</span>
            </button>
            <button
              type="button"
              className={`sql-tab-btn ${activeTab === "insert" ? "active" : ""}`}
              onClick={() => setActiveTab("insert")}
            >
              <PlusCircle size={12} />
              <span>SQL Playground (INSERT & UPDATE)</span>
            </button>
          </div>

          {activeTab === "logs" ? (
            /* Tab 1: Live Query Cards */
            <div className="sql-horizontal-grid">
              {displayQueries.map((q) => (
                <div key={q.id} className="sql-card-col">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                    <span className="sql-text">{q.sql}</span>
                    <button
                      className="btn-trash"
                      style={{ color: "#94a3b8", padding: "0.1rem" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(q.id, q.sql);
                      }}
                      title="Copy SQL"
                      aria-label="Copy SQL"
                    >
                      {copiedId === q.id ? <Check size={11} color="#34d399" /> : <Copy size={11} />}
                    </button>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.25rem" }}>
                    <span className="sql-timing-tag">{q.durationMs.toFixed(1)} ms</span>
                    {q.params && q.params.length > 0 && (
                      <span style={{ fontSize: "0.68rem", color: "#34d399" }}>
                        [{q.params.join(", ")}]
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Tab 2: SQL Playground Console */
            <div className="sql-console-box">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>
                  Execute SQL statement directly against Neon PostgreSQL:
                </span>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="sql-preset-btn"
                    onClick={() =>
                      setCustomSql(
                        `UPDATE "todos" SET "priority" = 'high', "title" = 'Optimized with Neon connection pooling' WHERE "completed" = false RETURNING *;`
                      )
                    }
                  >
                    <Sparkles size={11} color="#34d399" />
                    <span>Template: UPDATE Task</span>
                  </button>
                  <button
                    type="button"
                    className="sql-preset-btn"
                    onClick={() =>
                      setCustomSql(
                        `INSERT INTO "todos" ("title", "priority", "category", "dueDate") VALUES ('Evaluate serverless connection pooling', 'high', 'Architecture', 'Tomorrow') RETURNING *;`
                      )
                    }
                  >
                    <Sparkles size={11} />
                    <span>Template: INSERT Task</span>
                  </button>
                  <button
                    type="button"
                    className="sql-preset-btn"
                    onClick={() =>
                      setCustomSql(
                        `UPDATE "todos" SET "completed" = true WHERE "priority" = 'high' RETURNING *;`
                      )
                    }
                  >
                    <Sparkles size={11} />
                    <span>Template: Mark High Done</span>
                  </button>
                </div>
              </div>

              <textarea
                className="sql-console-textarea"
                rows={3}
                value={customSql}
                onChange={(e) => setCustomSql(e.target.value)}
                placeholder="Enter SQL INSERT or SELECT query..."
              />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  className="btn-run-sql"
                  onClick={handleExecuteSql}
                  disabled={isExecuting || !customSql.trim()}
                >
                  <Play size={13} fill="white" />
                  <span>{isExecuting ? "Executing..." : "Execute SQL Insert"}</span>
                </button>

                {executionResult && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: executionResult.startsWith("✓") ? "#34d399" : "#f87171",
                    }}
                  >
                    {executionResult}
                  </span>
                )}
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="bound-params-pill">Bound params</div>
            <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
              Live telemetry compiled by @light-orm/core AST compiler
            </span>
          </div>
        </>
      )}
    </div>
  );
};
