import { Router } from "express";
import { authenticateStreamToken, authenticateToken } from "../auth/auth.middleware";
import { aiLimiter } from "../../middleware/rate-limit";
import { moderatePanelDescriptions } from "../../middleware/content-safety";
import * as jobController from "./job.controller";
import { streamGenerationJob } from "./job.events";

const router = Router();

// Panels are moderated before they reach the queue: once work is enqueued it
// runs without a request context to reject it.
router.post(
  "/generate",
  authenticateToken,
  aiLimiter,
  moderatePanelDescriptions,
  jobController.createGenerationJob,
);

// Must precede /:id so "active" is not read as a job id.
router.get("/active", authenticateToken, jobController.getActiveGenerationJob);
// EventSource cannot set an Authorization header; see authenticateStreamToken.
router.get("/:id/events", authenticateStreamToken, streamGenerationJob);
router.get("/:id", authenticateToken, jobController.getGenerationJob);

export default router;
