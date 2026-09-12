import { describe, it, expect } from "vitest";
import {
  defineModel,
  string,
  number,
  boolean,
  timestamp,
  text,
  json,
} from "../src/schema.js";
import { InferInsertModel, InferModel } from "../src/types.js";

describe("Schema Definition & Type Inference", () => {
  it("should create model definition with correct column configurations", () => {
    const Todo = defineModel("todos", {
      id: number().primaryKey().autoIncrement(),
      title: string().notNull(),
      completed: boolean().default(false),
      description: text().nullable(),
      metadata: json().nullable(),
      createdAt: timestamp().default("NOW()"),
    });

    expect(Todo.tableName).toBe("todos");
    expect(Todo.columns.id.options.primaryKey).toBe(true);
    expect(Todo.columns.id.options.autoIncrement).toBe(true);
    expect(Todo.columns.id.options.dataType).toBe("number");

    expect(Todo.columns.title.options.nullable).toBe(false);
    expect(Todo.columns.title.options.dataType).toBe("string");

    expect(Todo.columns.completed.options.hasDefault).toBe(true);
    expect(Todo.columns.completed.options.defaultValue).toBe(false);

    expect(Todo.columns.description.options.nullable).toBe(true);
    expect(Todo.columns.description.options.dataType).toBe("text");
  });

  it("should validate column names and table names", () => {
    expect(() => defineModel("", { id: number() })).toThrow(/non-empty/);
    expect(() => defineModel("empty_cols", {} as any)).toThrow(/at least one column/);
  });

  it("type inference compiles correctly without runtime errors", () => {
    const User = defineModel("users", {
      id: number().primaryKey().autoIncrement(),
      name: string().notNull(),
      email: string().unique(),
      role: string().default("member"),
      isActive: boolean().default(true),
    });

    type UserRow = InferModel<typeof User>;
    type NewUser = InferInsertModel<typeof User>;

    // Static type validation assertion
    const dummyRow: UserRow = {
      id: 1,
      name: "Alice",
      email: "alice@example.com",
      role: "admin",
      isActive: true,
    };

    // 'id', 'role', 'isActive' are optional in insert because of autoIncrement/default
    const validInsert: NewUser = {
      name: "Bob",
      email: "bob@example.com",
    };

    expect(dummyRow.name).toBe("Alice");
    expect(validInsert.name).toBe("Bob");
  });
});
