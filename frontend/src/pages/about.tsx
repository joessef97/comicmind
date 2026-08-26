import type { ReactNode } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/page-layout";
import {
  Sparkles,
  Layers,
  Users,
  Wand2,
  Shield,
  Share2,
} from "lucide-react";

/** Alternating fills give the six-card grid its rhythm. */
type Tone = "paper" | "yellow" | "red" | "ink";

const TONE_CLASSES: Record<Tone, { card: string; title: string; body: string; icon: string }> = {
  paper: {
    card: "bg-[#f8f5ec] hard-shadow",
    title: "text-[#12100c]",
    body: "text-[#4a4535]",
    icon: "border-[#12100c] bg-[#f2ede1] text-[#12100c]",
  },
  yellow: {
    card: "bg-[#f2b32e] hard-shadow",
    title: "text-[#12100c]",
    body: "text-[#4a4535]",
    icon: "border-[#12100c] bg-[#f8f5ec] text-[#12100c]",
  },
  red: {
    card: "bg-[#d8402f] hard-shadow",
    title: "text-[#f2ede1]",
    body: "text-[#f2ede1]",
    icon: "border-[#12100c] bg-[#f2ede1] text-[#12100c]",
  },
  ink: {
    card: "bg-[#12100c] hard-shadow-yellow",
    title: "text-[#f2ede1]",
    body: "text-[#a39b8b]",
    icon: "border-[#f2ede1] bg-[#1b1811] text-[#f2b32e]",
  },
};

const FEATURES: { icon: ReactNode; title: string; description: string; tone: Tone }[] = [
  {
    icon: <Users className="h-6 w-6" />,
    title: "Character Consistency",
    description:
      "Maintain visual identity across panels so your protagonists stay recognizable through every scene.",
    tone: "paper",
  },
  {
    icon: <Layers className="h-6 w-6" />,
    title: "SVG Speech Bubbles",
    description:
      "Keep dialogue editable with layered speech bubbles that are easy to update and localize.",
    tone: "yellow",
  },
  {
    icon: <Wand2 className="h-6 w-6" />,
    title: "AI Story Generation",
    description:
      "Turn a simple prompt into a coherent multi-panel narrative with strong pacing.",
    tone: "red",
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Content Safety",
    description:
      "Built-in filtering keeps generated content within platform safety and quality standards.",
    tone: "ink",
  },
  {
    icon: <Sparkles className="h-6 w-6" />,
    title: "Style Control",
    description:
      "Select visual directions like anime, noir, or watercolor to match your story tone.",
    tone: "paper",
  },
  {
    icon: <Share2 className="h-6 w-6" />,
    title: "Export & Sharing",
    description:
      "Export high-quality outputs and share finished comics quickly with your audience.",
    tone: "yellow",
  },
];

const IMAGE_BLOCK_SHADOWS = ["hard-shadow-red", "hard-shadow-blue", "hard-shadow-yellow", "hard-shadow"];

export default function About() {
  return (
    <PageLayout>
      <main className="bg-[#f2ede1]">
        <div className="container mx-auto px-4 py-16 md:py-20">
          {/* Header */}
          <section className="grid gap-12 border-b-4 border-[#12100c] pb-16 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="label-mono mb-4 text-[#d8402f]">Storytelling, upgraded</p>
              <h1 className="font-display text-[46px] uppercase leading-[0.95] text-[#12100c] sm:text-[64px]">
                About ComicMind
              </h1>
              <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-[#4a4535]">
                ComicMind helps creators turn simple ideas into complete, consistent,
                and expressive comics using AI-assisted storytelling and visual generation.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {IMAGE_BLOCK_SHADOWS.map((shadow, i) => (
                <div
                  key={i}
                  className={`art-placeholder aspect-square border-[3px] border-[#12100c] ${shadow}`}
                />
              ))}
            </div>
          </section>

          {/* Introduction */}
          <section className="max-w-3xl border-b-4 border-[#12100c] py-16">
            <h2 className="font-display text-[32px] uppercase leading-none text-[#12100c]">
              Introduction
            </h2>
            <p className="mt-5 text-[16px] leading-[1.7] text-[#4a4535]">
              ComicMind is built for creators who want faster ideation without sacrificing
              narrative quality. You bring the concept, and ComicMind helps structure the
              story, generate visuals, and keep your comic style cohesive from panel to panel.
            </p>
          </section>

          {/* Features */}
          <section className="border-b-4 border-[#12100c] py-16">
            <div className="max-w-3xl">
              <h2 className="font-display text-[36px] uppercase leading-[0.95] text-[#12100c] sm:text-[44px]">
                Powerful Comic Creation
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-[#4a4535]">
                Everything you need to go from idea to polished comic with speed and consistency.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>
          </section>

          {/* Closing CTA */}
          <section className="pt-16">
            <div className="border-[3px] border-[#12100c] bg-[#12100c] px-6 py-14 text-center sm:px-10">
              <h2 className="font-display text-[32px] uppercase leading-[0.95] text-[#f2ede1] sm:text-[42px]">
                Ready to create your comic?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-[16px] leading-relaxed text-[#a39b8b]">
                Start building your next story with AI-powered comic tools designed for creators.
              </p>
              <div className="mt-8 flex justify-center">
                <Link href="/editor/new">
                  <Button
                    size="lg"
                    className="border-[3px] border-[#f2ede1] bg-[#d8402f] text-[#f2ede1] shadow-[7px_7px_0_#f2ede1]"
                  >
                    Start Creating
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </PageLayout>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  tone,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  tone: Tone;
}) {
  const t = TONE_CLASSES[tone];

  return (
    <article className={`border-[3px] border-[#12100c] p-6 ${t.card}`}>
      <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center border-[3px] ${t.icon}`}>
        {icon}
      </div>
      <h3 className={`font-display text-[22px] uppercase leading-none ${t.title}`}>{title}</h3>
      <p className={`mt-3 text-[14px] leading-relaxed ${t.body}`}>{description}</p>
    </article>
  );
}
