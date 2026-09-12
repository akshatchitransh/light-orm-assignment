import React from "react";
import { CheckCircle2, Clock, Layers, Sparkles } from "lucide-react";

interface StatsProps {
  total: number;
  completed: number;
  active: number;
}

export const StatsBar: React.FC<StatsProps> = ({ total, completed, active }) => {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="stats-grid">
      <div className="glass-panel stat-card">
        <div className="stat-header">
          <span>Total Tasks</span>
          <div className="stat-icon-badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818cf8" }}>
            <Layers size={16} />
          </div>
        </div>
        <div className="stat-value-row">
          <div className="stat-value">{total}</div>
          <span className="stat-rate-badge">Database Rows</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: "100%", background: "var(--gradient-primary)" }} />
        </div>
      </div>

      <div className="glass-panel stat-card">
        <div className="stat-header">
          <span>In Progress</span>
          <div className="stat-icon-badge" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
            <Clock size={16} />
          </div>
        </div>
        <div className="stat-value-row">
          <div className="stat-value" style={{ color: "#fbbf24" }}>{active}</div>
          <span className="stat-rate-badge" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fcd34d" }}>
            Active
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${total > 0 ? (active / total) * 100 : 0}%`,
              background: "var(--gradient-amber)",
            }}
          />
        </div>
      </div>

      <div className="glass-panel stat-card">
        <div className="stat-header">
          <span>Completed</span>
          <div className="stat-icon-badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
            <CheckCircle2 size={16} />
          </div>
        </div>
        <div className="stat-value-row">
          <div className="stat-value" style={{ color: "#34d399" }}>{completed}</div>
          <span className="stat-rate-badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#6ee7b7" }}>
            Done
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${percentage}%`,
              background: "var(--gradient-emerald)",
            }}
          />
        </div>
      </div>

      <div className="glass-panel stat-card">
        <div className="stat-header">
          <span>Efficiency</span>
          <div className="stat-icon-badge" style={{ background: "rgba(217, 70, 239, 0.15)", color: "#e879f9" }}>
            <Sparkles size={16} />
          </div>
        </div>
        <div className="stat-value-row">
          <div className="stat-value" style={{ color: "#c084fc" }}>{percentage}%</div>
          <span className="stat-rate-badge" style={{ background: "rgba(217, 70, 239, 0.15)", color: "#f0abfc" }}>
            {percentage === 100 ? "All Done! 🎉" : `${total - completed} left`}
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${percentage}%`,
              background: "linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%)",
            }}
          />
        </div>
      </div>
    </div>
  );
};
