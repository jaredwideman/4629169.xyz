import Link from "next/link";
import { listPosts } from "@/lib/posts";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BlogIndex() {
  const session = await getSession();
  const posts = await listPosts({ includeDrafts: !!session });
  return (
    <div className="container">
      <header className="site">
        <h1><Link href="/">Blog</Link></h1>
        <nav>
          <a href="/">← 4629169.xyz</a>
          {session ? <Link href="/admin">admin</Link> : null}
        </nav>
      </header>
      {posts.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No posts yet.</p>
      ) : (
        <ul className="posts">
          {posts.map((p) => (
            <li key={p.filename}>
              <h2>
                <Link href={`/${p.slug}`}>{p.title}</Link>
                {p.draft ? <span className="draft-badge">DRAFT</span> : null}
              </h2>
              <div className="date">{p.date}</div>
              {p.excerpt ? <div className="excerpt">{p.excerpt}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
