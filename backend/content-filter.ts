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
 * E.g. for "kill" → /(?<![a-z])k[\s.\-_]*i[\s.\-_]*l[\s.\-_]*l(?![a-z])/i
 * The negative look-around prevents matching inside normal words like "skilled".
 */
function buildObfuscationRegex(word: string): RegExp {
  const chars = word.split("").join("[\\s.\\-_]*");
  return new RegExp(`(?<![a-z])${chars}(?![a-z])`, "i");
}

export function containsBannedWords(text: string): boolean {
  const decoded = leetDecode(text);

  return BANNED_WORDS.some((word) => {
    // Pass 1: word-boundary match on leet-decoded text (catches normal usage)
    const regex = new RegExp(`\\b${word}\\b`, "i");
    if (regex.test(decoded)) return true;
    // Pass 2: obfuscation pattern on leet-decoded text (catches k.i.l.l etc.)
    if (buildObfuscationRegex(word).test(decoded)) return true;
    return false;
  });
}

export function validateContent(title: string, idea: string): { valid: boolean; message?: string } {
  if (containsBannedWords(title) || containsBannedWords(idea)) {
    return {
      valid: false,
      message: "Your content contains inappropriate or unsafe words. Please modify your input."
    };
  }
  return { valid: true };
}

export function validatePanelDescriptions(panels: Array<{ description?: string }>): { valid: boolean; message?: string } {
  for (const panel of panels) {
    if (panel.description && containsBannedWords(panel.description)) {
      return {
        valid: false,
        message: "Panel descriptions contain inappropriate content. Please modify your input."
      };
    }
  }
  return { valid: true };
}
