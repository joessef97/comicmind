import { describe, expect, it } from "vitest";
import { resolveStoryModel } from "../backend/src/services/story-model";

describe("resolveStoryModel", () => {
  it("uses the supported low-cost model by default instead of retired gpt-4", () => {
    expect(resolveStoryModel()).toBe("gpt-4o-mini");
  });

  it("allows Render to select another supported story model through STORY_MODEL", () => {
    expect(resolveStoryModel("gpt-4o")).toBe("gpt-4o");
  });
});
