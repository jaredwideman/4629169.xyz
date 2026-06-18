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

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineCaptionMarkdown(s: string) {
  return escapeHtml(s).replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function expandCaptionImages(md: string) {
  return md.replace(/^!\[(.*)\]\(([^\s)]+)(?:\s+"live:([^"]+)")?\)\s*$/gm, (_match, caption: string, src: string, liveSrc?: string) => {
    const alt = caption.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[<>]/g, "");
    const img = liveSrc
      ? `<span class="live-photo"><img src="${escapeHtml(src)}" data-live-src="${escapeHtml(liveSrc)}" alt="${escapeHtml(alt)}" /><span class="live-badge">▶</span></span>`
      : `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`;
    const captionHtml = caption.trim() ? `\n<figcaption>${inlineCaptionMarkdown(caption)}</figcaption>` : "";
    return `<figure>\n${img}${captionHtml}\n</figure>`;
  });
}

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
  const previewRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);
  const savedRef = useRef({
    title: initial.title,
    slug: initial.slug,
    date: initial.date,
    body: initial.body,
    draft: initial.draft,
    excerpt: initial.excerpt,
  });
  const hasUnsavedChanges =
    title !== savedRef.current.title ||
    slug !== savedRef.current.slug ||
    date !== savedRef.current.date ||
    body !== savedRef.current.body ||
    draft !== savedRef.current.draft ||
    excerpt !== savedRef.current.excerpt;
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  // Auto-fill slug from title until user edits the slug field.
  useEffect(() => {
    if (!slugDirty) setSlug(slugify(title));
  }, [title, slugDirty]);

  // Warn if the user tries to leave the editor with unsaved changes.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!hasUnsavedChangesRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }

    function onDocumentClick(e: MouseEvent) {
      if (!hasUnsavedChangesRef.current || e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      if (target.target && target.target !== "_self") return;
      if (target.href === window.location.href) return;
      if (!confirm("You have unsaved changes. Leave this page and discard them?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, []);

  // Keep the markdown editor and rendered preview scrolling together.
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let frame = 0;

    function syncScroll(source: HTMLElement, target: HTMLElement) {
      if (syncingScrollRef.current) return;
      const sourceMax = source.scrollHeight - source.clientHeight;
      const targetMax = target.scrollHeight - target.clientHeight;
      if (sourceMax <= 0 || targetMax <= 0) return;
      syncingScrollRef.current = true;
      target.scrollTop = (source.scrollTop / sourceMax) * targetMax;
      window.requestAnimationFrame(() => {
        syncingScrollRef.current = false;
      });
    }

    function connect() {
      const editorScroller = editorRef.current?.scrollDOM;
      const preview = previewRef.current;
      if (!editorScroller || !preview) {
        frame = window.requestAnimationFrame(connect);
        return;
      }

      const onEditorScroll = () => syncScroll(editorScroller, preview);
      const onPreviewScroll = () => syncScroll(preview, editorScroller);
      editorScroller.addEventListener("scroll", onEditorScroll, { passive: true });
      preview.addEventListener("scroll", onPreviewScroll, { passive: true });
      cleanup = () => {
        editorScroller.removeEventListener("scroll", onEditorScroll);
        preview.removeEventListener("scroll", onPreviewScroll);
      };
    }

    connect();
    return () => {
      window.cancelAnimationFrame(frame);
      cleanup?.();
    };
  }, []);

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
    const savedDraft = publish ? false : draft;
    savedRef.current = { title, slug, date, body, draft: savedDraft, excerpt };
    hasUnsavedChangesRef.current = false;
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
    const heicFrameCount = json.heicFrameCount as number | undefined;
    if (heicFrameCount && !json.liveUrl) {
      setStatus(`Uploaded ${file.name} as still image (${heicFrameCount} frame${heicFrameCount === 1 ? "" : "s"}; no playable animation)`);
    } else if (json.liveUrl) {
      setStatus(`Uploaded ${file.name} as playable live image`);
    } else {
      setStatus(`Uploaded ${file.name}`);
    }
    return { url: json.url as string, liveUrl: json.liveUrl as string | undefined };
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
      ? `\n<video src="${url}" autoplay muted loop playsinline data-auto-video></video>\n`
      : `\n![](${url})\n`;
  }

  async function handleFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const uploaded = await uploadFile(file);
      if (!uploaded) continue;
      if (uploaded.liveUrl) {
        insertAtCursor(`\n![](${uploaded.url} "live:${uploaded.liveUrl}")\n`);
      } else {
        insertAtCursor(mediaMarkup(file, uploaded.url));
      }
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
        <div className="preview-pane" ref={previewRef}>
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
            {expandCaptionImages(body)}
          </ReactMarkdown>
        </div>
      </div>

      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 12 }}>
        Drag-drop images or videos anywhere in the editor to upload &amp; insert. Cmd/Ctrl-S saves.
      </p>
    </div>
  );
}
