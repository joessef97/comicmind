/**
 * The text model used to write a comic story. It can be changed in Render
 * without a code deployment, while keeping a supported, economical default.
 */
export function resolveStoryModel(configuredModel = process.env.STORY_MODEL): string {
  return configuredModel?.trim() || "gpt-4o-mini";
}
