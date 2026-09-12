import React from "react";
import { CheckCircle2, Circle, Layers, TrendingUp } from "lucide-react";

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
          <Layers size={16} />
        </div>
        <div className="stat-value">{total}</div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: "100%" }} />
        </div>
      </div>

      <div className="glass-panel stat-card">
        <div className="stat-header">
          <span>Active</span>
          <Circle size={16} />
        </div>
        <div className="stat-value" style={{ color: "#fbbf24" }}>{active}</div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${total > 0 ? (active / total) * 100 : 0}%`,
              background: "#fbbf24",
            }}
          />
        </div>
      </div>

      <div className="glass-panel stat-card">
        <div className="stat-header">
          <span>Completed</span>
          <CheckCircle2 size={16} />
        </div>
        <div className="stat-value" style={{ color: "#34d399" }}>{completed}</div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${percentage}%`,
              background: "#34d399",
            }}
          />
        </div>
      </div>

      <div className="glass-panel stat-card">
        <div className="stat-header">
          <span>Completion Rate</span>
          <TrendingUp size={16} />
        </div>
        <div className="stat-value" style={{ color: "#818cf8" }}>{percentage}%</div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${percentage}%` }} />
        </div>
      </div>
    </div>
  );
};
