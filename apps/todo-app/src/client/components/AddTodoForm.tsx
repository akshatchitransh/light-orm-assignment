import React, { useState } from "react";
import { Plus } from "lucide-react";

interface AddTodoFormProps {
  onAdd: (data: {
    title: string;
    priority: string;
    category: string;
    dueDate?: string;
  }) => Promise<void>;
  isLoading: boolean;
}

export const AddTodoForm: React.FC<AddTodoFormProps> = ({ onAdd, isLoading }) => {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [category, setCategory] = useState("Engineering");
  const [dateOption, setDateOption] = useState("Today");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isLoading) return;

    await onAdd({
      title: title.trim(),
      priority,
      category,
      dueDate: dateOption,
    });

    setTitle("");
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
          disabled={isLoading}
        />

        <div className="form-row">
          <div>
            <div className="field-label">Priority</div>
            <div className="segmented-priority">
              {(["low", "medium", "high"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`seg-btn ${priority === p ? "active" : ""}`}
                  onClick={() => setPriority(p)}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
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
        </div>

        <div>
          <div className="field-label">Date</div>
          <select
            className="select-box"
            value={dateOption}
            onChange={(e) => setDateOption(e.target.value)}
          >
            <option value="Today">Today</option>
            <option value="Tomorrow">Tomorrow</option>
            <option value="Fri, Mar 15">Fri, Mar 15</option>
            <option value="Mon, Mar 18">Mon, Mar 18</option>
            <option value="Next Week">Next Week</option>
          </select>
        </div>

        <button
          type="submit"
          className="btn-add-purple"
          disabled={!title.trim() || isLoading}
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Add Task</span>
        </button>
      </form>
    </div>
  );
};
