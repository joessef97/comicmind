import { describe, it, expect } from "vitest";
import {
  containsBannedWords,
  validateContent,
  validatePanelDescriptions,
} from "../backend/src/utils/content-filter";

// ─── containsBannedWords ──────────────────────────────────────────────

describe("containsBannedWords", () => {
  it("returns false for safe text", () => {
    expect(containsBannedWords("A friendly robot learns to paint")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(containsBannedWords("")).toBe(false);
  });

  it("detects a plain banned word", () => {
    expect(containsBannedWords("There is too much violence here")).toBe(true);
  });

  it("detects banned word regardless of case", () => {
    expect(containsBannedWords("EXPLICIT content")).toBe(true);
  });

  it("detects leet-speak obfuscation (k1ll → kill)", () => {
    expect(containsBannedWords("k1ll the dragon")).toBe(true);
  });

  it("detects dot-separated obfuscation (k.i.l.l → kill)", () => {
    expect(containsBannedWords("k.i.l.l the dragon")).toBe(true);
  });

  it("detects $ → s substitution (5u1c1d3  → suicide)", () => {
    expect(containsBannedWords("5u1c1d3")).toBe(true);
  });

  it("does not flag partial matches (skilled, blood-orange substring)", () => {
    // "skilled" should NOT match "kill" because of word-boundary checks
    expect(containsBannedWords("skilled programmer")).toBe(false);
  });

  it("detects new category: sexual content", () => {
    expect(containsBannedWords("pornographic scene")).toBe(true);
  });

  it("detects new category: drugs", () => {
    expect(containsBannedWords("cocaine deal")).toBe(true);
  });

  it("detects new category: extremism", () => {
    expect(containsBannedWords("terrorist attack")).toBe(true);
  });

  it("detects new category: profanity", () => {
    expect(containsBannedWords("what the fuck")).toBe(true);
  });

  it("detects new category: hate speech", () => {
    expect(containsBannedWords("white supremacist rally")).toBe(true);
  });

  it("detects new category: abuse", () => {
    expect(containsBannedWords("child molestation")).toBe(true);
  });
});

// ─── validateContent ──────────────────────────────────────────────────

describe("validateContent", () => {
  it("passes for safe title and idea", () => {
    const result = validateContent("My Great Adventure", "Two cats explore a forest");
    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it("fails when the title contains a banned word", () => {
    const result = validateContent("Murder Mystery", "Two friends solve a puzzle");
    expect(result.valid).toBe(false);
    expect(result.message).toBeDefined();
  });

  it("fails when the idea contains a banned word", () => {
    const result = validateContent("My Story", "A tale about drug dealing");
    expect(result.valid).toBe(false);
    expect(result.message).toBeDefined();
  });

  it("fails when both title and idea contain banned words", () => {
    const result = validateContent("Gore Fest", "Hate-filled world");
    expect(result.valid).toBe(false);
  });

  it("passes when text is just whitespace", () => {
    const result = validateContent("   ", "   ");
    expect(result.valid).toBe(true);
  });
});

// ─── validatePanelDescriptions ────────────────────────────────────────

describe("validatePanelDescriptions", () => {
  it("passes for safe panel descriptions", () => {
    const panels = [
      { description: "A cat sitting on a fence" },
      { description: "The sun sets over the ocean" },
    ];
    const result = validatePanelDescriptions(panels);
    expect(result.valid).toBe(true);
  });

  it("fails when any panel has a banned word", () => {
    const panels = [
      { description: "A cat sitting on a fence" },
      { description: "A scene of graphic violence" },
    ];
    const result = validatePanelDescriptions(panels);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("inappropriate");
  });

  it("passes for panels with no description field", () => {
    const panels = [{ other: "value" }] as any;
    const result = validatePanelDescriptions(panels);
    expect(result.valid).toBe(true);
  });

  it("passes for empty panels array", () => {
    const result = validatePanelDescriptions([]);
    expect(result.valid).toBe(true);
  });
});
