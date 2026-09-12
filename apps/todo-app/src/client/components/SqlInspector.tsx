import React, { useState } from "react";
import { Check, ChevronDown, ChevronUp, Clock, Copy, Terminal, Zap } from "lucide-react";
import { QueryTelemetryItem } from "../../server/db.js";

interface SqlInspectorProps {
  queries: QueryTelemetryItem[];
}

export const SqlInspector: React.FC<SqlInspectorProps> = ({ queries }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterOp, setFilterOp] = useState<string>("ALL");

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredQueries = queries.filter((q) => {
    if (filterOp === "ALL") return true;
    return q.sql.toUpperCase().startsWith(filterOp);
  });

  const highlightSql = (sql: string) => {
    const keywords = ["SELECT", "FROM", "WHERE", "ORDER BY", "DESC", "ASC", "LIMIT", "OFFSET", "INSERT INTO", "VALUES", "RETURNING", "UPDATE", "SET", "DELETE", "COUNT", "CREATE TABLE", "IF NOT EXISTS", "SERIAL", "PRIMARY KEY", "BOOLEAN", "VARCHAR", "TIMESTAMP", "NOT NULL", "DEFAULT"];
    
    // Simple colored token renderer
    const parts = sql.split(/(\s+|,|\(|\))/g);
    return parts.map((part, i) => {
      const upper = part.trim().toUpperCase();
      if (keywords.includes(upper)) {
        return (
          <span key={i} style={{ color: "#c084fc", fontWeight: 700 }}>
            {part}
          </span>
        );
      }
      if (part.startsWith("$")) {
        return (
          <span key={i} style={{ color: "#38bdf8", fontWeight: 600 }}>
            {part}
          </span>
        );
      }
      if (part.startsWith('"') && part.endsWith('"')) {
        return (
          <span key={i} style={{ color: "#e2e8f0" }}>
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="glass-panel sql-inspector">
      <div className="sql-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="sql-header-title">
          <div className="mac-dots">
            <span className="mac-dot red" />
            <span className="mac-dot yellow" />
            <span className="mac-dot green" />
          </div>
          <Terminal size={17} color="#c084fc" style={{ marginLeft: "0.25rem" }} />
          <span>Live SQL Query Inspector</span>
          <span className="sql-badge">{queries.length} Queries Captured</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {isOpen ? "Collapse Terminal" : "Expand Live SQL"}
          </span>
          {isOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </div>
      </div>

      {isOpen && (
        <>
          <div style={{ padding: "0.5rem 1.5rem", display: "flex", gap: "0.4rem", background: "rgba(10, 14, 25, 0.4)", borderBottom: "1px solid var(--border-subtle)" }}>
            {["ALL", "INSERT", "SELECT", "UPDATE", "DELETE"].map((op) => (
              <button
                key={op}
                className={`priority-btn ${filterOp === op ? "active priority-medium" : ""}`}
                style={{ fontSize: "0.7rem", padding: "0.2rem 0.55rem" }}
                onClick={() => setFilterOp(op)}
              >
                {op}
              </button>
            ))}
          </div>

          <div className="sql-body">
            {filteredQueries.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem 0", fontSize: "0.85rem" }}>
                Interactive Telemetry: Click anywhere on tasks (toggle, create, delete) to see real-time parameterized SQL generation!
              </div>
            ) : (
              filteredQueries.map((q) => (
                <div key={q.id} className="sql-log-item">
                  <div className="sql-log-meta">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Zap size={12} color="#f59e0b" />
                      <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{q.source || "postgres"}</span>
                      <span>•</span>
                      <span>{new Date(q.timestamp).toLocaleTimeString()}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <Clock size={11} />
                        <span className="sql-timing">{q.durationMs.toFixed(1)} ms</span>
                      </div>

                      <button
                        className="icon-btn"
                        style={{ width: "24px", height: "24px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(q.id, q.sql);
                        }}
                        title="Copy SQL Query"
                      >
                        {copiedId === q.id ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  <div className="sql-code">
                    {highlightSql(q.sql)}
                  </div>

                  {q.params && q.params.length > 0 && (
                    <div className="sql-params">
                      <strong style={{ color: "#f87171", marginRight: "0.4rem" }}>parameters:</strong>
                      [{q.params.map((p) => (typeof p === "string" ? `"${p}"` : String(p))).join(", ")}]
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};
