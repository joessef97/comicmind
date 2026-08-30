/**
 * Postgres connection for the generation job ledger.
 *
 * The pool is created lazily and is entirely optional: when DATABASE_URL is
 * unset (the current Render deployment, and any local checkout that has not
 * run docker compose) `getDb()` returns null and callers skip ledger writes.
 * Generation itself must never fail because bookkeeping is unavailable.
 */

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let pool: Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;
let warned = false;

export function isLedgerEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): NodePgDatabase<typeof schema> | null {
  if (!isLedgerEnabled()) {
    if (!warned) {
      warned = true;
      console.log("[db] DATABASE_URL not set — generation ledger disabled");
    }
    return null;
  }

  if (!db) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number.parseInt(process.env.PG_POOL_MAX || "", 10) || 10,
      // Fail fast rather than letting a request hang on an unreachable ledger.
      connectionTimeoutMillis: 5_000,
    });

    pool.on("error", (err) => {
      console.error("[db] idle client error:", err.message);
    });

    db = drizzle(pool, { schema });
    console.log("[db] Generation ledger connected");
  }

  return db;
}

/** Closes the pool. Used by tests and by graceful shutdown. */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

export { schema };
