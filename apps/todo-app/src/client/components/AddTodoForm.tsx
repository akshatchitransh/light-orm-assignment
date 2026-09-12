import React, { useState } from "react";
import { Plus } from "lucide-react";

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
          placeholder="What needs to be done? (e.g. Write comprehensive ORM documentation)"
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
          <span className="priority-label">Priority:</span>
          <button
            type="button"
            className={`priority-btn priority-low ${priority === "low" ? "active" : ""}`}
            onClick={() => setPriority("low")}
          >
            Low
          </button>
          <button
            type="button"
            className={`priority-btn priority-medium ${priority === "medium" ? "active" : ""}`}
            onClick={() => setPriority("medium")}
          >
            Medium
          </button>
          <button
            type="button"
            className={`priority-btn priority-high ${priority === "high" ? "active" : ""}`}
            onClick={() => setPriority("high")}
          >
            High
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select
            className="input-text"
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem", width: "auto" }}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="General">General</option>
            <option value="Engineering">Engineering</option>
            <option value="Work">Work</option>
            <option value="DevOps">DevOps</option>
            <option value="Personal">Personal</option>
          </select>

          <input
            type="date"
            className="input-text"
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem", width: "auto" }}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>
    </form>
  );
};
