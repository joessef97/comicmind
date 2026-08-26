import { PageLayout } from "@/components/layout/page-layout";

export default function Privacy() {
  return (
    <PageLayout>
      <main className="mx-auto max-w-[560px] px-4 py-20">
        <h1 className="mb-6 border-b-4 border-[#12100c] pb-4 font-display text-[44px] uppercase leading-[0.95] text-[#12100c]">
          Privacy Policy
        </h1>
        <p className="text-[16px] leading-[1.7] text-[#4a4535]">
          We collect only the information required to create your account, generate comics,
          and improve service reliability. We do not sell your personal data. If you need
          details about account data export or deletion, contact support@comicmind.app.
        </p>
      </main>
    </PageLayout>
  );
}
