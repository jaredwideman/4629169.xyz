import fs from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { uploadsDir } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};

function streamFromNode(stream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      stream.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      (stream as fs.ReadStream).destroy?.();
    },
  });
}

async function serve(req: NextRequest, method: "GET" | "HEAD", parts: string[]) {
  const root = uploadsDir();
  const filepath = path.resolve(root, ...parts);

  // Prevent path traversal.
  if (!filepath.startsWith(root + path.sep)) {
    return new NextResponse("Not found", { status: 404 });
  }

  let stats;
  try {
    stats = await stat(filepath);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!stats.isFile()) return new NextResponse("Not found", { status: 404 });

  const ext = path.extname(filepath).toLowerCase();
  const mime = MIME_BY_EXT[ext] || "application/octet-stream";
  const size = stats.size;

  const baseHeaders: Record<string, string> = {
    "Content-Type": mime,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
    "Last-Modified": stats.mtime.toUTCString(),
  };

  const range = req.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match) {
      return new NextResponse("Range Not Satisfiable", {
        status: 416,
        headers: { ...baseHeaders, "Content-Range": `bytes */${size}` },
      });
    }
    const startStr = match[1];
    const endStr = match[2];
    let start: number;
    let end: number;
    if (startStr === "" && endStr !== "") {
      // Suffix range: last N bytes.
      const suffix = Number(endStr);
      start = Math.max(0, size - suffix);
      end = size - 1;
    } else {
      start = Number(startStr || 0);
      end = endStr ? Math.min(Number(endStr), size - 1) : size - 1;
    }
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
      return new NextResponse("Range Not Satisfiable", {
        status: 416,
        headers: { ...baseHeaders, "Content-Range": `bytes */${size}` },
      });
    }
    const length = end - start + 1;
    const headers = {
      ...baseHeaders,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(length),
    };
    if (method === "HEAD") return new NextResponse(null, { status: 206, headers });
    const nodeStream = fs.createReadStream(filepath, { start, end });
    return new NextResponse(streamFromNode(nodeStream), { status: 206, headers });
  }

  const headers = { ...baseHeaders, "Content-Length": String(size) };
  if (method === "HEAD") return new NextResponse(null, { status: 200, headers });
  const nodeStream = fs.createReadStream(filepath);
  return new NextResponse(streamFromNode(nodeStream), { status: 200, headers });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  return serve(req, "GET", parts);
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  return serve(req, "HEAD", parts);
}
