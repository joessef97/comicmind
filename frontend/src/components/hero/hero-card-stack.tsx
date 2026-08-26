import { useState, useEffect } from "react";
import { TopRatedComicPreview } from "./top-rated-comic-preview";
import { getDisplayImageUrl } from "@/lib/utils";

interface BackgroundComic {
  _id: string;
  title: string;
  coverUrl?: string;
  panels?: { imageUrl: string }[];
}

/** Rotations are fixed by the Newsprint spec — pasted-up panels, not a fan. */
const CARD_ROTATIONS = ["-5deg", "4deg", "3deg", "-6deg"];

export function HeroCardStack() {
  const [backgroundComics, setBackgroundComics] = useState<BackgroundComic[]>([]);

  useEffect(() => {
    async function fetchComics() {
      try {
        const res = await fetch("/api/comics/public?limit=4");
        if (!res.ok) return;
        const data = await res.json();
        if (data.comics && Array.isArray(data.comics)) {
          setBackgroundComics(data.comics.slice(0, 4));
        }
      } catch {
        // Hatched placeholders stand in on error.
      }
    }
    fetchComics();
  }, []);

  return (
    <div className="relative w-full">
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        {/* Live top-rated comic keeps its place as the lead panel. */}
        <div
          className="border-[4px] border-[#f2ede1] bg-[#1b1811] shadow-[8px_8px_0_#12100c]"
          style={{ transform: `rotate(${CARD_ROTATIONS[0]})` }}
        >
          <TopRatedComicPreview />
        </div>

        <PanelCard comic={backgroundComics[1]} rotation={CARD_ROTATIONS[1]} />
        <PanelCard comic={backgroundComics[2]} rotation={CARD_ROTATIONS[2]} />

        {/* The punchline card. */}
        <div
          className="flex aspect-video items-center border-[4px] border-[#12100c] bg-[#f2b32e] p-4 shadow-[8px_8px_0_#12100c]"
          style={{ transform: `rotate(${CARD_ROTATIONS[3]})` }}
        >
          <p className="font-display text-[26px] uppercase leading-[0.95] text-[#12100c]">
            Same face,
            <br />
            every panel.
          </p>
        </div>
      </div>
    </div>
  );
}

function PanelCard({ comic, rotation }: { comic?: BackgroundComic; rotation: string }) {
  const imageUrl = comic?.coverUrl || comic?.panels?.[0]?.imageUrl;

  return (
    <div
      className="relative aspect-video overflow-hidden border-[4px] border-[#f2ede1] shadow-[8px_8px_0_#12100c]"
      style={{ transform: `rotate(${rotation})` }}
    >
      {imageUrl ? (
        <img
          src={getDisplayImageUrl(imageUrl, "card")}
          alt={comic?.title || "Comic preview"}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="art-placeholder-ink h-full w-full" />
      )}

      {comic?.title && (
        <div className="absolute inset-x-0 bottom-0 border-t-[3px] border-[#f2ede1] bg-[#12100c] px-2 py-1">
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[#a39b8b]">
            {comic.title}
          </p>
        </div>
      )}
    </div>
  );
}
