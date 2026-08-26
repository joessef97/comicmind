import { useState, useCallback, useRef, useEffect } from "react";
import {
  FacebookShareButton,
  FacebookIcon,
  TwitterShareButton,
  TwitterIcon,
  RedditShareButton,
  RedditIcon,
} from "react-share";
import { Link2, Download, Check, ChevronDown, FileImage, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { captureExportRef } from "@/lib/comic-export";

interface ShareButtonsProps {
  comicId: string;
  title: string;
  description?: string;
  exportRef: React.RefObject<HTMLDivElement | null>;
  prepareExport?: () => Promise<void>;
  onShareCountUpdate?: (shares: number) => void;
  onDownloadCountUpdate?: (downloads: number) => void;
}

const BASE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://comicmind.com";

export function ShareButtons({
  comicId,
  title,
  description,
  exportRef,
  prepareExport,
  onShareCountUpdate,
  onDownloadCountUpdate,
}: ShareButtonsProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<"pdf" | "png" | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const shareUrl = `${BASE_URL}/comic/${comicId}`;
  const shareText = description || `Check out "${title}" on ComicMind!`;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  const trackShare = useCallback(async () => {
    try {
      const res = await apiRequest("POST", `/api/comics/${comicId}/share`);
      const data = await res.json();
      onShareCountUpdate?.(data.shares);
    } catch {
      // Silent — share tracking failures should not interrupt UX
    }
  }, [comicId, onShareCountUpdate]);

  const trackDownload = useCallback(async () => {
    try {
      const res = await apiRequest("POST", `/api/comics/${comicId}/download-track`);
      const data = await res.json();
      onDownloadCountUpdate?.(data.downloads);
    } catch {
      // Silent — download tracking failures should not interrupt UX
    }
  }, [comicId, onDownloadCountUpdate]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Link copied to clipboard" });
      trackShare();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Failed to copy link",
        variant: "destructive",
      });
    }
  }, [shareUrl, toast, trackShare]);

  const handleDownload = useCallback(async (format: "pdf" | "png") => {
    setDropdownOpen(false);
    setDownloading(format);
    try {
      if (format === "png") {
        // Client-side capture of the dedicated export component via ref
        await prepareExport?.();
        const blob = await captureExportRef(exportRef);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_comicmind.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Comic downloaded as PNG" });
        trackDownload();
        return;
      }

      // PDF — still uses backend
      console.log(`[share-buttons] PDF download: comicId=${comicId}`);
      const res = await fetch(`/api/comics/${comicId}/download?format=pdf`);
      console.log(`[share-buttons] PDF response: status=${res.status} type=${res.headers.get("Content-Type")} length=${res.headers.get("Content-Length")}`);
      if (!res.ok) {
        const errText = await res.text();
        console.error("[share-buttons] PDF error response:", errText);
        let msg = "Download failed";
        try { msg = JSON.parse(errText).message || msg; } catch {}
        throw new Error(msg);
      }
      const contentType = res.headers.get("Content-Type") || "";
      if (contentType.includes("application/json")) {
        const body = await res.json();
        throw new Error(body.message || "Server returned an error instead of a file");
      }
      const blob = await res.blob();
      console.log(`[share-buttons] PDF blob: size=${blob.size} type=${blob.type}`);
      if (blob.size === 0) {
        throw new Error("Received empty PDF from server");
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_comicmind.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Comic downloaded as PDF" });
      trackDownload();
    } catch (err: any) {
      console.error("[share-buttons] Download failed:", err);
      toast({
        title: err?.message || "Failed to download comic",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  }, [comicId, title, exportRef, prepareExport, toast, trackDownload]);

  const iconSize = 36;
  const iconRound = true;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FacebookShareButton
        url={shareUrl}
        title={title}
        beforeOnClick={trackShare}
      >
        <FacebookIcon size={iconSize} round={iconRound} />
      </FacebookShareButton>

      <TwitterShareButton
        url={shareUrl}
        title={shareText}
        beforeOnClick={trackShare}
      >
        <TwitterIcon size={iconSize} round={iconRound} />
      </TwitterShareButton>

      <RedditShareButton
        url={shareUrl}
        title={title}
        beforeOnClick={trackShare}
      >
        <RedditIcon size={iconSize} round={iconRound} />
      </RedditShareButton>

      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-2 border-[2px] border-[#12100c] text-[#12100c] hover:bg-[#12100c] hover:text-[#f2ede1]"
        onClick={handleCopyLink}
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-400" />
        ) : (
          <Link2 className="w-4 h-4" />
        )}
        {copied ? "Copied" : "Copy Link"}
      </Button>

      {/* Download dropdown */}
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 border-[2px] border-[#12100c] text-[#12100c] hover:bg-[#12100c] hover:text-[#f2ede1]"
          onClick={() => setDropdownOpen((o) => !o)}
          disabled={!!downloading}
        >
          {downloading ? (
            <span className="h-4 w-4 animate-spin border-2 border-current border-t-transparent" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {downloading ? `Downloading ${downloading.toUpperCase()}…` : "Download"}
          {!downloading && <ChevronDown className="w-3 h-3 ml-0.5" />}
        </Button>

        {dropdownOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] border-[3px] border-[#12100c] bg-[#f8f5ec] p-1">
            <button
              className="flex w-full items-center gap-2 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[#12100c] transition-colors hover:bg-[#ddd6c4]"
              onClick={() => handleDownload("png")}
            >
              <FileImage className="w-4 h-4" />
              Download PNG
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[#12100c] transition-colors hover:bg-[#ddd6c4]"
              onClick={() => handleDownload("pdf")}
            >
              <FileText className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
