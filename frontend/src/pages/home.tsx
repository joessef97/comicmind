import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/page-layout";
import { HeroCardStack } from "@/components/hero/hero-card-stack";
import { ArrowRight, Star } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  usePanelImages,
  usePublicComics,
  useComicRun,
  type PublicComic,
} from "@/hooks/use-panel-images";
import { getDisplayImageUrl } from "@/lib/utils";

const STEPS = [
  {
    numeral: "1",
    color: "#d8402f",
    title: "Write your idea",
    body: "Give it a title and a premise. A sentence is enough to start — the story grows from there.",
  },
  {
    numeral: "2",
    color: "#2f4fd8",
    title: "Pick a style",
    body: "Six art directions, from anime to noir. Your whole book is drawn in the one you choose.",
  },
  {
    numeral: "3",
    color: "#f2b32e",
    title: "Generate six panels",
    body: "Edit the dialogue, regenerate any panel you don't like, then export in high resolution.",
  },
];

/** The six real art styles, matching ART_STYLES in pages/editor.tsx. */
const STYLES = [
  { id: "anime", name: "Anime", description: "Japanese animation style with expressive characters", shadow: "hard-shadow-red" },
  { id: "realistic", name: "Realistic", description: "Life-like detail and natural lighting", shadow: "hard-shadow-blue" },
  { id: "cartoon", name: "Cartoon", description: "Bold lines and vibrant, playful colors", shadow: "hard-shadow-yellow" },
  { id: "noir", name: "Noir", description: "High-contrast black and white cinematic style", shadow: "hard-shadow-red" },
  { id: "watercolor", name: "Watercolor", description: "Soft textures and fluid artistic strokes", shadow: "hard-shadow-blue" },
  { id: "retro", name: "Retro", description: "Classic vintage comic book aesthetic", shadow: "hard-shadow-yellow" },
];

export default function Home() {
  const { user } = useAuth();
  const createLink = user ? "/editor/new" : "/register";
  const galleryLink = user ? "/dashboard" : "/login";

  return (
    <PageLayout>
      <HeroBand createLink={createLink} galleryLink={galleryLink} />
      <StepsBand />
      <ConsistencyBand />
      <EditorDemoBand />
      <StylesBand />
      <TopRatedBand />
      <ClosingBand createLink={createLink} />
    </PageLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Split hero                                                              */
/* -------------------------------------------------------------------------- */

function HeroBand({ createLink, galleryLink }: { createLink: string; galleryLink: string }) {
  return (
    <section className="grid border-b-4 border-[#12100c] lg:grid-cols-2">
      <div className="relative flex items-center bg-[#f2ede1] px-6 py-16 lg:px-12 lg:py-20">
        <div className="mx-auto w-full max-w-[600px] space-y-7">
          <span className="inline-block border-[3px] border-[#12100c] bg-[#f2b32e] px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#12100c] hard-shadow-sm">
            No drawing skills required
          </span>

          <h1 className="font-display text-[54px] uppercase leading-[0.92] tracking-tight text-[#12100c] sm:text-[72px] lg:text-[86px] xl:text-[96px]">
            Create
            <br />
            Consistent
            <br />
            <span
              className="text-[#d8402f]"
              style={{ WebkitTextStroke: "2px #12100c", paintOrder: "stroke fill" }}
            >
              Comic Books
            </span>
          </h1>

          <p className="max-w-xl text-[17px] leading-relaxed text-[#4a4535]">
            Turn your scripts into professional 6-panel comics.
            Maintain character consistency, edit speech bubbles, and export in high resolution.
            No drawing skills required.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link href={createLink}>
              <Button size="lg" className="w-full sm:w-auto">
                Start Creating <ArrowRight className="ml-1 h-5 w-5" />
              </Button>
            </Link>
            <Link href={galleryLink}>
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                View Gallery
              </Button>
            </Link>
            <Link href="/browse">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Browse Comics
              </Button>
            </Link>
          </div>

          <p className="label-mono text-[#6d675a]">
            Six panels · Six styles · One consistent cast
          </p>
        </div>
      </div>

      <div className="dark halftone relative overflow-hidden border-t-4 border-[#12100c] bg-[#1b1811] px-6 py-14 lg:border-l-4 lg:border-t-0 lg:px-12 lg:py-20">
        <div className="relative z-10 mx-auto w-full max-w-[560px]">
          <HeroCardStack />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Three-step strip                                                        */
/* -------------------------------------------------------------------------- */

function StepsBand() {
  return (
    <section className="border-b-4 border-[#12100c] bg-[#f2ede1]">
      <div className="grid md:grid-cols-3">
        {STEPS.map((step, index) => (
          <div
            key={step.numeral}
            className={`px-6 py-10 lg:px-10 lg:py-12 ${
              index > 0 ? "border-t-[3px] border-[#12100c] md:border-l-[3px] md:border-t-0" : ""
            }`}
          >
            <span
              className="numeral-outline block text-[68px] leading-none"
              style={{ color: step.color }}
            >
              {step.numeral}
            </span>
            <h3 className="mt-4 font-display text-[22px] uppercase leading-none text-[#12100c]">
              {step.title}
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-[#4a4535]">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Consistency explainer                                                   */
/* -------------------------------------------------------------------------- */

function ConsistencyBand() {
  // Real proof for our own claim: consecutive panels from one published comic,
  // same cast, in story order. The comparison row is left as a placeholder —
  // see the note on ThumbnailRow.
  const run = useComicRun(4);

  return (
    <section className="border-b-4 border-[#12100c] bg-[#f2ede1] px-6 py-16 lg:px-12 lg:py-20">
      <div className="container mx-auto grid gap-12 lg:grid-cols-2 lg:items-center">
        <div className="space-y-5">
          <span className="label-mono text-[#d8402f]">The hard part</span>
          <h2 className="font-display text-[38px] uppercase leading-[0.95] text-[#12100c] sm:text-[52px]">
            Your hero shouldn&apos;t change face on page two
          </h2>
          <p className="max-w-xl text-[16px] leading-relaxed text-[#4a4535]">
            Most image tools redraw your character from scratch on every prompt, so by the last
            panel nobody recognises them. ComicMind locks a character reference before the first
            panel is drawn and holds it across all six, so the cast stays the cast.
          </p>
        </div>

        <div className="space-y-8">
          <ThumbnailRow label="Other tools" variant="dashed" images={[]} />
          <ThumbnailRow
            label="ComicMind"
            variant="solid"
            images={run.panels}
            caption={run.title ? `From "${run.title}" — panels 1–4, one unbroken run` : undefined}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * The "Other tools" row is deliberately left as empty hatching. Filling it
 * would mean either fabricating a competitor's output or passing ComicMind's
 * own panels off as someone else's — both would make the comparison a claim we
 * cannot stand behind. Drop real screenshots in via `images` to make it a
 * genuine side-by-side.
 */
function ThumbnailRow({
  label,
  variant,
  images,
  caption,
}: {
  label: string;
  variant: "dashed" | "solid";
  images: string[];
  caption?: string;
}) {
  const frame =
    variant === "dashed"
      ? "border-[3px] border-dashed border-[#6d675a]"
      : "border-[3px] border-[#12100c]";

  return (
    <div className="space-y-3">
      <span className={`label-mono ${variant === "dashed" ? "text-[#6d675a]" : "text-[#12100c]"}`}>
        {label}
      </span>
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`art-placeholder relative flex aspect-square items-center justify-center overflow-hidden ${frame}`}
          >
            {images[i] ? (
              <img
                src={images[i]}
                alt=""
                aria-hidden
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span className="font-display text-[22px] text-[#6d675a]">?</span>
            )}
          </div>
        ))}
      </div>
      {caption && (
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#6d675a]">{caption}</p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Editor demo band                                                        */
/* -------------------------------------------------------------------------- */

function EditorDemoBand() {
  const images = usePanelImages(7);

  return (
    <section className="dark border-b-4 border-[#12100c] bg-[#1b1811] px-6 py-16 lg:px-12 lg:py-20">
      <div className="container mx-auto space-y-10">
        <div className="space-y-3">
          <span className="label-mono text-[#f2b32e]">The studio</span>
          <h2 className="max-w-3xl font-display text-[38px] uppercase leading-[0.95] text-[#f2ede1] sm:text-[52px]">
            Edit every panel, every bubble, every line
          </h2>
        </div>

        <div className="grid border-[3px] border-[#f2ede1] lg:grid-cols-[180px_1fr_260px]">
          {/* Panel rail */}
          <div className="space-y-3 border-b-[3px] border-[#f2ede1] p-4 lg:border-b-0 lg:border-r-[3px]">
            <span className="label-mono text-[#a39b8b]">Panels</span>
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className={`art-placeholder-ink relative flex aspect-square items-center justify-center overflow-hidden border-[3px] ${
                    n === 2 ? "border-[#f2b32e]" : "border-[#4a4535]"
                  }`}
                >
                  {images[n - 1] && (
                    <img
                      src={images[n - 1]}
                      alt=""
                      aria-hidden
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <span className="relative border border-[#12100c] bg-[#12100c]/80 px-1 font-mono text-[10px] text-[#f2ede1]">
                    {n}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Canvas */}
          <div className="art-placeholder-ink flex items-center justify-center border-b-[3px] border-[#f2ede1] p-8 lg:border-b-0 lg:border-r-[3px]">
            <div className="art-placeholder-ink relative aspect-[4/3] w-full max-w-md overflow-hidden border-[4px] border-[#f2ede1]">
              {images[1] && (
                <img
                  src={images[1]}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              )}
              <span className="absolute left-4 top-4 max-w-[55%] border-[3px] border-[#12100c] bg-[#f8f5ec] px-3 py-2 text-[13px] font-semibold leading-tight text-[#12100c]">
                We only get one shot at this.
              </span>
              <span className="absolute bottom-4 right-4 max-w-[55%] border-[3px] border-[#12100c] bg-[#f2b32e] px-3 py-2 text-[13px] font-semibold leading-tight text-[#12100c]">
                Then let&apos;s make it count.
              </span>
            </div>
          </div>

          {/* Properties */}
          <div className="space-y-4 p-4">
            <span className="label-mono text-[#a39b8b]">Properties</span>
            {["Title", "Story", "Style", "Dialogue", "Narration"].map((field) => (
              <div key={field} className="space-y-1.5">
                <span className="label-mono block text-[#6d675a]">{field}</span>
                <div className="h-8 border-[3px] border-[#4a4535] bg-[#12100c]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Style showcase                                                          */
/* -------------------------------------------------------------------------- */

function StylesBand() {
  const images = usePanelImages(6);

  return (
    <section className="border-b-4 border-[#12100c] bg-[#f2ede1] px-6 py-16 lg:px-12 lg:py-20">
      <div className="container mx-auto space-y-10">
        <div className="space-y-3">
          <span className="label-mono text-[#d8402f]">Six styles</span>
          <h2 className="font-display text-[38px] uppercase leading-[0.95] text-[#12100c] sm:text-[52px]">
            Pick a look, keep it all book
          </h2>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {STYLES.map((style, index) => (
            <div
              key={style.id}
              className={`border-[3px] border-[#12100c] bg-[#f8f5ec] ${style.shadow}`}
            >
              <div className="art-placeholder aspect-[4/3] overflow-hidden border-b-[3px] border-[#12100c]">
                {images[index] && (
                  <img
                    src={images[index]}
                    alt=""
                    aria-hidden
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </div>
              <div className="space-y-2 p-5">
                <h3 className="font-display text-[22px] uppercase leading-none text-[#12100c]">
                  {style.name}
                </h3>
                <p className="text-[14px] leading-relaxed text-[#4a4535]">{style.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. Top-rated grid                                                          */
/* -------------------------------------------------------------------------- */

function TopRatedBand() {
  const comics = usePublicComics(12);

  // The endpoint sorts by createdAt, so rank here to earn the heading.
  const ranked = [...comics]
    .sort((a, b) =>
      b.averageRating - a.averageRating || b.ratingsCount - a.ratingsCount,
    )
    .slice(0, 4);

  const slots = ranked.length ? ranked : [undefined, undefined, undefined, undefined];

  return (
    <section className="border-b-4 border-[#12100c] bg-[#f2ede1] px-6 py-16 lg:px-12 lg:py-20">
      <div className="container mx-auto space-y-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <span className="label-mono text-[#2f4fd8]">From the racks</span>
            <h2 className="font-display text-[38px] uppercase leading-[0.95] text-[#12100c] sm:text-[52px]">
              Top rated this week
            </h2>
          </div>
          <Link href="/browse">
            <Button variant="outline">Browse Comics</Button>
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {slots.map((comic, index) => (
            <TopRatedCard key={comic?.id ?? index} comic={comic} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TopRatedCard({ comic }: { comic?: PublicComic }) {
  // There is no cover field on the API — panel one is the cover.
  const imageUrl = comic?.panels?.[0]?.imageUrl;

  const body = (
    <div className="h-full border-[3px] border-[#12100c] bg-[#f8f5ec]">
      <div className="relative aspect-[4/3] overflow-hidden border-b-[3px] border-[#12100c]">
        {imageUrl ? (
          <img
            src={getDisplayImageUrl(imageUrl, "card")}
            alt={comic?.title ?? "Comic cover"}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="art-placeholder h-full w-full" />
        )}
        {comic?.style && (
          <span className="absolute right-0 top-0 border-b-[3px] border-l-[3px] border-[#12100c] bg-[#12100c] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#f2ede1]">
            {comic.style}
          </span>
        )}
      </div>
      <div className="space-y-2 p-4">
        <h3 className="truncate font-display text-[20px] uppercase leading-none text-[#12100c]">
          {comic?.title ?? "Untitled"}
        </h3>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#6d675a]">
          {comic?.authorUsername ? `By ${comic.authorUsername}` : "Awaiting a first issue"}
        </p>
        {typeof comic?.averageRating === "number" && comic.ratingsCount > 0 && (
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#12100c]">
            <Star className="h-3 w-3 fill-[#f2b32e] text-[#12100c]" />
            {comic.averageRating.toFixed(1)}
            <span className="text-[#6d675a]">
              · {comic.ratingsCount ?? 0} rating{comic.ratingsCount === 1 ? "" : "s"}
            </span>
          </p>
        )}
      </div>
    </div>
  );

  if (!comic) return body;

  return (
    <Link href={`/comic/${comic.id}`}>
      <a className="block h-full">{body}</a>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. Closing CTA                                                             */
/* -------------------------------------------------------------------------- */

function ClosingBand({ createLink }: { createLink: string }) {
  return (
    <section className="halftone relative overflow-hidden bg-[#d8402f] px-6 py-20 lg:px-12 lg:py-24">
      <div className="container relative z-10 mx-auto flex flex-col items-center gap-8 text-center">
        <h2
          className="max-w-4xl font-display text-[42px] uppercase leading-[0.92] text-[#f2ede1] sm:text-[60px]"
          style={{ WebkitTextStroke: "2px #12100c", paintOrder: "stroke fill" }}
        >
          Your first six panels are waiting
        </h2>
        <p className="max-w-xl text-[16px] leading-relaxed text-[#f2ede1]">
          Start with a sentence. Finish with a comic you can print.
        </p>
        <Link href={createLink}>
          <Button
            size="lg"
            className="border-[3px] border-[#12100c] bg-[#f2ede1] text-[#12100c] hard-shadow-lg"
          >
            Start Creating <ArrowRight className="ml-1 h-5 w-5" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
