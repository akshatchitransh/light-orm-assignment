import React, { useState } from "react";
import { Calendar, Check, Edit2, Flame, Sparkles, Tag, Trash2, X, Zap } from "lucide-react";
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

  const renderPriorityBadge = () => {
    if (priorityKey === "high") {
      return (
        <span className="pill-badge pill-high">
          <Flame size={11} />
          <span>High</span>
        </span>
      );
    }
    if (priorityKey === "low") {
      return (
        <span className="pill-badge pill-low">
          <Sparkles size={11} />
          <span>Low</span>
        </span>
      );
    }
    return (
      <span className="pill-badge pill-medium">
        <Zap size={11} />
        <span>Medium</span>
      </span>
    );
  };

  return (
    <div className={`todo-item priority-${priorityKey} ${todo.completed ? "completed" : ""}`}>
      <div className="todo-left">
        <button
          type="button"
          className={`custom-checkbox ${todo.completed ? "checked" : ""}`}
          onClick={() => onToggle(todo.id, !todo.completed)}
          aria-label={todo.completed ? "Mark incomplete" : "Mark completed"}
        >
          {todo.completed && <Check size={14} color="white" strokeWidth={3.5} />}
        </button>

        <div className="todo-content">
          {isEditing ? (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="text"
                className="input-text"
                style={{ padding: "0.35rem 0.75rem", fontSize: "0.95rem" }}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <button className="icon-btn" onClick={handleSaveTitle} title="Save changes">
                <Check size={16} color="#34d399" />
              </button>
              <button
                className="icon-btn"
                onClick={() => {
                  setEditTitle(todo.title);
                  setIsEditing(false);
                }}
                title="Cancel"
              >
                <X size={16} color="#ef4444" />
              </button>
            </div>
          ) : (
            <span
              className={`todo-title ${todo.completed ? "completed" : ""}`}
              onDoubleClick={() => setIsEditing(true)}
              title="Double click to edit"
            >
              {todo.title}
            </span>
          )}

          <div className="todo-meta">
            {renderPriorityBadge()}

            {todo.category && (
              <span className="meta-chip">
                <Tag size={11} />
                <span>{todo.category}</span>
              </span>
            )}

            {todo.dueDate && (
              <span className="meta-chip">
                <Calendar size={11} />
                <span>{todo.dueDate}</span>
              </span>
            )}

            <span style={{ fontSize: "0.7rem", color: "var(--text-faint)", marginLeft: "auto" }}>
              ID: #{todo.id}
            </span>
          </div>
        </div>
      </div>

      <div className="todo-actions">
        {!isEditing && (
          <button
            className="icon-btn"
            onClick={() => setIsEditing(true)}
            title="Edit task title"
          >
            <Edit2 size={15} />
          </button>
        )}

        <button
          className="icon-btn delete-btn"
          onClick={() => onDelete(todo.id)}
          title="Delete task via ORM"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
};
