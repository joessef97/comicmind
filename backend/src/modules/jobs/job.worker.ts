import crypto from "crypto";
import { GenerationJobModel } from "./job.model";
import { DraftModel } from "../drafts/draft.model";
import { generatePanelImage } from "../../services/ai.service";
import { isPersistedUrl, persistImage, persistImageBuffer } from "../../services/image-storage";

const LOCK_TTL_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 5_000;

/**
 * One process-local worker loop. The database lease makes multiple server
 * instances safe, while the lease token prevents an expired worker from
 * writing a panel after a replacement has claimed the job.
 */
export class GenerationJobWorker {
  private timer?: NodeJS.Timeout;
  private running = false;
  private processing = false;

  start() {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => this.wake(), POLL_INTERVAL_MS);
    this.timer.unref?.();
    this.wake();
  }

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  wake() {
    if (this.processing) return;
    void this.drain();
  }

  private async drain() {
    this.processing = true;
    try {
      // Continue claiming jobs until the queue is empty; one worker remains
      // sequential to avoid unbounded image-provider concurrency per process.
      while (this.running || !this.timer) {
        const claimed = await this.claimNext();
        if (!claimed) break;
        await this.process(claimed.job, claimed.lockToken);
      }
    } catch (error) {
      console.error("[job-worker] Queue polling failed:", error);
    } finally {
      this.processing = false;
    }
  }

  private async claimNext(): Promise<{ job: any; lockToken: string } | null> {
    const now = new Date();
    const lockToken = crypto.randomUUID();
    const job = await GenerationJobModel.findOneAndUpdate(
      {
        $or: [
          { status: "pending" },
          { status: "in_progress", workerLockUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          status: "in_progress",
          workerLockUntil: new Date(now.getTime() + LOCK_TTL_MS),
          workerLockToken: lockToken,
        },
      },
      { sort: { createdAt: 1 }, new: true },
    );
    return job ? { job, lockToken } : null;
  }

  private async process(job: any, lockToken: string) {
    // A crash can leave a panel marked in_progress. It is safe to regenerate
    // only that panel because no image URL was committed as completed.
    await GenerationJobModel.updateOne(
      { _id: job._id, status: "in_progress", workerLockToken: lockToken },
      { $set: { "panels.$[panel].status": "pending" } },
      { arrayFilters: [{ "panel.status": "in_progress" }] },
    );

    for (const panel of job.panels) {
      if (panel.status === "completed") continue;
      if (!(await this.markPanelStarted(job._id, panel.number, lockToken))) return;

      try {
        const generated = await generatePanelImage(panel.description, job.style, panel.number);
        const stored = await this.persistPanel(generated, String(job._id), panel.number);
        if (!stored.imageUrl) throw new Error("Image provider returned no image URL");

        const committed = await GenerationJobModel.updateOne(
          { _id: job._id, status: "in_progress", workerLockToken: lockToken },
          {
            $set: {
              "panels.$[panel].status": "completed",
              "panels.$[panel].imageUrl": stored.imageUrl,
              "panels.$[panel].storagePublicId": stored.storagePublicId,
              "panels.$[panel].generationMeta": generated.generationMeta,
              "panels.$[panel].error": undefined,
              workerLockUntil: new Date(Date.now() + LOCK_TTL_MS),
            },
            $inc: { "progress.completed": 1 },
          },
          { arrayFilters: [{ "panel.number": panel.number }] },
        );
        if (!committed.modifiedCount) return;
        Object.assign(panel, {
          status: "completed",
          imageUrl: stored.imageUrl,
          storagePublicId: stored.storagePublicId,
          generationMeta: generated.generationMeta,
          error: undefined,
        });
        await this.syncDraft(job, "GENERATING");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Panel generation failed";
        await GenerationJobModel.updateOne(
          { _id: job._id, status: "in_progress", workerLockToken: lockToken },
          {
            $set: {
              "panels.$[panel].status": "failed",
              "panels.$[panel].error": message,
              status: "failed",
              error: `Panel ${panel.number}: ${message}`,
            },
            $unset: { workerLockUntil: 1, workerLockToken: 1 },
          },
          { arrayFilters: [{ "panel.number": panel.number }] },
        );
        await this.syncDraft(job, "FAILED");
        return;
      }
    }

    await GenerationJobModel.updateOne(
      { _id: job._id, status: "in_progress", workerLockToken: lockToken },
      {
        $set: { status: "completed", completedAt: new Date() },
        $unset: { workerLockUntil: 1, workerLockToken: 1 },
      },
    );
    await this.syncDraft(job, "COMPLETED", true);
  }

  private async markPanelStarted(jobId: unknown, panelNumber: number, lockToken: string): Promise<boolean> {
    const result = await GenerationJobModel.updateOne(
      { _id: jobId, status: "in_progress", workerLockToken: lockToken },
      {
        $set: {
          "panels.$[panel].status": "in_progress",
          workerLockUntil: new Date(Date.now() + LOCK_TTL_MS),
        },
        $inc: { "panels.$[panel].attempts": 1 },
      },
      { arrayFilters: [{ "panel.number": panelNumber }] },
    );
    return result.modifiedCount === 1;
  }

  private async persistPanel(generated: any, jobId: string, panelNumber: number) {
    if (generated.imageBuffer) {
      const result = await persistImageBuffer(generated.imageBuffer, jobId, `panel-${panelNumber}`);
      if (result) return { imageUrl: result.url, storagePublicId: result.publicId };
    }
    if (generated.imageUrl && !isPersistedUrl(generated.imageUrl)) {
      const result = await persistImage(generated.imageUrl, jobId, `panel-${panelNumber}`);
      if (result) return { imageUrl: result.url, storagePublicId: result.publicId };
    }
    return { imageUrl: generated.imageUrl, storagePublicId: undefined };
  }

  private async syncDraft(job: any, status: "GENERATING" | "COMPLETED" | "FAILED", complete = false) {
    if (!job.draftId) return;
    const update: any = { $set: { panels: job.panels, status } };
    if (complete) update.$unset = { generationJobId: 1 };
    await DraftModel.updateOne({ _id: job.draftId, userId: job.userId }, update);
  }
}

export const generationJobWorker = new GenerationJobWorker();
