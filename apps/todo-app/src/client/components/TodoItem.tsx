import React, { useState } from "react";
import { Calendar, Check, Edit2, Tag, Trash2, X } from "lucide-react";
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

  const getPriorityClass = (p: string) => {
    switch (p.toLowerCase()) {
      case "high":
        return "pill-high";
      case "low":
        return "pill-low";
      default:
        return "pill-medium";
    }
  };

  return (
    <div className={`todo-item ${todo.completed ? "completed" : ""}`}>
      <div className="todo-left">
        <button
          type="button"
          className={`custom-checkbox ${todo.completed ? "checked" : ""}`}
          onClick={() => onToggle(todo.id, !todo.completed)}
          aria-label={todo.completed ? "Mark incomplete" : "Mark completed"}
        >
          {todo.completed && <Check size={14} color="white" strokeWidth={3} />}
        </button>

        <div className="todo-content">
          {isEditing ? (
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <input
                type="text"
                className="input-text"
                style={{ padding: "0.25rem 0.5rem", fontSize: "0.95rem" }}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <button className="icon-btn" onClick={handleSaveTitle}>
                <Check size={15} color="#34d399" />
              </button>
              <button
                className="icon-btn"
                onClick={() => {
                  setEditTitle(todo.title);
                  setIsEditing(false);
                }}
              >
                <X size={15} color="#ef4444" />
              </button>
            </div>
          ) : (
            <span
              className={`todo-title ${todo.completed ? "completed" : ""}`}
              onDoubleClick={() => setIsEditing(true)}
            >
              {todo.title}
            </span>
          )}

          <div className="todo-meta">
            <span className={`pill-badge ${getPriorityClass(todo.priority)}`}>
              {todo.priority}
            </span>

            {todo.category && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                <Tag size={12} />
                <span>{todo.category}</span>
              </span>
            )}

            {todo.dueDate && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                <Calendar size={12} />
                <span>{todo.dueDate}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="todo-actions">
        {!isEditing && (
          <button
            className="icon-btn"
            onClick={() => setIsEditing(true)}
            title="Edit title"
          >
            <Edit2 size={15} />
          </button>
        )}

        <button
          className="icon-btn delete-btn"
          onClick={() => onDelete(todo.id)}
          title="Delete task"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
};
