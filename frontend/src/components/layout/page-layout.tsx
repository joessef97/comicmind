import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function PageLayout({ children, className, contentClassName }: PageLayoutProps) {
  return (
    // `light` pins the paper tokens; pages with ink chrome pass `dark`, which is
    // declared later in index.css and therefore wins.
    <div className={cn("light min-h-screen flex flex-col bg-background", className)}>
      <Navbar />
      <div className={cn("flex-1", contentClassName)}>{children}</div>
      <Footer />
    </div>
  );
}
