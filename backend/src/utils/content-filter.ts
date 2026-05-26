/**
 * Content Filter
 * ──────────────
 * Regex-based banned-words detection with leet-speak normalisation.
 * Runs entirely in-backend with a banned list + basic NLP normalization.
 */

import nlp from "compromise";

// ── Character normalisation (covers common leet-speak substitutions) ───

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
  "!": "i",
  "+": "t",
};

function normaliseLeet(text: string): string {
  const leetNormalised = text
    .split("")
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join("");

  // Collapse punctuation between letters so k.i.l.l -> kill.
  return leetNormalised.replace(/([a-z])[._-]+(?=[a-z])/gi, "$1");
}

// ── Banned words list ──────────────────────────────────────────────────
// Kept as a flat array — O(n) regex compilation is done once below.

const BANNED_PATTERNS = [
  // Violence / weapons
  "\\bviolence\\b",
  "\\bkill\\w*\\b",
  "\\bmurder\\w*\\b",
  "\\bsuicide\\b",
  "\\bbomb\\b",
  "\\bterroris[mt]\\w*\\b",
  "\\bmassacre\\b",
  "\\bgenocide\\b",
  "\\bassassination\\b",
  "\\bgore\\b",
  "\\btorture\\b",
  "\\bdismember\\w*\\b",
  "\\bbehead\\w*\\b",

  // Sexual / explicit / profanity
  "\\bexplicit\\b",
  "\\bporn\\w*\\b",
  "\\bhentai\\b",
  "\\bxxx\\b",
  "\\bnude\\b",
  "\\bnaked\\b",
  "\\bsex\\b",
  "\\borgasm\\b",
  "\\bpenis\\b",
  "\\bvagina\\b",
  "\\bdildo\\b",
  "\\bmasturbat\\w*\\b",
  "\\bfuck\\b",

  // Drugs / abuse / extremism
  "\\bcocaine\\b",
  "\\bheroin\\b",
  "\\bmeth\\b",
  "\\bfentanyl\\b",
  "\\bdrug\\s+dealing\\b",
  "\\bchild\\s+molestation\\b",
  "\\bwhite\\s+supremacist\\b",

  // Self-harm
  "\\bself[-\\s]?harm\\b",
  "\\bcut\\s+myself\\b",
  "\\bslit\\s+wrist\\b",
];

/** Pre-compiled regex that matches banned tokens/phrases with boundaries. */
const BANNED_REGEX = new RegExp(BANNED_PATTERNS.join("|"), "i");
const BANNED_REGEX_LIST = BANNED_PATTERNS.map((pattern) => new RegExp(pattern, "i"));

function normalizeForSafety(text: string): string {
  if (!text) return "";

  const leetNormalised = normaliseLeet(text.toLowerCase());
  const doc = nlp(leetNormalised).normalize({
    punctuation: true,
    whitespace: true,
    case: true,
    numbers: true,
    plurals: true,
    verbs: true,
  });

  const nlpNormalised = doc.text("normal").toLowerCase();
  return `${leetNormalised}\n${nlpNormalised}`;
}

/**
 * Main backend content-safety checker.
 */
export function checkContent(text: string): { safe: boolean; reason?: string } {
  if (!text || text.trim().length === 0) {
    return { safe: true };
  }

  const normalizedText = normalizeForSafety(text);
  const directMatch = BANNED_REGEX.test(normalizedText);
  if (!directMatch) {
    return { safe: true };
  }

  const matchedPattern = BANNED_REGEX_LIST.find((pattern) => pattern.test(normalizedText));
  return {
    safe: false,
    reason: matchedPattern
      ? `Blocked by banned-content rule: ${matchedPattern.source}`
      : "Blocked by banned-content rule",
  };
}

/**
 * Returns `true` when `text` (after leet-speak normalisation) contains
 * any word from the banned list.
 */
export function containsBannedWords(text: string): boolean {
  return !checkContent(text).safe;
}

/**
 * Validate a comic's title + idea.
 * Returns `{ valid: true }` when clean, `{ valid: false, message }` otherwise.
 */
export function validateContent(
  title: string,
  idea: string,
): { valid: boolean; message?: string } {
  const titleCheck = checkContent(title);
  if (!titleCheck.safe) {
    return {
      valid: false,
      message:
        "The title contains inappropriate content. Please revise your comic title.",
    };
  }
  const ideaCheck = checkContent(idea);
  if (!ideaCheck.safe) {
    return {
      valid: false,
      message:
        "The idea contains inappropriate content. Please revise your comic idea.",
    };
  }
  return { valid: true };
}

/**
 * Validate every panel description in an array.
 */
export function validatePanelDescriptions(
  panels: Array<{ description?: string }>,
): { valid: boolean; message?: string } {
  for (let i = 0; i < panels.length; i++) {
    const desc = panels[i]?.description;
    if (desc && !checkContent(desc).safe) {
      return {
        valid: false,
        message: `Panel ${i + 1} description contains inappropriate content. Please revise it.`,
      };
    }
  }
  return { valid: true };
}
