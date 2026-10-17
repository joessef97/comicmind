import type { Response } from "express";
import type { AuthRequest } from "../auth/auth.middleware";
import { GenerationJobModel } from "./job.model";
import { DraftModel } from "../drafts/draft.model";
import { validateGenerationJobInput } from "@shared/schema";
import { generationJobWorker } from "./job.worker";

function serializeJob(job: any) {
  return {
    id: String(job._id),
    userId: job.userId,
    title: job.title,
    style: job.style,
    idea: job.idea,
    characterSheet: job.characterSheet,
    characterRefUrl: job.characterRefUrl,
    status: job.status,
    panels: job.panels,
    progress: job.progress,
    completedAt: job.completedAt,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

/** POST /api/jobs — persist a request and immediately wake the local worker. */
export async function enqueueJob(req: AuthRequest, res: Response) {
  try {
    const validation = validateGenerationJobInput(req.body);
    if (!validation.valid || !validation.value) {
      return res.status(400).json({ message: validation.message });
    }

    const input = validation.value;
    if (input.draftId) {
      const draft = await DraftModel.findOne({ _id: input.draftId, userId: req.userId! });
      if (!draft) return res.status(404).json({ message: "Draft not found" });
    }
    const job = await GenerationJobModel.create({
      ...input,
      userId: req.userId!,
      status: "pending",
      panels: input.panels.map((panel) => ({ ...panel, status: "pending", attempts: 0 })),
      progress: { completed: 0, total: input.panels.length },
    });

    if (input.draftId) {
      await DraftModel.updateOne(
        { _id: input.draftId, userId: req.userId! },
        { $set: { generationJobId: String(job._id), status: "GENERATING" } },
      );
    }

    generationJobWorker.wake();
    return res.status(202).json({ jobId: String(job._id), job: serializeJob(job) });
  } catch (error) {
    console.error("Enqueue generation job error:", error);
    return res.status(500).json({ message: "Failed to enqueue generation job" });
  }
}

/** GET /api/jobs/:id — clients poll this endpoint for durable progress. */
export async function getJob(req: AuthRequest, res: Response) {
  try {
    const job = await GenerationJobModel.findOne({ _id: req.params.id, userId: req.userId! });
    if (!job) return res.status(404).json({ message: "Generation job not found" });
    return res.status(200).json({ job: serializeJob(job) });
  } catch (error) {
    console.error("Get generation job error:", error);
    return res.status(500).json({ message: "Failed to get generation job" });
  }
}

/** DELETE /api/jobs/:id — cancellation is cooperative; no future panel starts. */
export async function cancelJob(req: AuthRequest, res: Response) {
  try {
    const job = await GenerationJobModel.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.userId!,
        status: { $in: ["pending", "in_progress"] },
      },
      { $set: { status: "cancelled" }, $unset: { workerLockUntil: 1, workerLockToken: 1 } },
      { new: true },
    );
    if (!job) return res.status(404).json({ message: "Active generation job not found" });
    return res.status(200).json({ job: serializeJob(job) });
  } catch (error) {
    console.error("Cancel generation job error:", error);
    return res.status(500).json({ message: "Failed to cancel generation job" });
  }
}
