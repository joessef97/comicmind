import { describe, expect, it } from "vitest";
import { canTransition, isTerminal, type JobStatus } from "../../backend/src/jobs/job.service";

describe("job state machine", () => {
  it("treats only finished states as terminal", () => {
    expect(isTerminal("queued")).toBe(false);
    expect(isTerminal("running")).toBe(false);

    for (const status of ["succeeded", "partial", "failed", "cancelled"] as JobStatus[]) {
      expect(isTerminal(status)).toBe(true);
    }
  });

  it("allows a job to start and to finish", () => {
    expect(canTransition("queued", "running")).toBe(true);
    expect(canTransition("running", "succeeded")).toBe(true);
    expect(canTransition("running", "partial")).toBe(true);
    expect(canTransition("running", "failed")).toBe(true);
  });

  it("refuses to reopen a terminal job", () => {
    // A re-run must create a new job rather than resurrecting an old one,
    // otherwise the audit trail loses the history of the first attempt.
    for (const from of ["succeeded", "partial", "failed", "cancelled"] as JobStatus[]) {
      for (const to of ["queued", "running", "succeeded"] as JobStatus[]) {
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });

  it("refuses to skip straight from queued to succeeded", () => {
    // Reaching succeeded without passing through running would mean no worker
    // ever picked the job up, so the panels cannot have been rendered.
    expect(canTransition("queued", "succeeded")).toBe(false);
    expect(canTransition("queued", "partial")).toBe(false);
  });

  it("allows cancellation from either live state", () => {
    expect(canTransition("queued", "cancelled")).toBe(true);
    expect(canTransition("running", "cancelled")).toBe(true);
  });
});
