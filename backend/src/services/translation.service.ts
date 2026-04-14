import { translate } from "@vitalets/google-translate-api";

export interface NormalizedTextResult {
  originalText: string;
  normalizedText: string;
  sourceLanguage: string;
  wasTranslated: boolean;
}

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

export function isArabicText(text: string): boolean {
  if (!text) return false;
  return ARABIC_REGEX.test(text);
}

async function translateText(text: string, targetLanguage: string): Promise<string> {
  if (!text || !text.trim()) {
    return text;
  }

  const result = await translate(text, { to: targetLanguage });
  return result.text;
}

export async function normalizeText(text: string): Promise<NormalizedTextResult> {
  const originalText = text ?? "";

  if (!originalText.trim()) {
    return {
      originalText,
      normalizedText: originalText,
      sourceLanguage: "en",
      wasTranslated: false,
    };
  }

  const sourceLanguage = isArabicText(originalText) ? "ar" : "en";
  if (sourceLanguage !== "ar") {
    return {
      originalText,
      normalizedText: originalText,
      sourceLanguage,
      wasTranslated: false,
    };
  }

  try {
    const normalizedText = await translateText(originalText, "en");
    return {
      originalText,
      normalizedText,
      sourceLanguage,
      wasTranslated: true,
    };
  } catch (error) {
    console.error("[translation-service] normalizeText failed, using original text:", error);
    return {
      originalText,
      normalizedText: originalText,
      sourceLanguage,
      wasTranslated: false,
    };
  }
}

export async function translateGeneratedText(
  text: string,
  targetLanguage: string,
): Promise<string> {
  if (!text || !text.trim() || targetLanguage === "en") {
    return text;
  }

  try {
    return await translateText(text, targetLanguage);
  } catch (error) {
    console.error("[translation-service] translateGeneratedText failed, using original text:", error);
    return text;
  }
}
