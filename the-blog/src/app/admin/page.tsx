import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listPosts, todayISO } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const session = await getSession();
  if (!session) redirect("login");
  const posts = await listPosts({ includeDrafts: true });
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return (
    <div className="admin-shell">
      <div className="admin-bar">
        <strong>Admin</strong>
        <span className="status">signed in as {session.email}</span>
        <span className="grow" />
        <Link href={`${base}/admin/new`}><button className="primary">New post</button></Link>
        <form action={`${base}/api/auth/logout`} method="post" style={{ display: "inline" }}>
          <button>Sign out</button>
        </form>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13 }}>
        {posts.length} post{posts.length === 1 ? "" : "s"} · today is {todayISO()}
      </p>
      <ul className="posts">
        {posts.map((p) => (
          <li key={p.filename}>
            <h2>
              <Link href={`${base}/admin/edit/${p.slug}`}>{p.title}</Link>
              {p.draft ? <span className="draft-badge">DRAFT</span> : null}
            </h2>
            <div className="date">{p.date} · <code style={{ fontSize: 12 }}>{p.filename}</code></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
