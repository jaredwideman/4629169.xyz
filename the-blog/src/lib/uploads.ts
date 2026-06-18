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
  "image/heic",
  "image/heif",
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
  "image/heic": "heic",
  "image/heif": "heif",
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

export async function saveUpload(file: File): Promise<{ url: string; relPath: string; bytes: number; mime: string; liveUrl?: string }> {
  const fileLooksHeic = /\.(heic|heif)$/i.test(file.name);
  const mime = file.type || (fileLooksHeic ? "image/heic" : "");
  if (!isAllowedMime(mime)) throw new Error(`Unsupported file type: ${file.type || file.name}`);

  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const id = nanoid(10);
  const dir = path.join(uploadsDir(), yyyy, mm);
  await fs.mkdir(dir, { recursive: true });
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const buf = Buffer.from(await file.arrayBuffer());

  if (mime === "image/heic" || mime === "image/heif") {
    try {
      // iPhone HEIC/Live Photo files can exceed libheif's conservative default
      // reference limits. This app only accepts authenticated uploads, so allow
      // libheif to process larger-but-legitimate personal media files.
      process.env.LIBHEIF_SECURITY_LIMITS = process.env.LIBHEIF_SECURITY_LIMITS || "off";
      const { default: sharp } = await import("sharp");
      const image = sharp(buf, { animated: true });
      const meta = await image.metadata();
      const jpg = await sharp(buf, { page: 0 }).rotate().jpeg({ quality: 88 }).toBuffer();
      const jpgFilename = `${id}.jpg`;
      await fs.writeFile(path.join(dir, jpgFilename), jpg);

      let liveUrl: string | undefined;
      if ((meta.pages || 1) > 1) {
        try {
          const gif = await sharp(buf, { animated: true }).rotate().gif().toBuffer();
          const gifFilename = `${id}.gif`;
          await fs.writeFile(path.join(dir, gifFilename), gif);
          liveUrl = `${basePath}/uploads/${yyyy}/${mm}/${gifFilename}`;
        } catch {
          // Some HEICs decode as stills only. That's fine: no play button.
        }
      }

      return {
        url: `${basePath}/uploads/${yyyy}/${mm}/${jpgFilename}`,
        relPath: `${yyyy}/${mm}/${jpgFilename}`,
        bytes: jpg.length,
        mime: "image/jpeg",
        liveUrl,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Could not convert HEIC/HEIF image: ${msg}`);
    }
  }

  const ext = EXT_BY_MIME[mime] || "bin";
  const filename = `${id}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buf);
  const url = `${basePath}/uploads/${yyyy}/${mm}/${filename}`;
  return { url, relPath: `${yyyy}/${mm}/${filename}`, bytes: buf.length, mime };
}
