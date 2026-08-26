// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  useComicRun,
  useStyleSamples,
  usePanelImages,
  __resetPublicComicsCache,
} from "@/hooks/use-panel-images";

/**
 * The public list endpoint trims every comic to its first panel
 * (getPublicComicPreviews), so a multi-panel run has to come from the detail
 * endpoint. These fakes mirror that split exactly.
 */
const LIST_RESPONSE = {
  comics: [
    {
      id: "comic-1",
      userId: "u1",
      title: "The Long Walk",
      style: "noir",
      idea: "A detective loses the thread.",
      panels: [{ imageUrl: "https://cdn.test/c1-p1.png" }],
      shares: 0,
      downloads: 0,
      createdAt: "2026-08-01T00:00:00.000Z",
      authorUsername: "youssef",
      ratingsCount: 3,
      averageRating: 4.7,
      commentsCount: 1,
    },
    {
      id: "comic-2",
      userId: "u1",
      title: "Second Issue",
      style: "anime",
      idea: "A rematch.",
      panels: [{ imageUrl: "https://cdn.test/c2-p1.png" }],
      shares: 0,
      downloads: 0,
      createdAt: "2026-07-01T00:00:00.000Z",
      authorUsername: "youssef",
      ratingsCount: 1,
      averageRating: 3.2,
      commentsCount: 0,
    },
  ],
};

const DETAIL_RESPONSE = {
  id: "comic-1",
  title: "The Long Walk",
  panels: Array.from({ length: 6 }, (_, i) => ({
    imageUrl: `https://cdn.test/c1-p${i + 1}.png`,
  })),
};

beforeEach(() => {
  // The list request is shared process-wide, so clear it between cases.
  __resetPublicComicsCache();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.startsWith("/api/comics/public/")) {
        return { ok: true, json: async () => DETAIL_RESPONSE } as Response;
      }
      if (url.startsWith("/api/comics/public")) {
        return { ok: true, json: async () => LIST_RESPONSE } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useComicRun", () => {
  it("returns a full consecutive run from the detail endpoint", async () => {
    const { result } = renderHook(() => useComicRun(4));

    await waitFor(() => expect(result.current.panels).toHaveLength(4));

    expect(result.current.title).toBe("The Long Walk");
    expect(result.current.panels).toEqual([
      "https://cdn.test/c1-p1.png",
      "https://cdn.test/c1-p2.png",
      "https://cdn.test/c1-p3.png",
      "https://cdn.test/c1-p4.png",
    ]);
  });

  it("never returns a partially filled run", async () => {
    const { result } = renderHook(() => useComicRun(4));
    await waitFor(() => expect(result.current.panels.length).toBeGreaterThan(0));
    // A short run would render blank boxes beside the consistency claim.
    expect(result.current.panels).toHaveLength(4);
  });
});

describe("useStyleSamples", () => {
  it("keys art by the style the comic actually used", async () => {
    const { result } = renderHook(() => useStyleSamples());

    await waitFor(() => expect(Object.keys(result.current).length).toBe(2));

    expect(result.current.noir).toBe("https://cdn.test/c1-p1.png");
    expect(result.current.anime).toBe("https://cdn.test/c2-p1.png");
    // Styles with no published comic stay empty rather than borrowing art.
    expect(result.current.watercolor).toBeUndefined();
  });
});

describe("usePanelImages", () => {
  it("fills every requested slot by cycling the available covers", async () => {
    const { result } = renderHook(() => usePanelImages(5));

    await waitFor(() => expect(result.current).toHaveLength(5));

    expect(result.current).toEqual([
      "https://cdn.test/c1-p1.png",
      "https://cdn.test/c2-p1.png",
      "https://cdn.test/c1-p1.png",
      "https://cdn.test/c2-p1.png",
      "https://cdn.test/c1-p1.png",
    ]);
  });
});
