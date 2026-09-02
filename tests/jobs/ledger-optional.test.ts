/**
 * The ledger is bookkeeping, so it must never be able to cost a user a comic.
 * These tests pin that contract with no database connection open.
 */

import { describe, expect, it } from "vitest";
import {
  createJob,
  finalizeIfComplete,
  finalizeJob,
  getJob,
  getJobPanels,
  isLedgerEnabled,
  markRunning,
  recordPanelResult,
} from "../../backend/src/jobs/job.service";

/** Shaped like a real job id, so these exercise the code path a client would. */
const MISSING_JOB_ID = "000000000000000000000000";

describe("ledger with no Mongo connection", () => {
  it("reports itself disabled", () => {
    expect(isLedgerEnabled()).toBe(false);
  });

  it("returns null rather than throwing", async () => {
    await expect(createJob({ userId: "u1", totalPanels: 3 })).resolves.toBeNull();
    await expect(getJob(MISSING_JOB_ID)).resolves.toBeNull();
    await expect(markRunning(MISSING_JOB_ID)).resolves.toBeNull();
    await expect(finalizeJob(MISSING_JOB_ID)).resolves.toBeNull();
    await expect(finalizeIfComplete(MISSING_JOB_ID)).resolves.toBeNull();
  });

  it("accepts panel results silently", async () => {
    await expect(
      recordPanelResult(MISSING_JOB_ID, 0, {
        status: "succeeded",
        imageUrl: "https://example.test/panel.png",
      }),
    ).resolves.toBeUndefined();
  });

  it("reports no panels rather than throwing", async () => {
    await expect(getJobPanels(MISSING_JOB_ID)).resolves.toEqual([]);
  });

  it("treats a malformed job id as a missing job", async () => {
    await expect(getJob("not-an-object-id")).resolves.toBeNull();
    await expect(getJobPanels("not-an-object-id")).resolves.toEqual([]);
  });
});
