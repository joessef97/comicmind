import { Router } from "express";
import { authenticateToken } from "../auth/auth.middleware";
import {
  createPortalSession,
  getCheckoutEligibility,
  getBillingPlans,
  getSubscriptionStatus,
  handlePaddleWebhook,
} from "./billing.controller";

const router = Router();

router.get("/plans", getBillingPlans);
router.get("/subscription", authenticateToken, getSubscriptionStatus);
router.get("/checkout-eligibility", authenticateToken, getCheckoutEligibility);
router.post("/portal-session", authenticateToken, createPortalSession);
router.post("/webhook", handlePaddleWebhook);

export default router;
