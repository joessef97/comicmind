/**
 * OpenAI Image Service — implements ImageProvider using the
 * OpenAI Images API (gpt-image-1).
 *
 * gpt-image-1 differences from DALL·E 3:
 *   - Does NOT internally rewrite prompts → much better character consistency
 *   - Returns base64 data (b64_json) instead of temporary URLs
 *   - Supports "low", "medium", "high" quality (instead of "standard" / "hd")
 */

import OpenAI, { toFile } from "openai";
import type {
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "./image-provider";

/** Style → prompt suffix mapping */
const STYLE_PROMPTS: Record<string, string> = {
  anime: "anime style, manga artwork, cel-shaded",
  realistic: "photorealistic, detailed, high quality photography",
  cartoon: "cartoon style, colorful, animated",
  noir: "film noir, black and white, dramatic shadows, 1940s detective style",
  comic: "comic book style, bold lines, vibrant colors",
  watercolor:
    "watercolor painting style, soft textures, fluid artistic strokes, pastel colors",
  retro:
    "classic vintage comic book aesthetic, halftone dots, retro 1960s colors, bold outlines",
};

/** Rough cost per image for gpt-image-1 at medium quality / 1024×1024 */
const COST_ESTIMATE_USD = 0.04;

export class OpenAIImageService implements ImageProvider {
  readonly providerName = "openai";
  private client: OpenAI;
  private model: string;

  constructor(apiKey?: string, model = "gpt-image-1") {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        "OPENAI_API_KEY is not set. Provide it via environment variable or constructor parameter."
      );
    }
    this.client = new OpenAI({ apiKey: key });
    this.model = model;
  }

  async generateImage(
    req: ImageGenerationRequest
  ): Promise<ImageGenerationResult> {
    const styleModifier =
      STYLE_PROMPTS[req.style.toLowerCase()] || STYLE_PROMPTS.comic;

    // ── Build the prompt ─────────────────────────────────────────
    //
    // gpt-image-1 does NOT rewrite prompts internally, so the exact
    // text we send is what drives the generation. This gives us much
    // better character consistency when we repeat the same character
    // description across panels.

    let fullPrompt: string;

    if (req.characterSheet) {
      const charEntries = req.characterSheet
        .split(" | ")
        .filter((entry) => !entry.startsWith("Setting:"));
      const settingEntry = req.characterSheet
        .split(" | ")
        .find((entry) => entry.startsWith("Setting:"));

      const charBlock = charEntries
        .map((entry) => `  ★ ${entry}`)
        .join("\n");

      fullPrompt = [
        `CHARACTER REFERENCE (same appearance in every panel):`,
        charBlock,
        ``,
        `Art style: ${styleModifier}.`,
        settingEntry ? `${settingEntry}.` : "",
        ``,
        `Scene: ${req.prompt}`,
        ``,
        `Rules: Consistent face, hair, skin tone, outfit, and accessory across all panels. Single comic panel illustration. No text, no words, no letters, no speech bubbles, no captions.`,
      ]
        .filter(Boolean)
        .join("\n");
    } else {
      fullPrompt = `A ${styleModifier} illustration. ${req.prompt}. Single comic panel artwork, no text, no words, no letters, no speech bubbles.`;
    }

    try {
      let b64: string | undefined;
      let imageUrl = "";

      if (req.referenceImage) {
        // ── Reference-based generation via images.edit ────────────
        // gpt-image-1 can accept a reference image so it can "see"
        // the character design and replicate face/hair/outfit exactly.
        console.log(
          `[gpt-image-1] Panel ${req.panelNumber ?? "?"}: using character reference image (${(req.referenceImage.length / 1024).toFixed(0)} KB)`,
        );

        const refFile = await toFile(req.referenceImage, "character-ref.png", {
          type: "image/png",
        });

        // Build the panel prompt using the user's template
        const editPrompt = [
          `You are creating a comic book panel using the PROVIDED CHARACTER REFERENCE IMAGE.`,
          ``,
          `The character must match the reference exactly.`,
          ``,
          `Do not change:`,
          `* Face`,
          `* Hair`,
          `* Skin tone`,
          `* Outfit`,
          `* Colors`,
          `* Body proportions`,
          ``,
          `You may change:`,
          `* Pose`,
          `* Expression`,
          `* Camera angle`,
          `* Background`,
          `* Action`,
          `* Lighting`,
          ``,
          `SCENE:`,
          req.prompt,
          ``,
          `STYLE: ${styleModifier}`,
          ``,
          `Professional comic illustration, cinematic composition, dynamic action.`,
          ``,
          `If uncertain, copy the reference character exactly.`,
          `Do not include text, words, letters, or speech bubbles.`,
        ].join("\n");

        const editResponse = await this.client.images.edit({
          model: this.model,
          image: refFile,
          prompt: editPrompt,
          n: 1,
          // images.edit only supports: auto, 1024x1024, 256x256, 512x512, 1536x1024, 1024x1536
          size: (() => {
            const s = req.size || "1024x1024";
            const editSizeMap: Record<string, "1024x1024" | "1536x1024" | "1024x1536"> = {
              "1024x1024": "1024x1024",
              "1024x1792": "1024x1536",
              "1792x1024": "1536x1024",
            };
            return editSizeMap[s] || "1024x1024";
          })(),
        });

        if (!editResponse.data || editResponse.data.length === 0) {
          throw new Error("No image data returned from OpenAI images.edit");
        }

        b64 = (editResponse.data[0] as any).b64_json as string | undefined;
        imageUrl = editResponse.data[0]?.url || "";
        fullPrompt = editPrompt;
      } else {
        // ── Standard generation (no reference image) ─────────────
        const response = await this.client.images.generate({
          model: this.model,
          prompt: fullPrompt,
          n: 1,
          size: req.size || "1024x1024",
          quality: "medium" as any,
        });

        if (!response.data || response.data.length === 0) {
          throw new Error("No image data returned from OpenAI");
        }

        const item = response.data[0];
        b64 = (item as any).b64_json as string | undefined;
        imageUrl = item?.url || "";
      }

      let imageBuffer: Buffer | undefined;
      if (b64) {
        imageBuffer = Buffer.from(b64, "base64");
        console.log(
          `[gpt-image-1] Panel ${req.panelNumber ?? "?"}: received ${(imageBuffer.length / 1024).toFixed(0)} KB image`,
        );
      } else if (!imageUrl) {
        throw new Error("No image URL or base64 data in OpenAI response");
      }

      return {
        imageUrl,
        imageBuffer,
        meta: {
          model: this.model,
          prompt: fullPrompt,
          style: req.style,
          createdAt: new Date().toISOString(),
          costEstimate: COST_ESTIMATE_USD,
        },
      };
    } catch (error: any) {
      // Translate OpenAI-specific errors into friendly messages
      if (error?.status === 429 || error?.code === "rate_limit_exceeded") {
        throw new Error(
          "OpenAI rate limit reached. Please wait a moment and try again."
        );
      }
      if (error?.status === 401 || error?.code === "invalid_api_key") {
        throw new Error(
          "OpenAI API key is invalid or expired. Please check your configuration."
        );
      }
      if (
        error?.code === "billing_hard_limit_reached" ||
        error?.code === "insufficient_quota"
      ) {
        throw new Error(
          "OpenAI quota exhausted. Please check your billing settings."
        );
      }
      if (error?.code === "content_policy_violation") {
        throw new Error(
          "The image prompt was rejected by OpenAI's safety system. Please revise the description."
        );
      }
      // Re-throw anything else with its original message
      throw error;
    }
  }
}

/**
 * Singleton accessor — lazily created so the module can be imported
 * even when the env var isn't set yet (e.g. during tests).
 */
let _instance: OpenAIImageService | null = null;

export function getOpenAIImageService(): OpenAIImageService {
  if (!_instance) {
    _instance = new OpenAIImageService();
  }
  return _instance;
}
