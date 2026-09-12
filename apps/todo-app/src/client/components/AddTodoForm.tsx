import React, { useState } from "react";
import { ArrowDown, ArrowUp, Calendar, Loader2, Minus, Plus } from "lucide-react";

interface AddTodoFormProps {
  onAdd: (data: {
    title: string;
    priority: string;
    category: string;
    dueDate?: string;
  }) => Promise<void>;
  isLoading: boolean;
}

export const AddTodoForm: React.FC<AddTodoFormProps> = ({ onAdd }) => {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [category, setCategory] = useState("Engineering");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default to today's date formatted as YYYY-MM-DD for native input
  const getTodayStr = () => new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [activePreset, setActivePreset] = useState<string>("today");

  const formatDisplayDate = (isoStr: string) => {
    if (!isoStr) return "No date";
    const today = getTodayStr();
    if (isoStr === today) return "Today";

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    if (isoStr === tomorrowStr) return "Tomorrow";

    try {
      const d = new Date(isoStr + "T00:00:00");
      return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    } catch {
      return isoStr;
    }
  };

  const handleSetPreset = (preset: "today" | "tomorrow" | "next-week") => {
    setActivePreset(preset);
    const d = new Date();
    if (preset === "tomorrow") {
      d.setDate(d.getDate() + 1);
    } else if (preset === "next-week") {
      d.setDate(d.getDate() + 7);
    }
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleCustomDateChange = (val: string) => {
    setSelectedDate(val);
    setActivePreset("custom");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const displayDueDate = formatDisplayDate(selectedDate);
      await onAdd({
        title: cleanTitle,
        priority,
        category,
        dueDate: displayDueDate,
      });
      setTitle("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="clean-card">
      <h2 className="card-heading">New task</h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <input
          type="text"
          className="task-input-box"
          placeholder="What needs to get done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isSubmitting}
        />

        <div>
          <div className="field-label">Priority</div>
          <div className="segmented-priority">
            <button
              type="button"
              className={`seg-btn ${priority === "low" ? "active" : ""}`}
              onClick={() => setPriority("low")}
            >
              <ArrowDown size={12} />
              <span>Low</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${priority === "medium" ? "active" : ""}`}
              onClick={() => setPriority("medium")}
            >
              <Minus size={12} />
              <span>Medium</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${priority === "high" ? "active" : ""}`}
              onClick={() => setPriority("high")}
            >
              <ArrowUp size={12} />
              <span>High</span>
            </button>
          </div>
        </div>

        <div>
          <div className="field-label">Category</div>
          <select
            className="select-box"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="Engineering">Engineering</option>
            <option value="Product">Product</option>
            <option value="DevOps">DevOps</option>
            <option value="Design">Design</option>
            <option value="General">General</option>
          </select>
        </div>

        {/* Interactive Calendar Date Picker */}
        <div>
          <div className="field-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Due Date</span>
            <span style={{ fontSize: "0.72rem", color: "var(--brand-primary)", fontWeight: 700 }}>
              {formatDisplayDate(selectedDate)}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            <div className="calendar-input-wrapper">
              <Calendar size={14} className="calendar-icon" />
              <input
                type="date"
                className="calendar-date-input"
                value={selectedDate}
                onChange={(e) => handleCustomDateChange(e.target.value)}
                title="Select due date from calendar"
              />
            </div>

            <div className="date-presets-bar">
              <button
                type="button"
                className={`date-preset-chip ${activePreset === "today" ? "active" : ""}`}
                onClick={() => handleSetPreset("today")}
              >
                Today
              </button>
              <button
                type="button"
                className={`date-preset-chip ${activePreset === "tomorrow" ? "active" : ""}`}
                onClick={() => handleSetPreset("tomorrow")}
              >
                Tomorrow
              </button>
              <button
                type="button"
                className={`date-preset-chip ${activePreset === "next-week" ? "active" : ""}`}
                onClick={() => handleSetPreset("next-week")}
              >
                Next Week
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn-add-teal"
          disabled={!title.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Plus size={16} strokeWidth={2.5} />
          )}
          <span>{isSubmitting ? "Adding task..." : "Add Task"}</span>
        </button>
      </form>
    </div>
  );
};
