/**
 * Worker retry semantics. The ledger and image provider are mocked here; what
 * is under test is *when* the worker records a failure, not how images render.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateImage: vi.fn(),
  persistImageBuffer: vi.fn(),
  persistImage: vi.fn(),
  isPersistedUrl: vi.fn(() => true),
  getComic: vi.fn(),
  updateComic: vi.fn(),
  getDraft: vi.fn(),
  updateDraft: vi.fn(),
  updateDraftPanel: vi.fn(),
  markRunning: vi.fn(),
  recordPanelResult: vi.fn(),
  finalizeIfComplete: vi.fn(),
}));

vi.mock("../../backend/src/services/ai.service", () => ({
  getImageProvider: () => ({ generateImage: mocks.generateImage }),
}));

vi.mock("../../backend/src/services/image-storage", () => ({
  persistImageBuffer: mocks.persistImageBuffer,
  persistImage: mocks.persistImage,
  isPersistedUrl: mocks.isPersistedUrl,
}));

vi.mock("../../backend/src/services/storage.service", () => ({
  storage: {
    getComic: mocks.getComic,
    updateComic: mocks.updateComic,
    getDraft: mocks.getDraft,
    updateDraft: mocks.updateDraft,
    updateDraftPanel: mocks.updateDraftPanel,
  },
}));

vi.mock("../../backend/src/jobs/job.service", () => ({
  markRunning: mocks.markRunning,
  recordPanelResult: mocks.recordPanelResult,
  finalizeIfComplete: mocks.finalizeIfComplete,
  isTerminal: (status: string) => ["succeeded", "partial", "failed", "cancelled"].includes(status),
}));

vi.mock("../../backend/src/jobs/queue", () => ({
  PANEL_QUEUE_NAME: "comic-panel-generation",
  getRedisConnection: () => null,
}));

const { renderPanel } = await import("../../backend/src/jobs/panel.worker");

function makeJob(overrides: { attemptsMade?: number; attempts?: number } = {}) {
  return {
    data: {
      jobId: "job-1",
      userId: "user-1",
      comicId: null,
      draftId: null,
      panelIndex: 2,
      prompt: "a hero on a rooftop",
      style: "anime",
    },
    attemptsMade: overrides.attemptsMade ?? 0,
    opts: { attempts: overrides.attempts ?? 3 },
  } as any;
}

describe("panel worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isPersistedUrl.mockReturnValue(true);
  });

  it("records success and asks the job to finalize", async () => {
    mocks.generateImage.mockResolvedValue({
      imageUrl: "https://cdn.test/panel-2.png",
      meta: { model: "gpt-image-2" },
    });

    const result = await renderPanel(makeJob());

    expect(result.imageUrl).toBe("https://cdn.test/panel-2.png");
    expect(mocks.markRunning).toHaveBeenCalledWith("job-1");
    expect(mocks.recordPanelResult).toHaveBeenCalledWith("job-1", 2, {
      status: "succeeded",
      imageUrl: "https://cdn.test/panel-2.png",
    });
    expect(mocks.finalizeIfComplete).toHaveBeenCalledWith("job-1");
  });

  it("persists each queued panel into its linked draft without a browser connected", async () => {
    mocks.generateImage.mockResolvedValue({
      imageUrl: "https://cdn.test/panel-2.png",
      meta: { model: "gpt-image-2" },
    });
    const job = makeJob();
    job.data.draftId = "draft-1";

    await renderPanel(job);

    expect(mocks.updateDraftPanel).toHaveBeenCalledWith(
      "draft-1",
      "user-1",
      2,
      expect.objectContaining({
        imageUrl: "https://cdn.test/panel-2.png",
      }),
    );
  });

  it("marks the linked draft complete when the final queued panel finishes", async () => {
    mocks.generateImage.mockResolvedValue({ imageUrl: "https://cdn.test/panel-2.png", meta: {} });
    mocks.finalizeIfComplete.mockResolvedValue({ status: "succeeded" });

    const job = makeJob();
    job.data.draftId = "draft-1";

    await renderPanel(job);

    expect(mocks.updateDraft).toHaveBeenLastCalledWith(
      "draft-1",
      "user-1",
      expect.objectContaining({ status: "COMPLETED" }),
    );
  });

  it("does not record a failure while retries remain", async () => {
    mocks.generateImage.mockRejectedValue(new Error("rate limited"));

    // Attempt 1 of 3 — BullMQ will retry, so the panel is not lost yet.
    await expect(renderPanel(makeJob({ attemptsMade: 0, attempts: 3 }))).rejects.toThrow(
      "rate limited",
    );

    expect(mocks.recordPanelResult).not.toHaveBeenCalled();
    expect(mocks.finalizeIfComplete).not.toHaveBeenCalled();
  });

  it("records a failure once retries are exhausted", async () => {
    mocks.generateImage.mockRejectedValue(new Error("content policy"));
    mocks.finalizeIfComplete.mockResolvedValue({ status: "failed" });

    // Attempt 3 of 3 — this is the last chance, so the panel is genuinely lost.
    await expect(renderPanel(makeJob({ attemptsMade: 2, attempts: 3 }))).rejects.toThrow(
      "content policy",
    );

    expect(mocks.recordPanelResult).toHaveBeenCalledWith("job-1", 2, {
      status: "failed",
      error: "content policy",
    });
    // Still finalizes: siblings must be delivered even though this panel failed.
    expect(mocks.finalizeIfComplete).toHaveBeenCalledWith("job-1");
  });

  it("marks a linked draft failed when every queued panel has failed", async () => {
    mocks.generateImage.mockRejectedValue(new Error("content policy"));
    mocks.finalizeIfComplete.mockResolvedValue({ status: "failed" });
    const job = makeJob({ attemptsMade: 2, attempts: 3 });
    job.data.draftId = "draft-1";

    await expect(renderPanel(job)).rejects.toThrow("content policy");

    expect(mocks.updateDraft).toHaveBeenCalledWith(
      "draft-1",
      "user-1",
      expect.objectContaining({ status: "FAILED" }),
    );
  });

  it("rethrows so BullMQ owns the retry decision", async () => {
    mocks.generateImage.mockRejectedValue(new Error("upstream 500"));
    await expect(renderPanel(makeJob())).rejects.toThrow("upstream 500");
  });

  it("continues when the character reference cannot be downloaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    mocks.generateImage.mockResolvedValue({
      imageUrl: "https://cdn.test/panel-2.png",
      meta: {},
    });

    const job = makeJob();
    job.data.characterRefUrl = "https://cdn.test/ref.png";

    // The reference sheet improves consistency but is not required to render.
    await expect(renderPanel(job)).resolves.toMatchObject({
      imageUrl: "https://cdn.test/panel-2.png",
    });
    expect(mocks.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ referenceImage: undefined }),
    );

    vi.unstubAllGlobals();
  });
});
