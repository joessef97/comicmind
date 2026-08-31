/**
 * The queued client must degrade quietly. If any of this throws or reports a
 * false positive, the editor either crashes or silently stops generating on
 * the deployment that cannot queue — which is the live one today.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findActiveJob,
  isTerminalStatus,
  startGenerationJob,
} from "../../frontend/src/hooks/use-generation-job";

const input = {
  panels: [{ description: "a rooftop chase" }],
  style: "noir",
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

describe("queued generation client", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => "test-token"),
      setItem: vi.fn(),
    });
  });

  it("returns null on 503 so the caller falls back", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(503, { mode: "sync" })));
    await expect(startGenerationJob(input, "key-1")).resolves.toBeNull();
  });

  it("returns null rather than throwing when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(startGenerationJob(input, "key-1")).resolves.toBeNull();
  });

  it("returns the job id when the server accepts the work", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(202, { jobId: "job-9", status: "queued" })),
    );
    await expect(startGenerationJob(input, "key-1")).resolves.toBe("job-9");
  });

  it("sends the idempotency key and the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(202, { jobId: "job-9" }));
    vi.stubGlobal("fetch", fetchMock);

    await startGenerationJob(input, "key-abc");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Idempotency-Key"]).toBe("key-abc");
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("reports no active job rather than throwing when the lookup fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(findActiveJob({ draftId: "d1" })).resolves.toBeNull();
  });

  it("knows which statuses are finished", () => {
    expect(isTerminalStatus("queued")).toBe(false);
    expect(isTerminalStatus("running")).toBe(false);
    expect(isTerminalStatus("succeeded")).toBe(true);
    expect(isTerminalStatus("partial")).toBe(true);
    expect(isTerminalStatus("failed")).toBe(true);
  });
});
