"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import ReactMarkdown from "react-markdown";
import DeleteButton from "../DeleteButton";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";

type Initial = {
  title: string;
  slug: string;
  date: string;
  body: string;
  draft: boolean;
  excerpt: string;
  previousFilename: string;
  tracked?: boolean;
};

type Props = { mode: "new" | "edit"; initial: Initial };

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function Editor({ mode, initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [slugDirty, setSlugDirty] = useState(mode === "edit");
  const [date, setDate] = useState(initial.date);
  const [body, setBody] = useState(initial.body);
  const [draft, setDraft] = useState(initial.draft);
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [status, setStatus] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const editorRef = useRef<EditorView | null>(null);

  // Auto-fill slug from title until user edits the slug field.
  useEffect(() => {
    if (!slugDirty) setSlug(slugify(title));
  }, [title, slugDirty]);

  // Cmd/Ctrl-S to save
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save({ publish: !draft });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, slug, date, body, draft, excerpt]);

  async function save({ publish }: { publish: boolean }) {
    if (!title.trim()) { setStatus("Title required"); return; }
    if (!slug.trim()) { setStatus("Slug required"); return; }
    setStatus(publish ? "Publishing…" : "Saving…");
    const res = await fetch(`${BASE}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, slug, date, body,
        draft: publish ? false : draft,
        excerpt,
        previousFilename: initial.previousFilename || undefined,
        push: publish,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(json.error || `Failed (${res.status})`);
      return;
    }
    setStatus(json.gitWarning ? `Saved (git: ${json.gitWarning})` : (publish ? "Published ✓" : "Saved ✓"));
    if (publish) setDraft(false);
    if (mode === "new") {
      router.replace(`/admin/edit/${slug}`);
    } else if (slug !== initial.slug || date !== initial.date) {
      router.replace(`/admin/edit/${slug}`);
    } else {
      router.refresh();
    }
  }

  async function uploadFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    setStatus(`Uploading ${file.name}…`);
    const res = await fetch(`${BASE}/api/upload`, { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) { setStatus(json.error || "Upload failed"); return null; }
    setStatus(`Uploaded ${file.name}`);
    return json.url as string;
  }

  function insertAtCursor(text: string) {
    const view = editorRef.current;
    if (!view) {
      setBody((b) => b + "\n" + text + "\n");
      return;
    }
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  }

  function mediaMarkup(file: File, url: string) {
    const isVideo = file.type.startsWith("video/");
    // Images use normal markdown alt text as an optional caption:
    //   ![caption here](/path/to/image.jpg)
    // Leave it blank for no caption:
    //   ![](/path/to/image.jpg)
    return isVideo
      ? `\n<video controls src="${url}"></video>\n`
      : `\n![](${url})\n`;
  }

  async function handleFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const url = await uploadFile(file);
      if (!url) continue;
      insertAtCursor(mediaMarkup(file, url));
    }
  }

  function onDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setDragging(true);
    }
  }
  function onDragLeave() { setDragging(false); }
  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) await handleFiles(e.dataTransfer.files);
  }

  const extensions = useMemo(() => [markdown(), EditorView.lineWrapping], []);

  return (
    <div className="admin-shell">
      <div className="admin-bar">
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ flex: 2, minWidth: 240 }}
        />
        <input
          type="text"
          placeholder="slug"
          value={slug}
          onChange={(e) => { setSlug(e.target.value); setSlugDirty(true); }}
          style={{ flex: 1, minWidth: 140 }}
        />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <label><input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />Keep as draft</label>
        <span className="grow" />
        <span className="status">{status}</span>
        {mode === "edit" && initial.previousFilename ? (
          <DeleteButton filename={initial.previousFilename} title={title || initial.previousFilename} tracked={!!initial.tracked} />
        ) : null}
        <button className="primary" onClick={() => save({ publish: !draft })} title="Cmd/Ctrl-S">
          Save
        </button>
      </div>

      <div className={"editor-grid dropzone" + (dragging ? " dragging" : "")}
           onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
        <div className="editor-pane">
          <CodeMirror
            value={body}
            extensions={extensions}
            onChange={(v) => setBody(v)}
            onCreateEditor={(view) => { editorRef.current = view; }}
            theme="light"
            basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
          />
        </div>
        <div className="preview-pane">
          <h1>{title || <span style={{ color: "#bbb" }}>Title</span>}</h1>
          <div className="date" style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>{date}</div>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            rehypePlugins={[rehypeRaw]}
            components={{
              p({ children }) {
                const childArray = Array.isArray(children) ? children : [children];
                const only = childArray.length === 1 ? childArray[0] : null;
                if (
                  only &&
                  typeof only === "object" &&
                  "type" in only &&
                  only.type === "img" &&
                  "props" in only
                ) {
                  const props = only.props as { src?: string; alt?: string };
                  if (props.alt) {
                    return <figure><img src={props.src} alt={props.alt} /><figcaption>{props.alt}</figcaption></figure>;
                  }
                }
                return <p>{children}</p>;
              },
            }}
          >
            {body}
          </ReactMarkdown>
        </div>
      </div>

      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 12 }}>
        Drag-drop images or videos anywhere in the editor to upload &amp; insert. Cmd/Ctrl-S saves.
      </p>
    </div>
  );
}
