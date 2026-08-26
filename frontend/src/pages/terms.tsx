import { PageLayout } from "@/components/layout/page-layout";

export default function Terms() {
  return (
    <PageLayout>
      <main className="mx-auto max-w-[560px] px-4 py-20">
        <h1 className="mb-6 border-b-4 border-[#12100c] pb-4 font-display text-[44px] uppercase leading-[0.95] text-[#12100c]">
          Terms of Service
        </h1>
        <p className="text-[16px] leading-[1.7] text-[#4a4535]">
          By using ComicMind, you agree not to generate harmful or illegal content, to keep
          your account credentials secure, and to follow applicable laws in your region.
          Service availability and features may change as the platform evolves.
        </p>
      </main>
    </PageLayout>
  );
}
