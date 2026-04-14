/**
 * Cloudinary Image Storage — implements ICloudImageStorage
 *
 * Stores panel images on Cloudinary with automatic CDN delivery,
 * optimised transformations, and folder-based organisation.
 *
 * Required env vars:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * Or the single combined URL:
 *   CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
 */

import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import crypto from "crypto";
import type { ICloudImageStorage, UploadResult } from "./cloud-storage";

export class CloudinaryStorage implements ICloudImageStorage {
  readonly providerName = "cloudinary";

  constructor() {
    // Cloudinary SDK auto-reads CLOUDINARY_URL from env if present.
    // If individual vars are provided, configure explicitly.
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    }
    // else: CLOUDINARY_URL env var is auto-detected by the SDK
  }

  isConfigured(): boolean {
    const cfg = cloudinary.config();
    return !!(cfg.cloud_name && cfg.api_key && cfg.api_secret);
  }

  async uploadFromUrl(
    remoteUrl: string,
    options?: { folder?: string; publicId?: string; transformation?: Record<string, any> },
  ): Promise<UploadResult> {
    const folder = options?.folder || "comicmind/panels";
    const publicId =
      options?.publicId ||
      crypto.createHash("sha256").update(remoteUrl + Date.now()).digest("hex").slice(0, 20);

    const result: UploadApiResponse = await cloudinary.uploader.upload(remoteUrl, {
      folder,
      public_id: publicId,
      resource_type: "image",
      overwrite: true,
      // Default optimisation: auto quality + auto format for CDN
      transformation: options?.transformation || [
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    return this.mapResult(result);
  }

  async uploadFromBuffer(
    buffer: Buffer,
    options?: { folder?: string; publicId?: string; contentType?: string },
  ): Promise<UploadResult> {
    const folder = options?.folder || "comicmind/panels";
    const publicId =
      options?.publicId ||
      crypto.randomBytes(12).toString("hex");

    return new Promise<UploadResult>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: "image",
          overwrite: true,
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error("No result from Cloudinary upload_stream"));
          resolve(this.mapResult(result));
        },
      );
      stream.end(buffer);
    });
  }

  async deleteImage(publicId: string): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
      });
      return result.result === "ok";
    } catch (err) {
      console.error("[cloudinary] deleteImage error:", err);
      return false;
    }
  }

  async deleteFolder(folderPrefix: string): Promise<number> {
    try {
      // List all resources in the folder
      let totalDeleted = 0;
      let nextCursor: string | undefined;

      do {
        const result = await cloudinary.api.resources({
          type: "upload",
          prefix: folderPrefix,
          max_results: 100,
          next_cursor: nextCursor,
        });

        const publicIds = result.resources.map((r: any) => r.public_id);
        if (publicIds.length > 0) {
          await cloudinary.api.delete_resources(publicIds);
          totalDeleted += publicIds.length;
        }

        nextCursor = result.next_cursor;
      } while (nextCursor);

      // Try to remove the now-empty folder itself
      try {
        await cloudinary.api.delete_folder(folderPrefix);
      } catch {
        // folder deletion may fail if not empty — that's ok
      }

      return totalDeleted;
    } catch (err) {
      console.error("[cloudinary] deleteFolder error:", err);
      return 0;
    }
  }

  /** Build a CDN URL with automatic format/quality optimisation */
  getCdnUrl(publicId: string, options?: { width?: number; height?: number }): string {
    const transforms: Record<string, any> = {
      quality: "auto",
      fetch_format: "auto",
    };
    if (options?.width) transforms.width = options.width;
    if (options?.height) transforms.height = options.height;

    return cloudinary.url(publicId, {
      secure: true,
      transformation: [transforms],
    });
  }

  private mapResult(result: UploadApiResponse): UploadResult {
    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      contentType: `image/${result.format}`,
      bytes: result.bytes,
    };
  }
}
