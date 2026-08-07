import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// One connection pool for the whole process.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// node-postgres emits "error" on idle clients when the connection drops
// (database restart, network blip, failover). An "error" event with no
// listener is rethrown by Node as an uncaught exception and kills the
// process, with no request involved at all. The pool discards the dead
// connection and opens a fresh one on the next query, so acknowledging the
// event is all that is needed.
pool.on("error", function onIdleClientError(error) {
  console.error("[db] idle client error:", error.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
