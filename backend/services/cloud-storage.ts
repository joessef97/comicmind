/**
 * Cloud Image Storage — Abstract Interface
 *
 * Any storage backend (Cloudinary, S3, Firebase, local disk) implements
 * this interface so the rest of the app is decoupled from the provider.
 */

export interface UploadResult {
  /** Publicly accessible URL (CDN-backed for cloud providers) */
  url: string;
  /** Provider-specific asset identifier (used for deletion) */
  publicId: string;
  /** Image width in pixels (if available) */
  width?: number;
  /** Image height in pixels (if available) */
  height?: number;
  /** Content type (e.g. "image/png") */
  contentType?: string;
  /** File size in bytes */
  bytes?: number;
}

export interface ICloudImageStorage {
  /** Human-readable provider name */
  readonly providerName: string;

  /**
   * Upload an image from a remote URL (e.g. a temporary OpenAI link)
   * to persistent storage. Returns a permanent URL + asset metadata.
   */
  uploadFromUrl(
    remoteUrl: string,
    options?: {
      /** Folder path inside the storage bucket (e.g. "comics/abc123") */
      folder?: string;
      /** Optional custom public ID (without extension) */
      publicId?: string;
      /** Transformation / resize options */
      transformation?: Record<string, any>;
    },
  ): Promise<UploadResult>;

  /**
   * Upload an image from a local Buffer.
   */
  uploadFromBuffer(
    buffer: Buffer,
    options?: {
      folder?: string;
      publicId?: string;
      contentType?: string;
    },
  ): Promise<UploadResult>;

  /**
   * Delete a single image by its provider-specific public ID.
   * Returns `true` if deleted, `false` if not found.
   */
  deleteImage(publicId: string): Promise<boolean>;

  /**
   * Delete all images inside a folder prefix.
   * Useful when deleting an entire comic.
   */
  deleteFolder(folderPrefix: string): Promise<number>;

  /**
   * Check whether this provider is properly configured.
   */
  isConfigured(): boolean;
}
