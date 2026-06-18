import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { nanoid } from "nanoid";

const execFileAsync = promisify(execFile);

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

async function magickCommand(): Promise<string> {
  const configured = process.env.IMAGEMAGICK_PATH;
  if (configured) return configured;

  const candidates = [
    "magick",
    "C:\\Program Files\\ImageMagick-7.1.1-Q16-HDRI\\magick.exe",
    "C:\\Program Files\\ImageMagick-7.1.1-Q16\\magick.exe",
  ];
  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ["-version"], { timeout: 10000 });
      return candidate;
    } catch {}
  }

  // Last chance: find whatever winget installed.
  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync("powershell", [
        "-NoProfile",
        "-Command",
        "Get-ChildItem 'C:\\Program Files' -Directory -Filter 'ImageMagick*' | Sort-Object Name -Descending | Select-Object -First 1 | ForEach-Object { Join-Path $_.FullName 'magick.exe' }",
      ], { timeout: 10000 });
      const found = stdout.trim();
      if (found) return found;
    } catch {}
  }

  throw new Error("ImageMagick magick.exe not found. Install ImageMagick or set IMAGEMAGICK_PATH.");
}

async function identifyFrameCount(magick: string, file: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(magick, ["identify", "-format", "%n", file], { timeout: 30000 });
    const nums = stdout.match(/\d+/g)?.map(Number).filter((n) => Number.isFinite(n)) || [];
    return Math.max(1, ...nums);
  } catch {
    return 1;
  }
}

async function convertHeicWithMagick(buf: Buffer, dir: string, id: string): Promise<{ jpg: Buffer; gif?: Buffer; frameCount: number }> {
  const magick = await magickCommand();
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "blog-heic-"));
  const input = path.join(tmp, `${id}.heic`);
  const jpgPath = path.join(tmp, `${id}.jpg`);
  const gifPath = path.join(tmp, `${id}.gif`);
  try {
    await fs.writeFile(input, buf);
    const frameCount = await identifyFrameCount(magick, input);
    await execFileAsync(magick, [input + "[0]", "-auto-orient", "-quality", "88", jpgPath], { timeout: 120000 });
    const jpg = await fs.readFile(jpgPath);
    let gif: Buffer | undefined;
    if (frameCount > 1) {
      try {
        await execFileAsync(magick, [input, "-auto-orient", "-coalesce", "-loop", "0", gifPath], { timeout: 120000 });
        const generatedFrameCount = await identifyFrameCount(magick, gifPath);
        if (generatedFrameCount > 1) gif = await fs.readFile(gifPath);
      } catch {
        // Still-only HEIC or unsupported animation. No play button.
      }
    }
    return { jpg, gif, frameCount };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

export async function saveUpload(file: File): Promise<{ url: string; relPath: string; bytes: number; mime: string; liveUrl?: string; heicFrameCount?: number }> {
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
      const converted = await convertHeicWithMagick(buf, dir, id);
      const jpgFilename = `${id}.jpg`;
      await fs.writeFile(path.join(dir, jpgFilename), converted.jpg);
      let liveUrl: string | undefined;
      if (converted.gif) {
        const gifFilename = `${id}.gif`;
        await fs.writeFile(path.join(dir, gifFilename), converted.gif);
        liveUrl = `${basePath}/uploads/${yyyy}/${mm}/${gifFilename}`;
      }
      return {
        url: `${basePath}/uploads/${yyyy}/${mm}/${jpgFilename}`,
        relPath: `${yyyy}/${mm}/${jpgFilename}`,
        bytes: converted.jpg.length,
        mime: "image/jpeg",
        liveUrl,
        heicFrameCount: converted.frameCount,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Could not convert HEIC/HEIF image with ImageMagick: ${msg}`);
    }
  }

  const ext = EXT_BY_MIME[mime] || "bin";
  const filename = `${id}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buf);
  const url = `${basePath}/uploads/${yyyy}/${mm}/${filename}`;
  return { url, relPath: `${yyyy}/${mm}/${filename}`, bytes: buf.length, mime };
}
