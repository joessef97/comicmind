/**
 * The ledger is bookkeeping, so it must never be able to cost a user a comic.
 * These tests pin that contract with no database present.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  createJob,
  finalizeIfComplete,
  finalizeJob,
  getJob,
  getJobPanels,
  markRunning,
  recordPanelResult,
} from "../../backend/src/jobs/job.service";
import { isLedgerEnabled } from "../../backend/src/db";

describe("ledger with no DATABASE_URL", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("reports itself disabled", () => {
    expect(isLedgerEnabled()).toBe(false);
  });

  it("returns null rather than throwing", async () => {
    await expect(createJob({ userId: "u1", totalPanels: 3 })).resolves.toBeNull();
    await expect(getJob("00000000-0000-0000-0000-000000000000")).resolves.toBeNull();
    await expect(markRunning("00000000-0000-0000-0000-000000000000")).resolves.toBeNull();
    await expect(finalizeJob("00000000-0000-0000-0000-000000000000")).resolves.toBeNull();
    await expect(
      finalizeIfComplete("00000000-0000-0000-0000-000000000000"),
    ).resolves.toBeNull();
  });

  it("accepts panel results silently", async () => {
    await expect(
      recordPanelResult("00000000-0000-0000-0000-000000000000", 0, {
        status: "succeeded",
        imageUrl: "https://example.test/panel.png",
      }),
    ).resolves.toBeUndefined();
  });

  it("returns an empty panel list", async () => {
    await expect(getJobPanels("00000000-0000-0000-0000-000000000000")).resolves.toEqual([]);
  });
});
