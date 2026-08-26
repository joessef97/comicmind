import { Link } from "wouter";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
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
    color: "#d8402f",
  },
  {
    number: "02",
    title: "Tell Your Story",
    description: "Describe your story plot, characters, and key events.",
    image: "/assets/guide/story-screen.svg",
    alt: "Story prompt writing screen",
    color: "#2f4fd8",
  },
  {
    number: "03",
    title: "Choose Your Style",
    description: "Pick a visual style like Anime, Realistic, or Cartoon.",
    image: "/assets/guide/style-screen.svg",
    alt: "Visual style selection screen",
    color: "#f2b32e",
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

const faqs = [
  {
    value: "faq-1",
    question: "Can I create a story with multiple characters?",
    answer:
      "Yes. Add each character in your story description and explain their role to get more coherent panel outcomes.",
  },
  {
    value: "faq-2",
    question: "Do all stories cost the same?",
    answer:
      "Package pricing may vary by plan, but each package clearly shows how many stories you can generate.",
  },
  {
    value: "faq-3",
    question: "Can I change the style after generating?",
    answer:
      "You can regenerate the same story with another style anytime to compare different visual directions.",
  },
  {
    value: "faq-4",
    question: "How long does it take to generate a comic?",
    answer:
      "Most comics finish in a few minutes, depending on demand and the length of your story.",
  },
  {
    value: "faq-5",
    question: "Can I edit my story after generating the comic?",
    answer: "Yes. I can edit the text in the comics.",
  },
  {
    value: "faq-6",
    question: "Can I download or share my comic?",
    answer:
      "Yes. You can download your comic in pdf and png formats and share it with others from the comic page and also on social media like facebook and reddit and x.",
  },
  {
    value: "faq-7",
    question: "What happens if my generation fails?",
    answer: "If generation fails, you can retry without losing your story input.",
  },
  {
    value: "faq-8",
    question: "Are my comics saved to my account?",
    answer: "Yes. Your comics are saved to your account so you can revisit them later.",
  },
  {
    value: "faq-9",
    question: "Can I reuse the same story with different styles?",
    answer: "Yes. You can regenerate the same story with different styles to compare results.",
  },
  {
    value: "faq-10",
    question: "Is there a limit on how many comics I can create?",
    answer:
      "Limits depend on your plan, and each package shows how many stories you can create.",
  },
  {
    value: "faq-11",
    question: "Can I regenerate only one panel instead of the whole comic?",
    answer:
      "Yes. You can retry a single failed or unsatisfactory panel without regenerating the entire comic.",
  },
  {
    value: "faq-12",
    question: "Do you provide credits or refunds if image generation fails?",
    answer:
      "If generation fails due to a system issue, you can retry and contact support for credit or refund help based on your plan.",
  },
  {
    value: "faq-13",
    question: "Is my story prompt private and secure?",
    answer:
      "We treat your prompts as private account content and apply secure access controls so only you can manage your saved comics.",
  },
  {
    value: "faq-14",
    question: "Can I collaborate with another user on the same comic?",
    answer:
      "Real-time collaboration is not available yet, but you can share your comic link or exported file to co-create asynchronously.",
  },
  {
    value: "faq-15",
    question: "Can I organize my comics into folders or collections?",
    answer:
      "Folder-based organization is not available yet; you can still manage comics from your dashboard and sort by newest activity.",
  },
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

  return (
    <PageLayout>
      <main className="bg-[#f2ede1]">
        <div className="container mx-auto max-w-6xl px-4 py-16 md:py-20">
          {/* Masthead */}
          <section className="border-b-4 border-[#12100c] pb-14">
            <p className="label-mono text-[#d8402f]">Getting Started</p>
            <h1 className="mt-4 max-w-4xl font-display text-[46px] uppercase leading-[0.95] text-[#12100c] sm:text-[66px]">
              Create your comic in 3 simple steps
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-[#4a4535]">
              Learn how to create your comic in 3 simple steps
            </p>
          </section>

          {/* Steps as full-width ruled rows */}
          <section aria-labelledby="steps-heading" className="border-b-4 border-[#12100c] py-14">
            <h2
              id="steps-heading"
              className="mb-10 font-display text-[32px] uppercase leading-none text-[#12100c]"
            >
              Step-by-Step Guide
            </h2>

            <div>
              {guideSteps.map((step, index) => (
                <div
                  key={step.number}
                  className={`grid gap-8 py-10 md:grid-cols-[1fr_1.2fr] md:items-center ${
                    index > 0 ? "border-t-[3px] border-[#12100c]" : ""
                  }`}
                >
                  <div>
                    <span
                      className="numeral-outline block text-[60px] leading-none"
                      style={{ color: step.color }}
                    >
                      {step.number}
                    </span>
                    <h3 className="mt-4 font-display text-[28px] uppercase leading-none text-[#12100c]">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-[16px] leading-relaxed text-[#4a4535]">
                      {step.description}
                    </p>
                  </div>
                  <div className="art-placeholder overflow-hidden border-[3px] border-[#12100c]">
                    <img
                      src={step.image}
                      alt={step.alt}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Tips + FAQ */}
          <section className="grid gap-10 border-b-4 border-[#12100c] py-14 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-[32px] uppercase leading-none text-[#12100c]">
                Tips for a Great Story
              </h2>
              <ul className="mt-6 space-y-4">
                {tips.map((tip) => (
                  <li key={tip} className="flex items-start gap-3 text-[16px] leading-relaxed text-[#4a4535]">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#d8402f]" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="font-display text-[32px] uppercase leading-none text-[#12100c]">FAQ</h2>
              <Accordion type="single" collapsible className="mt-6 w-full border-t-[3px] border-[#12100c]">
                {faqs.map((faq) => (
                  <AccordionItem
                    key={faq.value}
                    value={faq.value}
                    className="border-b-[2px] border-[#ddd6c4]"
                  >
                    <AccordionTrigger className="text-[15px] text-[#12100c]">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-[15px] leading-relaxed text-[#4a4535]">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>

          {/* Packages */}
          <section
            id="packages"
            aria-labelledby="packages-heading"
            className="scroll-mt-24 border-b-4 border-[#12100c] py-14"
          >
            <h2
              id="packages-heading"
              className="mb-10 font-display text-[32px] uppercase leading-none text-[#12100c]"
            >
              Packages
            </h2>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <div
                  key={pkg.title}
                  className={`relative flex flex-col border-[3px] border-[#12100c] p-6 ${
                    pkg.featured ? "bg-[#f2b32e] hard-shadow" : "bg-[#f8f5ec]"
                  }`}
                >
                  {pkg.featured && (
                    <span className="absolute -top-[3px] right-4 border-[3px] border-[#12100c] bg-[#12100c] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#f2ede1]">
                      Most Popular
                    </span>
                  )}
                  <h3 className="font-display text-[24px] uppercase leading-none text-[#12100c]">
                    {pkg.title}
                  </h3>
                  <p className="mt-4 font-display text-[46px] leading-none text-[#12100c]">
                    {pkg.price}
                  </p>
                  <p className="mt-4 flex-1 text-[14px] leading-relaxed text-[#4a4535]">
                    {pkg.detail}
                  </p>
                  <Button asChild className="mt-6 w-full">
                    <Link href={getPackageHref(pkg.title, pkg.price)}>Choose Plan</Link>
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* Closing CTA */}
          <section className="mt-14 border-[3px] border-[#12100c] bg-[#12100c] p-8 text-center md:p-12">
            <h2 className="font-display text-[32px] uppercase leading-[0.95] text-[#f2ede1] sm:text-[42px]">
              Ready to create your comic?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-[#a39b8b]">
              Jump into the editor and turn your idea into a polished 6-panel story.
            </p>
            <Link href="/editor/new">
              <Button
                size="lg"
                className="mt-8 border-[3px] border-[#f2ede1] bg-[#d8402f] text-[#f2ede1] shadow-[7px_7px_0_#f2ede1]"
              >
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
