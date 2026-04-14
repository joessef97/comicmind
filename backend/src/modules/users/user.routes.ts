import { Router } from "express";
import { authenticateToken } from "../auth/auth.middleware";
import { activateSubscription, getSubscriptionStatus } from "./user.controller";

const router = Router();

router.get("/subscription", authenticateToken, getSubscriptionStatus);
router.post("/subscription/activate", authenticateToken, activateSubscription);

export default router;
