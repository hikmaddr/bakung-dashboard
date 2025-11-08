import path from "path";
import fs from "fs";
import { put } from "@vercel/blob";
import { del as blobDel } from "@vercel/blob";

type SaveOptions = {
  prefix?: string; // e.g. "avatars/" or "logos/"
  allowedContentTypes?: string[];
  maxSizeBytes?: number;
};

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export async function saveFile(
  file: File,
  opts: SaveOptions = {}
): Promise<{ url: string; filename: string; size: number; contentType: string }> {
  const { prefix = "", allowedContentTypes, maxSizeBytes } = opts;

  const contentType = file.type || "application/octet-stream";
  const size = file.size || 0;

  if (allowedContentTypes && allowedContentTypes.length > 0) {
    if (!allowedContentTypes.includes(contentType)) {
      throw new Error(`File type not allowed: ${contentType}`);
    }
  }

  if (maxSizeBytes && size > maxSizeBytes) {
    throw new Error(`File too large: ${size} > ${maxSizeBytes}`);
  }

  // Create a safe filename preserving extension
  const originalName = file.name || "upload";
  const ext = path.extname(originalName) || "";
  const base = path.basename(originalName, ext);
  const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, "_");
  const timestamp = Date.now();
  const filename = `${safeBase}_${timestamp}${ext}`;

  // Prefer Vercel Blob if token exists (production-safe persistent storage)
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (hasBlobToken) {
    try {
      const blobPath = `${prefix}${filename}`;
      const { url } = await put(blobPath, buffer, {
        access: "public",
        contentType,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      return { url, filename, size, contentType };
    } catch (err: unknown) {
      // Provide clearer feedback for common token / permission issues
      const msg = err instanceof Error ? err.message : String(err);
      if (/unauthorized|forbidden|token/i.test(msg)) {
        throw new Error(
          `Blob upload failed: ${msg}. Verify BLOB_READ_WRITE_TOKEN in Vercel env and redeploy.`
        );
      }
      throw new Error(`Blob upload failed: ${msg}`);
    }
  }

  // Local filesystem fallback (works in dev; NOT suitable on Vercel serverless)
  // Prevent EROFS on Vercel by requiring Blob token in production
  if (process.env.VERCEL) {
    throw new Error(
      "Blob token belum dikonfigurasi. Set BLOB_READ_WRITE_TOKEN di Vercel Project Environment untuk mengaktifkan upload yang persisten."
    );
  }

  // Development-only local write
  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  const targetDir = path.join(uploadsRoot, prefix);
  ensureDir(targetDir);
  const targetPath = path.join(targetDir, filename);
  fs.writeFileSync(targetPath, buffer);

  const publicUrl = `/uploads/${prefix}${filename}`;
  return { url: publicUrl, filename, size, contentType };
}

/**
 * Delete a previously stored file.
 * - If the URL points to Vercel Blob, use Blob API (requires BLOB_READ_WRITE_TOKEN).
 * - If the URL is a local `/uploads/...` path, unlink from `public/uploads`.
 * Returns `true` if deletion appears successful, `false` if skipped or not found.
 */
export async function deleteFile(
  urlOrPath: string | null | undefined
): Promise<boolean> {
  try {
    const url = (urlOrPath || "").toString().trim();
    if (!url) return false;

    // Handle blob public URLs
    if (/^https?:\/\//i.test(url)) {
      const host = (() => {
        try {
          return new URL(url).host;
        } catch {
          return "";
        }
      })();
      if (
        /blob\.vercel-storage\.com|public\.blob\.vercel-storage\.com/i.test(
          host
        )
      ) {
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          // Cannot delete without token; skip gracefully
          return false;
        }
        try {
          await blobDel(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
          return true;
        } catch (_err) {
          // Fall through; report false but do not throw
          return false;
        }
      }
      // Non-blob remote URL: nothing to do
      return false;
    }

    // Handle local uploads path
    // Accept forms like "/uploads/.." or "uploads/.."
    const uploadsMatch = url.replace(/^\/+/, "");
    if (uploadsMatch.startsWith("uploads/")) {
      const targetPath = path.join(process.cwd(), "public", uploadsMatch);
      try {
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }

    return false;
  } catch {
    return false;
  }
}
