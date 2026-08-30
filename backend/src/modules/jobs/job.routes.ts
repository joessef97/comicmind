import { Router } from "express";
import { authenticateToken } from "../auth/auth.middleware";
import { aiLimiter } from "../../middleware/rate-limit";
import { moderatePanelDescriptions } from "../../middleware/content-safety";
import * as jobController from "./job.controller";

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

router.get("/:id", authenticateToken, jobController.getGenerationJob);

export default router;
