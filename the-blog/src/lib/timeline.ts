import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkHtml from "remark-html";
import { contentDir } from "./posts";

const execFileAsync = promisify(execFile);

export type TimelineItem = {
  id: string;
  kind: "image" | "video" | "live-photo";
  src: string;
  liveSrc?: string;
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

export type TimelineMonth = {
  month: string;
  filename: string;
  body: string;
  tracked: boolean;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const MEDIA_RE = /^\s*([!@])\[(.*)\]\(([^\s)]+)(?:\s+"live:([^"]+)")?\)\s*<([^>]*)>\s*\{([^}]+)\}\s*$/;

export function timelineDir(): string {
  return path.join(contentDir(), "timeline");
}

export function timelineFilename(month: string): string {
  if (!isValidMonth(month)) throw new Error("Invalid month");
  return `${month}.md`;
}

export function isValidMonth(month: string): boolean {
  if (!MONTH_RE.test(month)) return false;
  const d = new Date(`${month}-01T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 7) === month;
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function trackedTimelineFilenames(): Promise<Set<string>> {
  try {
    const { stdout } = await execFileAsync("git", ["ls-files", "timeline/*.md"], { cwd: contentDir() });
    return new Set(stdout.split(/\r?\n/).filter(Boolean).map((f) => path.basename(f)));
  } catch {
    return new Set();
  }
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, "-");
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

export async function listTimelineMonths(): Promise<TimelineMonth[]> {
  const dir = timelineDir();
  await ensureDir(dir);
  const files = (await fs.readdir(dir)).filter((f) => /^\d{4}-\d{2}\.md$/.test(f));
  const tracked = await trackedTimelineFilenames();
  const hasTrackedInfo = tracked.size > 0;
  const months = await Promise.all(files.map(async (filename) => ({
    month: filename.replace(/\.md$/, ""),
    filename,
    body: await fs.readFile(path.join(dir, filename), "utf8"),
    tracked: !hasTrackedInfo || tracked.has(filename),
  })));
  return months.sort((a, b) => b.month.localeCompare(a.month));
}

export async function getTimelineMonth(month: string): Promise<TimelineMonth> {
  if (!isValidMonth(month)) throw new Error("Invalid month");
  const dir = timelineDir();
  await ensureDir(dir);
  const filename = timelineFilename(month);
  const filepath = path.join(dir, filename);
  const tracked = await trackedTimelineFilenames();
  const hasTrackedInfo = tracked.size > 0;
  let body = "";
  try {
    body = await fs.readFile(filepath, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  return { month, filename, body, tracked: !hasTrackedInfo || tracked.has(filename) };
}

export async function saveTimelineMonth(input: { month: string; body: string }): Promise<{ filename: string; filepath: string }> {
  if (!isValidMonth(input.month)) throw new Error("Invalid month");
  const dir = timelineDir();
  await ensureDir(dir);
  const filename = timelineFilename(input.month);
  const filepath = path.join(dir, filename);
  await fs.writeFile(filepath, input.body, "utf8");
  return { filename, filepath };
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
    const src = match[3].trim();
    const liveSrc = match[4]?.trim();
    const tags = match[5].split(",").map(normalizeTag).filter(Boolean);
    const date = match[6].trim();
    if (!isRealDate(date) || tags.length === 0) continue;

    const kind = marker === "@" ? "video" : liveSrc ? "live-photo" : "image";
    const sourceLine = index + 1;
    items.push({
      id: `${input.sourcePost}:${sourceLine}`,
      kind,
      src,
      liveSrc,
      captionMarkdown,
      captionHtml: captionMarkdown ? await inlineMarkdown(captionMarkdown) : "",
      altText: stripMarkdownForAlt(captionMarkdown),
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
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

export async function listTimelineItems(opts: {
  includeDrafts?: boolean;
  tags?: string[];
  cursor?: string | null;
  limit?: number;
} = {}): Promise<TimelinePage> {
  const months = await listTimelineMonths();
  const visibleMonths = opts.includeDrafts ? months : months.filter((month) => month.tracked);
  const nested = await Promise.all(visibleMonths.map((month) => parseTimelineItemsFromMarkdown({
    markdown: month.body,
    sourcePost: month.filename,
    sourceTitle: month.month,
  })));

  const all = nested.flat().sort(compareItems);
  const tagCounts = new Map<string, number>();
  for (const item of all) for (const tag of item.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);

  const selectedTags = (opts.tags || []).map(normalizeTag).filter(Boolean);
  const filtered = all.filter((item) => matchesTags(item, selectedTags));
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
