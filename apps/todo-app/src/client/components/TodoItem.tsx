import React, { useState } from "react";
import { Calendar, Check, Trash2 } from "lucide-react";
import { TodoItem as TodoType } from "../../server/db.js";

interface TodoItemProps {
  todo: TodoType;
  onToggle: (id: number, completed: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onUpdateTitle: (id: number, title: string) => Promise<void>;
}

export const TodoItem: React.FC<TodoItemProps> = ({
  todo,
  onToggle,
  onDelete,
  onUpdateTitle,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);

  const handleSaveTitle = async () => {
    if (editTitle.trim() && editTitle.trim() !== todo.title) {
      await onUpdateTitle(todo.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveTitle();
    } else if (e.key === "Escape") {
      setEditTitle(todo.title);
      setIsEditing(false);
    }
  };

  const priorityKey = (todo.priority || "medium").toLowerCase();

  return (
    <div className={`task-item-card ${todo.completed ? "done" : ""}`}>
      <button
        type="button"
        className={`task-checkbox-btn ${todo.completed ? "checked" : ""}`}
        onClick={() => onToggle(todo.id, !todo.completed)}
        aria-label={todo.completed ? "Mark incomplete" : "Mark complete"}
      >
        {todo.completed && <Check size={12} color="white" strokeWidth={3} />}
      </button>

      <div className="task-details">
        {isEditing ? (
          <input
            type="text"
            className="task-input-box"
            style={{ padding: "0.25rem 0.6rem", fontSize: "0.9rem" }}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <span
            className={`task-label ${todo.completed ? "done" : ""}`}
            onClick={() => onToggle(todo.id, !todo.completed)}
            onDoubleClick={() => setIsEditing(true)}
            title="Click to toggle, double-click to edit"
          >
            {todo.title}
          </span>
        )}

        <div className="task-badges-row">
          <span className={`badge-pill priority-${priorityKey}`}>
            {priorityKey.charAt(0).toUpperCase() + priorityKey.slice(1)}
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
        </div>
      </div>

      <button
        className="btn-trash"
        onClick={() => onDelete(todo.id)}
        title="Delete task"
        aria-label="Delete task"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
};
