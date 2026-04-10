/**
 * lib/storage.ts — File storage abstraction
 *
 * Swappable storage backend. v1 uses the local filesystem.
 * To switch to MinIO/S3, replace saveFile / getFileStream / deleteFile
 * without touching any API route.
 *
 * storagePath returned by saveFile is a RELATIVE filename (not absolute).
 * Store it in the DB as-is. Never expose it to the client.
 * Reconstruct the absolute path by joining with UPLOAD_DIR at read time.
 *
 * UPLOAD_DIR env var (default: ./uploads relative to project root).
 * In Docker, mount a bind volume at this path.
 *
 * Note: Vercel serverless functions have a 4.5MB (hobby) / 50MB (Pro) payload
 * limit regardless of this setting. For large uploads, use Docker/self-hosted.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "uploads");

async function ensureUploadDir(): Promise<void> {
  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
}

/**
 * Save a file buffer to the upload directory.
 * Returns:
 *   storagePath — relative filename (safe to persist in DB)
 *   sha256      — hex digest computed from the buffer
 *
 * The mimeType parameter is accepted for future MinIO/S3 compatibility
 * (object metadata / Content-Type header on PUT). Not used for local storage.
 */
export async function saveFile(
  buffer: Buffer,
  originalFilename: string,
  _mimeType: string
): Promise<{ storagePath: string; sha256: string }> {
  await ensureUploadDir();

  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const ext = path.extname(originalFilename).toLowerCase();
  const storedFilename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  const absolutePath = path.join(UPLOAD_DIR, storedFilename);

  await fs.promises.writeFile(absolutePath, buffer);

  return { storagePath: storedFilename, sha256 };
}

/**
 * Open a ReadStream for a stored file.
 * storagePath must be the relative filename returned by saveFile.
 * Validates that the resolved absolute path stays within UPLOAD_DIR
 * (prevents directory traversal).
 */
export function getFileStream(storagePath: string): fs.ReadStream {
  const absolutePath = path.resolve(UPLOAD_DIR, storagePath);
  const resolvedDir = path.resolve(UPLOAD_DIR);

  if (
    !absolutePath.startsWith(resolvedDir + path.sep) &&
    absolutePath !== resolvedDir
  ) {
    throw new Error("Invalid storage path");
  }

  return fs.createReadStream(absolutePath);
}

/**
 * Delete a stored file from the upload directory.
 */
export async function deleteFile(storagePath: string): Promise<void> {
  const absolutePath = path.resolve(UPLOAD_DIR, storagePath);
  const resolvedDir = path.resolve(UPLOAD_DIR);

  if (!absolutePath.startsWith(resolvedDir + path.sep)) {
    throw new Error("Invalid storage path");
  }

  await fs.promises.unlink(absolutePath);
}
