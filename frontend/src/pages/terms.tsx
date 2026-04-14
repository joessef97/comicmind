import { PageLayout } from "@/components/layout/page-layout";

export default function Terms() {
  return (
    <PageLayout>
      <main className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-3xl font-display font-bold mb-4">Terms of Service</h1>
        <p className="text-muted-foreground leading-relaxed">
          By using ComicMind, you agree not to generate harmful or illegal content, to keep
          your account credentials secure, and to follow applicable laws in your region.
          Service availability and features may change as the platform evolves.
        </p>
      </main>
    </PageLayout>
  );
}
