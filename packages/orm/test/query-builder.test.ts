import { describe, it, expect } from "vitest";
import { QueryBuilder } from "../src/query-builder.js";
import { defineModel, number, string, boolean, timestamp } from "../src/schema.js";

describe("QueryBuilder SQL Compiler", () => {
  const Todo = defineModel("todos", {
    id: number().primaryKey().autoIncrement(),
    title: string().notNull(),
    completed: boolean().default(false),
    priority: string().default("medium"),
    createdAt: timestamp().default("NOW()"),
  });

  describe("SELECT queries", () => {
    it("should build basic SELECT * FROM table", () => {
      const q = QueryBuilder.select("todos");
      expect(q.sql).toBe('SELECT * FROM "todos"');
      expect(q.params).toEqual([]);
    });

    it("should build SELECT with column projection", () => {
      const q = QueryBuilder.select("todos", {
        select: ["id", "title"],
      });
      expect(q.sql).toBe('SELECT "id", "title" FROM "todos"');
    });

    it("should build SELECT with simple equality WHERE", () => {
      const q = QueryBuilder.select("todos", {
        where: { completed: false },
      });
      expect(q.sql).toBe('SELECT * FROM "todos" WHERE "completed" = $1');
      expect(q.params).toEqual([false]);
    });

    it("should build SELECT with advanced comparison operators", () => {
      const q = QueryBuilder.select("todos", {
        where: {
          id: { gt: 10 },
          priority: { in: ["high", "urgent"] },
          title: { contains: "assignment" },
        },
        orderBy: { id: "desc" },
        limit: 10,
        offset: 20,
      });

      expect(q.sql).toContain('"id" > $1');
      expect(q.sql).toContain('"priority" IN ($2, $3)');
      expect(q.sql).toContain('"title" ILIKE $4');
      expect(q.sql).toContain('ORDER BY "id" DESC');
      expect(q.sql).toContain("LIMIT $5");
      expect(q.sql).toContain("OFFSET $6");
      expect(q.params).toEqual([10, "high", "urgent", "%assignment%", 10, 20]);
    });

    it("should handle IS NULL and IS NOT NULL", () => {
      const q = QueryBuilder.select("todos", {
        where: {
          title: { isNull: true },
          priority: { isNull: false },
        },
      });
      expect(q.sql).toBe('SELECT * FROM "todos" WHERE "title" IS NULL AND "priority" IS NOT NULL');
      expect(q.params).toEqual([]);
    });

    it("should compile OR clauses correctly", () => {
      const q = QueryBuilder.select("todos", {
        where: {
          OR: [{ completed: true }, { priority: "urgent" }],
        },
      });
      expect(q.sql).toBe('SELECT * FROM "todos" WHERE ("completed" = $1 OR "priority" = $2)');
      expect(q.params).toEqual([true, "urgent"]);
    });
  });

  describe("INSERT queries", () => {
    it("should build parameterized INSERT with RETURNING *", () => {
      const q = QueryBuilder.insert("todos", {
        title: "Finish lightweight ORM",
        completed: false,
      });

      expect(q.sql).toBe('INSERT INTO "todos" ("title", "completed") VALUES ($1, $2) RETURNING *');
      expect(q.params).toEqual(["Finish lightweight ORM", false]);
    });

    it("should build batch INSERT query", () => {
      const q = QueryBuilder.insertMany("todos", [
        { title: "Task 1", completed: false },
        { title: "Task 2", completed: true },
      ]);

      expect(q.sql).toBe(
        'INSERT INTO "todos" ("title", "completed") VALUES ($1, $2), ($3, $4) RETURNING *'
      );
      expect(q.params).toEqual(["Task 1", false, "Task 2", true]);
    });
  });

  describe("UPDATE queries", () => {
    it("should build parameterized UPDATE with WHERE and RETURNING *", () => {
      const q = QueryBuilder.update("todos", { id: 1 }, { completed: true });

      expect(q.sql).toBe('UPDATE "todos" SET "completed" = $1 WHERE "id" = $2 RETURNING *');
      expect(q.params).toEqual([true, 1]);
    });

    it("should throw validation error if WHERE is missing", () => {
      expect(() => QueryBuilder.update("todos", {} as any, { completed: true })).toThrow(
        /requires a non-empty where condition/
      );
    });
  });

  describe("DELETE queries", () => {
    it("should build parameterized DELETE with WHERE and RETURNING *", () => {
      const q = QueryBuilder.delete("todos", { id: 5 });

      expect(q.sql).toBe('DELETE FROM "todos" WHERE "id" = $1 RETURNING *');
      expect(q.params).toEqual([5]);
    });
  });

  describe("CREATE TABLE DDL", () => {
    it("should generate valid PostgreSQL DDL with serial primary key and defaults", () => {
      const ddl = QueryBuilder.createTableDdl(Todo);

      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS "todos"');
      expect(ddl).toContain('"id" SERIAL PRIMARY KEY');
      expect(ddl).toContain('"title" VARCHAR(255) NOT NULL');
      expect(ddl).toContain('"completed" BOOLEAN NOT NULL DEFAULT FALSE');
      expect(ddl).toContain('"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP');
    });
  });
});
