import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function isAllowedMime(m: string) {
  return ALLOWED_MIME.has(m);
}

export function uploadsDir(): string {
  if (process.env.UPLOADS_DIR) return path.resolve(process.env.UPLOADS_DIR);
  return path.resolve(process.cwd(), "public", "uploads");
}

export async function saveUpload(file: File): Promise<{ url: string; relPath: string; bytes: number; mime: string }> {
  if (!isAllowedMime(file.type)) throw new Error(`Unsupported file type: ${file.type}`);
  const ext = EXT_BY_MIME[file.type] || "bin";
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const id = nanoid(10);
  const filename = `${id}.${ext}`;
  const dir = path.join(uploadsDir(), yyyy, mm);
  await fs.mkdir(dir, { recursive: true });
  const filepath = path.join(dir, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filepath, buf);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const url = `${basePath}/uploads/${yyyy}/${mm}/${filename}`;
  return { url, relPath: `${yyyy}/${mm}/${filename}`, bytes: buf.length, mime: file.type };
}
