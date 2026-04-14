import { PageLayout } from "@/components/layout/page-layout";

export default function NotFound() {
  return (
    <PageLayout>
      <main className="container mx-auto px-4 py-20 flex-1 flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h1 className="text-3xl font-bold">404</h1>
          <p className="mt-2 text-sm opacity-80">Page not found.</p>
        </div>
      </main>
    </PageLayout>
  );
}
