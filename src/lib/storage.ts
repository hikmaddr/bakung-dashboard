import path from "path";
import fs from "fs";
import { put } from "@vercel/blob";

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
  const originalName = (file as any).name || "upload";
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
    } catch (err: any) {
      // Provide clearer feedback for common token / permission issues
      const msg = String(err?.message || err);
      if (/unauthorized|forbidden|token/i.test(msg)) {
        throw new Error(
          `Blob upload failed: ${msg}. Verify BLOB_READ_WRITE_TOKEN in Vercel env and redeploy.`
        );
      }
      throw new Error(`Blob upload failed: ${msg}`);
    }
  }

  // Local filesystem fallback (works in dev; not persistent on serverless)
  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  const targetDir = path.join(uploadsRoot, prefix);
  ensureDir(targetDir);
  const targetPath = path.join(targetDir, filename);
  fs.writeFileSync(targetPath, buffer);

  const publicUrl = `/uploads/${prefix}${filename}`;
  return { url: publicUrl, filename, size, contentType };
}
