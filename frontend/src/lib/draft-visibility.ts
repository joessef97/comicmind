export interface DashboardDraft {
  status: string;
  panels?: unknown[];
}

/** Keep every saved draft visible, including a generation that has not produced its first panel. */
export function visibleDashboardDrafts<T extends DashboardDraft>(drafts: T[]): T[] {
  return drafts;
}
