import { Router } from "express";
import { authenticateToken } from "../auth/auth.middleware";
import * as ratingController from "./rating.controller";

// Mounted at /api/comics (nested under comic resource)
const router = Router();

router.post("/:id/rating", authenticateToken, ratingController.rateComic);
router.get("/:id/ratings/summary", ratingController.getRatingSummary);
router.get("/:id/ratings", ratingController.getRatings);
router.get("/:id/rating/mine", authenticateToken, ratingController.getMyRating);

export default router;
