/**
 * Local Disk Image Storage — implements ICloudImageStorage
 *
 * Fallback provider that stores images on the server filesystem under
 * `uploads/panels/`. Useful when Cloudinary (or another cloud provider)
 * is not configured.
 *
 * Images are served via `express.static("/uploads", …)` registered in
 * routes.ts, so the returned URL is like `/uploads/panels/<hash>.png`.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { ICloudImageStorage, UploadResult } from "./cloud-storage";

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
const PANELS_DIR = path.join(UPLOADS_ROOT, "panels");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(PANELS_DIR);

export class LocalDiskStorage implements ICloudImageStorage {
  readonly providerName = "local-disk";

  isConfigured(): boolean {
    // Always available — it's the fallback
    return true;
  }

  async uploadFromUrl(
    remoteUrl: string,
    options?: { folder?: string; publicId?: string },
  ): Promise<UploadResult> {
    const response = await fetch(remoteUrl);
    if (!response.ok) {
      throw new Error(
        `[local-disk] Failed to download image: HTTP ${response.status}`,
      );
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = Buffer.from(await response.arrayBuffer());

    return this.saveBuffer(buffer, contentType, options);
  }

  async uploadFromBuffer(
    buffer: Buffer,
    options?: { folder?: string; publicId?: string; contentType?: string },
  ): Promise<UploadResult> {
    return this.saveBuffer(buffer, options?.contentType || "image/png", options);
  }

  async deleteImage(publicId: string): Promise<boolean> {
    // publicId for local storage is the relative path, e.g. "panels/abc123.png"
    const filePath = path.join(UPLOADS_ROOT, publicId);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[local-disk] deleteImage error:", err);
      return false;
    }
  }

  async deleteFolder(folderPrefix: string): Promise<number> {
    const dir = path.join(UPLOADS_ROOT, folderPrefix);
    if (!fs.existsSync(dir)) return 0;

    let count = 0;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const full = path.join(dir, file);
        if (fs.statSync(full).isFile()) {
          fs.unlinkSync(full);
          count++;
        }
      }
      // Remove the directory if now empty
      try { fs.rmdirSync(dir); } catch { /* not empty */ }
    } catch (err) {
      console.error("[local-disk] deleteFolder error:", err);
    }
    return count;
  }

  /* ─────────── Private helpers ─────────── */

  private saveBuffer(
    buffer: Buffer,
    contentType: string,
    options?: { folder?: string; publicId?: string },
  ): UploadResult {
    const ext = contentType.includes("jpeg") || contentType.includes("jpg")
      ? ".jpg"
      : contentType.includes("webp")
        ? ".webp"
        : ".png";

    // Determine sub-folder (e.g. "comicmind/panels" or a comic-specific folder)
    const subFolder = options?.folder
      ? options.folder.replace(/^comicmind\//, "")
      : "panels";

    const targetDir = path.join(UPLOADS_ROOT, subFolder);
    ensureDir(targetDir);

    const id =
      options?.publicId ||
      crypto.createHash("sha256")
        .update(crypto.randomBytes(16))
        .digest("hex")
        .slice(0, 24);

    const filename = `${id}${ext}`;
    const filePath = path.join(targetDir, filename);
    fs.writeFileSync(filePath, buffer);

    const publicId = `${subFolder}/${filename}`;
    const url = `/uploads/${publicId}`;

    console.log(`[local-disk] Saved image: ${url}`);

    return {
      url,
      publicId,
      contentType,
      bytes: buffer.length,
    };
  }
}
