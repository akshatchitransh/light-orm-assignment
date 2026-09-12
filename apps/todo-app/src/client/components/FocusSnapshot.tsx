import React from "react";
import { MoreHorizontal } from "lucide-react";

interface FocusSnapshotProps {
  total: number;
  completed: number;
  active: number;
}

export const FocusSnapshot: React.FC<FocusSnapshotProps> = ({
  total,
  completed,
  active,
}) => {
  const efficiency = total > 0 ? Math.round((completed / total) * 100) : 0;
  const onTrackRate = total > 0 ? Math.min(100, Math.round(efficiency * 1.15 + 15)) : 0;

  return (
    <div className="snapshot-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 className="card-heading">Focus snapshot</h3>
        <button
          className="btn-trash"
          style={{ padding: "0.2rem" }}
          title="Snapshot options"
          aria-label="Snapshot options"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      <div className="snapshot-headline">
        <div className="snapshot-big-num">{efficiency}%</div>
        <div>
          <div className="snapshot-phrase">You're building a strong rhythm</div>
          <span className="badge-keep-going">Keep going</span>
        </div>
      </div>

      <div className="snapshot-breakdown">
        <div className="snapshot-row">
          <span>Completed</span>
          <span className="snapshot-row-val">{completed}</span>
        </div>
        <div className="snapshot-row">
          <span>Remaining</span>
          <span className="snapshot-row-val">{active}</span>
        </div>
        <div className="snapshot-row">
          <span>On track</span>
          <span className="snapshot-row-val">{onTrackRate}%</span>
        </div>
      </div>
    </div>
  );
};
