import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listTimelineItems, normalizeTag } from "@/lib/timeline";
import TimelineClient from "./TimelineClient";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ tags?: string; tag?: string }> };

export default async function BlogIndex({ searchParams }: Props) {
  const session = await getSession();
  const params = await searchParams;
  const selectedTags = (params.tags || params.tag || "").split(",").map(normalizeTag).filter(Boolean);
  const page = await listTimelineItems({ includeDrafts: !!session, tags: selectedTags, limit: 12 });

  return (
    <div className="container timeline-container">
      <header className="site">
        <h1><Link href="/">Blog</Link></h1>
        <nav>
          <a href="/">← 4629169.xyz</a>
          {session ? <Link href="/admin">admin</Link> : null}
        </nav>
      </header>
      <TimelineClient initialItems={page.items} initialCursor={page.nextCursor} allTags={page.tags} selectedTags={selectedTags} />
    </div>
  );
}
