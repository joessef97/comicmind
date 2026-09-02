/**
 * Connects the integration suites to a real MongoDB, or reports that there
 * isn't one.
 *
 * `tests/setup.ts` always supplies a MONGODB_URI default, so the presence of
 * the variable proves nothing — the only honest check is to try. A short
 * server-selection timeout keeps `npm test` on a laptop with no mongod from
 * stalling on the driver's 30s default, which is what lets these suites skip
 * offline and still run wherever a mongod is available.
 *
 * Each suite passes its own `dbName`. Vitest runs test files in parallel, and
 * claiming work off the queue is deliberately not scoped to one job — a
 * worker takes the oldest panel it can see. Without a database per file the
 * suites would consume each other's panels.
 */

import mongoose from "mongoose";

const PROBE_TIMEOUT_MS = 2_000;

export async function connectTestMongo(dbName?: string): Promise<boolean> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return false;

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: PROBE_TIMEOUT_MS,
      ...(dbName ? { dbName } : {}),
    });
    return true;
  } catch {
    // Leaves nothing behind to keep the process from exiting.
    await mongoose.disconnect().catch(() => {});
    return false;
  }
}

/** Drops the suite's database so a run never inherits the last one's state. */
export async function dropTestMongo(): Promise<void> {
  await mongoose.connection.dropDatabase().catch(() => {});
}

export async function disconnectTestMongo(): Promise<void> {
  await mongoose.disconnect().catch(() => {});
}
