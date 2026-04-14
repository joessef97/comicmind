/**
 * Client-side content safety filter.
 * Mirrors the backend content-filter.ts logic so we can catch violations
 * BEFORE making any API / generation calls.
 */

const BANNED_WORDS = [
  // ── Violence & gore ─────────────────────────────────────────────
  "violence", "gore", "gory", "bloodbath", "bloodshed", "brutal",
  "brutality", "mutilate", "mutilation", "dismember", "decapitate",
  "decapitation", "eviscerate", "disembowel", "massacre", "slaughter",
  "carnage", "torture", "torment", "maim", "bludgeon",

  // ── Killing & death ────────────────────────────────────────────
  "kill", "murder", "assassinate", "assassination", "homicide",
  "manslaughter", "execute", "execution", "strangle", "suffocate",
  "smother", "stab", "stabbing", "shoot", "gunshot",
  "bloodlust", "genocide", "exterminate", "extermination",

  // ── Weapons ────────────────────────────────────────────────────
  "weapon", "firearm", "handgun", "rifle", "shotgun",
  "machete", "grenade", "explosive", "bomb", "dynamite",
  "ammunition", "ammo", "sniper", "submachine",

  // ── Blood & body horror ────────────────────────────────────────
  "blood", "bloody", "bleed", "bleeding", "entrails",
  "intestines", "organs", "corpse", "cadaver", "carcass",
  "decompose", "rotting",

  // ── Sexual & explicit ──────────────────────────────────────────
  "sexual", "sexually", "explicit", "nude", "nudity",
  "naked", "nsfw", "porn", "pornography", "pornographic",
  "erotic", "erotica", "fetish", "orgasm", "genital",
  "genitalia", "intercourse", "fornicate", "fornication",
  "obscene", "obscenity", "lewd", "lewdness", "smut",
  "hentai", "xxx", "stripclub", "prostitute", "prostitution",
  "brothel", "escort", "hooker", "whore",

  // ── Hate speech & slurs ────────────────────────────────────────
  "hate", "hatred", "racist", "racism", "bigot",
  "bigotry", "sexist", "sexism", "homophobe", "homophobia",
  "homophobic", "transphobe", "transphobia", "transphobic",
  "xenophobe", "xenophobia", "antisemite", "antisemitism",
  "supremacist", "supremacy", "slur", "derogatory", "discriminate",
  "discrimination",

  // ── Self-harm & suicide ────────────────────────────────────────
  "suicide", "suicidal", "selfharm", "selfmutilation",
  "overdose", "cutting", "hangself",

  // ── Drugs & substances ─────────────────────────────────────────
  "drug", "drugs", "cocaine", "heroin", "methamphetamine",
  "meth", "fentanyl", "opioid", "opiate", "narcotic",
  "narcotics", "marijuana", "cannabis", "weed", "ecstasy",
  "mdma", "lsd", "ketamine", "amphetamine", "barbiturate",
  "hallucinogen", "psychedelic", "intoxicant", "drugdealer",
  "drugtraffic",

  // ── Abuse & assault ────────────────────────────────────────────
  "abuse", "abuser", "abusive", "assault", "molest",
  "molestation", "harass", "harassment", "rape", "rapist",
  "pedophile", "pedophilia", "predator", "grooming", "trafficking",
  "kidnap", "kidnapping", "hostage",

  // ── Extremism & terrorism ──────────────────────────────────────
  "terrorist", "terrorism", "extremist", "extremism", "radicalize",
  "radicalization", "jihad", "jihadist", "insurgent", "insurgency",
  "militia", "paramilitary", "warcrime", "warcrimes",

  // ── Profanity & vulgarity ──────────────────────────────────────
  "fuck", "shit", "bitch", "bastard", "damn",
  "cunt", "dick", "asshole", "motherfucker",

  // ── Miscellaneous unsafe ───────────────────────────────────────
  "arson", "arsonist", "blackmail", "extortion", "fraud",
  "scam", "theft", "robbery", "burglary", "vandalism",
  "sabotage", "poison", "toxic", "lethal", "deadly",
];

/**
 * Decode leet-speak but preserve word spacing so \b still works.
 */
function leetDecode(text: string): string {
  return text
    .toLowerCase()
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/0/g, "o")
    .replace(/5/g, "s")
    .replace(/@/g, "a")
    .replace(/\$/g, "s");
}

/**
 * Build a regex that matches a banned word whose characters are separated
 * by optional non-alpha fillers (dots, dashes, spaces, underscores).
 * Negative look-around prevents matching inside normal words like "skilled".
 */
function buildObfuscationRegex(word: string): RegExp {
  const chars = word.split("").join("[\\s.\\-_]*");
  return new RegExp(`(?<![a-z])${chars}(?![a-z])`, "i");
}

/**
 * Returns the list of banned words found in the given text.
 */
export function findBannedWords(text: string): string[] {
  const decoded = leetDecode(text);

  return BANNED_WORDS.filter((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    if (regex.test(decoded)) return true;
    if (buildObfuscationRegex(word).test(decoded)) return true;
    return false;
  });
}

export function containsBannedWords(text: string): boolean {
  return findBannedWords(text).length > 0;
}

export interface ContentValidationResult {
  valid: boolean;
  /** Human-readable error message (only when valid === false) */
  message?: string;
  /** The specific banned words that were detected */
  flaggedWords?: string[];
  /** Unix-ms timestamp of the check – attached to API requests as metadata */
  checkedAt: number;
}

/**
 * Validate title + idea (premise) against the banned-word list.
 * Returns a rich result object that the UI can use for error display
 * and that gets attached to generation request metadata.
 */
export function validateContentSafety(
  title: string,
  idea: string,
): ContentValidationResult {
  const now = Date.now();
  const titleFlags = findBannedWords(title);
  const ideaFlags = findBannedWords(idea);
  const allFlags = Array.from(new Set(titleFlags.concat(ideaFlags)));

  if (allFlags.length > 0) {
    return {
      valid: false,
      message: `Your content contains restricted words: ${allFlags.map((w) => `"${w}"`).join(", ")}. Please revise your title or story and try again.`,
      flaggedWords: allFlags,
      checkedAt: now,
    };
  }

  return { valid: true, checkedAt: now };
}
