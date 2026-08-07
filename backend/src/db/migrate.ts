/**
 * Production migration runner.
 *
 * drizzle-kit is a devDependency and is not in the runtime image, so
 * migrations are applied with the runtime migrator instead. entrypoint.sh
 * calls this in place of the old `prisma migrate deploy`.
 */

import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";

async function runMigrations() {
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigrations();
