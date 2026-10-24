import { describe, expect, it } from "vitest";
import { visibleDashboardDrafts } from "../frontend/src/lib/draft-visibility";

describe("visibleDashboardDrafts", () => {
  it("keeps recovered drafts visible even while their panel list has not been populated", () => {
    const drafts = visibleDashboardDrafts([
      { id: "completed", status: "COMPLETED", panels: [{ imageUrl: "/uploads/panel-1.png" }] },
      { id: "empty-job", status: "GENERATING", panels: [] },
    ]);

    expect(drafts.map((draft) => draft.id)).toEqual(["completed", "empty-job"]);
  });
});
