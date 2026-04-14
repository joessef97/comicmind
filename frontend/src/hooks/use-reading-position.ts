import { useState, useEffect, useCallback } from "react";

/**
 * Hook to persist and restore comic reading position using localStorage.
 * Key format: "comic-reading-pos:{comicId}"
 */
export function useReadingPosition(comicId: string) {
  const storageKey = `comic-reading-pos:${comicId}`;

  const [spreadIndex, setSpreadIndexState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? parseInt(stored, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  // Persist whenever the spread changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(spreadIndex));
    } catch {
      // quota exceeded or private mode — ignore
    }
  }, [storageKey, spreadIndex]);

  const setSpreadIndex = useCallback(
    (indexOrFn: number | ((prev: number) => number)) => {
      setSpreadIndexState(indexOrFn);
    },
    [],
  );

  return { spreadIndex, setSpreadIndex };
}
