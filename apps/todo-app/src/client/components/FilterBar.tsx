import React from "react";
import { Filter, Search } from "lucide-react";

interface FilterBarProps {
  status: "all" | "active" | "completed";
  onStatusChange: (status: "all" | "active" | "completed") => void;
  priority: string;
  onPriorityChange: (priority: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  status,
  onStatusChange,
  priority,
  onPriorityChange,
  search,
  onSearchChange,
}) => {
  return (
    <div className="glass-panel filter-bar">
      <div className="tabs-group">
        <button
          className={`tab-btn ${status === "all" ? "active" : ""}`}
          onClick={() => onStatusChange("all")}
        >
          All Tasks
        </button>
        <button
          className={`tab-btn ${status === "active" ? "active" : ""}`}
          onClick={() => onStatusChange("active")}
        >
          In Progress
        </button>
        <button
          className={`tab-btn ${status === "completed" ? "active" : ""}`}
          onClick={() => onStatusChange("completed")}
        >
          Completed
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flex: 1, justifyContent: "flex-end" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <Filter size={13} style={{ position: "absolute", left: "0.65rem", color: "var(--text-muted)", pointerEvents: "none" }} />
          <select
            className="input-text"
            style={{ width: "auto", padding: "0.45rem 0.8rem 0.45rem 1.8rem", fontSize: "0.825rem" }}
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value)}
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>

        <div className="search-box">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
