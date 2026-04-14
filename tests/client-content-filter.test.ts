import { describe, it, expect } from "vitest";
import {
  findBannedWords,
  containsBannedWords,
  validateContentSafety,
} from "../frontend/src/lib/content-filter";

// ─── findBannedWords ──────────────────────────────────────────────────

describe("findBannedWords", () => {
  it("returns empty array for safe text", () => {
    expect(findBannedWords("A friendly robot learns to paint")).toEqual([]);
  });

  it("returns the specific banned words found", () => {
    const result = findBannedWords("Too much violence and hate");
    expect(result).toContain("violence");
    expect(result).toContain("hate");
    expect(result.length).toBe(2);
  });

  it("detects leet-speak (k1ll)", () => {
    expect(findBannedWords("k1ll")).toContain("kill");
  });

  it("detects dot-obfuscation (m.u.r.d.e.r)", () => {
    expect(findBannedWords("m.u.r.d.e.r")).toContain("murder");
  });

  it("returns empty for the empty string", () => {
    expect(findBannedWords("")).toEqual([]);
  });
});

// ─── containsBannedWords ──────────────────────────────────────────────

describe("containsBannedWords (client)", () => {
  it("returns false for safe text", () => {
    expect(containsBannedWords("Superheroes save the day")).toBe(false);
  });

  it("returns true for text with a banned word", () => {
    expect(containsBannedWords("explicit content")).toBe(true);
  });
});

// ─── validateContentSafety ────────────────────────────────────────────

describe("validateContentSafety", () => {
  it("passes for clean title + idea and includes checkedAt timestamp", () => {
    const before = Date.now();
    const result = validateContentSafety("Space Cats", "Cats explore a distant galaxy");
    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
    expect(result.flaggedWords).toBeUndefined();
    expect(result.checkedAt).toBeGreaterThanOrEqual(before);
  });

  it("fails when title contains a banned word", () => {
    const result = validateContentSafety("Murder Mystery", "Two friends solve a puzzle");
    expect(result.valid).toBe(false);
    expect(result.flaggedWords).toContain("murder");
    expect(result.message).toContain("murder");
    expect(result.checkedAt).toBeGreaterThan(0);
  });

  it("fails when idea contains a banned word", () => {
    const result = validateContentSafety("My Story", "drug dealer escapes police");
    expect(result.valid).toBe(false);
    expect(result.flaggedWords).toContain("drug");
  });

  it("fails and lists multiple flagged words without duplicates", () => {
    const result = validateContentSafety("gore and hate", "a story of gore and hate");
    expect(result.valid).toBe(false);
    // Should deduplicate
    const unique = [...new Set(result.flaggedWords)];
    expect(result.flaggedWords!.length).toBe(unique.length);
    expect(result.flaggedWords).toContain("gore");
    expect(result.flaggedWords).toContain("hate");
  });

  it("passes for empty strings (no content to flag)", () => {
    const result = validateContentSafety("", "");
    expect(result.valid).toBe(true);
  });

  it("catches leet-speak in title", () => {
    const result = validateContentSafety("n5fw art", "innocent story");
    expect(result.valid).toBe(false);
    expect(result.flaggedWords).toContain("nsfw");
  });

  it("catches obfuscated word in idea", () => {
    const result = validateContentSafety("good title", "the hero must k.i.l.l the villain");
    expect(result.valid).toBe(false);
    expect(result.flaggedWords).toContain("kill");
  });

  it("catches new category: weapons", () => {
    const result = validateContentSafety("The Grenade", "a story about a grenade");
    expect(result.valid).toBe(false);
    expect(result.flaggedWords).toContain("grenade");
  });

  it("catches new category: profanity", () => {
    const result = validateContentSafety("shit happens", "a normal day");
    expect(result.valid).toBe(false);
    expect(result.flaggedWords).toContain("shit");
  });

  it("catches new category: self-harm", () => {
    const result = validateContentSafety("safe title", "the character is suicidal");
    expect(result.valid).toBe(false);
    expect(result.flaggedWords).toContain("suicidal");
  });
});
