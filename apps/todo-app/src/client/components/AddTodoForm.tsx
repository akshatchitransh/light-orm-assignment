import React, { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Minus, Plus } from "lucide-react";

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
  const [dateOption, setDateOption] = useState("Today");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAdd({
        title: cleanTitle,
        priority,
        category,
        dueDate: dateOption,
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
