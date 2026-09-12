import React from "react";
import { Search, SlidersHorizontal } from "lucide-react";

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
    <div className="toolbar-card">
      <div className="tab-pill-group">
        <button
          className={`filter-tab ${status === "all" ? "active" : ""}`}
          onClick={() => onStatusChange("all")}
        >
          All Tasks
        </button>
        <button
          className={`filter-tab ${status === "active" ? "active" : ""}`}
          onClick={() => onStatusChange("active")}
        >
          In Progress
        </button>
        <button
          className={`filter-tab ${status === "completed" ? "active" : ""}`}
          onClick={() => onStatusChange("completed")}
        >
          Completed
        </button>
      </div>

      <div className="search-controls-row">
        <select
          className="select-box"
          style={{ width: "140px", flexShrink: 0 }}
          value={priority}
          onChange={(e) => onPriorityChange(e.target.value)}
        >
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <div className="search-wrap">
          <Search size={14} className="search-ico" />
          <input
            type="text"
            className="search-input-field"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <button
          className="nav-btn"
          style={{ padding: "0.5rem 0.65rem" }}
          title="Filter options"
          aria-label="Filter options"
        >
          <SlidersHorizontal size={14} />
        </button>
      </div>
    </div>
  );
};
