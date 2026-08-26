import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/page-layout";

export default function NotFound() {
  return (
    <PageLayout>
      <main className="dark halftone relative flex flex-1 items-center justify-center overflow-hidden bg-[#12100c] px-4 py-24">
        <div className="relative z-10 flex flex-col items-center gap-6 text-center">
          <span
            className="numeral-outline numeral-outline-paper text-[104px] leading-none text-[#d8402f]"
          >
            404
          </span>
          <p className="label-mono text-[#a39b8b]">Page not found.</p>
          <Link href="/browse">
            <Button
              variant="outline"
              size="lg"
              className="border-[#f2ede1] text-[#f2ede1] hover:bg-[#f2ede1] hover:text-[#12100c]"
            >
              Back to Browse
            </Button>
          </Link>
        </div>
      </main>
    </PageLayout>
  );
}
