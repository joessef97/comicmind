export interface DashboardDraft {
  status: string;
  panels?: unknown[];
}

/**
 * Keep recoverable and completed drafts visible. Empty generating records are
 * excluded because they have no story or panel state the editor can restore.
 */
export function visibleDashboardDrafts<T extends DashboardDraft>(drafts: T[]): T[] {
  return drafts.filter(
    (draft) => !(draft.status === "GENERATING" && (!draft.panels || draft.panels.length === 0)),
  );
}
