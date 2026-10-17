export interface InsertUser {
  username: string;
  email: string;
  password: string;
}

export interface InsertComic {
  title: string;
  style: string;
  idea: string;
  panels: any[];
  characterSheet?: string;
  characterRefUrl?: string;
}

export type GenerationJobStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";
export type GenerationJobPanelStatus = "pending" | "in_progress" | "completed" | "failed";

export interface InsertGenerationJob {
  title: string;
  style: string;
  idea: string;
  panels: Array<{
    number: number;
    description: string;
    dialogue?: string;
    narration?: string;
  }>;
  characterSheet?: string;
  characterRefUrl?: string;
  draftId?: string;
}

/** Validation for the data persisted before a background generation job starts. */
export function validateGenerationJobInput(
  data: unknown,
): { valid: boolean; message?: string; value?: InsertGenerationJob } {
  const comicValidation = validateComicInput(data);
  if (!comicValidation.valid || !comicValidation.value) return comicValidation;

  const { panels } = comicValidation.value;
  const draftId = (data as any)?.draftId;
  if (draftId !== undefined && (typeof draftId !== "string" || !draftId.trim())) {
    return { valid: false, message: "draftId must be a non-empty string" };
  }
  if (!panels.length) return { valid: false, message: "At least one panel is required" };
  if (panels.some((panel: any, index: number) =>
    !panel || typeof panel.description !== "string" || !panel.description.trim() ||
    (panel.number !== undefined && (!Number.isInteger(panel.number) || panel.number < 1)) ||
    (panel.number !== undefined && panel.number !== index + 1),
  )) {
    return { valid: false, message: "Each panel needs a non-empty description and sequential number" };
  }

  return {
    valid: true,
    value: {
      ...comicValidation.value,
      panels: panels.map((panel: any, index: number) => ({
        number: panel.number ?? index + 1,
        description: panel.description.trim(),
        dialogue: typeof panel.dialogue === "string" ? panel.dialogue : "",
        narration: typeof panel.narration === "string" ? panel.narration : "",
      })),
      draftId: draftId?.trim(),
    },
  };
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateLoginInput(data: any): { valid: boolean; message?: string; value?: { username: string; password: string } } {
  const { username, password } = data || {};

  if (!username || typeof username !== "string") {
    return { valid: false, message: "Username is required" };
  }
  if (!password || typeof password !== "string") {
    return { valid: false, message: "Password is required" };
  }

  return { valid: true, value: { username, password } };
}

export function validateUserInput(data: any): { valid: boolean; message?: string; value?: InsertUser } {
  const { username, email, password } = data || {};

  if (!username || typeof username !== "string") {
    return { valid: false, message: "Username is required" };
  }
  if (username.length < 3) {
    return { valid: false, message: "Username must be at least 3 characters" };
  }
  if (username.length > 30) {
    return { valid: false, message: "Username must be at most 30 characters" };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, message: "Username can only contain letters, numbers, and underscores" };
  }

  if (!email || typeof email !== "string") {
    return { valid: false, message: "Email is required" };
  }
  if (!validateEmail(email)) {
    return { valid: false, message: "Please enter a valid email address" };
  }

  if (!password || typeof password !== "string") {
    return { valid: false, message: "Password is required" };
  }
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters" };
  }
  if (password.length > 128) {
    return { valid: false, message: "Password must be at most 128 characters" };
  }

  return { valid: true, value: { username, email, password } };
}

export function validateComicInput(data: any): { valid: boolean; message?: string; value?: InsertComic } {
  const { title, style, idea, panels, characterSheet, characterRefUrl } = data || {};

  if (!title || typeof title !== "string") {
    return { valid: false, message: "Title is required" };
  }
  if (title.length > 100) {
    return { valid: false, message: "Title must be at most 100 characters" };
  }

  if (!style || typeof style !== "string") {
    return { valid: false, message: "Style is required" };
  }

  if (!idea || typeof idea !== "string") {
    return { valid: false, message: "Idea is required" };
  }
  if (idea.length > 1000) {
    return { valid: false, message: "Idea must be at most 1000 characters" };
  }

  if (!Array.isArray(panels)) {
    return { valid: false, message: "Panels must be an array" };
  }

  if (characterSheet !== undefined && typeof characterSheet !== "string") {
    return { valid: false, message: "characterSheet must be a string" };
  }

  if (characterRefUrl !== undefined && typeof characterRefUrl !== "string") {
    return { valid: false, message: "characterRefUrl must be a string" };
  }

  return { valid: true, value: { title, style, idea, panels, characterSheet, characterRefUrl } };
}

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  createdAt: Date;
}

export interface Comic {
  id: string;
  userId: string;
  title: string;
  style: string;
  idea: string;
  panels: any[];
  characterSheet?: string;
  characterRefUrl?: string;
  published: boolean;
  shares: number;
  downloads: number;
  createdAt: Date;
}

export type DraftStatus = "DRAFT" | "GENERATING" | "COMPLETED" | "FAILED";

export interface Draft {
  id: string;
  userId: string;
  title: string;
  style: string;
  idea: string;
  panels: any[];
  characterSheet?: string;
  characterRefUrl?: string;
  generationJobId?: string;
  status: DraftStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertDraft {
  title: string;
  style: string;
  idea: string;
  panels?: any[];
  characterSheet?: string;
  characterRefUrl?: string;
  generationJobId?: string;
  status?: DraftStatus;
}

// ── Rating & Comment ────────────────────────────────────────────────────

export interface InsertRating {
  comicId: string;
  value: number;  // 1-5
}

export interface Rating {
  id: string;
  userId: string;
  comicId: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RatingWithUser {
  id: string;
  userId: string;
  comicId: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
  username: string;
  avatar?: string;
}

export interface InsertComment {
  comicId: string;
  text: string;
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  comicId: string;
  text: string;
  createdAt: Date;
}

export interface ComicDetail extends Comic {
  averageRating: number;
  ratingCount: number;
  comments: Comment[];
  authorUsername: string;
}

export function validateRatingInput(data: any): { valid: boolean; message?: string; value?: { value: number } } {
  const { value } = data || {};
  if (value === undefined || typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
    return { valid: false, message: "Rating value must be an integer between 1 and 5" };
  }
  return { valid: true, value: { value } };
}

export function validateCommentInput(data: any): { valid: boolean; message?: string; value?: { text: string } } {
  const { text } = data || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    return { valid: false, message: "Comment text is required" };
  }
  if (text.trim().length > 500) {
    return { valid: false, message: "Comment must be at most 500 characters" };
  }
  return { valid: true, value: { text: text.trim() } };
}

// ── User Profile Extension ─────────────────────────────────────────────

export interface UserProfile {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
}

export function validateDraftInput(data: any): { valid: boolean; message?: string; value?: InsertDraft } {
  const { title, style, idea, panels, characterSheet, characterRefUrl, status } = data || {};

  if (!title || typeof title !== "string") {
    return { valid: false, message: "Title is required" };
  }
  if (title.length > 100) {
    return { valid: false, message: "Title must be at most 100 characters" };
  }

  if (!style || typeof style !== "string") {
    return { valid: false, message: "Style is required" };
  }

  // Idea can be empty for early drafts
  if (idea !== undefined && typeof idea !== "string") {
    return { valid: false, message: "Idea must be a string" };
  }
  if (idea && idea.length > 1000) {
    return { valid: false, message: "Idea must be at most 1000 characters" };
  }

  if (panels !== undefined && !Array.isArray(panels)) {
    return { valid: false, message: "Panels must be an array" };
  }

  if (characterSheet !== undefined && typeof characterSheet !== "string") {
    return { valid: false, message: "characterSheet must be a string" };
  }

  if (characterRefUrl !== undefined && typeof characterRefUrl !== "string") {
    return { valid: false, message: "characterRefUrl must be a string" };
  }

  const validStatuses: DraftStatus[] = ["DRAFT", "GENERATING", "COMPLETED", "FAILED"];
  if (status !== undefined && !validStatuses.includes(status)) {
    return { valid: false, message: "Invalid status" };
  }

  return {
    valid: true,
    value: {
      title,
      style,
      idea: idea || "",
      panels: panels || [],
      characterSheet,
      characterRefUrl,
      status: status || "DRAFT",
    },
  };
}
