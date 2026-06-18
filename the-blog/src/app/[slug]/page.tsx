import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug } from "@/lib/posts";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const session = await getSession();
  const post = await getPostBySlug(slug, { includeUntracked: !!session });
  if (!post) notFound();
  if ((post.draft || !post.tracked) && !session) notFound();
  return (
    <div className="container">
      <header className="site">
        <h1><Link href="/">Blog</Link></h1>
        <nav>
          <Link href="/">all posts</Link>
          {session ? <Link href={`/admin/edit/${post.slug}`}>edit</Link> : null}
        </nav>
      </header>
      <article className="post">
        <h1>{post.title}{post.draft ? <span className="draft-badge">DRAFT</span> : null}</h1>
        <div className="date">{post.date}</div>
        <div dangerouslySetInnerHTML={{ __html: post.html }} />
      </article>
    </div>
  );
}
