import { describe, expect, it } from "vitest";
import { visibleDashboardDrafts } from "../frontend/src/lib/draft-visibility";

describe("visibleDashboardDrafts", () => {
  it("keeps a completed recovered draft visible so it can be reopened", () => {
    const drafts = visibleDashboardDrafts([
      { id: "completed", status: "COMPLETED", panels: [{ imageUrl: "/uploads/panel-1.png" }] },
      { id: "empty-job", status: "GENERATING", panels: [] },
    ]);

    expect(drafts.map((draft) => draft.id)).toEqual(["completed"]);
  });
});
