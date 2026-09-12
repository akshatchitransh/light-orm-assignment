import React, { useEffect, useState, useCallback } from "react";
import { Header } from "./components/Header.js";
import { StatsBar } from "./components/StatsBar.js";
import { AddTodoForm } from "./components/AddTodoForm.js";
import { FilterBar } from "./components/FilterBar.js";
import { TodoItem } from "./components/TodoItem.js";
import { SqlInspector } from "./components/SqlInspector.js";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { TodoItem as TodoType, QueryTelemetryItem } from "../server/db.js";

interface AppStats {
  total: number;
  completed: number;
  active: number;
  driver: string;
}

export const App: React.FC = () => {
  const [todos, setTodos] = useState<TodoType[]>([]);
  const [stats, setStats] = useState<AppStats>({
    total: 0,
    completed: 0,
    active: 0,
    driver: "Memory Engine",
  });
  const [queries, setQueries] = useState<QueryTelemetryItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchQueries = async () => {
    try {
      const res = await fetch("/api/telemetry/queries");
      const json = await res.json();
      if (json.success) {
        setQueries(json.queries);
      }
    } catch {
      // ignore query fetch errors
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const json = await res.json();
      if (json.success) {
        setStats(json.stats);
      }
    } catch {
      // ignore
    }
  };

  const fetchTodos = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);
      if (search.trim()) params.append("search", search.trim());

      const res = await fetch(`/api/todos?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setTodos(json.data);
      }
    } catch (err: any) {
      console.error("Failed to load todos:", err);
    } finally {
      setIsLoading(false);
      fetchStats();
      fetchQueries();
    }
  }, [statusFilter, priorityFilter, search]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const handleAddTodo = async (data: {
    title: string;
    priority: string;
    category: string;
    dueDate?: string;
  }) => {
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        showToast("Task created via db.todo.create()");
        fetchTodos();
      }
    } catch (err: any) {
      console.error("Failed to create todo:", err);
    }
  };

  const handleToggle = async (id: number, completed: boolean) => {
    // Optimistic UI update
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed } : t))
    );

    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(completed ? "Marked completed via db.todo.update()" : "Marked active");
        fetchStats();
        fetchQueries();
      }
    } catch (err) {
      console.error("Failed to update todo:", err);
      fetchTodos();
    }
  };

  const handleUpdateTitle = async (id: number, title: string) => {
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("Title updated via db.todo.update()");
        fetchTodos();
      }
    } catch (err) {
      console.error("Failed to update title:", err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/todos/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        showToast("Deleted via db.todo.delete()");
        fetchTodos();
      }
    } catch (err) {
      console.error("Failed to delete todo:", err);
    }
  };

  const handleSeedData = async () => {
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        showToast("Demo tasks seeded via db.todo.createMany()");
        fetchTodos();
      }
    } catch (err) {
      console.error("Failed to seed:", err);
    }
  };

  const handleClearCompleted = async () => {
    try {
      const res = await fetch("/api/todos-completed", { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        showToast(`Cleared ${json.deletedCount} tasks via db.todo.deleteMany()`);
        fetchTodos();
      }
    } catch (err) {
      console.error("Failed to clear:", err);
    }
  };

  return (
    <div className="app-container">
      <Header
        driverName={stats.driver}
        onRefresh={fetchTodos}
        onSeedData={handleSeedData}
        onClearCompleted={handleClearCompleted}
        isLoading={isLoading}
      />

      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "2rem",
            right: "2rem",
            background: "rgba(30, 41, 59, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(99, 102, 241, 0.4)",
            color: "#818cf8",
            padding: "0.75rem 1.25rem",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            zIndex: 9999,
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={16} color="#34d399" />
          <span>{toastMessage}</span>
        </div>
      )}

      <StatsBar
        total={stats.total}
        completed={stats.completed}
        active={stats.active}
      />

      <AddTodoForm onAdd={handleAddTodo} isLoading={isLoading} />

      <FilterBar
        status={statusFilter}
        onStatusChange={setStatusFilter}
        priority={priorityFilter}
        onPriorityChange={setPriorityFilter}
        search={search}
        onSearchChange={setSearch}
      />

      {todos.length === 0 ? (
        <div className="glass-panel empty-state">
          <div className="empty-icon">
            <ClipboardList size={28} />
          </div>
          <div className="empty-title">No tasks found</div>
          <div className="empty-subtitle">
            {search || statusFilter !== "all" || priorityFilter !== "all"
              ? "No tasks match your current filter settings. Try adjusting or clearing filters."
              : "All tasks completed! Click 'Seed Demo' or add a new task above."}
          </div>
        </div>
      ) : (
        <div className="todo-list">
          {todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onUpdateTitle={handleUpdateTitle}
            />
          ))}
        </div>
      )}

      <SqlInspector queries={queries} />
    </div>
  );
};
