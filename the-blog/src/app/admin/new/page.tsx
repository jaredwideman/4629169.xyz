import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { todayISO } from "@/lib/posts";
import Editor from "../_editor/Editor";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const session = await getSession();
  if (!session) redirect("../login");
  return (
    <Editor
      mode="new"
      initial={{
        title: "",
        slug: "",
        date: todayISO(),
        body: "# New post\n\nStart writing...\n",
        draft: true,
        excerpt: "",
        previousFilename: "",
      }}
    />
  );
}
