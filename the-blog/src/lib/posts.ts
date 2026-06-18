import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkHtml from "remark-html";

const execFileAsync = promisify(execFile);

export type PostMeta = {
  slug: string;
  title: string;
  date: string; // ISO date (YYYY-MM-DD)
  draft: boolean;
  excerpt?: string;
  filename: string; // basename, e.g. 2026-06-17-hello-world.md
  tracked: boolean;
};

export type Post = PostMeta & {
  body: string; // raw markdown
  html: string; // rendered HTML
};

export function contentDir(): string {
  // Resolve from cwd (Next.js runs from app dir). Default ../ assumes app is sibling to posts/.
  const raw = process.env.BLOG_CONTENT_DIR || "../";
  return path.resolve(process.cwd(), raw);
}

export function postsDir(): string {
  return path.join(contentDir(), "posts");
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function isValidSlug(s: string) {
  return SLUG_RE.test(s);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function buildFilename(date: string, slug: string) {
  return `${date}-${slug}.md`;
}

export function parseFilename(filename: string): { date: string; slug: string } | null {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
  if (!m) return null;
  return { date: m[1], slug: m[2] };
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function trackedPostFilenames(): Promise<Set<string>> {
  try {
    const { stdout } = await execFileAsync("git", ["ls-files", "posts/*.md"], { cwd: contentDir() });
    return new Set(stdout.split(/\r?\n/).filter(Boolean).map((f) => path.basename(f)));
  } catch {
    // In local dev without git, treat all posts as tracked.
    return new Set();
  }
}

export async function listPosts(opts: { includeDrafts?: boolean } = {}): Promise<PostMeta[]> {
  const dir = postsDir();
  await ensureDir(dir);
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
  const tracked = await trackedPostFilenames();
  const hasTrackedInfo = tracked.size > 0;
  const out: PostMeta[] = [];
  for (const filename of files) {
    const parsed = parseFilename(filename);
    if (!parsed) continue;
    const raw = await fs.readFile(path.join(dir, filename), "utf8");
    const { data, content } = matter(raw);
    const draft = Boolean(data.draft);
    const isTracked = !hasTrackedInfo || tracked.has(filename);
    // Public blog only shows git-tracked published posts. Admin sees local drafts/untracked files too.
    if ((!isTracked || draft) && !opts.includeDrafts) continue;
    out.push({
      slug: parsed.slug,
      filename,
      title: typeof data.title === "string" ? data.title : parsed.slug,
      date: typeof data.date === "string" ? data.date : parsed.date,
      draft,
      tracked: isTracked,
      excerpt: typeof data.excerpt === "string" ? data.excerpt : firstParagraph(content),
    });
  }
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out;
}

function firstParagraph(md: string): string {
  const m = md.trim().split(/\n\s*\n/)[0] || "";
  return m.replace(/[#*_`>\[\]\(\)!]/g, "").slice(0, 240);
}

export async function getPostBySlug(slug: string, opts: { includeUntracked?: boolean } = {}): Promise<Post | null> {
  if (!isValidSlug(slug)) return null;
  const dir = postsDir();
  await ensureDir(dir);
  const files = await fs.readdir(dir);
  const filename = files.find((f) => {
    const p = parseFilename(f);
    return p?.slug === slug;
  });
  if (!filename) return null;
  const tracked = await trackedPostFilenames();
  const hasTrackedInfo = tracked.size > 0;
  const isTracked = !hasTrackedInfo || tracked.has(filename);
  if (!isTracked && !opts.includeUntracked) return null;

  const raw = await fs.readFile(path.join(dir, filename), "utf8");
  const parsed = parseFilename(filename)!;
  const { data, content } = matter(raw);
  const html = await renderMarkdown(content);
  return {
    slug: parsed.slug,
    filename,
    title: typeof data.title === "string" ? data.title : parsed.slug,
    date: typeof data.date === "string" ? data.date : parsed.date,
    draft: Boolean(data.draft),
    tracked: isTracked,
    excerpt: typeof data.excerpt === "string" ? data.excerpt : undefined,
    body: content,
    html,
  };
}

export async function renderMarkdown(md: string): Promise<string> {
  const file = await remark()
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkHtml, { sanitize: false })
    .process(md);
  return String(file);
}

export type SaveInput = {
  slug: string;
  date: string;
  title: string;
  body: string;
  draft: boolean;
  excerpt?: string;
  // If renaming, this is the previous filename to delete.
  previousFilename?: string;
};

export async function savePost(input: SaveInput): Promise<{ filename: string; filepath: string }> {
  if (!isValidSlug(input.slug)) throw new Error("Invalid slug");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Invalid date");
  const dir = postsDir();
  await ensureDir(dir);
  const filename = buildFilename(input.date, input.slug);
  const filepath = path.join(dir, filename);

  const fm: Record<string, unknown> = {
    title: input.title,
    date: input.date,
    draft: input.draft,
  };
  if (input.excerpt) fm.excerpt = input.excerpt;

  const raw = matter.stringify(input.body, fm);
  await fs.writeFile(filepath, raw, "utf8");

  if (input.previousFilename && input.previousFilename !== filename) {
    const old = path.join(dir, input.previousFilename);
    try {
      await fs.unlink(old);
    } catch {}
  }
  return { filename, filepath };
}

export async function deletePost(filename: string) {
  const dir = postsDir();
  const filepath = path.join(dir, filename);
  await fs.unlink(filepath);
}
