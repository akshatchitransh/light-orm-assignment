import React from "react";
import { Database, RefreshCw, Sparkles, Trash2, Zap } from "lucide-react";

interface HeaderProps {
  driverName: string;
  onSeedData: () => void;
  onClearCompleted: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  driverName,
  onSeedData,
  onClearCompleted,
  onRefresh,
  isLoading,
}) => {
  const isPostgres = driverName.includes("postgres");
  const driverLabel = isPostgres ? "Neon Serverless Postgres" : "Memory Postgres Engine";

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-icon-wrapper">
          <div className="brand-icon">
            <Database size={26} />
          </div>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <h1 className="brand-title">LightORM Studio</h1>
            <span className="brand-title-badge">v0.1</span>
          </div>
          <div className="brand-subtitle">
            <span>Powered by @light-orm/core</span>
            <span>•</span>
            <div className="driver-badge">
              <div className="driver-pulse-wrapper">
                <span className="driver-ping" />
                <span className="driver-dot" />
              </div>
              <Zap size={12} />
              <span>{driverLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="header-actions">
        <button
          className="btn btn-secondary"
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh tasks & query telemetry"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          <span>Sync</span>
        </button>

        <button
          className="btn btn-secondary"
          onClick={onSeedData}
          title="Seed realistic demo tasks"
        >
          <Sparkles size={14} color="#a855f7" />
          <span>Seed Demo</span>
        </button>

        <button
          className="btn btn-danger-ghost"
          onClick={onClearCompleted}
          title="Clear all completed tasks"
        >
          <Trash2 size={14} />
          <span>Clear Done</span>
        </button>
      </div>
    </header>
  );
};
