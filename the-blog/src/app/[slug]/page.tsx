import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug } from "@/lib/posts";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  const session = await getSession();
  if (post.draft && !session) notFound();
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return (
    <div className="container">
      <header className="site">
        <h1><Link href={`${base}/`}>Blog</Link></h1>
        <nav>
          <Link href={`${base}/`}>all posts</Link>
          {session ? <Link href={`${base}/admin/edit/${post.slug}`}>edit</Link> : null}
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
