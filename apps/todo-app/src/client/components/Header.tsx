import React from "react";
import { Database, RefreshCw, Sparkles, Trash2 } from "lucide-react";

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
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-icon">
          <Database size={26} />
        </div>
        <div>
          <h1 className="brand-title">LightORM Todo Studio</h1>
          <div className="brand-subtitle">
            <span>Powered by @light-orm/core</span>
            <div className="driver-badge">
              <span className="driver-dot" />
              <span>{driverName || "Postgres Engine"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="header-actions">
        <button
          className="btn btn-secondary"
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh tasks and telemetry"
        >
          <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
          <span>Sync</span>
        </button>

        <button
          className="btn btn-secondary"
          onClick={onSeedData}
          title="Seed realistic sample data"
        >
          <Sparkles size={15} />
          <span>Seed Demo</span>
        </button>

        <button
          className="btn btn-danger-ghost"
          onClick={onClearCompleted}
          title="Delete all finished tasks"
        >
          <Trash2 size={15} />
          <span>Clear Done</span>
        </button>
      </div>
    </header>
  );
};
