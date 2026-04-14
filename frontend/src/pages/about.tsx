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
  ArrowRight,
} from "lucide-react";

export default function About() {
  return (
    <PageLayout className="bg-background text-foreground font-sans">
      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background" />
          <div className="absolute left-1/2 top-[-220px] h-[440px] w-[680px] -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-600/20 via-fuchsia-500/12 to-pink-500/20 blur-3xl" />
          <div className="absolute right-[-160px] top-[520px] h-[340px] w-[340px] rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="relative container mx-auto px-4 py-16 md:py-20">
          <section className="max-w-4xl">
            <div>
              <p className="mb-4 inline-flex items-center rounded-full border border-border/70 bg-muted/50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-md">
                Storytelling, upgraded
              </p>
              <h1 className="text-4xl font-display font-black tracking-tight sm:text-5xl lg:text-6xl">
                <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                  About ComicMind
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                ComicMind helps creators turn simple ideas into complete, consistent,
                and expressive comics using AI-assisted storytelling and visual generation.
              </p>
            </div>
          </section>

          <section className="mt-20 md:mt-24 max-w-3xl">
            <h2 className="text-2xl font-display font-bold text-foreground">Introduction</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              ComicMind is built for creators who want faster ideation without sacrificing
              narrative quality. You bring the concept, and ComicMind helps structure the
              story, generate visuals, and keep your comic style cohesive from panel to panel.
            </p>
          </section>

          <section className="mt-20 md:mt-24">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-display font-bold tracking-tight text-foreground">
                Powerful Comic Creation
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                Everything you need to go from idea to polished comic with speed and consistency.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={<Users className="h-7 w-7 text-violet-300" />}
                title="Character Consistency"
                description="Maintain visual identity across panels so your protagonists stay recognizable through every scene."
                highlighted
              />
              <FeatureCard
                icon={<Layers className="h-7 w-7 text-fuchsia-300" />}
                title="SVG Speech Bubbles"
                description="Keep dialogue editable with layered speech bubbles that are easy to update and localize."
              />
              <FeatureCard
                icon={<Wand2 className="h-7 w-7 text-pink-300" />}
                title="AI Story Generation"
                description="Turn a simple prompt into a coherent multi-panel narrative with strong pacing."
                highlighted
              />
              <FeatureCard
                icon={<Shield className="h-7 w-7 text-rose-300" />}
                title="Content Safety"
                description="Built-in filtering keeps generated content within platform safety and quality standards."
              />
              <FeatureCard
                icon={<Sparkles className="h-7 w-7 text-amber-300" />}
                title="Style Control"
                description="Select visual directions like anime, noir, or watercolor to match your story tone."
              />
              <FeatureCard
                icon={<Share2 className="h-7 w-7 text-emerald-300" />}
                title="Export & Sharing"
                description="Export high-quality outputs and share finished comics quickly with your audience."
              />
            </div>
          </section>

          <section className="mt-20 md:mt-24 pb-6">
            <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 px-6 py-12 text-center backdrop-blur-md sm:px-10">
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-[280px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-violet-600/20 via-fuchsia-500/20 to-pink-500/20 blur-3xl" />
              <div className="relative">
                <h2 className="text-3xl font-display font-bold tracking-tight text-foreground sm:text-4xl">
                  Ready to create your comic?
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                  Start building your next story with AI-powered comic tools designed for creators.
                </p>
                <div className="mt-8 flex justify-center">
                  <Link href="/editor/new">
                    <Button className="min-h-11 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-7 text-primary-foreground shadow-[0_12px_36px_rgba(168,85,247,0.35)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_16px_44px_rgba(217,70,239,0.45)]">
                      Start Creating
                    </Button>
                  </Link>
                </div>
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
  highlighted = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  highlighted?: boolean;
}) {
  return (
    <article
      className={[
        "group rounded-xl border p-6 backdrop-blur-md transition-all duration-300",
        "hover:scale-[1.02] hover:shadow-[0_16px_42px_rgba(0,0,0,0.35)]",
        highlighted
          ? "border-violet-400/40 bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-transparent shadow-[0_0_0_1px_rgba(168,85,247,0.25),0_12px_34px_rgba(124,58,237,0.25)]"
          : "border-border/70 bg-card/70 hover:border-violet-300/30",
      ].join(" ")}
    >
      <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl border border-border/70 bg-muted/50 transition-colors duration-300 group-hover:bg-muted/70">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </article>
  );
}

function StepCard({
  step,
  icon,
  title,
  description,
}: {
  step: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:border-violet-300/30 hover:shadow-[0_14px_36px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold tracking-wider text-violet-200/80">STEP {step}</span>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
          {icon}
        </div>
      </div>
      <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/70">{description}</p>
    </article>
  );
}
