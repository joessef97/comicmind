import { Router } from "express";
import { authenticateToken } from "../auth/auth.middleware";
import { moderateEditedPanels } from "../../middleware/content-safety";
import * as draftController from "./draft.controller";

const router = Router();

router.post("/", authenticateToken, moderateEditedPanels, draftController.createDraft);
router.get("/", authenticateToken, draftController.getDrafts);
router.get("/:id", authenticateToken, draftController.getDraft);
router.put("/:id", authenticateToken, moderateEditedPanels, draftController.updateDraft);
router.delete("/stale", authenticateToken, draftController.cleanupStaleDrafts);
router.delete("/:id", authenticateToken, draftController.deleteDraft);

export default router;
