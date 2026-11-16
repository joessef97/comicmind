import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateImage: vi.fn(),
  persistImageBuffer: vi.fn(),
  persistImage: vi.fn(),
  isPersistedUrl: vi.fn(() => true),
  getComic: vi.fn(),
  updateComic: vi.fn(),
  updateDraft: vi.fn(),
  updateDraftPanel: vi.fn(),
  recordPanelResult: vi.fn(),
  releasePanelForRetry: vi.fn(),
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
    updateDraft: mocks.updateDraft,
    updateDraftPanel: mocks.updateDraftPanel,
  },
}));
vi.mock("../../backend/src/jobs/job.service", () => ({
  recordPanelResult: mocks.recordPanelResult,
  releasePanelForRetry: mocks.releasePanelForRetry,
  finalizeIfComplete: mocks.finalizeIfComplete,
  isTerminal: (status: string) => ["succeeded", "partial", "failed", "cancelled"].includes(status),
}));

const { renderPanel } = await import("../../backend/src/jobs/panel.worker");

function makePanel(overrides: Record<string, unknown> = {}) {
  return {
    jobId: "job-1",
    userId: "user-1",
    comicId: null,
    draftId: null,
    panelNumber: 2,
    prompt: "a hero on a rooftop",
    style: "anime",
    attempts: 1,
    maxAttempts: 3,
    leaseToken: "lease-1",
    ...overrides,
  } as any;
}

describe("MongoDB panel worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isPersistedUrl.mockReturnValue(true);
  });

  it("records successful panels and finalizes completed jobs", async () => {
    mocks.generateImage.mockResolvedValue({
      imageUrl: "https://cdn.test/panel-2.png",
      meta: { model: "gpt-image-2" },
    });

    await renderPanel(makePanel());

    expect(mocks.recordPanelResult).toHaveBeenCalledWith("job-1", 2, {
      status: "succeeded",
      imageUrl: "https://cdn.test/panel-2.png",
      attempts: 1,
    }, "lease-1");
    expect(mocks.finalizeIfComplete).toHaveBeenCalledWith("job-1");
  });

  it("persists each panel into its linked draft without a browser connected", async () => {
    mocks.generateImage.mockResolvedValue({ imageUrl: "https://cdn.test/panel-2.png", meta: {} });

    await renderPanel(makePanel({ draftId: "draft-1" }));

    expect(mocks.updateDraftPanel).toHaveBeenCalledWith(
      "draft-1",
      "user-1",
      2,
      expect.objectContaining({ imageUrl: "https://cdn.test/panel-2.png" }),
    );
  });

  it("marks a linked draft complete when its job finishes", async () => {
    mocks.generateImage.mockResolvedValue({ imageUrl: "https://cdn.test/panel-2.png", meta: {} });
    mocks.finalizeIfComplete.mockResolvedValue({ status: "succeeded" });

    await renderPanel(makePanel({ draftId: "draft-1" }));

    expect(mocks.updateDraft).toHaveBeenLastCalledWith(
      "draft-1",
      "user-1",
      expect.objectContaining({ status: "COMPLETED" }),
    );
  });

  it("releases a failed panel for delayed retry while attempts remain", async () => {
    mocks.generateImage.mockRejectedValue(new Error("rate limited"));

    await renderPanel(makePanel({ attempts: 1 }));

    expect(mocks.releasePanelForRetry).toHaveBeenCalledWith(
      "job-1",
      2,
      "lease-1",
      "rate limited",
      expect.any(Date),
    );
    expect(mocks.recordPanelResult).not.toHaveBeenCalled();
  });

  it("records a failure when attempts are exhausted", async () => {
    mocks.generateImage.mockRejectedValue(new Error("content policy"));
    mocks.finalizeIfComplete.mockResolvedValue({ status: "failed" });

    await renderPanel(makePanel({ attempts: 3 }));

    expect(mocks.recordPanelResult).toHaveBeenCalledWith("job-1", 2, {
      status: "failed",
      error: "content policy",
      attempts: 3,
    }, "lease-1");
    expect(mocks.finalizeIfComplete).toHaveBeenCalledWith("job-1");
  });

  it("marks a linked draft failed when all its panels fail", async () => {
    mocks.generateImage.mockRejectedValue(new Error("content policy"));
    mocks.finalizeIfComplete.mockResolvedValue({ status: "failed" });

    await renderPanel(makePanel({ draftId: "draft-1", attempts: 3 }));

    expect(mocks.updateDraft).toHaveBeenCalledWith(
      "draft-1",
      "user-1",
      expect.objectContaining({ status: "FAILED" }),
    );
  });

  it("continues without a character reference when its download fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    mocks.generateImage.mockResolvedValue({ imageUrl: "https://cdn.test/panel-2.png", meta: {} });

    await renderPanel(makePanel({ characterRefUrl: "https://cdn.test/ref.png" }));

    expect(mocks.generateImage).toHaveBeenCalledWith(expect.objectContaining({ referenceImage: undefined }));
    vi.unstubAllGlobals();
  });
});
