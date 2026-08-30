/**
 * Applies pending Drizzle migrations. Run with `npm run db:migrate`.
 *
 * Kept separate from server startup on purpose: a web process that migrates on
 * boot races with itself when more than one instance starts, and makes a bad
 * migration take the site down instead of failing a deploy step.
 */

import path from "path";
import { fileURLToPath } from "url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, getDb, isLedgerEnabled } from "./index";

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

async function main() {
  if (!isLedgerEnabled()) {
    console.error("DATABASE_URL is not set — nothing to migrate.");
    process.exit(1);
  }

  const db = getDb();
  if (!db) {
    console.error("Could not open a database connection.");
    process.exit(1);
  }

  console.log(`[migrate] Applying migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log("[migrate] Done");

  await closeDb();
}

main().catch(async (err) => {
  console.error("[migrate] Failed:", err);
  await closeDb().catch(() => {});
  process.exit(1);
});
