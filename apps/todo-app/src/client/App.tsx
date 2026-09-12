import React, { useEffect, useState, useCallback } from "react";
import { Header } from "./components/Header.js";
import { StatsBar } from "./components/StatsBar.js";
import { AddTodoForm } from "./components/AddTodoForm.js";
import { FilterBar } from "./components/FilterBar.js";
import { TodoItem } from "./components/TodoItem.js";
import { FocusSnapshot } from "./components/FocusSnapshot.js";
import { SqlInspector } from "./components/SqlInspector.js";
import { CheckCircle2, Clock, Sparkles, Zap } from "lucide-react";
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("light-orm-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchQueries = async () => {
    try {
      const res = await fetch("/api/telemetry/queries");
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
        showToast(completed ? "Completed via db.todo.update()" : "Reopened via db.todo.update()");
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

  // Determine dynamic greeting
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

      {/* Hero Greeting Section */}
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

        <div className="focus-artwork-card">
          <img
            src="/focus-mode.jpg"
            alt="3D Focus Artwork"
            className="focus-artwork-img"
          />
          <div className="focus-artwork-badge">
            <Zap size={11} fill="white" />
            <span>Focus mode</span>
          </div>
        </div>
      </section>

      {/* 4 Bento Metric Cards */}
      <StatsBar
        total={stats.total}
        completed={stats.completed}
        active={stats.active}
      />

      {/* Main 2-Column Grid */}
      <div className="workspace-grid">
        {/* Left Column: Form, Filters, Tasks */}
        <div className="left-feed">
          <AddTodoForm onAdd={handleAddTodo} isLoading={isLoading} />

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
                <Sparkles size={24} style={{ margin: "0 auto 0.5rem auto", color: "var(--purple-primary)" }} />
                <p style={{ fontWeight: 600, color: "var(--text-main)", marginBottom: "0.25rem" }}>No tasks to show</p>
                <p style={{ fontSize: "0.85rem" }}>Click "+ Add Task" or "Seed Demo" above to create your tasks.</p>
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

        {/* Right Column: Focus Snapshot & SQL Inspector */}
        <div className="right-sidebar">
          <FocusSnapshot
            total={stats.total}
            completed={stats.completed}
            active={stats.active}
          />

          <SqlInspector queries={queries} />
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="toast-bar">
          <CheckCircle2 size={16} color="#34d399" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
