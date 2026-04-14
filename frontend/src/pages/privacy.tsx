import { PageLayout } from "@/components/layout/page-layout";

export default function Privacy() {
  return (
    <PageLayout>
      <main className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-3xl font-display font-bold mb-4">Privacy Policy</h1>
        <p className="text-muted-foreground leading-relaxed">
          We collect only the information required to create your account, generate comics,
          and improve service reliability. We do not sell your personal data. If you need
          details about account data export or deletion, contact support@comicmind.app.
        </p>
      </main>
    </PageLayout>
  );
}
