import React from "react";
import { Moon, RefreshCw, Sparkles, Sun, Trash2 } from "lucide-react";

interface HeaderProps {
  driverName: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onSeedData: () => void;
  onClearCompleted: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  driverName,
  theme,
  onToggleTheme,
  onSeedData,
  onClearCompleted,
  onRefresh,
  isLoading,
}) => {
  const isPostgres = driverName.includes("postgres");
  const driverLabel = isPostgres ? "Neon Serverless Postgres" : "In-Memory Engine";

  return (
    <header className="top-nav">
      <div className="brand-section">
        <div className="brand-pill-bar" />
        <div>
          <h1 className="brand-title">LightORM Studio</h1>
          <div className="brand-subline">
            <span className="neon-dot" />
            <span>{driverLabel}</span>
          </div>
        </div>
      </div>

      <div className="nav-actions">
        <button
          className="nav-btn"
          onClick={onRefresh}
          disabled={isLoading}
          title="Sync with database"
        >
          <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
          <span>Sync</span>
        </button>

        <button
          className="nav-btn"
          onClick={onSeedData}
          title="Seed realistic demo tasks"
        >
          <Sparkles size={13} color="var(--purple-primary)" />
          <span>Seed Demo</span>
        </button>

        <button
          className="nav-btn danger"
          onClick={onClearCompleted}
          title="Clear all completed tasks"
        >
          <Trash2 size={13} />
          <span>Clear Done</span>
        </button>

        <button
          className="theme-toggle-btn"
          onClick={onToggleTheme}
          title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
          aria-label="Toggle theme"
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>
    </header>
  );
};
