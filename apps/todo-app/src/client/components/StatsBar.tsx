import React from "react";
import { ArrowUpRight, CheckCircle2, Clock, ListTodo } from "lucide-react";

interface StatsProps {
  total: number;
  completed: number;
  active: number;
}

export const StatsBar: React.FC<StatsProps> = ({ total, completed, active }) => {
  const efficiency = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bento-metrics-grid">
      <div className="metric-pill-card">
        <div className="metric-header">
          <span className="metric-label">Total Tasks</span>
          <ListTodo size={17} />
        </div>
        <div className="metric-number">{total}</div>
      </div>

      <div className="metric-pill-card">
        <div className="metric-header">
          <span className="metric-label">In Progress</span>
          <Clock size={17} />
        </div>
        <div className="metric-number">{active}</div>
      </div>

      <div className="metric-pill-card">
        <div className="metric-header">
          <span className="metric-label">Completed</span>
          <CheckCircle2 size={17} />
        </div>
        <div className="metric-number">{completed}</div>
      </div>

      <div className="metric-pill-card">
        <div className="metric-header">
          <span className="metric-label">Efficiency Rate</span>
          <ArrowUpRight size={17} />
        </div>
        <div className="metric-number">{efficiency}%</div>
        <div className="metric-bar-track">
          <div
            className="metric-bar-fill"
            style={{ width: `${efficiency}%` }}
          />
        </div>
      </div>
    </div>
  );
};
