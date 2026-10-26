export interface RecoverablePanel {
  number?: number;
  imageUrl?: string;
}

/**
 * A persisted image is the source of truth for recovery. Only panels without
 * one are eligible for another paid image request after a browser close.
 */
export function missingPanelIndices(panels: RecoverablePanel[]): number[] {
  return panels.flatMap((panel, index) => (panel.imageUrl ? [] : [index]));
}

/** A partial draft is recoverable regardless of a browser-side failure state. */
export function shouldResumePanelGeneration(
  status: string,
  panels: RecoverablePanel[],
): boolean {
  return status !== "COMPLETED" && panels.length > 0 && missingPanelIndices(panels).length > 0;
}
