import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "../src/client.js";
import { defineModel, number, string, boolean } from "../src/schema.js";
import { MemoryPostgresDriver } from "../src/driver/memory.js";

describe("Lightweight ORM Client End-to-End", () => {
  const Todo = defineModel("todos", {
    id: number().primaryKey().autoIncrement(),
    title: string().notNull(),
    completed: boolean().default(false),
    priority: string().default("medium"),
  });

  let db: ReturnType<typeof createClient<{ todo: typeof Todo }>>;

  beforeEach(async () => {
    const memoryDriver = new MemoryPostgresDriver();
    db = createClient({
      driver: memoryDriver,
      schema: { todo: Todo },
    });
    await db.syncSchema();
  });

  it("should create records and return fully typed models", async () => {
    const created = await db.todo.create({
      title: "Complete ORM assignment",
      priority: "high",
    });

    expect(created.id).toBe(1);
    expect(created.title).toBe("Complete ORM assignment");
    expect(created.completed).toBe(false);
    expect(created.priority).toBe("high");
  });

  it("should find records with WHERE filters and operators", async () => {
    await db.todo.createMany([
      { title: "Task 1", completed: false, priority: "low" },
      { title: "Task 2", completed: true, priority: "medium" },
      { title: "Task 3", completed: false, priority: "high" },
    ]);

    // Find by exact equality
    const active = await db.todo.findMany({
      where: { completed: false },
    });
    expect(active.length).toBe(2);

    // Find with IN operator
    const highOrMedium = await db.todo.findMany({
      where: { priority: { in: ["medium", "high"] } },
    });
    expect(highOrMedium.length).toBe(2);

    // Find with substring search
    const task3 = await db.todo.findMany({
      where: { title: { contains: "3" } },
    });
    expect(task3.length).toBe(1);
    expect(task3[0]?.title).toBe("Task 3");
  });

  it("should find a unique record and first matching record", async () => {
    const item = await db.todo.create({ title: "Unique task" });

    const found = await db.todo.findUnique({
      where: { id: item.id },
    });
    expect(found).not.toBeNull();
    expect(found?.title).toBe("Unique task");

    const first = await db.todo.findFirst({
      where: { title: "Unique task" },
    });
    expect(first?.id).toBe(item.id);
  });

  it("should update records by id", async () => {
    const item = await db.todo.create({ title: "To be updated", completed: false });

    const updated = await db.todo.update({
      where: { id: item.id },
      data: { completed: true, title: "Has been updated" },
    });

    expect(updated.completed).toBe(true);
    expect(updated.title).toBe("Has been updated");

    const reloaded = await db.todo.findUnique({ where: { id: item.id } });
    expect(reloaded?.completed).toBe(true);
  });

  it("should delete records by id", async () => {
    const item = await db.todo.create({ title: "To be deleted" });
    const countBefore = await db.todo.count();

    const deleted = await db.todo.delete({ where: { id: item.id } });
    expect(deleted?.id).toBe(item.id);

    const countAfter = await db.todo.count();
    expect(countAfter).toBe(countBefore - 1);
  });

  it("should support query telemetry listeners", async () => {
    const telemetryEvents: any[] = [];
    const unsubscribe = db.onQuery((evt) => {
      telemetryEvents.push(evt);
    });

    await db.todo.create({ title: "Telemetry test" });
    await db.todo.findMany();

    expect(telemetryEvents.length).toBe(2);
    expect(telemetryEvents[0].sql).toContain("INSERT INTO");
    expect(telemetryEvents[1].sql).toContain("SELECT");
    expect(typeof telemetryEvents[0].durationMs).toBe("number");

    unsubscribe();
  });

  it("should support transactions and rollback on error", async () => {
    try {
      await db.transaction(async (tx) => {
        await tx.todo.create({ title: "Tx task 1" });
        await tx.todo.create({ title: "Tx task 2" });
        throw new Error("Simulated rollback error");
      });
    } catch {
      // expected error
    }

    const all = await db.todo.findMany();
    // Because of rollback, neither task should persist
    expect(all.length).toBe(0);
  });
});
