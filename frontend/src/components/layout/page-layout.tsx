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
    <div className={cn("min-h-screen flex flex-col bg-background", className)}>
      <Navbar />
      <div className={cn("flex-1", contentClassName)}>{children}</div>
      <Footer />
    </div>
  );
}
