import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type DisplayImageVariant = "thumb" | "card" | "reader";

const CLOUDINARY_TRANSFORMS: Record<DisplayImageVariant, string> = {
  thumb: "f_auto,q_auto:good,w_480,c_limit",
  card: "f_auto,q_auto:good,w_800,c_limit",
  reader: "f_auto,q_auto:good,w_1400,c_limit",
};

/**
 * Build display-only Cloudinary transforms while preserving original URLs for export.
 * Non-Cloudinary URLs pass through unchanged.
 */
export function getDisplayImageUrl(url: string | undefined, variant: DisplayImageVariant): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return url;
  }

  // Keep export path untouched: only call this helper in on-screen components.
  if (url.includes(`/${CLOUDINARY_TRANSFORMS[variant]}/`)) {
    return url;
  }

  return url.replace(
    "/upload/",
    `/upload/${CLOUDINARY_TRANSFORMS[variant]}/`,
  );
}
