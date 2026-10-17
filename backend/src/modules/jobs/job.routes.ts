import { Router } from "express";
import { authenticateToken } from "../auth/auth.middleware";
import { aiLimiter } from "../../middleware/rate-limit";
import { moderatePanelDescriptions } from "../../middleware/content-safety";
import { cancelJob, enqueueJob, getJob } from "./job.controller";

const jobRouter = Router();

jobRouter.post("/", authenticateToken, aiLimiter, moderatePanelDescriptions, enqueueJob);
jobRouter.get("/:id", authenticateToken, getJob);
jobRouter.delete("/:id", authenticateToken, cancelJob);

export default jobRouter;
