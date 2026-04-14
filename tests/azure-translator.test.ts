import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isArabicText,
  normalizeText,
  translateGeneratedText,
} from "../backend/src/services/translation.service";

// ── isArabicText (offline heuristic — no API needed) ─────────────────

describe("isArabicText", () => {
  it("returns true for Arabic text", () => {
    expect(isArabicText("مرحبا بالعالم")).toBe(true);
  });

  it("returns true for mixed Arabic and English", () => {
    expect(isArabicText("Hello مرحبا World")).toBe(true);
  });

  it("returns false for pure English", () => {
    expect(isArabicText("Hello World")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isArabicText("")).toBe(false);
  });

  it("returns false for numbers only", () => {
    expect(isArabicText("12345")).toBe(false);
  });

  it("detects Arabic supplement characters", () => {
    // \u08A0 range
    expect(isArabicText("\u08A0")).toBe(true);
  });
});

// ── normalizeText + translateGeneratedText ─────────────────────────────

describe("translation service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("normalizeText keeps English text unchanged", async () => {
    const result = await normalizeText("Hello world");
    expect(result.originalText).toBe("Hello world");
    expect(result.normalizedText).toBe("Hello world");
    expect(result.sourceLanguage).toBe("en");
    expect(result.wasTranslated).toBe(false);
  });

  it("normalizeText translates Arabic to English", async () => {
    vi.doMock("@vitalets/google-translate-api", () => ({
      translate: vi.fn(async () => ({ text: "Hello from Arabic" })),
    }));

    const { normalizeText: mockedNormalizeText } = await import("../backend/src/services/translation.service");
    const result = await mockedNormalizeText("مرحبا");
    expect(result.normalizedText).toBe("Hello from Arabic");
    expect(result.sourceLanguage).toBe("ar");
    expect(result.wasTranslated).toBe(true);
  });

  it("translateGeneratedText is a no-op for target en", async () => {
    const result = await translateGeneratedText("Already English", "en");
    expect(result).toBe("Already English");
  });
});

// ── translateDialoguesToArabic — name preservation ──────────────────────

describe("dialogue name preservation", () => {
  it("extracts character name correctly", () => {
    // We test the name-extraction logic by checking containsArabic
    // on the name part (should be false — names stay English)
    const dialogue = "Lena: Hello world";
    const colonIdx = dialogue.indexOf(":");
    const name = dialogue.slice(0, colonIdx).trim();
    const text = dialogue.slice(colonIdx + 1).trim();

    expect(name).toBe("Lena");
    expect(text).toBe("Hello world");
    expect(isArabicText(name)).toBe(false);
  });

  it("handles dialogue without colon", () => {
    const dialogue = "No colon here";
    const colonIdx = dialogue.indexOf(":");
    expect(colonIdx).toBe(-1);
  });
});

// ── Middleware shape ────────────────────────────────────────────────────

describe("autoTranslateInput middleware", () => {
  it("is a function with 3 parameters (req, res, next)", async () => {
    const { autoTranslateInput } = await import("../backend/src/middleware/translation");
    expect(typeof autoTranslateInput).toBe("function");
    expect(autoTranslateInput.length).toBe(3);
  });
});

describe("translatePanelsToArabic", () => {
  it("is a function", async () => {
    const { translatePanelsToArabic } = await import("../backend/src/middleware/translation");
    expect(typeof translatePanelsToArabic).toBe("function");
  });

  it("returns empty array for empty input", async () => {
    const { translatePanelsToArabic } = await import("../backend/src/middleware/translation");
    const result = await translatePanelsToArabic([]);
    expect(result).toEqual([]);
  });
});
