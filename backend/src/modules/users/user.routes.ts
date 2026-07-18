import { Router } from "express";
import { authenticateToken } from "../auth/auth.middleware";
import { getSubscriptionStatus } from "../billing/billing.controller";

const router = Router();

router.get("/subscription", authenticateToken, getSubscriptionStatus);

export default router;
