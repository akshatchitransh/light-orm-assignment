import React, { useState } from "react";
import { Flame, Plus, Sparkles, Tag, Zap } from "lucide-react";

interface AddTodoFormProps {
  onAdd: (data: { title: string; priority: string; category: string; dueDate?: string }) => Promise<void>;
  isLoading: boolean;
}

export const AddTodoForm: React.FC<AddTodoFormProps> = ({ onAdd, isLoading }) => {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [category, setCategory] = useState("General");
  const [dueDate, setDueDate] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isLoading) return;

    await onAdd({
      title: title.trim(),
      priority,
      category,
      dueDate: dueDate || undefined,
    });

    setTitle("");
  };

  return (
    <form className="glass-panel add-card" onSubmit={handleSubmit}>
      <div className="add-input-row">
        <input
          type="text"
          className="input-text"
          placeholder="Create a new task via @light-orm/core... (e.g. Implement schema introspection CLI)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isLoading}
          autoFocus
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!title.trim() || isLoading}
        >
          <Plus size={18} />
          <span>Add Task</span>
        </button>
      </div>

      <div className="add-options-row">
        <div className="priority-selector">
          <button
            type="button"
            className={`priority-btn priority-low ${priority === "low" ? "active" : ""}`}
            onClick={() => setPriority("low")}
          >
            <Sparkles size={12} />
            <span>Low</span>
          </button>
          <button
            type="button"
            className={`priority-btn priority-medium ${priority === "medium" ? "active" : ""}`}
            onClick={() => setPriority("medium")}
          >
            <Zap size={12} />
            <span>Medium</span>
          </button>
          <button
            type="button"
            className={`priority-btn priority-high ${priority === "high" ? "active" : ""}`}
            onClick={() => setPriority("high")}
          >
            <Flame size={12} />
            <span>High</span>
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Tag size={13} style={{ position: "absolute", left: "0.65rem", color: "var(--text-muted)", pointerEvents: "none" }} />
            <select
              className="input-text"
              style={{ padding: "0.4rem 0.8rem 0.4rem 1.9rem", fontSize: "0.8rem", width: "auto" }}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="General">General</option>
              <option value="Engineering">Engineering</option>
              <option value="Architecture">Architecture</option>
              <option value="DevOps">DevOps</option>
              <option value="Product">Product</option>
            </select>
          </div>

          <input
            type="date"
            className="input-text"
            style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem", width: "auto" }}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            title="Optional due date"
          />
        </div>
      </div>
    </form>
  );
};
