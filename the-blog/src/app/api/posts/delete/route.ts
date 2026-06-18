import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { requireSession } from "@/lib/auth";
import { deletePost, postsDir, contentDir } from "@/lib/posts";
import { commitAndPush, gitEnabled } from "@/lib/git";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const data = await req.json();
    const filename = String(data?.filename || "");
    const push = Boolean(data?.push);
    if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(filename)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    await deletePost(filename);

    let gitWarning: string | undefined;
    if (push) {
      if (!gitEnabled()) {
        gitWarning = "BLOG_GIT_PAT not set; deleted locally only";
      } else {
        const rel = path.relative(contentDir(), path.join(postsDir(), filename)).replace(/\\/g, "/");
        const result = await commitAndPush(`Delete post: ${filename}\n\nby ${session.email}`, [rel]);
        if (!result.ok) gitWarning = result.error;
      }
    }

    return NextResponse.json({ ok: true, gitWarning });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
