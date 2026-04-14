import { Link } from "wouter";
import { useEffect } from "react";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/hooks/use-auth";

const guideSteps = [
  {
    number: "01",
    title: "Name Your Comic",
    description: "Give your comic a unique and memorable title.",
    image: "/assets/guide/title-screen.svg",
    alt: "Comic title creation screen",
  },
  {
    number: "02",
    title: "Tell Your Story",
    description: "Describe your story plot, characters, and key events.",
    image: "/assets/guide/story-screen.svg",
    alt: "Story prompt writing screen",
  },
  {
    number: "03",
    title: "Choose Your Style",
    description: "Pick a visual style like Anime, Realistic, or Cartoon.",
    image: "/assets/guide/style-screen.svg",
    alt: "Visual style selection screen",
  },
];

const packages = [
  {
    title: "3 Stories",
    price: "$4.99",
    detail: "Starter package for quick experiments.",
  },
  {
    title: "5 Stories",
    price: "$8.99",
    detail: "Most popular for regular creators.",
    featured: true,
  },
  {
    title: "10 Stories",
    price: "$15.00",
    detail: "Best value for power users.",
  },
];

const tips = [
  "Include a clear beginning, conflict, and ending",
  "Keep it concise (6 panels)",
  "Define your characters clearly",
];

export default function UserGuide() {
  const { user } = useAuth();

  const getCheckoutPath = (plan: string, price: string) =>
    `/checkout?plan=${encodeURIComponent(plan)}&price=${encodeURIComponent(price)}`;

  const getPackageHref = (title: string, price: string) => {
    const plan = title.replace(" Stories", "");
    const numericPrice = price.replace("$", "");
    const checkoutPath = getCheckoutPath(plan, numericPrice);

    if (user) {
      return checkoutPath;
    }

    return `/login?returnTo=${encodeURIComponent(checkoutPath)}`;
  };

  useEffect(() => {
    const scrollToHashTarget = () => {
      const pendingPackagesScroll = sessionStorage.getItem("scrollToPackages") === "1";
      const hash = window.location.hash;
      const id = pendingPackagesScroll
        ? "packages"
        : hash
          ? decodeURIComponent(hash.replace("#", ""))
          : "";

      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;

      const y = target.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: y, behavior: "smooth" });

      if (pendingPackagesScroll) {
        sessionStorage.removeItem("scrollToPackages");
      }
    };

    scrollToHashTarget();
    window.addEventListener("hashchange", scrollToHashTarget);

    return () => {
      window.removeEventListener("hashchange", scrollToHashTarget);
    };
  }, []);

  return (
    <PageLayout className="bg-background text-foreground">
      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background" />
          <div className="absolute left-[-120px] top-[-120px] h-[360px] w-[360px] rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute right-[-140px] top-[80px] h-[360px] w-[360px] rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="container mx-auto max-w-6xl px-4 py-16 md:py-20 space-y-14 md:space-y-16">
          <section className="text-center max-w-3xl mx-auto space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/50 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Getting Started
            </p>
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">User Guide</h1>
            <p className="text-base md:text-lg text-muted-foreground">
              Learn how to create your comic in 3 simple steps
            </p>
          </section>

          <section aria-labelledby="steps-heading" className="space-y-6">
            <h2 id="steps-heading" className="text-2xl md:text-3xl font-display font-semibold text-center">
              Step-by-Step Guide
            </h2>
            <div className="space-y-5 md:space-y-6">
              {guideSteps.map((step) => (
                <Card
                  key={step.number}
                  className="glass-panel rounded-xl border border-border/70 shadow-[0_12px_40px_rgba(5,8,20,0.22)] overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-primary/50"
                >
                  <CardContent className="p-5 md:p-6 grid gap-6 md:grid-cols-[1fr_1.2fr] md:items-center">
                    <div className="space-y-3">
                      <span className="inline-flex items-center rounded-lg border border-primary/40 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                        {step.number}
                      </span>
                      <h3 className="text-2xl font-display font-semibold">{step.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/40">
                      <img
                        src={step.image}
                        alt={step.alt}
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.02]"
                        loading="lazy"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-panel rounded-xl border border-border/70 shadow-[0_10px_35px_rgba(10,14,35,0.2)]">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-2xl font-display font-semibold">Tips for a Great Story</h2>
                <ul className="space-y-3 text-muted-foreground">
                  {tips.map((tip) => (
                    <li key={tip} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="glass-panel rounded-xl border border-border/70 shadow-[0_10px_35px_rgba(10,14,35,0.2)]">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-2xl font-display font-semibold">FAQ</h2>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="faq-1" className="border-border/70">
                    <AccordionTrigger className="text-sm md:text-base hover:no-underline">
                      Can I create a story with multiple characters?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      Yes. Add each character in your story description and explain their role to get more coherent panel outcomes.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="faq-2" className="border-border/70">
                    <AccordionTrigger className="text-sm md:text-base hover:no-underline">
                      Do all stories cost the same?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      Package pricing may vary by plan, but each package clearly shows how many stories you can generate.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="faq-3" className="border-border/70">
                    <AccordionTrigger className="text-sm md:text-base hover:no-underline">
                      Can I change the style after generating?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      You can regenerate the same story with another style anytime to compare different visual directions.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="faq-4" className="border-border/70">
                    <AccordionTrigger className="text-sm md:text-base hover:no-underline">
                      How long does it take to generate a comic?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      Most comics finish in a few minutes, depending on demand and the length of your story.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="faq-5" className="border-border/70">
                    <AccordionTrigger className="text-sm md:text-base hover:no-underline">
                      Can I edit my story after generating the comic?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      Yes. I can edit the text in the comics.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="faq-6" className="border-border/70">
                    <AccordionTrigger className="text-sm md:text-base hover:no-underline">
                      Can I download or share my comic?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      Yes. You can download your comic in pdf and png formats and share it with others from the comic page and also on social media like facebook and reddit and x.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="faq-7" className="border-border/70">
                    <AccordionTrigger className="text-sm md:text-base hover:no-underline">
                      What happens if my generation fails?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      If generation fails, you can retry without losing your story input.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="faq-8" className="border-border/70">
                    <AccordionTrigger className="text-sm md:text-base hover:no-underline">
                      Are my comics saved to my account?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      Yes. Your comics are saved to your account so you can revisit them later.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="faq-9" className="border-border/70">
                    <AccordionTrigger className="text-sm md:text-base hover:no-underline">
                      Can I reuse the same story with different styles?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      Yes. You can regenerate the same story with different styles to compare results.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="faq-10" className="border-border/70">
                    <AccordionTrigger className="text-sm md:text-base hover:no-underline">
                      Is there a limit on how many comics I can create?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      Limits depend on your plan, and each package shows how many stories you can create.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="faq-11" className="border-border/70">
                    <AccordionTrigger className="text-sm md:text-base hover:no-underline">
                      Can I regenerate only one panel instead of the whole comic?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      Yes. You can retry a single failed or unsatisfactory panel without regenerating the entire comic.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="faq-12" className="border-border/70">
                    <AccordionTrigger className="text-sm md:text-base hover:no-underline">
                      Do you provide credits or refunds if image generation fails?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      If generation fails due to a system issue, you can retry and contact support for credit or refund help based on your plan.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="faq-13" className="border-border/70">
                    <AccordionTrigger className="text-sm md:text-base hover:no-underline">
                      Is my story prompt private and secure?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      We treat your prompts as private account content and apply secure access controls so only you can manage your saved comics.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="faq-14" className="border-border/70">
                    <AccordionTrigger className="text-sm md:text-base hover:no-underline">
                      Can I collaborate with another user on the same comic?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      Real-time collaboration is not available yet, but you can share your comic link or exported file to co-create asynchronously.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="faq-15" className="border-border/70">
                    <AccordionTrigger className="text-sm md:text-base hover:no-underline">
                      Can I organize my comics into folders or collections?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      Folder-based organization is not available yet; you can still manage comics from your dashboard and sort by newest activity.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </section>

          <section id="packages" aria-labelledby="packages-heading" className="space-y-6">
            <h2 id="packages-heading" className="text-2xl md:text-3xl font-display font-semibold text-center">
              Packages
            </h2>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <Card
                  key={pkg.title}
                  className={`rounded-xl border ${
                    pkg.featured
                      ? "border-primary/60 bg-gradient-to-b from-primary/15 to-card shadow-[0_10px_35px_rgba(168,85,247,0.2)]"
                      : "border-border/70 bg-card"
                  } transition-all duration-300 hover:-translate-y-1 hover:border-primary/50`}
                >
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-xl font-display font-semibold">{pkg.title}</h3>
                    <p className="text-3xl font-display font-bold">{pkg.price}</p>
                    <p className="text-sm text-muted-foreground">{pkg.detail}</p>
                    <Button asChild className="w-full bg-gradient-to-r from-primary to-[#ec4899] text-primary-foreground hover:opacity-90 shadow-[0_0_20px_rgba(168,85,247,0.28)]">
                      <Link
                        href={getPackageHref(pkg.title, pkg.price)}
                      >
                        Choose Plan
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border/70 bg-gradient-to-r from-card via-muted/40 to-card p-8 md:p-10 text-center shadow-[0_12px_40px_rgba(13,16,36,0.22)]">
            <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Ready to create your comic?</h2>
            <p className="mt-3 text-muted-foreground">
              Jump into the editor and turn your idea into a polished 6-panel story.
            </p>
            <Link href="/editor/new">
              <Button className="mt-6 bg-gradient-to-r from-primary to-[#ec4899] text-primary-foreground px-8 h-11 text-sm md:text-base font-semibold hover:opacity-90 shadow-[0_0_24px_rgba(168,85,247,0.35)]">
                Start Creating
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </section>
        </div>
      </main>
    </PageLayout>
  );
}
