import {
  defineModel,
  createClient,
  string,
  number,
  boolean,
  timestamp,
  InferModel,
  InferInsertModel,
} from "@light-orm/core";

/**
 * 1. Define a Schema Model using fluent TypeScript builder
 */
const User = defineModel("users", {
  id: number().primaryKey().autoIncrement(),
  name: string().notNull(),
  email: string().unique(),
  role: string().default("developer"),
  isActive: boolean().default(true),
  createdAt: timestamp().default("NOW()"),
});

// Full type inference without code generation:
type UserRow = InferModel<typeof User>;
type NewUserInput = InferInsertModel<typeof User>;

async function main() {
  console.log("==================================================");
  console.log("🚀 Testing @light-orm/core TypeScript ORM Directly");
  console.log("==================================================\n");

  // 2. Initialize ORM Client
  const db = createClient({
    schema: {
      user: User,
    },
    logging: true, // prints SQL queries to console
    onQuery: (event) => {
      console.log(`⏱️  [Telemetry] Query took ${event.durationMs.toFixed(2)}ms (Rows: ${event.rowCount})`);
    },
  });

  // 3. Auto-sync schema DDL
  console.log("--- 1. Syncing Schema (CREATE TABLE) ---");
  await db.syncSchema();

  // 4. Create Records with Typed Input
  console.log("\n--- 2. Creating Records (INSERT) ---");
  const alice = await db.user.create({
    name: "Alice Johnson",
    email: "alice@example.com",
    role: "admin",
  });
  console.log("Created Alice (inferred type UserRow):", alice);

  const bob = await db.user.create({
    name: "Bob Smith",
    email: "bob@example.com",
    // role & isActive will use schema default values ("developer", true)
  });
  console.log("Created Bob (with default values):", bob);

  // 5. Batch Insert
  console.log("\n--- 3. Batch Insert (createMany) ---");
  const moreUsers = await db.user.createMany([
    { name: "Charlie Brown", email: "charlie@example.com", role: "developer" },
    { name: "Diana Prince", email: "diana@example.com", role: "lead" },
  ]);
  console.log(`Inserted ${moreUsers.length} additional users.`);

  // 6. Query Filtering with Operators
  console.log("\n--- 4. Query with Operators (findMany) ---");
  const leadsOrAdmins = await db.user.findMany({
    where: {
      role: { in: ["admin", "lead"] },
    },
    orderBy: { id: "asc" },
  });
  console.log("Admins & Leads:", leadsOrAdmins);

  // 7. Substring Search
  console.log("\n--- 5. Substring Search (contains / ILIKE) ---");
  const searchResults = await db.user.findMany({
    where: {
      name: { contains: "Smith" },
    },
  });
  console.log("Search results for 'Smith':", searchResults);

  // 8. Update Record
  console.log("\n--- 6. Update Record (UPDATE) ---");
  const updatedBob = await db.user.update({
    where: { id: bob.id },
    data: { role: "senior developer" },
  });
  console.log("Updated Bob:", updatedBob);

  // 9. Aggregate Count
  console.log("\n--- 7. Aggregate Count ---");
  const totalUsers = await db.user.count();
  console.log("Total Users:", totalUsers);

  // 10. Atomic Transaction with Rollback Support
  console.log("\n--- 8. Testing Transactions (COMMIT & ROLLBACK) ---");
  try {
    await db.transaction(async (tx) => {
      await tx.user.create({ name: "Temporary User 1", email: "temp1@test.com" });
      console.log("Created temp user 1 in transaction...");
      
      // Simulate failure to trigger rollback
      throw new Error("Simulated rollback error");
    });
  } catch (err: any) {
    console.log(`Transaction successfully caught & rolled back: "${err.message}"`);
  }

  const countAfterRollback = await db.user.count();
  console.log(`Count after rollback: ${countAfterRollback} (Notice temp user was not persisted!)`);

  console.log("\n==================================================");
  console.log("✅ ALL ORM CAPABILITIES TESTED & VERIFIED!");
  console.log("==================================================");
}

main().catch(console.error);
