import OpenAI from "openai";
import crypto from "crypto";
import type { ImageProvider, ImageGenerationMeta } from "./image-provider";
import { getOpenAIImageService } from "./openai-image-service";
import { getBannedTokensForPrompt } from "../utils/content-filter";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface Panel {
  number: number;
  description: string;
  dialogue: string;
  narration: string;
  imageUrl?: string;
  error?: string;
  /** Generation metadata — persisted alongside the panel */
  generationMeta?: ImageGenerationMeta;
}

/**
 * Shared character & setting description generated alongside the story.
 * Prepended to every image prompt so the model sees consistent anchors.
 */
export interface CharacterSheet {
  /** Full text block describing all characters + setting */
  description: string;
  /** Individual character entries for reference */
  characters: Array<{
    name: string;
    appearance: string;
  }>;
  /** Shared setting / environment notes */
  setting: string;
}

export interface StoryResult {
  panels: Panel[];
  /** Consistency anchor — included in every image prompt */
  characterSheet: CharacterSheet;
}

/**
 * Return the active image provider.
 * Currently OpenAI — swap this function to change providers globally.
 */
export function getImageProvider(): ImageProvider {
  return getOpenAIImageService();
}

export async function generateStory(title: string, idea: string, style: string, userId?: string): Promise<StoryResult> {
  const bannedWordsPrompt = getBannedTokensForPrompt();

  const prompt = `You are a professional comic-book writer and visual director creating a 6-panel story
for an AI image generator (gpt-image-2).

── INPUTS ──────────────────────────────────────────────
Title: ${title}
Idea: ${idea}
Art Style: ${style}

══════════════════════════════════════════════════════════
   PILLAR 1: STORY & WRITING  (Co-Equal Priority)
══════════════════════════════════════════════════════════

── STORY STRUCTURE (6-PANEL ARC) ───────────────────────
Your 6 panels tell a COMPLETE, EMOTIONALLY GRIPPING story. The reader
should feel something — suspense, wonder, heartbreak, triumph, surprise.

Panel 1 — THE HOOK: Drop the reader into a SPECIFIC, interesting moment.
  Don't just "introduce the character" — show them doing something that
  reveals who they are AND sets up the conflict. End with a question
  the reader NEEDS answered.
  EXAMPLE: A surgeon's hands trembling as she reads a patient file —
           the patient is her estranged daughter.

Panel 2 — THE COMPLICATION: Raise the stakes. Introduce a problem,
  dilemma, or revelation that makes the situation PERSONAL and URGENT.
  The character must WANT something and face an OBSTACLE.
  EXAMPLE: The daughter refuses treatment unless her mother promises
           to tell the truth about why she left.

Panel 3 — THE ESCALATION: Things get worse or stranger. Add a twist,
  a ticking clock, or a moral dilemma. The character is forced to
  confront something uncomfortable. Tension should be RISING.
  EXAMPLE: Mid-surgery, the mother discovers a locket inside the
           daughter's belongings — with a photo of them together.

Panel 4 — THE CLIMAX: The most DRAMATIC moment. The character makes
  a choice, takes a risk, or something irreversible happens.
  This panel should have the highest emotional intensity.
  EXAMPLE: The surgery hits a complication. The mother must choose
           between the safe option and a risky one only she can do.

Panel 5 — THE AFTERMATH: Show the CONSEQUENCE. How did the climax
  change everything? Reveal new information. Show vulnerability.
  The character processes what happened — relief, regret, shock, hope.
  EXAMPLE: The daughter wakes up. She sees her mother sleeping
           in the chair beside her, still holding her hand.

Panel 6 — THE RESOLUTION: Deliver an EMOTIONALLY SATISFYING ending.
  Answer the story's central question. Give the reader a feeling —
  a twist that recontextualizes everything, a bittersweet truth,
  a moment of connection, or a hard-earned victory.
  EXAMPLE: The daughter opens the locket and finds a note inside:
           "I never left. I was always watching."

STORY QUALITY RULES:
- The story MUST have a clear CONFLICT (what does the character want? what's in their way?)
- Every panel must CAUSE the next — no random scene changes
- Include at least ONE genuine SURPRISE or TWIST (in P3, P4, or P6)
- The character in P6 must be DIFFERENT from P1 — they've learned, lost, or gained something
- Avoid vague, generic plots ("character finds mysterious thing, thing is magical, the end")
- Make it SPECIFIC: real names, real emotions, real consequences
- Think: "Would someone want to keep reading?" If not, make it more interesting

── NARRATION RULES (Yellow caption box — TOP of panel) ─
- Every panel MUST have narration (NEVER empty).
- Written in third person, present tense — like a novel's narrator.
- Narration TELLS THE STORY. If someone read ONLY the 6 narration boxes
  in order, they should understand the complete plot.
- Each narration box MUST advance to a new story beat — never repeat or stall.
- Use vivid, specific language. Not "She feels sad" → "Her throat
  tightens. She hasn't heard that name in twelve years."
- 1-2 sentences, 15-30 words. Punchy and evocative.

Full narration example (reads as complete story):
  P1: "Dr. Lena Vasquez hasn't spoken to her daughter in twelve years. Today, her daughter's name appears on the surgery roster."
  P2: "Maya refuses the anesthesia. She says she won't sleep until her mother explains why she disappeared."
  P3: "In Maya's belongings, Lena finds a locket — and inside, a photo she thought she'd burned."
  P4: "The surgery goes wrong. Lena's hands hover over the scalpel. The safe choice will leave a scar. The risky one could fix everything — or end it."
  P5: "Maya opens her eyes to find her mother's hand wrapped around hers, tears still wet on her cheeks."
  P6: "Inside the locket, behind the photo, a folded note: 'I watched every birthday from across the street. I'm sorry.'"

── DIALOGUE RULES (White speech bubble — BOTTOM of panel) ─
- ALL 6 PANELS MUST have dialogue. NEVER leave dialogue empty.
- Format: "CharacterName: What they say"
- Dialogue shows what characters FEEL and THINK — raw, emotional, real.
- Use contractions, interruptions, incomplete sentences. People don't
  talk in perfect grammar when they're scared, angry, or heartbroken.
- Each line should reveal CHARACTER — who this person is, what they want.
- Dialogue must be DIFFERENT from narration — don't repeat the same info.

Full dialogue example:
  P1: "Lena: No. No, this can't be right. Check the roster again."
  P2: "Maya: Twelve years, Mom. You don't get to just show up with a scalpel."
  P3: "Lena: Where did you get this? I destroyed every photo."
  P4: "Lena: I'm not losing her again. Prep for the arterial bypass."
  P5: "Maya: You stayed... you actually stayed."
  P6: "Lena: I never left, Maya. I just couldn't face you."

══════════════════════════════════════════════════════════
   PILLAR 2: VISUAL CONSISTENCY  (Co-Equal Priority)
══════════════════════════════════════════════════════════

CRITICAL CONSTRAINT: gpt-image-2 has ZERO MEMORY between panels. The ONLY way
to maintain character consistency is to include the EXACT SAME detailed visual
description in EVERY panel. This is non-negotiable.

── CHARACTER TAG RULES ─────────────────────────────────
For EACH character, the "appearance" field must be a COMMA-SEPARATED TAG LIST
with ALL of these attributes in THIS EXACT ORDER:

  1. Gender
  2. Age range (e.g., early 20s, mid 30s)
  3. Ethnicity and skin tone (e.g., light olive skin, dark brown skin)
  4. Hair: EXACT color + style + length (e.g., shoulder-length straight jet-black hair
     with blunt bangs). Hair is the MOST IMPORTANT consistency anchor.
  5. Facial hair if any (clean-shaven, short stubble, full beard)
  6. Eye color
  7. Build / body type (slim, athletic, stocky)
  8. FULL outfit with BOLD, SPECIFIC colors and garments that NEVER change.
     The outfit must be DISTINCTIVE and memorable — use bright or unusual
     color combinations that are impossible to miss.
     (e.g., bright teal zip-up hoodie over a white t-shirt, black skinny jeans,
     red high-top sneakers — NOT "dark jacket" or "casual clothes")
  9. ONE unique, VISUALLY BOLD accessory that is the character's SIGNATURE.
     This must be obvious and visible in every shot.
     (e.g., round gold-frame glasses, bright red beanie hat, thick silver
     chain necklace, large black over-ear headphones around neck)

RULES:
- Visual, concrete, drawable attributes ONLY — no personality traits
- Choose BOLD, HIGH-CONTRAST colors that stand out (bright teal, cherry red,
  deep purple, mustard yellow — NOT grey, dark, neutral, or muted)
- Be hyper-specific: not "glasses" → "round gold-frame glasses",
  not "hoodie" → "bright teal zip-up hoodie with white drawstrings"
- Tag list must be IDENTICAL every time — same words, same order, no synonyms
- The outfit and accessory MUST NOT CHANGE across panels (no costume changes)
- 30-45 words per character

── CAMERA WORK (SEQUENTIAL ART DIRECTION) ──────────────
Panel 1 — WIDE ESTABLISHING SHOT: Full environment, character at full body.
Panel 2 — MEDIUM SHOT: Waist-up, 3/4 angle.
Panel 3 — CLOSE-UP: Face or key object filling frame.
Panel 4 — DYNAMIC SHOT: Motion, dramatic angle (low/dutch/bird's-eye).
Panel 5 — OVER-THE-SHOULDER or REVERSE ANGLE.
Panel 6 — PULL-BACK RESOLUTION: Wider framing, emotional payoff.

── PANEL DESCRIPTION TEMPLATE ──────────────────────────
Each panel "description" MUST follow this EXACT structure:

  "[CAMERA TYPE]. A [gender], [age], [ethnicity/skin], [EXACT hair description],
   [eye color], [build], wearing [EXACT outfit — copy word for word],
   with [EXACT accessory — copy word for word].
   The character is [pose] with [facial expression].
   [What is happening — the action in this moment].
   [Background/environment details]."

CRITICAL:
- The character's hair, outfit, and accessory description must be
  WORD-FOR-WORD IDENTICAL in all 6 panels. These are the 3 anchors
  that keep the character looking the same.
- Start every panel description with the character's full appearance.
  DALL-E weights the beginning of the prompt most heavily.
- Different pose and expression each panel. Characters physically MOVE.
- 60-100 words per description.
- Include specific background details unique to each panel.

══════════════════════════════════════════════════════════
   OUTPUT FORMAT (strict JSON — no markdown, no commentary)
══════════════════════════════════════════════════════════
{
  "characterSheet": {
    "description": "All character tags joined by | then | Setting: tags. MAX 80 WORDS.",
    "characters": [
      { "name": "CharacterName", "appearance": "comma-separated tag list (all 9 attributes)" }
    ],
    "setting": "location, time of day, weather, lighting, color palette, key props"
  },
  "panels": [
    {
      "number": 1,
      "description": "Panel image description following template above.",
      "dialogue": "CharacterName: What they say aloud.",
      "narration": "Narrator caption. 1-2 sentences."
    }
  ]
}

══════════════════════════════════════════════════════════
   CONTENT SAFETY  (Mandatory)
══════════════════════════════════════════════════════════

You MUST NEVER use ANY of these words (or their variants) in dialogue,
narration, or panel descriptions. This is a hard platform rule — using
any of them will cause the comic to be rejected by the content filter.

BANNED WORDS: ${bannedWordsPrompt}

Instead use softer alternatives:
- "kill" → "stop", "defeat", "end", "destroy"
- "murder" → "crime", "foul play"
- "suicide" → "sacrifice", "last resort"
- "bomb" → "blast", "explosion", "device"
- "violence" → "danger", "conflict", "struggle"
- "gore" → "chaos", "aftermath"
- "torture" → "torment", "suffering"
- "assassination" → "attack", "ambush"
- "explicit" → "intense", "raw"

This applies to ALL text output — dialogue, narration, and descriptions.
You can still tell dramatic, intense, emotional stories. Just use the
alternative words above.

── FINAL CHECKLIST ─────────────────────────────────────
□ Story has clear CONFLICT, SURPRISE, and EMOTIONAL ARC
□ Reading narration P1-P6 alone tells a complete, gripping story
□ ALL 6 panels have non-empty dialogue (CharacterName: words)
□ ALL 6 panels have non-empty narration
□ Character P6 is emotionally different from P1
□ characterSheet.characters[].appearance has all 9 attributes
□ Every panel COPY-PASTES the full character tag list
□ Every panel has a different camera angle, pose, and expression
□ Panel descriptions are 60-100 words
□ NO banned words appear anywhere in the output
□ Output is valid JSON with no markdown wrapping`;

  try {
    // Hash the userId before sending to OpenAI so raw internal IDs are
    // never exposed to a third-party API.  Falls back to "anonymous" for
    // unauthenticated edge-cases (should not happen behind authenticateToken).
    const openaiUser = userId
      ? crypto.createHash("sha256").update(userId).digest("hex")
      : "anonymous";

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      user: openaiUser,
      messages: [
        {
          role: "system",
          content: `You are an award-winning comic-book writer AND visual director. You have TWO co-equal priorities that you ALWAYS deliver on simultaneously:

PRIORITY A — GRIPPING STORYTELLING:
- Every story must have a clear CONFLICT, rising TENSION, and an emotionally satisfying RESOLUTION
- Include at least one genuine SURPRISE or TWIST
- Narration (all 6 panels) must read as a complete mini-story on its own
- ALL 6 panels must have dialogue ("CharacterName: words") — raw, emotional, natural
- The character in Panel 6 must be emotionally DIFFERENT from Panel 1
- Make the reader FEEL something: suspense, wonder, heartbreak, triumph

PRIORITY B — CHARACTER VISUAL CONSISTENCY:
- Define a precise comma-separated tag list for each character (gender, age, skin tone, hair, facial hair, eyes, build, outfit with colors, unique accessory)
- The 3 CONSISTENCY ANCHORS are: (1) hair description, (2) outfit colors/garments, (3) signature accessory. These THREE must be WORD-FOR-WORD IDENTICAL in every panel description — they are what makes DALL-E draw the same person.
- Choose BOLD, distinctive, high-contrast features: bright teal hoodie, round gold-frame glasses, cherry-red sneakers — not vague/neutral descriptions
- COPY-PASTE that EXACT tag list — same words, same order — into every panel description. Start each description with the character's full appearance.
- NEVER paraphrase, abbreviate, or use synonyms for appearance tags
- Each panel uses a different camera angle, pose, and expression

Both priorities are NON-NEGOTIABLE. A visually consistent comic with a boring story is a failure. An engaging story with inconsistent characters is also a failure. You deliver BOTH.

You ALWAYS return ONLY valid JSON. No markdown code fences. No explanatory text. Just the raw JSON object starting with { and ending with }.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 4500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the full JSON object (could be wrapped in markdown code fences)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format from AI");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate panels
    const panels = parsed.panels as Panel[];
    if (!Array.isArray(panels) || panels.length !== 6) {
      throw new Error("AI did not return exactly 6 panels");
    }

    // ── Post-processing: enforce dialogue & narration on ALL panels ──
    // GPT-4 sometimes returns empty strings despite explicit instructions.
    // Rather than letting the comic ship with missing speech bubbles, we
    // derive a sensible fallback from the panel's context.
    const mainCharName =
      parsed.characterSheet?.characters?.[0]?.name || "Character";

    for (const panel of panels) {
      // Fix missing dialogue
      if (!panel.dialogue || panel.dialogue.trim() === "" || panel.dialogue.trim() === '""') {
        const fallbackDialogues: Record<number, string> = {
          1: `${mainCharName}: Wait... what is this?`,
          2: `${mainCharName}: This can't be a coincidence.`,
          3: `${mainCharName}: No... this changes everything.`,
          4: `${mainCharName}: I have to do this. There's no other way.`,
          5: `${mainCharName}: I didn't expect it to feel like this.`,
          6: `${mainCharName}: Now I understand.`,
        };
        panel.dialogue = fallbackDialogues[panel.number] || `${mainCharName}: ...`;
        console.log(`[post-process] Panel ${panel.number}: filled empty dialogue`);
      }

      // Fix missing narration
      if (!panel.narration || panel.narration.trim() === "") {
        const fallbackNarrations: Record<number, string> = {
          1: "It begins with a moment that changes everything.",
          2: "The pieces start falling into place — but the picture makes no sense.",
          3: "The truth hits harder than expected.",
          4: "There is no turning back now.",
          5: "The dust settles. The silence is deafening.",
          6: "And just like that, nothing will ever be the same.",
        };
        panel.narration = fallbackNarrations[panel.number] || "The story continues.";
        console.log(`[post-process] Panel ${panel.number}: filled empty narration`);
      }
    }

    // Build characterSheet with fallbacks
    const cs = parsed.characterSheet || {};
    const characterSheet: CharacterSheet = {
      description: cs.description || "",
      characters: Array.isArray(cs.characters) ? cs.characters : [],
      setting: cs.setting || "",
    };

    // ALWAYS build the description from individual character entries.
    // This produces a more structured, tag-based description that works
    // much better as a DALL-E prefix than GPT's prose summary.
    if (characterSheet.characters.length > 0) {
      characterSheet.description = characterSheet.characters
        .map((c: { name: string; appearance: string }) => `${c.name}: ${c.appearance}`)
        .join(" | ")
        + (characterSheet.setting ? ` | Setting: ${characterSheet.setting}` : "");
    }

    return { panels, characterSheet };
  } catch (error) {
    console.error("Story generation error:", error);
    throw new Error("Failed to generate story");
  }
}

/**
 * Generate a character reference sheet image using gpt-image-2.
 *
 * This produces a full-body, neutral-pose illustration of the main character
 * so that gpt-image-2 receives the exact same visual anchor across all panels.
 * The reference image is stored alongside the comic and can be displayed to
 * the user during generation.
 */
export async function generateCharacterReference(
  characterSheet: CharacterSheet,
  storyIdea: string,
  style: string,
): Promise<{ imageBuffer?: Buffer; imageUrl: string; meta: ImageGenerationMeta }> {
  const provider = getImageProvider();

  // Build the character reference prompt from the user's template
  const mainChar = characterSheet.characters?.[0];
  const charDescription = mainChar
    ? `${mainChar.name}: ${mainChar.appearance}`
    : characterSheet.description || "A distinctive comic book character";

  const STYLE_PROMPTS: Record<string, string> = {
    anime: "anime style, manga artwork, cel-shaded",
    realistic: "photorealistic, detailed, high quality photography",
    cartoon: "cartoon style, colorful, animated",
    noir: "film noir, black and white, dramatic shadows, 1940s detective style",
    comic: "comic book style, bold lines, vibrant colors",
    watercolor: "watercolor painting style, soft textures, fluid artistic strokes, pastel colors",
    retro: "classic vintage comic book aesthetic, halftone dots, retro 1960s colors, bold outlines",
  };
  const styleModifier = STYLE_PROMPTS[style.toLowerCase()] || STYLE_PROMPTS.comic;

  const prompt = [
    `Create a main character for a comic story.`,
    ``,
    `STORY CONTEXT:`,
    storyIdea,
    ``,
    `CHARACTER:`,
    charDescription,
    ``,
    `STYLE: ${styleModifier}`,
    ``,
    `Design a visually distinctive character suitable for a comic.`,
    ``,
    `OUTPUT REQUIREMENTS:`,
    `* Full body view`,
    `* Neutral standing pose`,
    `* Clear face visibility`,
    `* Consistent outfit`,
    `* Professional comic illustration`,
    `* Plain background`,
    ``,
    `The character design must be memorable and easy to recognize across multiple scenes.`,
    `Do not include text, words, letters, or captions.`,
  ].join("\n");

  console.log("[character-ref] Generating character reference sheet…");

  const result = await provider.generateImage({
    prompt,
    style,
    panelNumber: 0,
    size: "1024x1024",
  });

  console.log("[character-ref] Character reference generated successfully.");

  return {
    imageBuffer: result.imageBuffer,
    imageUrl: result.imageUrl,
    meta: result.meta,
  };
}

export async function generatePanelImage(
  description: string,
  style: string,
  panelNumber: number,
  referenceImage?: Buffer,
): Promise<{ imageUrl: string; imageBuffer?: Buffer; generationMeta: ImageGenerationMeta }> {
  const provider = getImageProvider();

  const result = await provider.generateImage({
    prompt: description,
    style,
    panelNumber,
    size: "1024x1024",
    referenceImage,
  });

  return {
    imageUrl: result.imageUrl,
    imageBuffer: result.imageBuffer,
    generationMeta: result.meta,
  };
}

export async function generateAllPanelImages(
  panels: Panel[],
  style: string,
  referenceImage?: Buffer,
): Promise<(Panel & { imageBuffer?: Buffer })[]> {
  const results: (Panel & { imageBuffer?: Buffer })[] = [];

  for (const panel of panels) {
    try {
      const { imageUrl, imageBuffer, generationMeta } = await generatePanelImage(
        panel.description,
        style,
        panel.number,
        referenceImage,
      );
      results.push({ ...panel, imageUrl, imageBuffer, generationMeta });
    } catch (error) {
      console.error(`Failed to generate panel ${panel.number}:`, error);
      results.push({
        ...panel,
        error: `Failed to generate image for panel ${panel.number}`
      });
    }
  }

  return results;
}

export async function retryPanelGeneration(
  panel: Panel,
  style: string,
  referenceImage?: Buffer,
): Promise<Panel & { imageBuffer?: Buffer }> {
  try {
    const { imageUrl, imageBuffer, generationMeta } = await generatePanelImage(
      panel.description,
      style,
      panel.number,
      referenceImage,
    );
    return { ...panel, imageUrl, imageBuffer, generationMeta, error: undefined };
  } catch (error) {
    console.error(`Retry failed for panel ${panel.number}:`, error);
    return {
      ...panel,
      error: `Retry failed for panel ${panel.number}`
    };
  }
}
