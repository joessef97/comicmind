---
name: comic-pipeline-extension
description: "Extend the ComicMind AI comic generation pipeline. Use when: adding new comic styles, panel types, generation steps, post-processing, image providers, or modifying the story/image generation flow. USE FOR: new art style, new AI model integration, generation pipeline changes, panel customization."
argument-hint: "What to extend (e.g., 'add manga style', 'add panel retry logic', 'integrate Stable Diffusion')"
---

# Comic Pipeline Extension

Extend the AI comic generation pipeline in ComicMind — new styles, generation steps, image providers, or post-processing.

## When to Use

- Adding a new comic art style
- Integrating a new AI image provider alongside OpenAI DALL-E
- Adding post-processing steps (translation, upscaling, watermarks)
- Modifying story generation prompts or panel structure
- Adding new generation metadata or panel fields

## Architecture Overview

The generation pipeline flows through these layers:

```
Request → Auth → Rate Limit → Translate (Arabic) → Content Safety → Controller
                                                                        │
                                                              ┌─────────┴─────────┐
                                                              │                   │
                                                        Story Generation    Image Generation
                                                        (ai.service.ts)    (image-provider.ts)
                                                              │                   │
                                                              │            ┌──────┴──────┐
                                                              │            │             │
                                                              │      openai-image   (future providers)
                                                              │            │
                                                              └─────┬──────┘
                                                                    │
                                                           Post-Processing
                                                        (translate panels back)
                                                                    │
                                                              Store → Respond
```

**Key files:**
- `backend/src/services/ai.service.ts` — Story generation (OpenAI GPT), CharacterSheet
- `backend/src/services/openai-image-service.ts` — DALL-E image generation
- `backend/src/services/image-provider.ts` — Image provider abstraction layer
- `backend/src/modules/comics/comic.controller.ts` — Orchestrates generation + storage
- `backend/src/middleware/translation.ts` — Arabic ↔ English translation
- `backend/src/middleware/content-safety.ts` — Azure content moderation

## Procedure

### Adding a New Art Style

1. **Update the shared schema** (`shared/schema.ts`):
   - Add the new style to the style type/validation if there's a fixed set
   - Ensure the validator accepts the new style name

2. **Update AI service prompts** (`backend/src/services/ai.service.ts`):
   - The style name is passed into the story generation prompt
   - The CharacterSheet description should account for the new style
   - Modify the system prompt to include style-specific instructions if needed

3. **Update image generation prompts** (`backend/src/services/openai-image-service.ts`):
   - The style is injected into the DALL-E prompt for each panel
   - Add style-specific prompt modifiers (e.g., "manga style with screen tones" vs "watercolor illustration")

4. **Update frontend style selector** in the editor page:
   - Add the new style option to the UI dropdown/selector
   - Add a preview/icon if applicable

### Adding a New Image Provider

1. **Create the provider** (`backend/src/services/<provider>-image-service.ts`):

```typescript
import type { ImageGenerationResult } from "./image-provider";

export async function generateImageWithProvider(
  prompt: string,
  style: string,
  panelNumber: number,
): Promise<ImageGenerationResult> {
  // Call external API
  // Return { url: string, meta?: object }
}
```

2. **Register in image provider** (`backend/src/services/image-provider.ts`):
   - Add the new provider to the provider selection logic
   - Use environment config to determine which provider to use

3. **Add environment config** (`backend/src/config/env.ts`):
```typescript
export const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || "openai";
export const NEW_PROVIDER_API_KEY = process.env.NEW_PROVIDER_API_KEY || "";
```

4. **Update generation metadata** — store which provider generated each panel in `generationMeta`

### Adding a Post-Processing Step

Post-processing runs after generation, before storage. Follow the translation middleware pattern:

1. **Create the processor** (`backend/src/services/<processor>.ts`):

```typescript
export async function processGeneratedPanels(
  panels: Panel[],
  options?: ProcessOptions,
): Promise<Panel[]> {
  if (!panels?.length) return panels;

  // Process in parallel when possible
  const results = await Promise.all(
    panels.map((panel) => processPanel(panel, options))
  );

  return panels.map((panel, i) => ({
    ...panel,
    ...results[i],
  }));
}
```

2. **Integrate in controller** (`backend/src/modules/comics/comic.controller.ts`):
   - Call the processor after generation completes
   - Wrap in try-catch — post-processing should never crash the pipeline
   - Log failures but return original data on error (graceful degradation)

```typescript
try {
  panels = await processGeneratedPanels(panels);
} catch (error) {
  console.error("[post-processor] Failed, using originals:", error);
}
```

### Adding New Panel Fields

1. **Update shared schema** — add field to `InsertComic` panel interface
2. **Update Mongoose model** — add field to comic/draft schema
3. **Update AI service** — generate the new field in story generation
4. **Update frontend reader** — display the new field in the comic reader component

### Modifying Story Generation

The story generation in `ai.service.ts` uses:
- A **system prompt** defining the AI's role and output format
- A **CharacterSheet** concept for visual consistency across panels
- **6-panel structure** with: number, description, dialogue, narration

To modify:
1. Update the system prompt to include new instructions
2. Adjust the expected JSON output structure
3. Update the response parser to extract new fields
4. Ensure the controller handles the new structure

## Middleware Chain for Generation Endpoints

When adding middleware to generation routes, follow this order:

```
authenticateToken → rateLimiter → autoTranslateInput → contentSafetyCheck → handler
```

- Rate limiter: use `aiLimiter` for generation endpoints (stricter than auth)
- Translation: only for user-facing text inputs (title, idea)
- Content safety: validates text is appropriate before sending to AI

## Quality Checks

- [ ] New style/provider works end-to-end (generate → store → display)
- [ ] Error handling follows graceful degradation (never crash pipeline)
- [ ] Generation metadata captures provider/model info for debugging
- [ ] Rate limiting is applied to new generation endpoints
- [ ] Content safety runs on user inputs before generation
- [ ] Frontend displays new fields/styles correctly
- [ ] Parallel processing used where possible (`Promise.all`)
