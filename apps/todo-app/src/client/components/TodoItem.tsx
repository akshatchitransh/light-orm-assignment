import React, { useState } from "react";
import { ArrowDown, ArrowUp, Calendar, Check, Minus, Trash2, X } from "lucide-react";
import { TodoItem as TodoType } from "../../server/db.js";

interface TodoItemProps {
  todo: TodoType;
  onToggle: (id: number, completed: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onUpdate: (
    id: number,
    data: { title?: string; priority?: string; category?: string; dueDate?: string }
  ) => Promise<void>;
}

export const TodoItem: React.FC<TodoItemProps> = ({
  todo,
  onToggle,
  onDelete,
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const [editPriority, setEditPriority] = useState(todo.priority || "medium");
  const [editCategory, setEditCategory] = useState(todo.category || "Engineering");
  const [editDueDate, setEditDueDate] = useState(todo.dueDate || "Today");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!editTitle.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await onUpdate(todo.id, {
        title: editTitle.trim(),
        priority: editPriority,
        category: editCategory,
        dueDate: editDueDate,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditTitle(todo.title);
    setEditPriority(todo.priority || "medium");
    setEditCategory(todo.category || "Engineering");
    setEditDueDate(todo.dueDate || "Today");
    setIsEditing(false);
  };

  const priorityKey = (todo.priority || "medium").toLowerCase();

  return (
    <div className={`task-item-card ${todo.completed ? "done" : ""}`}>
      {!isEditing && (
        <button
          type="button"
          className={`task-checkbox-btn ${todo.completed ? "checked" : ""}`}
          onClick={() => onToggle(todo.id, !todo.completed)}
          aria-label={todo.completed ? "Mark incomplete" : "Mark complete"}
        >
          {todo.completed && <Check size={12} color="white" strokeWidth={3} />}
        </button>
      )}

      <div className="task-details">
        {isEditing ? (
          /* Full Task Edit Mode */
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
            <div>
              <div className="field-label" style={{ marginBottom: "0.25rem" }}>Task Title</div>
              <input
                type="text"
                className="task-input-box"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Task title..."
                autoFocus
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.6rem" }}>
              <div>
                <div className="field-label">Priority</div>
                <div className="segmented-priority" style={{ padding: "0.15rem" }}>
                  <button
                    type="button"
                    className={`seg-btn ${editPriority === "low" ? "active" : ""}`}
                    onClick={() => setEditPriority("low")}
                    style={{ padding: "0.3rem 0" }}
                  >
                    <ArrowDown size={11} />
                    <span>Low</span>
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${editPriority === "medium" ? "active" : ""}`}
                    onClick={() => setEditPriority("medium")}
                    style={{ padding: "0.3rem 0" }}
                  >
                    <Minus size={11} />
                    <span>Med</span>
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${editPriority === "high" ? "active" : ""}`}
                    onClick={() => setEditPriority("high")}
                    style={{ padding: "0.3rem 0" }}
                  >
                    <ArrowUp size={11} />
                    <span>High</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="field-label">Category</div>
                <select
                  className="select-box"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  style={{ padding: "0.4rem 0.6rem", fontSize: "0.78rem" }}
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Product">Product</option>
                  <option value="DevOps">DevOps</option>
                  <option value="Design">Design</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div>
                <div className="field-label">Due Date</div>
                <div className="calendar-input-wrapper" style={{ padding: "0.35rem 0.6rem" }}>
                  <Calendar size={13} className="calendar-icon" />
                  <input
                    type="text"
                    className="calendar-date-input"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    placeholder="e.g. Tomorrow"
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", justifyContent: "flex-end", marginTop: "0.2rem" }}>
              <button
                type="button"
                className="nav-btn"
                onClick={handleCancel}
                style={{ padding: "0.35rem 0.8rem", fontSize: "0.78rem" }}
              >
                <X size={13} />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                className="btn-add-teal"
                onClick={handleSave}
                disabled={isSaving || !editTitle.trim()}
                style={{ width: "auto", padding: "0.35rem 0.95rem", fontSize: "0.78rem" }}
              >
                <Check size={13} />
                <span>{isSaving ? "Updating SQL..." : "Save (UPDATE)"}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Normal Task View */
          <>
            <div className="task-title-row">
              <span
                className={`task-label ${todo.completed ? "done" : ""}`}
                onClick={() => onToggle(todo.id, !todo.completed)}
                onDoubleClick={() => setIsEditing(true)}
                title="Click to toggle, double-click to edit"
              >
                {todo.title}
              </span>
              <button
                type="button"
                className="btn-edit-link"
                onClick={() => setIsEditing(true)}
                title="Edit task & run SQL UPDATE"
              >
                Edit
              </button>
            </div>

            <div className="task-badges-row">
              <span className={`badge-pill priority-${priorityKey}`}>
                {priorityKey}
              </span>

              {todo.category && (
                <span className="badge-pill category-chip">{todo.category}</span>
              )}

              {todo.dueDate && (
                <span className="badge-pill date-chip">
                  <Calendar size={10} />
                  <span>{todo.dueDate}</span>
                </span>
              )}

              <span style={{ fontSize: "0.68rem", color: "var(--text-faint)", marginLeft: "auto" }}>
                #{todo.id}
              </span>
            </div>
          </>
        )}
      </div>

      {!isEditing && (
        <button
          className="btn-trash"
          onClick={() => onDelete(todo.id)}
          title="Delete task"
          aria-label="Delete task"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
};
