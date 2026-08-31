import { describe, expect, it } from "vitest";
import { panelJobId } from "../../backend/src/jobs/queue";

describe("panelJobId", () => {
  it("is deterministic for the same panel", () => {
    expect(panelJobId("job-1", 3)).toBe(panelJobId("job-1", 3));
  });

  it("differs per panel and per job", () => {
    expect(panelJobId("job-1", 0)).not.toBe(panelJobId("job-1", 1));
    expect(panelJobId("job-1", 0)).not.toBe(panelJobId("job-2", 0));
  });

  it("avoids characters BullMQ rejects in custom ids", () => {
    // BullMQ namespaces its Redis keys with ':' and refuses it in custom ids.
    const id = panelJobId("6f1c9f0e-6a1a-4a3e-9f0e-2b7c1d8e5a44", 5);
    expect(id).not.toContain(":");
  });
});
