import React, { useEffect, useState, useCallback } from "react";
import { Header } from "./components/Header.js";
import { StatsBar } from "./components/StatsBar.js";
import { AddTodoForm } from "./components/AddTodoForm.js";
import { FilterBar } from "./components/FilterBar.js";
import { TodoItem } from "./components/TodoItem.js";
import { SqlInspector } from "./components/SqlInspector.js";
import { AlertCircle, CheckCircle2, Clock, Sparkles, Zap } from "lucide-react";
import { TodoItem as TodoType, QueryTelemetryItem } from "../server/db.js";

interface AppStats {
  total: number;
  completed: number;
  active: number;
  driver: string;
}

export const App: React.FC = () => {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("light-orm-theme") as "light" | "dark") || "light";
  });

  const [todos, setTodos] = useState<TodoType[]>([]);
  const [stats, setStats] = useState<AppStats>({
    total: 0,
    completed: 0,
    active: 0,
    driver: "postgres",
  });
  const [queries, setQueries] = useState<QueryTelemetryItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("light-orm-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 3200);
  };

  const fetchQueries = async () => {
    try {
      const res = await fetch("/api/telemetry/queries");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setQueries(json.queries);
      }
    } catch {
      // ignore
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) return;
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
      if (!res.ok) {
        const errorText = await res.text();
        console.error("API error fetching todos:", res.status, errorText);
        showToast(`API error (${res.status}): Failed to load tasks`, true);
        return;
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTodos(json.data);
      }
    } catch (err: any) {
      console.error("Failed to load todos:", err);
      showToast(`Network error: ${err.message}`, true);
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
    // 1. Instant optimistic UI update
    const tempId = -Date.now();
    const tempTodo: TodoType = {
      id: tempId,
      title: data.title,
      completed: false,
      priority: data.priority,
      category: data.category,
      dueDate: data.dueDate,
      createdAt: new Date().toISOString(),
    };

    setTodos((prev) => [tempTodo, ...prev]);
    setStats((prev) => ({
      ...prev,
      total: prev.total + 1,
      active: prev.active + 1,
    }));

    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server returned ${res.status}: ${errText.slice(0, 80)}`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        // Replace optimistic task with permanent database record
        setTodos((prev) => prev.map((t) => (t.id === tempId ? json.data : t)));
        showToast("Task created via db.todo.create()");
        fetchStats();
        fetchQueries();
      } else {
        throw new Error(json.error || "Failed to create task");
      }
    } catch (err: any) {
      console.error("Failed to create todo:", err);
      // Rollback optimistic update
      setTodos((prev) => prev.filter((t) => t.id !== tempId));
      setStats((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
        active: Math.max(0, prev.active - 1),
      }));
      showToast(err.message || "Failed to save task to database", true);
    }
  };

  const handleToggle = async (id: number, completed: boolean) => {
    // 1. Instant optimistic UI update
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed } : t))
    );
    setStats((prev) => ({
      ...prev,
      completed: completed ? prev.completed + 1 : Math.max(0, prev.completed - 1),
      active: completed ? Math.max(0, prev.active - 1) : prev.active + 1,
    }));

    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        showToast(completed ? "Completed via db.todo.update()" : "Reopened via db.todo.update()");
        fetchStats();
        fetchQueries();
      }
    } catch (err) {
      console.error("Failed to update todo:", err);
      // Rollback on error
      fetchTodos();
    }
  };

  const handleUpdateTitle = async (id: number, title: string) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        showToast("Title updated via db.todo.update()");
        fetchTodos();
      }
    } catch (err: any) {
      console.error("Failed to update title:", err);
      showToast("Failed to update title", true);
      fetchTodos();
    }
  };

  const handleDelete = async (id: number) => {
    // 1. Instant optimistic UI update
    const target = todos.find((t) => t.id === id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
    if (target) {
      setStats((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
        completed: target.completed ? Math.max(0, prev.completed - 1) : prev.completed,
        active: !target.completed ? Math.max(0, prev.active - 1) : prev.active,
      }));
    }

    try {
      const res = await fetch(`/api/todos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        showToast("Deleted via db.todo.delete()");
        fetchStats();
        fetchQueries();
      }
    } catch (err) {
      console.error("Failed to delete todo:", err);
      showToast("Failed to delete task from database", true);
      fetchTodos();
    }
  };

  const handleSeedData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        showToast("Demo tasks seeded via db.todo.createMany()");
        fetchTodos();
      }
    } catch (err: any) {
      console.error("Failed to seed:", err);
      showToast("Failed to seed demo data", true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCompleted = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/todos-completed", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        showToast(`Cleared ${json.deletedCount} tasks via db.todo.deleteMany()`);
        fetchTodos();
      }
    } catch (err: any) {
      console.error("Failed to clear:", err);
      showToast("Failed to clear completed tasks", true);
    } finally {
      setIsLoading(false);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="app-wrapper">
      {/* Top Header Navigation */}
      <Header
        driverName={stats.driver}
        theme={theme}
        onToggleTheme={toggleTheme}
        onRefresh={fetchTodos}
        onSeedData={handleSeedData}
        onClearCompleted={handleClearCompleted}
        isLoading={isLoading}
      />

      {/* Hero Greeting Section with Beautiful 3D Neon Database Image */}
      <section className="hero-section">
        <div className="greeting-card">
          <div className="tag-pill">
            <Sparkles size={12} />
            <span>A focused workspace</span>
          </div>
          <h2 className="greeting-title">{greeting}, Alex</h2>
          <p className="greeting-subtext">A calm place to move today's work forward.</p>
          <div className="focus-count-pill">
            <Clock size={13} />
            <span>{stats.active} tasks need your focus</span>
          </div>
        </div>

        {/* 3D Neon Cloud Database Artwork */}
        <div className="hero-artwork-card">
          <img
            src="/hero-db-art.jpg"
            alt="Neon Serverless PostgreSQL Database"
            className="hero-artwork-img"
          />
          <div className="hero-artwork-badge">
            <Zap size={11} fill="#34d399" />
            <span>Neon Serverless Postgres</span>
          </div>
        </div>
      </section>

      {/* 4 Bento Metric Cards */}
      <StatsBar
        total={stats.total}
        completed={stats.completed}
        active={stats.active}
      />

      {/* Main 2-Column Workspace Grid: Left Form (320px) | Right Feed (1fr) */}
      <div className="workspace-grid">
        {/* Left Column: New Task Card */}
        <AddTodoForm onAdd={handleAddTodo} isLoading={isLoading} />

        {/* Right Column: Filter Bar & Today's Tasks */}
        <div className="right-workspace-feed">
          <FilterBar
            status={statusFilter}
            onStatusChange={setStatusFilter}
            priority={priorityFilter}
            onPriorityChange={setPriorityFilter}
            search={search}
            onSearchChange={setSearch}
          />

          <div>
            <div className="tasks-header">
              <h3 className="card-heading" style={{ fontSize: "1.05rem" }}>Today's tasks</h3>
              <span className="tasks-count-tag">{todos.length}</span>
            </div>

            {todos.length === 0 ? (
              <div className="clean-card" style={{ textAlign: "center", padding: "2.5rem 1.5rem", color: "var(--text-sub)" }}>
                <Sparkles size={24} style={{ margin: "0 auto 0.5rem auto", color: "var(--brand-primary)" }} />
                <p style={{ fontWeight: 600, color: "var(--text-main)", marginBottom: "0.25rem" }}>No tasks to show</p>
                <p style={{ fontSize: "0.85rem" }}>Click "+ Add Task" or "Seed Demo" to populate your tasks.</p>
              </div>
            ) : (
              <div className="tasks-list">
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
          </div>
        </div>
      </div>

      {/* Bottom Full-Width SQL Inspector */}
      <SqlInspector queries={queries} onRefreshTasks={fetchTodos} />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          className="toast-bar"
          style={toastMessage.isError ? { background: "#7f1d1d", color: "#fecaca" } : undefined}
        >
          {toastMessage.isError ? (
            <AlertCircle size={16} color="#f87171" />
          ) : (
            <CheckCircle2 size={16} color="#34d399" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
};
