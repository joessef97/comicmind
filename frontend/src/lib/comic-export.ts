/**
 * Captures the ComicExportView DOM node as a PNG blob using html2canvas.
 *
 * html2canvas reads computed styles and paints directly onto a <canvas>,
 * avoiding the SVG foreignObject serialization that causes html-to-image
 * to produce blank output when elements have opacity:0 or are offscreen.
 */
export async function captureExportRef(
  exportRef: React.RefObject<HTMLDivElement | null>
): Promise<Blob> {
  const { default: html2canvas } = await import("html2canvas");
  const el = exportRef.current;

  // ── Debug: verify the ref exists ────────────────────────
  console.log("[comic-export] exportRef.current exists:", !!el);

  if (!el) {
    throw new Error("Export container ref is not attached — nothing to capture.");
  }

  // ── Debug: inspect what's inside the export DOM ─────────
  const imgs = el.querySelectorAll("img");
  const textBlocks = el.querySelectorAll("p, h1, span");
  console.log("[comic-export] innerHTML length:", el.innerHTML.length);
  console.log("[comic-export] <img> tags found:", imgs.length);
  console.log("[comic-export] text blocks (p/h1/span):", textBlocks.length);

  // Log every image src + load status
  imgs.forEach((img, i) => {
    console.log(
      `[comic-export] img[${i}] loaded=${img.complete} naturalWidth=${img.naturalWidth} src=${img.src.slice(0, 120)}`
    );
  });

  // ── Wait for every image to fully decode ────────────────
  await Promise.all(
    Array.from(imgs).map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return img.decode().catch(() => {
        console.warn("[comic-export] decode() failed for:", img.src.slice(0, 100));
      });
    })
  );

  // ── Temporarily make the container visible for html2canvas ──
  // html2canvas needs the element to have real computed layout and non-zero
  // opacity so it can read colors, dimensions, and positions.
  const prevOpacity = el.style.opacity;
  const prevOverflow = el.style.overflow;
  el.style.opacity = "1";
  el.style.overflow = "visible";

  // Force layout reflow
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  el.offsetHeight;

  const computedW = el.scrollWidth;
  const computedH = el.scrollHeight;
  console.log(`[comic-export] Container size: ${computedW}×${computedH}`);

  if (computedH < 50) {
    el.style.opacity = prevOpacity;
    el.style.overflow = prevOverflow;
    throw new Error("Export container has no rendered content.");
  }

  try {
    // ── Capture with html2canvas ──────────────────────────────
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff",
      width: computedW,
      height: computedH,
      useCORS: true,
      allowTaint: false,
      logging: true, // enables html2canvas internal logging for debugging
    });

    console.log(
      `[comic-export] Canvas captured: ${canvas.width}×${canvas.height}`
    );

    // Convert canvas → blob
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log(`[comic-export] PNG blob size: ${blob.size} bytes`);
            resolve(blob);
          } else {
            reject(new Error("canvas.toBlob returned null"));
          }
        },
        "image/png",
        1.0
      );
    });
  } finally {
    // Restore hidden state
    el.style.opacity = prevOpacity;
    el.style.overflow = prevOverflow;
  }
}
