import type { Request, Response } from "express";
import { ComicModel } from "../modules/comics/comic.model";
import sharp from "sharp";
import PDFDocument from "pdfkit";
import fs from "fs";

/* ── Unicode font detection ─────────────────────────────────────────────
 * pdfkit's 14 built-in fonts (Helvetica, Times, Courier …) only support
 * Latin-1.  For Arabic / non-Latin text we MUST register a TrueType font
 * that actually contains those glyphs.
 *
 * We probe common system font paths at startup so there's zero runtime
 * cost per-request.
 * ───────────────────────────────────────────────────────────────────── */
function findSystemFont(bold: boolean): string | null {
  const candidates = bold
    ? [
        "C:\\Windows\\Fonts\\arialbd.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
      ]
    : [
        "C:\\Windows\\Fonts\\arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
      ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        console.log(`[comic-download] Found ${bold ? "bold" : "regular"} system font: ${p}`);
        return p;
      }
    } catch { /* ignore */ }
  }
  return null;
}

const SYSTEM_FONT_REGULAR = findSystemFont(false);
const SYSTEM_FONT_BOLD = findSystemFont(true);

/**
 * Fetch a remote image and return its buffer.
 * Returns null on failure instead of throwing, so one bad panel
 * doesn't break the entire download.
 */
async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[comic-download] Image fetch failed (HTTP ${res.status}): ${url}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    console.log(`[comic-download] Fetched image: ${(buf.length / 1024).toFixed(0)} KB from ${url.slice(0, 120)}`);
    return buf;
  } catch (err) {
    console.error(`[comic-download] Image fetch error for ${url}:`, err);
    return null;
  }
}

/**
 * Create a 1-pixel white PNG placeholder of the given size via sharp.
 */
async function placeholderPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 200, g: 200, b: 200, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

/**
 * Build a single vertical PNG from all panel images.
 * Each panel is resized to a uniform width and stacked vertically.
 */
async function buildPng(imageUrls: string[]): Promise<Buffer> {
  const TARGET_WIDTH = 1024;

  // Download all panels in parallel (null = failed)
  const rawBuffers = await Promise.all(imageUrls.map(fetchImage));

  // Resize each panel — use SEPARATE sharp instances for metadata vs output
  const resized: { buffer: Buffer; width: number; height: number }[] = [];
  for (let i = 0; i < rawBuffers.length; i++) {
    const buf = rawBuffers[i];
    if (!buf) {
      // Use a grey placeholder for failed images
      const ph = await placeholderPng(TARGET_WIDTH, TARGET_WIDTH);
      resized.push({ buffer: ph, width: TARGET_WIDTH, height: TARGET_WIDTH });
      continue;
    }

    // Read original dimensions from a fresh instance
    const meta = await sharp(buf).metadata();
    const origW = meta.width || TARGET_WIDTH;
    const origH = meta.height || TARGET_WIDTH;
    const outputHeight = Math.round(origH * (TARGET_WIDTH / origW));

    // Resize with a NEW sharp instance (never reuse after metadata())
    const outBuf = await sharp(buf)
      .resize(TARGET_WIDTH, outputHeight)
      .png()
      .toBuffer();

    resized.push({ buffer: outBuf, width: TARGET_WIDTH, height: outputHeight });
  }

  const totalHeight = resized.reduce((sum, r) => sum + r.height, 0);

  // Compose all panels vertically on a white canvas
  let yOffset = 0;
  const composites: sharp.OverlayOptions[] = resized.map((r) => {
    const overlay: sharp.OverlayOptions = {
      input: r.buffer,
      top: yOffset,
      left: 0,
    };
    yOffset += r.height;
    return overlay;
  });

  return sharp({
    create: {
      width: TARGET_WIDTH,
      height: totalHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

interface PdfPanel {
  imageUrl: string;
  dialogue: string;
  narration: string;
  num: number;
}

/**
 * Build a PDF with one panel per page, including narration boxes and
 * speech bubbles rendered on top of each panel image.
 *
 * All async I/O is done BEFORE entering the Promise so the PDF
 * generation itself is fully synchronous.
 */
async function buildPdf(
  _title: string,
  panels: PdfPanel[]
): Promise<Buffer> {
  console.log(`[comic-download] Building PDF with ${panels.length} panels`);

  // ── Phase 1: download & convert all images (async) ───────────────
  const imageUrls = panels.map((p) => p.imageUrl);
  const rawBuffers = await Promise.all(imageUrls.map(fetchImage));

  const pages: { pngBuf: Buffer; pageWidth: number; pageHeight: number; panel: PdfPanel }[] = [];
  for (let i = 0; i < rawBuffers.length; i++) {
    const buf = rawBuffers[i];
    const pageWidth = 612;

    if (!buf) {
      console.warn(`[comic-download] Panel ${i + 1}: using placeholder (image fetch failed)`);
      const phBuf = await placeholderPng(pageWidth, pageWidth);
      pages.push({ pngBuf: phBuf, pageWidth, pageHeight: pageWidth, panel: panels[i] });
      continue;
    }

    const meta = await sharp(buf).metadata();
    const imgWidth = meta.width || 1024;
    const imgHeight = meta.height || 1024;
    const scale = pageWidth / imgWidth;
    const pageHeight = Math.round(imgHeight * scale);

    const pngBuf = await sharp(buf).png().toBuffer();
    pages.push({ pngBuf, pageWidth, pageHeight, panel: panels[i] });
    console.log(`[comic-download] Panel ${i + 1}: ${imgWidth}×${imgHeight} → page ${pageWidth}×${pageHeight}`);
  }

  // ── Phase 2: build the PDF synchronously inside the Promise ──────
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
      const chunks: Buffer[] = [];

      // Register Unicode-capable fonts so Arabic / non-Latin text renders
      let narrationFont = "Times-Bold";
      let dialogueFont = "Helvetica-Bold";
      const unicodeFontPath = SYSTEM_FONT_BOLD ?? SYSTEM_FONT_REGULAR;
      if (unicodeFontPath) {
        doc.registerFont("UnicodeFont", unicodeFontPath);
        narrationFont = "UnicodeFont";
        dialogueFont = "UnicodeFont";
        console.log("[comic-download] Using Unicode font for PDF text");
      } else {
        console.warn("[comic-download] No Unicode system font found — non-Latin text may render incorrectly");
      }

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => {
        const result = Buffer.concat(chunks);
        console.log(`[comic-download] PDF built: ${(result.length / 1024 / 1024).toFixed(2)} MB, ${pages.length} pages`);
        resolve(result);
      });
      doc.on("error", (err) => {
        console.error("[comic-download] PDFDocument error:", err);
        reject(err);
      });

      for (const { pngBuf, pageWidth, pageHeight, panel } of pages) {
        doc.addPage({ size: [pageWidth, pageHeight], margin: 0 });
        doc.image(pngBuf, 0, 0, { width: pageWidth, height: pageHeight });

        // ── Draw narration box (yellow, top-left) ───────────────
        if (panel.narration.trim()) {
          const maxW = pageWidth * 0.55;
          const padX = 10;
          const padY = 8;
          const boxX = 14;
          const boxY = 14;

          // Measure text height
          doc.font(narrationFont).fontSize(11);
          const textH = doc.heightOfString(panel.narration, { width: maxW - padX * 2 });
          const boxW = maxW;
          const boxH = textH + padY * 2;

          // Black border shadow
          doc.save();
          doc.rect(boxX + 2, boxY + 2, boxW, boxH).fill("#000000");
          doc.restore();

          // Yellow fill + black border
          doc.save();
          doc.rect(boxX, boxY, boxW, boxH).fill("#FFEB3B");
          doc.rect(boxX, boxY, boxW, boxH).lineWidth(2).stroke("#000000");
          doc.restore();

          // Text — only apply RTL features for pure Arabic (no Latin mixing)
          const narrationHasArabic = /[\u0600-\u06FF]/.test(panel.narration);
          const narrationHasLatin = /[a-zA-Z]/.test(panel.narration);
          const narrationPureRtl = narrationHasArabic && !narrationHasLatin;
          doc.fill("#000000").font(narrationFont).fontSize(11);
          doc.text(panel.narration, boxX + padX, boxY + padY, {
            width: maxW - padX * 2,
            lineGap: 2,
            align: narrationHasArabic ? "right" : "left",
            features: narrationPureRtl ? ["rtla"] : undefined,
          });
        }

        // ── Draw speech bubble (white, bottom-left) ─────────────
        if (panel.dialogue.trim()) {
          const maxW = pageWidth * 0.55;
          const padX = 12;
          const padY = 10;
          const bubbleX = 14;
          const tailH = 12;

          // Measure text height
          doc.font(dialogueFont).fontSize(11);
          const textH = doc.heightOfString(panel.dialogue, { width: maxW - padX * 2 });
          const bubbleH = textH + padY * 2;
          const bubbleY = pageHeight - bubbleH - tailH - 20;
          const radius = 14;

          // Black shadow
          doc.save();
          doc.roundedRect(bubbleX + 2, bubbleY + 2, maxW, bubbleH, radius).fill("#000000");
          doc.restore();

          // White fill + black border
          doc.save();
          doc.roundedRect(bubbleX, bubbleY, maxW, bubbleH, radius).fill("#FFFFFF");
          doc.roundedRect(bubbleX, bubbleY, maxW, bubbleH, radius).lineWidth(2).stroke("#000000");
          doc.restore();

          // Triangle tail
          const tailX = bubbleX + 22;
          const tailY = bubbleY + bubbleH;
          doc.save();
          doc.moveTo(tailX, tailY)
            .lineTo(tailX + 14, tailY)
            .lineTo(tailX + 4, tailY + tailH)
            .closePath()
            .fill("#000000");
          doc.moveTo(tailX + 2, tailY - 1)
            .lineTo(tailX + 11, tailY - 1)
            .lineTo(tailX + 5, tailY + tailH - 4)
            .closePath()
            .fill("#FFFFFF");
          doc.restore();

          // Text — only apply RTL features for pure Arabic (no Latin mixing)
          const dialogueHasArabic = /[\u0600-\u06FF]/.test(panel.dialogue);
          const dialogueHasLatin = /[a-zA-Z]/.test(panel.dialogue);
          const dialoguePureRtl = dialogueHasArabic && !dialogueHasLatin;
          doc.fill("#000000").font(dialogueFont).fontSize(11);
          doc.text(panel.dialogue, bubbleX + padX, bubbleY + padY, {
            width: maxW - padX * 2,
            lineGap: 2,
            align: dialogueHasArabic ? "right" : "left",
            features: dialoguePureRtl ? ["rtla"] : undefined,
          });
        }
      }

      doc.end();
    } catch (err) {
      console.error("[comic-download] PDF creation threw:", err);
      reject(err);
    }
  });
}

/**
 * GET /api/comics/:id/download?format=pdf|png
 *
 * Returns the full comic as a downloadable file.
 */
export async function downloadComic(req: Request, res: Response) {
  try {
    const comicId = String(req.params.id);
    const format = String(req.query.format || "pdf").toLowerCase();

    console.log(`[comic-download] Request: comicId=${comicId} format=${format}`);

    if (format !== "pdf" && format !== "png") {
      return res.status(400).json({ message: "Format must be 'pdf' or 'png'" });
    }

    // Look up the comic — allow both published and unpublished so owners
    // can download their own work even if it's not published yet.
    let comic = await ComicModel.findById(comicId);
    if (!comic) {
      console.error(`[comic-download] Comic not found: ${comicId}`);
      return res.status(404).json({ message: "Comic not found" });
    }

    const rawPanels: any[] = comic.panels || [];
    const sortedPanels = [...rawPanels]
      .sort((a: any, b: any) => (a.number ?? a.panelNumber ?? 0) - (b.number ?? b.panelNumber ?? 0));

    const pdfPanels: PdfPanel[] = sortedPanels
      .filter((p: any) => p.imageUrl)
      .map((p: any, i: number) => ({
        imageUrl: p.imageUrl,
        dialogue: p.dialogue || "",
        narration: p.narration || "",
        num: p.number ?? p.panelNumber ?? i + 1,
      }));

    const imageUrls = pdfPanels.map((p) => p.imageUrl);

    console.log(`[comic-download] Comic "${comic.title}": ${rawPanels.length} panels, ${imageUrls.length} with images`);

    if (imageUrls.length === 0) {
      return res.status(400).json({ message: "No panel images available for download" });
    }

    const safeTitle = comic.title.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "comic";

    if (format === "png") {
      const buffer = await buildPng(imageUrls);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.png"`);
      return res.end(buffer);
    }

    // PDF
    const buffer = await buildPdf(comic.title, pdfPanels);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.pdf"`);
    console.log(`[comic-download] Sending PDF: ${buffer.length} bytes`);
    return res.end(buffer);
  } catch (error: any) {
    console.error("[comic-download] Download failed:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        message: `Failed to generate ${req.query.format || "pdf"}: ${error.message || "unknown error"}`,
      });
    }
  }
}
