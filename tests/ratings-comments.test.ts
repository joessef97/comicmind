import { describe, it, expect } from "vitest";
import {
  validateRatingInput,
  validateCommentInput,
} from "../shared/schema";

// ─── validateRatingInput ───────────────────────────────────────────────

describe("validateRatingInput", () => {
  it("accepts a valid new rating (value 1–5)", () => {
    const result = validateRatingInput({ value: 4 });
    expect(result.valid).toBe(true);
    expect(result.value).toEqual({ value: 4 });
  });

  it("accepts boundary values 1 and 5", () => {
    expect(validateRatingInput({ value: 1 }).valid).toBe(true);
    expect(validateRatingInput({ value: 5 }).valid).toBe(true);
  });

  it("allows updating a rating (same shape, different value)", () => {
    // First "rate"
    const first = validateRatingInput({ value: 3 });
    expect(first.valid).toBe(true);
    expect(first.value).toEqual({ value: 3 });

    // "Update" with new value
    const updated = validateRatingInput({ value: 5 });
    expect(updated.valid).toBe(true);
    expect(updated.value).toEqual({ value: 5 });
  });

  it("rejects value below 1", () => {
    const result = validateRatingInput({ value: 0 });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/between 1 and 5/i);
  });

  it("rejects value above 5", () => {
    const result = validateRatingInput({ value: 6 });
    expect(result.valid).toBe(false);
  });

  it("rejects non-integer values", () => {
    expect(validateRatingInput({ value: 3.5 }).valid).toBe(false);
    expect(validateRatingInput({ value: 2.1 }).valid).toBe(false);
  });

  it("rejects string values", () => {
    expect(validateRatingInput({ value: "4" }).valid).toBe(false);
  });

  it("rejects missing value", () => {
    expect(validateRatingInput({}).valid).toBe(false);
    expect(validateRatingInput(null).valid).toBe(false);
    expect(validateRatingInput(undefined).valid).toBe(false);
  });

  it("rejects negative values", () => {
    expect(validateRatingInput({ value: -1 }).valid).toBe(false);
  });
});

// ─── validateCommentInput ──────────────────────────────────────────────

describe("validateCommentInput", () => {
  it("accepts a valid comment", () => {
    const result = validateCommentInput({ text: "Great comic!" });
    expect(result.valid).toBe(true);
    expect(result.value).toEqual({ text: "Great comic!" });
  });

  it("trims whitespace from comment text", () => {
    const result = validateCommentInput({ text: "  Nice work!  " });
    expect(result.valid).toBe(true);
    expect(result.value!.text).toBe("Nice work!");
  });

  it("accepts a comment at exactly 500 characters", () => {
    const text = "a".repeat(500);
    const result = validateCommentInput({ text });
    expect(result.valid).toBe(true);
    expect(result.value!.text).toBe(text);
  });

  it("rejects a comment over 500 characters", () => {
    const text = "b".repeat(501);
    const result = validateCommentInput({ text });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/500/);
  });

  it("rejects empty text", () => {
    expect(validateCommentInput({ text: "" }).valid).toBe(false);
    expect(validateCommentInput({ text: "   " }).valid).toBe(false);
  });

  it("rejects missing text field", () => {
    expect(validateCommentInput({}).valid).toBe(false);
    expect(validateCommentInput(null).valid).toBe(false);
    expect(validateCommentInput(undefined).valid).toBe(false);
  });

  it("rejects non-string text", () => {
    expect(validateCommentInput({ text: 123 }).valid).toBe(false);
    expect(validateCommentInput({ text: true }).valid).toBe(false);
  });
});

// ─── Auth failure simulation (validator-level) ─────────────────────────

describe("Auth guard expectations", () => {
  it("rating validator does NOT require comicId in body (comes from URL)", () => {
    // Only { value } is needed — comicId is a URL param
    const result = validateRatingInput({ value: 3 });
    expect(result.valid).toBe(true);
    expect(result.value).toEqual({ value: 3 });
    // Should NOT have comicId in the validated output
    expect((result.value as any).comicId).toBeUndefined();
  });

  it("comment validator does NOT require comicId in body (comes from URL)", () => {
    const result = validateCommentInput({ text: "hello" });
    expect(result.valid).toBe(true);
    expect((result.value as any).comicId).toBeUndefined();
  });

  it("rating with no body should fail validation (simulating unauthenticated raw post)", () => {
    // Even if auth is bypassed, validator catches bad input
    const result = validateRatingInput(undefined);
    expect(result.valid).toBe(false);
  });

  it("comment with no body should fail validation", () => {
    const result = validateCommentInput(undefined);
    expect(result.valid).toBe(false);
  });
});
