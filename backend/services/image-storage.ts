/**
 * Image Storage Facade
 *
 * Provides a unified API for the rest of the app.
 * Picks the best available backend at startup:
 *   1. Cloudinary  (if CLOUDINARY_* env vars are set)
 *   2. Local disk  (fallback — serves via express.static)
 *
 * Every function in this module delegates to the chosen provider
 * so routes/services never import a provider directly.
 */

import type { ICloudImageStorage, UploadResult } from "./cloud-storage";
import { CloudinaryStorage } from "./cloudinary-storage";
import { LocalDiskStorage } from "./local-disk-storage";
import path from "path";

/* ══════════════════════════════════════════════════════════════════
   Singleton – initialised once on first import
   ══════════════════════════════════════════════════════════════════ */
let _provider: ICloudImageStorage;

function getProvider(): ICloudImageStorage {
  if (_provider) return _provider;

  const cloudinary = new CloudinaryStorage();
  if (cloudinary.isConfigured()) {
    console.log("[image-storage] Using Cloudinary for persistent image storage");
    _provider = cloudinary;
  } else {
    console.log(
      "[image-storage] Cloudinary not configured — falling back to local disk storage.\n" +
      "  Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to enable cloud storage.",
    );
    _provider = new LocalDiskStorage();
  }

  return _provider;
}

/* ══════════════════════════════════════════════════════════════════
   Public API
   ══════════════════════════════════════════════════════════════════ */

export type { UploadResult } from "./cloud-storage";

/**
 * Name of the active storage provider ("cloudinary" | "local-disk").
 */
export function getStorageProviderName(): string {
  return getProvider().providerName;
}

/**
 * Download an image from `remoteUrl` (e.g. a temporary OpenAI link)
 * and persist it to cloud/disk storage.
 *
 * @param remoteUrl   The temporary URL from the image generation provider.
 * @param comicId     Optional comic ID — images are grouped into folders
 *                    per comic for easy batch deletion.
 * @param panelId     Optional panel identifier for the filename.
 * @returns           Persistent CDN/local URL, or `null` on failure.
 */
export async function persistImage(
  remoteUrl: string,
  comicId?: string,
  panelId?: string,
): Promise<UploadResult | null> {
  try {
    const folder = comicId
      ? `comicmind/panels/${comicId}`
      : "comicmind/panels";

    const result = await getProvider().uploadFromUrl(remoteUrl, {
      folder,
      publicId: panelId || undefined,
    });

    return result;
  } catch (err) {
    console.error("[image-storage] persistImage failed:", err);
    return null;
  }
}

/**
 * Persist an image from a Buffer (useful if you already downloaded it).
 */
export async function persistImageBuffer(
  buffer: Buffer,
  comicId?: string,
  panelId?: string,
  contentType?: string,
): Promise<UploadResult | null> {
  try {
    const folder = comicId
      ? `comicmind/panels/${comicId}`
      : "comicmind/panels";

    return await getProvider().uploadFromBuffer(buffer, {
      folder,
      publicId: panelId,
      contentType,
    });
  } catch (err) {
    console.error("[image-storage] persistImageBuffer failed:", err);
    return null;
  }
}

/**
 * Delete a single image by its storage public ID.
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  return getProvider().deleteImage(publicId);
}

/**
 * Delete all images for a given comic.
 */
export async function deleteComicImages(comicId: string): Promise<number> {
  return getProvider().deleteFolder(`comicmind/panels/${comicId}`);
}

/**
 * Check whether a URL is already stored in our persistent storage
 * (either a Cloudinary CDN URL or a local /uploads/ path).
 */
export function isPersistedUrl(url: string): boolean {
  if (!url) return false;
  // Local disk paths
  if (url.startsWith("/uploads/")) return true;
  // Cloudinary CDN
  if (url.includes("res.cloudinary.com")) return true;
  return false;
}

/**
 * Get the absolute filesystem path for the local uploads root.
 * (Used by express.static in routes.ts)
 */
export function getUploadsRoot(): string {
  return path.resolve(process.cwd(), "uploads");
}

/* ══════════════════════════════════════════════════════════════════
   Legacy aliases (backward-compatible with old callers)
   ══════════════════════════════════════════════════════════════════ */

/** @deprecated Use `persistImage()` instead. */
export async function downloadAndSaveImage(
  remoteUrl: string,
): Promise<string | null> {
  const result = await persistImage(remoteUrl);
  return result ? result.url : null;
}

/** @deprecated Use `isPersistedUrl()` instead. */
export function isLocalUrl(url: string): boolean {
  return isPersistedUrl(url);
}
