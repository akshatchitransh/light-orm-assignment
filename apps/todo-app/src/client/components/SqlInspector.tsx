import React, { useState } from "react";
import { ChevronDown, ChevronUp, Clock, Code, Terminal, Zap } from "lucide-react";
import { QueryTelemetryItem } from "../../server/db.js";

interface SqlInspectorProps {
  queries: QueryTelemetryItem[];
}

export const SqlInspector: React.FC<SqlInspectorProps> = ({ queries }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="glass-panel sql-inspector">
      <div className="sql-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="sql-header-title">
          <Terminal size={18} color="#c084fc" />
          <span>Live SQL Query Inspector</span>
          <span className="sql-badge">{queries.length} Queries Captured</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-muted)" }}>
          <span style={{ fontSize: "0.75rem" }}>
            {isOpen ? "Click to collapse" : "Click to view real-time ORM SQL"}
          </span>
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {isOpen && (
        <div className="sql-body">
          {queries.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-dim)", padding: "1rem" }}>
              Perform an action (create, toggle, delete) to see real-time parameterized SQL generation!
            </div>
          ) : (
            queries.map((q) => (
              <div key={q.id} className="sql-log-item">
                <div className="sql-log-meta">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Zap size={13} color="#f59e0b" />
                    <span>{q.source || "postgres"}</span>
                    <span>•</span>
                    <span>{new Date(q.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <Clock size={12} />
                    <span className="sql-timing">{q.durationMs.toFixed(1)} ms</span>
                    <span>•</span>
                    <span>{q.rowCount} rows</span>
                  </div>
                </div>

                <div className="sql-code">
                  <span style={{ color: "#c084fc", marginRight: "0.4rem" }}>&gt;</span>
                  {q.sql}
                </div>

                {q.params && q.params.length > 0 && (
                  <div className="sql-params">
                    <span style={{ color: "var(--text-dim)", marginRight: "0.4rem" }}>params:</span>
                    [{q.params.map((p) => (typeof p === "string" ? `"${p}"` : String(p))).join(", ")}]
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
