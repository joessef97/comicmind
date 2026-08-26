import { useState, useCallback } from "react";
import {
  FacebookShareButton,
  RedditShareButton,
  TwitterShareButton,
  FacebookIcon,
  RedditIcon,
  XIcon,
} from "react-share";
import { Link2, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ShareButtonsProps {
  comicId: string;
  title: string;
  description?: string;
  imageUrl?: string;
  onShareCountUpdated?: (shares: number) => void;
}

const BASE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://comicmind.app";

export function ShareButtons({
  comicId,
  title,
  description,
  imageUrl,
  onShareCountUpdated,
}: ShareButtonsProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const shareUrl = `${BASE_URL}/comic/${comicId}`;

  const trackShare = useCallback(async () => {
    try {
      const res = await apiRequest("POST", `/api/comics/${comicId}/share`);
      const data = await res.json();
      onShareCountUpdated?.(data.shares);
    } catch {
      // silent – share tracking is best-effort
    }
  }, [comicId, onShareCountUpdated]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Link copied to clipboard!" });
      trackShare();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy link", variant: "destructive" });
    }
  }, [shareUrl, toast, trackShare]);

  const handleDownloadForInstagram = useCallback(async () => {
    if (!imageUrl) {
      toast({ title: "No image available to download", variant: "destructive" });
      return;
    }
    setDownloading(true);
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_comicmind.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Image downloaded! Upload it to Instagram." });
      trackShare();
    } catch {
      toast({ title: "Failed to download image", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }, [imageUrl, title, toast, trackShare]);

  const iconSize = 36;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FacebookShareButton url={shareUrl} title={title} beforeOnClick={trackShare}>
        <FacebookIcon size={iconSize} round />
      </FacebookShareButton>

      <TwitterShareButton url={shareUrl} title={title} beforeOnClick={trackShare}>
        <XIcon size={iconSize} round />
      </TwitterShareButton>

      <RedditShareButton url={shareUrl} title={title} beforeOnClick={trackShare}>
        <RedditIcon size={iconSize} round />
      </RedditShareButton>

      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-1.5 px-4"
        onClick={handleCopyLink}
      >
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Link2 className="w-4 h-4" />}
        {copied ? "Copied!" : "Copy Link"}
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-1.5 px-4"
        onClick={handleDownloadForInstagram}
        disabled={downloading || !imageUrl}
      >
        <Download className="w-4 h-4" />
        {downloading ? "Downloading…" : "Download for Instagram"}
      </Button>
    </div>
  );
}
