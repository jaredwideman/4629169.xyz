import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { requireSession } from "@/lib/auth";
import { contentDir } from "@/lib/posts";
import { formatTimelineSource, getTimelineSource, saveTimelineSource } from "@/lib/timeline";
import { commitAndPush, gitEnabled } from "@/lib/git";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    await requireSession();
    const file = await getTimelineSource();
    return NextResponse.json({ ok: true, ...file });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const data = await req.json();
    const { body, push } = data || {};
    if (typeof body !== "string") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const savedBody = push ? formatTimelineSource(body) : body;
    const { filename, filepath } = await saveTimelineSource({ body: savedBody });
    let gitWarning: string | undefined;
    if (push) {
      if (!gitEnabled()) {
        gitWarning = "BLOG_GIT_PAT not set; saved locally only";
      } else {
        const rel = path.relative(contentDir(), filepath).replace(/\\/g, "/");
        const result = await commitAndPush(`Update timeline\n\nby ${session.email}`, [rel]);
        if (!result.ok) gitWarning = result.error;
      }
    }

    return NextResponse.json({ ok: true, filename, body: savedBody, gitWarning });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
