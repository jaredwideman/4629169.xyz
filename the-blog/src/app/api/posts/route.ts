import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { requireSession } from "@/lib/auth";
import { savePost, contentDir, isValidSlug } from "@/lib/posts";
import { commitAndPush, gitEnabled } from "@/lib/git";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const data = await req.json();
    const { title, slug, date, body, draft, excerpt, previousFilename, push } = data || {};
    if (typeof title !== "string" || typeof slug !== "string" || typeof date !== "string" || typeof body !== "string") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    if (!isValidSlug(slug)) {
      return NextResponse.json({ error: "Slug must be lowercase letters, digits, and dashes" }, { status: 400 });
    }
    const { filename, filepath } = await savePost({
      slug, date, title, body,
      draft: !!draft,
      excerpt: excerpt || undefined,
      previousFilename: typeof previousFilename === "string" ? previousFilename : undefined,
    });

    let gitWarning: string | undefined;
    if (push) {
      if (!gitEnabled()) {
        gitWarning = "BLOG_GIT_PAT not set; saved locally only";
      } else {
        const rel = path.relative(contentDir(), filepath).replace(/\\/g, "/");
        const filesToAdd = [rel];
        if (previousFilename && previousFilename !== filename) {
          filesToAdd.push(`posts/${previousFilename}`);
        }
        const msg = `${draft ? "Draft" : "Publish"}: ${title} (${slug})`;
        const result = await commitAndPush(`${msg}\n\nby ${session.email}`, filesToAdd);
        if (!result.ok) gitWarning = result.error;
      }
    }
    return NextResponse.json({ ok: true, filename, gitWarning });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
