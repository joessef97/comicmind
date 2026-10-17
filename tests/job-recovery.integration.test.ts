import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  model: { updateOne: vi.fn(), findOneAndUpdate: vi.fn() },
  draftModel: { updateOne: vi.fn() },
  generatePanelImage: vi.fn(),
  persistImage: vi.fn(),
  persistImageBuffer: vi.fn(),
  isPersistedUrl: vi.fn(),
}));

vi.mock("../backend/src/modules/jobs/job.model", () => ({ GenerationJobModel: mocks.model }));
vi.mock("../backend/src/modules/drafts/draft.model", () => ({ DraftModel: mocks.draftModel }));
vi.mock("../backend/src/services/ai.service", () => ({ generatePanelImage: mocks.generatePanelImage }));
vi.mock("../backend/src/services/image-storage", () => ({
  persistImage: mocks.persistImage,
  persistImageBuffer: mocks.persistImageBuffer,
  isPersistedUrl: mocks.isPersistedUrl,
}));

import { GenerationJobWorker } from "../backend/src/modules/jobs/job.worker";

describe("generation job recovery", () => {
  it("completes all six panels after a job has been enqueued", async () => {
    mocks.model.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mocks.generatePanelImage.mockImplementation(async (_description: string, _style: string, number: number) => ({
      imageUrl: `https://provider.example/panel-${number}.png`,
      generationMeta: { model: "test", prompt: `Panel ${number}`, style: "noir", createdAt: "now", costEstimate: 0 },
    }));
    mocks.isPersistedUrl.mockReturnValue(false);
    mocks.persistImage.mockImplementation(async (_url: string, _job: string, id: string) => ({
      url: `/uploads/job-1/${id}.png`, publicId: id,
    }));

    const queuedJob = {
      _id: "job-1", userId: "user-1", draftId: "draft-1", style: "noir", status: "in_progress",
      panels: Array.from({ length: 6 }, (_, index) => ({
        number: index + 1, description: `Panel ${index + 1}`, status: "pending",
      })),
    };

    await (new GenerationJobWorker() as any).process(queuedJob, "new-lease-token");

    expect(mocks.generatePanelImage).toHaveBeenCalledTimes(6);
    expect(mocks.persistImage).toHaveBeenCalledTimes(6);
    expect(mocks.draftModel.updateOne).toHaveBeenLastCalledWith(
      { _id: "draft-1", userId: "user-1" },
      expect.objectContaining({
        $set: expect.objectContaining({ status: "COMPLETED", panels: expect.arrayContaining([
          expect.objectContaining({ number: 6, imageUrl: "/uploads/job-1/panel-6.png" }),
        ]) }),
        $unset: { generationJobId: 1 },
      }),
    );
    expect(mocks.model.updateOne).toHaveBeenLastCalledWith(
      { _id: "job-1", status: "in_progress", workerLockToken: "new-lease-token" },
      expect.objectContaining({ $set: expect.objectContaining({ status: "completed" }) }),
    );
  });

  it("reclaims an expired lease and resumes from panel four without redoing completed panels", async () => {
    mocks.model.findOneAndUpdate.mockResolvedValue({ _id: "job-1" });
    const worker = new GenerationJobWorker() as any;
    await worker.claimNext();

    expect(mocks.model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          { status: "pending" },
          expect.objectContaining({ status: "in_progress", workerLockUntil: expect.any(Object) }),
        ]),
      }),
      expect.objectContaining({ $set: expect.objectContaining({ status: "in_progress", workerLockToken: expect.any(String) }) }),
      expect.objectContaining({ sort: { createdAt: 1 }, new: true }),
    );

    mocks.model.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mocks.generatePanelImage.mockResolvedValue({
      imageUrl: "https://provider.example/panel-4.png",
      generationMeta: { model: "test", prompt: "Panel 4", style: "noir", createdAt: "now", costEstimate: 0 },
    });
    mocks.isPersistedUrl.mockReturnValue(false);
    mocks.persistImage.mockResolvedValue({ url: "/uploads/job-1/panel-4.png", publicId: "panel-4" });

    await worker.process({
      _id: "job-1", style: "noir",
      panels: [
        ...Array.from({ length: 3 }, (_, index) => ({ number: index + 1, description: "Saved", status: "completed" })),
        { number: 4, description: "Needs generation", status: "pending" },
      ],
    }, "replacement-lease");

    expect(mocks.generatePanelImage).toHaveBeenCalledOnce();
    expect(mocks.generatePanelImage).toHaveBeenCalledWith("Needs generation", "noir", 4);
  });
});
