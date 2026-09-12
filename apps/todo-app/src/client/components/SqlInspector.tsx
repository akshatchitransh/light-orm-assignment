import React, { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { QueryTelemetryItem } from "../../server/db.js";

interface SqlInspectorProps {
  queries: QueryTelemetryItem[];
}

export const SqlInspector: React.FC<SqlInspectorProps> = ({ queries }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // If there are fewer than 3 queries, provide representative or live queries
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
      <div className="sql-wide-header">
        <div className="sql-title-group">
          <Terminal size={16} color="#34d399" />
          <span>SQL Inspector</span>
        </div>
        <div className="sql-active-pill">
          <span className="sql-green-dot" />
          <span>Live ORM activity</span>
        </div>
      </div>

      <div className="sql-horizontal-grid">
        {displayQueries.map((q) => (
          <div key={q.id} className="sql-card-col">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
              <span className="sql-text">{q.sql}</span>
              <button
                className="btn-trash"
                style={{ color: "#94a3b8", padding: "0.1rem" }}
                onClick={() => handleCopy(q.id, q.sql)}
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

      <div className="bound-params-pill">Bound params</div>
    </div>
  );
};
