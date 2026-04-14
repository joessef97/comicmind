import { describe, it, expect } from "vitest";
import { checkContent } from "../backend/src/utils/content-filter";

// ── checkContent (local banned list + NLP normalization) ───────────────

describe("checkContent", () => {
  it("returns safe for empty text", () => {
    expect(checkContent("").safe).toBe(true);
  });

  it("returns safe for friendly text", () => {
    expect(checkContent("A calm adventure in a sunny park").safe).toBe(true);
  });

  it("flags banned content", () => {
    const result = checkContent("This includes explicit porn content");
    expect(result.safe).toBe(false);
    expect(typeof result.reason).toBe("string");
  });
});

// ── Middleware shape checks ────────────────────────────────────────────

describe("content-safety middleware exports", () => {
  it("moderateUserInput is a function with 3 params", async () => {
    const { moderateUserInput } = await import(
      "../backend/src/middleware/content-safety"
    );
    expect(typeof moderateUserInput).toBe("function");
    expect(moderateUserInput.length).toBe(3);
  });

  it("moderatePanelDescriptions is a function with 3 params", async () => {
    const { moderatePanelDescriptions } = await import(
      "../backend/src/middleware/content-safety"
    );
    expect(typeof moderatePanelDescriptions).toBe("function");
    expect(moderatePanelDescriptions.length).toBe(3);
  });

  it("moderatePrompt is a function with 3 params", async () => {
    const { moderatePrompt } = await import(
      "../backend/src/middleware/content-safety"
    );
    expect(typeof moderatePrompt).toBe("function");
    expect(moderatePrompt.length).toBe(3);
  });

  it("moderateGeneratedDialogues is a function", async () => {
    const { moderateGeneratedDialogues } = await import(
      "../backend/src/middleware/content-safety"
    );
    expect(typeof moderateGeneratedDialogues).toBe("function");
  });

  it("moderateGeneratedDialogues returns safe for empty panels", async () => {
    const { moderateGeneratedDialogues } = await import(
      "../backend/src/middleware/content-safety"
    );
    const result = await moderateGeneratedDialogues([]);
    expect(result.safe).toBe(true);
  });
});
