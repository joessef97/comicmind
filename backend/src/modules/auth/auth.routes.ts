import { Router } from "express";
import { authLimiter } from "../../middleware/rate-limit";
import { authenticateToken } from "./auth.middleware";
import * as authController from "./auth.controller";

const router = Router();

router.post("/register", authLimiter, authController.register);
router.post("/login", authLimiter, authController.login);
router.get("/me", authenticateToken, authController.me);
router.post("/forgot-password", authLimiter, authController.forgotPassword);
router.post("/reset-password", authLimiter, authController.resetPassword);

export default router;
