import type { Request, Response } from "express";
import crypto from "crypto";
import { storage } from "../../services/storage.service";
import { hashPassword, verifyPassword, generateToken } from "./auth.service";
import type { AuthRequest } from "./auth.middleware";
import { validateUserInput, validateLoginInput, validateEmail } from "@shared/schema";
import { sendResetEmail } from "../../services/email.service";

export async function register(req: Request, res: Response) {
  try {
    const validation = validateUserInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }
    const { username, email, password } = validation.value!;

    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const existingEmail = await storage.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const hashedPassword = await hashPassword(password);
    const user = await storage.createUser({
      username,
      email,
      password: hashedPassword,
    });

    const token = generateToken(user.id);

    return res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(400).json({ message: "Invalid registration data" });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const validation = validateLoginInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }
    const { username, password } = validation.value!;

    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user.id);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(400).json({ message: "Invalid login data" });
  }
}

export async function me(req: AuthRequest, res: Response) {
  try {
    const user = await storage.getUser(req.userId!);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      id: user.id,
      username: user.username,
    });
  } catch (error) {
    console.error("Get user error:", error);
    return res.status(500).json({ message: "Failed to get user" });
  }
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string" || !validateEmail(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log(`[forgot-password] Request for email: ${normalizedEmail}`);

    // Always return the same message to prevent email enumeration
    const genericMessage = "If an account with that email exists, a reset link has been sent.";

    const user = await storage.getUserByEmail(normalizedEmail);

    if (!user) {
      console.log(`[forgot-password] No user found for ${normalizedEmail}`);
      return res.status(200).json({ message: genericMessage });
    }

    // Generate a secure random token (32 bytes = 64 hex chars)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 45 * 60 * 1000); // 45 minutes

    // Delete any existing active reset tokens for this user
    await storage.deleteActiveResetsForUser(user.id);

    // Store hashed token in DB
    await storage.createPasswordReset(user.id, resetToken, expiresAt);

    // Send the raw token in the email (only the hash is in DB)
    await sendResetEmail(normalizedEmail, resetToken);
    console.log(`[forgot-password] Reset token created for user ${user.id}`);

    return res.status(200).json({ message: genericMessage });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Failed to process request" });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { email, token, newPassword } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Reset token is required" });
    }

    if (!email || typeof email !== "string" || !validateEmail(email)) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    if (newPassword.length > 128) {
      return res.status(400).json({ message: "Password must be at most 128 characters" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log(`[reset-password] Attempt for email: ${normalizedEmail}`);

    // Find valid reset record by SHA-256 hashed token + email match
    const reset = await storage.findValidPasswordReset(token, normalizedEmail);
    if (!reset) {
      console.log(`[reset-password] Invalid or expired token for ${normalizedEmail}`);
      return res.status(400).json({ message: "Invalid or expired reset link. Please request a new one." });
    }

    // Hash new password with bcrypt (cost 12)
    const hashedPassword = await hashPassword(newPassword);
    await storage.updatePassword(reset.userId, hashedPassword);

    // Mark this reset token as used (single-use)
    await storage.markResetUsed(token);

    // Delete any other active reset tokens for this user
    await storage.deleteActiveResetsForUser(reset.userId);

    console.log(`[reset-password] Password reset successful for user ${reset.userId}`);
    return res.status(200).json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Failed to reset password" });
  }
}
