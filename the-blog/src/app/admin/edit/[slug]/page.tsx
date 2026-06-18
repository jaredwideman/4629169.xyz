import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPostBySlug } from "@/lib/posts";
import Editor from "../../_editor/Editor";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function EditPostPage({ params }: Props) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect("../../login");
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  return (
    <Editor
      mode="edit"
      initial={{
        title: post.title,
        slug: post.slug,
        date: post.date,
        body: post.body,
        draft: post.draft,
        excerpt: post.excerpt || "",
        previousFilename: post.filename,
      }}
    />
  );
}
