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

  const displayQueries = queries.slice(0, 6);

  return (
    <div className="sql-terminal-box">
      <div className="sql-terminal-header">
        <div className="sql-title-group">
          <Terminal size={15} color="#c084fc" />
          <span>SQL Inspector</span>
        </div>
        <div className="sql-active-pill">
          <span className="sql-green-dot" />
          <span>Live ORM activity</span>
        </div>
      </div>

      <div className="sql-queries-container">
        {displayQueries.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: "0.75rem", fontStyle: "italic", padding: "0.5rem 0" }}>
            Waiting for ORM query execution...
          </div>
        ) : (
          displayQueries.map((q) => (
            <div key={q.id} className="sql-snippet">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                <span className="sql-code-text">{q.sql}</span>
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

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.2rem" }}>
                <span className="sql-ms-tag">{q.durationMs.toFixed(1)} ms</span>
                {q.params && q.params.length > 0 && (
                  <span style={{ fontSize: "0.68rem", color: "#60a5fa" }}>
                    params: [{q.params.join(", ")}]
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bound-params-pill">Bound params</div>
    </div>
  );
};
