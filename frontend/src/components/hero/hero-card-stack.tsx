import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { TopRatedComicPreview } from "./top-rated-comic-preview";
import { getDisplayImageUrl } from "@/lib/utils";

interface BackgroundComic {
  _id: string;
  title: string;
  coverUrl?: string;
  panels?: { imageUrl: string }[];
}

// Card positions: 2 on left, 2 on right - all partially visible behind main card
const CARD_CONFIGS = [
  // Left side cards
  { x: -85, y: -25, rotate: -8, scale: 0.88, opacity: 0.75, zIndex: 4 },
  { x: -55, y: 35, rotate: -4, scale: 0.92, opacity: 0.7, zIndex: 2 },
  // Right side cards
  { x: 85, y: -30, rotate: 7, scale: 0.87, opacity: 0.75, zIndex: 3 },
  { x: 60, y: 40, rotate: 3, scale: 0.9, opacity: 0.7, zIndex: 1 },
];

// Placeholder gradients for cards without images
const PLACEHOLDER_GRADIENTS = [
  "from-indigo-600/40 via-purple-800/30 to-slate-900/50",
  "from-violet-600/40 via-fuchsia-800/30 to-slate-900/50",
  "from-blue-600/40 via-indigo-800/30 to-slate-900/50",
  "from-purple-600/40 via-pink-800/30 to-slate-900/50",
];

export function HeroCardStack() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [backgroundComics, setBackgroundComics] = useState<BackgroundComic[]>([]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

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
        // Use placeholders on error
      }
    }
    fetchComics();
  }, []);

  return (
    <div ref={containerRef} className="relative w-full min-h-[420px] flex items-center justify-center">
      {/* Soft ambient glow behind the stack */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[550px] h-[380px] bg-primary/15 rounded-full blur-[120px]" />
      </div>

      {/* Background cards */}
      {CARD_CONFIGS.map((config, index) => (
        <BackgroundCard
          key={index}
          comic={backgroundComics[index]}
          config={config}
          scrollProgress={scrollYProgress}
          index={index}
          placeholderGradient={PLACEHOLDER_GRADIENTS[index]}
        />
      ))}

      {/* Main card - TopRatedComicPreview */}
      <motion.div
        className="relative z-20 w-full"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
      >
        <div className="relative group">
          {/* Subtle glow for main card */}
          <div className="absolute -inset-3 bg-gradient-to-r from-primary/25 via-purple-500/20 to-primary/25 rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
          <div className="relative">
            <TopRatedComicPreview />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

interface BackgroundCardProps {
  comic?: BackgroundComic;
  config: {
    x: number;
    y: number;
    rotate: number;
    scale: number;
    opacity: number;
    zIndex: number;
  };
  scrollProgress: ReturnType<typeof useScroll>["scrollYProgress"];
  index: number;
  placeholderGradient: string;
}

function BackgroundCard({ comic, config, scrollProgress, index, placeholderGradient }: BackgroundCardProps) {
  // Subtle parallax - small movements only
  const xOffset = useTransform(
    scrollProgress,
    [0, 1],
    [config.x - 8, config.x + 8]
  );
  const yOffset = useTransform(
    scrollProgress,
    [0, 1],
    [config.y - 5, config.y + 5]
  );
  const rotate = useTransform(
    scrollProgress,
    [0, 1],
    [config.rotate - 1, config.rotate + 1]
  );

  const imageUrl = comic?.coverUrl || comic?.panels?.[0]?.imageUrl;

  return (
    <motion.div
      className="absolute top-1/2 left-1/2"
      style={{
        x: xOffset,
        y: yOffset,
        rotate,
        scale: config.scale,
        zIndex: config.zIndex,
        translateX: "-50%",
        translateY: "-50%",
      }}
      initial={{ opacity: 0, scale: config.scale * 0.9 }}
      animate={{ opacity: config.opacity, scale: config.scale }}
      transition={{ duration: 0.6, delay: 0.05 * index, ease: "easeOut" }}
    >
      <div
        className="relative w-[300px] aspect-video rounded-2xl overflow-hidden border border-border/70 shadow-xl bg-card/90"
        style={{ filter: "blur(0.5px)" }}
      >
        {imageUrl ? (
          <img
            src={getDisplayImageUrl(imageUrl, "card")}
            alt={comic?.title || "Comic preview"}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${placeholderGradient}`}>
            {/* Placeholder pattern overlay */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,white_1px,transparent_1px)] bg-[length:20px_20px]" />
            </div>
          </div>
        )}

        {/* Soft overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />

        {/* Title at bottom if available */}
        {comic?.title && (
          <div className="absolute bottom-2.5 left-3 right-3">
            <p className="text-white/70 text-xs font-medium truncate">
              {comic.title}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
