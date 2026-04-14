import { Router } from "express";
import { authenticateToken } from "../auth/auth.middleware";
import * as commentController from "./comment.controller";

// Mounted at /api/comics (nested under comic resource)
export const comicCommentRouter = Router();
comicCommentRouter.post("/:id/comments", authenticateToken, commentController.addComment);
comicCommentRouter.get("/:id/comments", commentController.getComments);

// Mounted at /api/comments (top-level for delete)
export const commentDeleteRouter = Router();
commentDeleteRouter.delete("/:id", authenticateToken, commentController.deleteComment);
