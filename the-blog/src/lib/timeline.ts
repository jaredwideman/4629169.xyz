import fs from "node:fs/promises";
import path from "node:path";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkHtml from "remark-html";
import { contentDir } from "./posts";

export type TimelineMedia = {
  kind: "image" | "video" | "live-photo";
  src: string;
  liveSrc?: string;
  altText: string;
  positionX?: number;
  positionY?: number;
  volume?: number;
};

export type TimelineItem = {
  id: string;
  kind: "image" | "video" | "live-photo";
  src: string;
  liveSrc?: string;
  media: TimelineMedia[];
  captionMarkdown: string;
  captionHtml: string;
  altText: string;
  tags: string[];
  date: string;
  sourcePost: string;
  sourceTitle: string;
  sourceLine: number;
};

export type TimelinePage = {
  items: TimelineItem[];
  nextCursor: string | null;
  tags: { tag: string; count: number }[];
};

export type TimelineSource = {
  filename: string;
  body: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MEDIA_RE = /^\s*([!@])\[(.*)\]\(([^\s)]+)(?:\s+"live:([^"]+)")?\)\s*<([^>]*)>\s*\{([^}]+)\}\s*$/;
const TIMELINE_FILENAME = "timeline.md";

type TimelineSourceEntry = {
  line: string;
  date: string;
  originalIndex: number;
};

type ParsedMediaSource = {
  src: string;
  positionX?: number;
  positionY?: number;
  volume?: number;
};

export function timelineFilePath(): string {
  return path.join(contentDir(), TIMELINE_FILENAME);
}

export function timelineFilename(): string {
  return TIMELINE_FILENAME;
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, "-");
}

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function parseMediaSourcePart(part: string): ParsedMediaSource {
  const clean = part.trim();
  const volumeMatch = clean.match(/^(.*)@v(\d{1,3})$/i);
  if (volumeMatch) return { src: volumeMatch[1], volume: clampPercent(Number(volumeMatch[2])) };
  const cropMatch = clean.match(/^(.*)@(\d{1,3}),(\d{1,3})$/);
  if (!cropMatch) return { src: clean };
  return {
    src: cropMatch[1],
    positionX: clampPercent(Number(cropMatch[2])),
    positionY: clampPercent(Number(cropMatch[3])),
  };
}

export function formatMediaSourcePart(part: ParsedMediaSource): string {
  if (part.volume !== undefined) return `${part.src}@v${clampPercent(part.volume)}`;
  if (part.positionX === undefined || part.positionY === undefined) return part.src;
  return `${part.src}@${clampPercent(part.positionX)},${clampPercent(part.positionY)}`;
}

export function normalizeTimelineSourceLine(line: string): string | null {
  const match = line.match(MEDIA_RE);
  if (!match) return null;
  const tags = Array.from(new Set(match[5].split(",").map(normalizeTag).filter(Boolean))).sort().join(",");
  const live = match[4] ? ` "live:${match[4].trim()}"` : "";
  const src = match[3].split("|").map((part) => formatMediaSourcePart(parseMediaSourcePart(part))).join("|");
  return `${match[1]}[${match[2].trim()}](${src}${live})<${tags}>{${match[6].trim()}}`;
}

export function formatTimelineSource(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const entries: TimelineSourceEntry[] = [];
  const otherLines: string[] = [];

  lines.forEach((line, index) => {
    const normalized = normalizeTimelineSourceLine(line);
    if (!normalized) {
      if (line.trim()) otherLines.push(line.trimEnd());
      return;
    }
    const match = normalized.match(MEDIA_RE);
    const date = match?.[6]?.trim() || "";
    if (!isRealDate(date)) {
      otherLines.push(line.trimEnd());
      return;
    }
    entries.push({ line: normalized, date, originalIndex: index });
  });

  entries.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.originalIndex - b.originalIndex;
  });

  return [...otherLines, ...entries.map((entry) => entry.line)].join("\n\n").trimEnd() + (entries.length || otherLines.length ? "\n" : "");
}

function isRealDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const d = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

function stripMarkdownForAlt(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/[<>]/g, "")
    .trim();
}

export async function inlineMarkdown(md: string): Promise<string> {
  const file = await remark()
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkHtml, { sanitize: false })
    .process(md);
  return String(file).trim().replace(/^<p>/, "").replace(/<\/p>$/, "");
}

export async function getTimelineSource(): Promise<TimelineSource> {
  const filepath = timelineFilePath();
  let body = "";
  try {
    body = await fs.readFile(filepath, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  return { filename: TIMELINE_FILENAME, body };
}

export async function saveTimelineSource(input: { body: string }): Promise<{ filename: string; filepath: string }> {
  const filepath = timelineFilePath();
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  await fs.writeFile(filepath, input.body, "utf8");
  return { filename: TIMELINE_FILENAME, filepath };
}

export async function parseTimelineItemsFromMarkdown(input: {
  markdown: string;
  sourcePost: string;
  sourceTitle: string;
}): Promise<TimelineItem[]> {
  const lines = input.markdown.split(/\r?\n/);
  const items: TimelineItem[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const match = line.match(MEDIA_RE);
    if (!match) continue;

    const marker = match[1];
    const captionMarkdown = match[2].trim();
    const rawSrc = match[3].trim();
    const parsedSrc = parseMediaSourcePart(rawSrc);
    const src = parsedSrc.src;
    const liveSrc = match[4]?.trim();
    const tags = match[5].split(",").map(normalizeTag).filter(Boolean);
    const date = match[6].trim();
    if (!isRealDate(date) || tags.length === 0) continue;

    const altText = stripMarkdownForAlt(captionMarkdown);
    const media: TimelineMedia[] = marker === "@"
      ? [{ kind: "video", src, altText, volume: parsedSrc.volume }]
      : rawSrc.split("|").map((part) => parseMediaSourcePart(part)).filter((part) => Boolean(part.src)).map((part) => ({
        kind: liveSrc ? "live-photo" : "image",
        src: part.src,
        liveSrc: rawSrc.includes("|") ? undefined : liveSrc,
        altText,
        positionX: part.positionX,
        positionY: part.positionY,
      }));
    if (media.length === 0) continue;

    const firstMedia = media[0];
    const sourceLine = index + 1;
    items.push({
      id: `${input.sourcePost}:${sourceLine}`,
      kind: firstMedia.kind,
      src: firstMedia.src,
      liveSrc: firstMedia.liveSrc,
      media,
      captionMarkdown,
      captionHtml: captionMarkdown ? await inlineMarkdown(captionMarkdown) : "",
      altText,
      tags: Array.from(new Set(tags)).sort(),
      date,
      sourcePost: input.sourcePost,
      sourceTitle: input.sourceTitle,
      sourceLine,
    });
  }

  return items;
}

function matchesTags(item: TimelineItem, selected: string[]): boolean {
  if (selected.length === 0) return true;
  return selected.every((tag) => item.tags.includes(tag));
}

function compareItems(a: TimelineItem, b: TimelineItem): number {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return a.sourceLine - b.sourceLine;
}

function dedupeTimelineItems(items: TimelineItem[]): TimelineItem[] {
  const seen = new Set<string>();
  const deduped: TimelineItem[] = [];
  for (const item of items) {
    const mediaKey = item.media.map((m) => m.src).join("|");
    const key = `${item.date}\n${mediaKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

export async function listTimelineItems(opts: {
  includeDrafts?: boolean;
  tags?: string[];
  cursor?: string | null;
  limit?: number;
} = {}): Promise<TimelinePage> {
  const source = await getTimelineSource();
  const parsed = await parseTimelineItemsFromMarkdown({
    markdown: source.body,
    sourcePost: source.filename,
    sourceTitle: "timeline",
  });

  const all = dedupeTimelineItems(parsed.sort(compareItems));
  const selectedTags = (opts.tags || []).map(normalizeTag).filter(Boolean);
  const filtered = all.filter((item) => matchesTags(item, selectedTags));
  const tagCounts = new Map<string, number>();
  for (const item of filtered) for (const tag of item.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  const start = opts.cursor ? Math.max(0, filtered.findIndex((item) => item.id === opts.cursor) + 1) : 0;
  const limit = Math.min(Math.max(opts.limit || 20, 1), 50);
  const items = filtered.slice(start, start + limit);
  const nextCursor = start + limit < filtered.length ? items[items.length - 1]?.id || null : null;

  return {
    items,
    nextCursor,
    tags: Array.from(tagCounts.entries()).map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag)),
  };
}
