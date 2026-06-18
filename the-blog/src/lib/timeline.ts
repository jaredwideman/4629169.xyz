import { listPosts, getPostBySlug } from "./posts";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkHtml from "remark-html";

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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MEDIA_RE = /^\s*([!@])\[(.*)\]\(([^\s)]+)(?:\s+"live:([^"]+)")?\)\s*<([^>]*)>\s*\{([^}]+)\}\s*$/;

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
  const posts = await listPosts({ includeDrafts: opts.includeDrafts });
  const nested = await Promise.all(posts.map(async (meta) => {
    const post = await getPostBySlug(meta.slug, { includeUntracked: opts.includeDrafts });
    if (!post || (post.draft && !opts.includeDrafts)) return [];
    return parseTimelineItemsFromMarkdown({ markdown: post.body, sourcePost: post.filename, sourceTitle: post.title });
  }));

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
