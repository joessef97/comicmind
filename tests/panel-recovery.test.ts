import { describe, expect, it } from "vitest";
import { missingPanelIndices, shouldResumePanelGeneration } from "../frontend/src/lib/panel-recovery";

describe("missingPanelIndices", () => {
  it("resumes only panels that do not already have a persisted image", () => {
    expect(
      missingPanelIndices([
        { number: 1, imageUrl: "https://cdn.test/1.png" },
        { number: 2, imageUrl: "https://cdn.test/2.png" },
        { number: 3 },
        { number: 4 },
      ]),
    ).toEqual([2, 3]);
  });

  it("does not schedule paid work when every persisted panel is complete", () => {
    expect(
      missingPanelIndices([
        { number: 1, imageUrl: "https://cdn.test/1.png" },
        { number: 2, imageUrl: "https://cdn.test/2.png" },
      ]),
    ).toEqual([]);
  });
});

describe("shouldResumePanelGeneration", () => {
  it("continues an interrupted draft even when the browser marked it failed", () => {
    expect(shouldResumePanelGeneration("FAILED", [{ number: 1, imageUrl: "https://cdn.test/1.png" }, { number: 2 }])).toBe(true);
  });
});
