"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";

type TimelineMonthSummary = { month: string; filename: string; tracked: boolean };
type Props = {
  initialMonth: string;
  initialBody: string;
  months: TimelineMonthSummary[];
};

type ValidationMessage = { line: number; level: "error" | "warning"; message: string };
type TimelineSourceEntry = { line: string; date: string; originalIndex: number };
type ParsedMediaSource = { src: string; positionX?: number; positionY?: number; volume?: number };

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const MEDIA_RE = /^\s*([!@])\[(.*)\]\(([^\s)]+)(?:\s+"live:([^"]+)")?\)\s*<([^>]*)>\s*\{([^}]+)\}\s*$/;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineCaptionMarkdown(s: string) {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase().replace(/\s+/g, "-");
}

function clampPercent(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseMediaSourcePart(part: string): ParsedMediaSource {
  const clean = part.trim();
  const volumeMatch = clean.match(/^(.*)@v(\d{1,3})$/i);
  if (volumeMatch) return { src: volumeMatch[1], volume: clampPercent(Number(volumeMatch[2])) };
  const cropMatch = clean.match(/^(.*)@(\d{1,3}),(\d{1,3})$/);
  if (!cropMatch) return { src: clean };
  return { src: cropMatch[1], positionX: clampPercent(Number(cropMatch[2])), positionY: clampPercent(Number(cropMatch[3])) };
}

function formatMediaSourcePart(part: ParsedMediaSource) {
  if (part.volume !== undefined) return `${part.src}@v${clampPercent(part.volume)}`;
  if (part.positionX === undefined || part.positionY === undefined) return part.src;
  return `${part.src}@${clampPercent(part.positionX)},${clampPercent(part.positionY)}`;
}

function isValidDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

function expandTimelineMarkdown(md: string) {
  let previousDate = "";
  return md.split(/\r?\n/).map((line, lineIndex) => {
    const match = line.match(MEDIA_RE);
    if (!match) return line;
    const marker = match[1];
    const caption = match[2];
    const src = match[3];
    const liveSrc = match[4];
    const tags = match[5];
    const cleanDate = match[6].trim();
    const alt = caption.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`~]/g, "").replace(/[<>]/g, "");
    const mediaParts = marker === "@" ? [parseMediaSourcePart(src)] : src.split("|").map(parseMediaSourcePart).filter((part) => Boolean(part.src));
    const media = mediaParts.map((part, mediaIndex) => {
      const x = part.positionX ?? 50;
      const y = part.positionY ?? 50;
      const cropAttrs = `data-crop-line="${lineIndex}" data-crop-index="${mediaIndex}" data-crop-x="${x}" data-crop-y="${y}" draggable="false" style="object-position:${x}% ${y}%"`;
      return marker === "@"
        ? `<video src="${escapeHtml(part.src)}" playsinline controls data-auto-video data-volume="${part.volume ?? 100}"></video>`
        : liveSrc && mediaParts.length === 1
          ? `<span class="live-photo"><img src="${escapeHtml(part.src)}" data-live-src="${escapeHtml(liveSrc)}" alt="${escapeHtml(alt)}" ${cropAttrs} /><span class="live-badge">▶</span></span>`
          : `<img src="${escapeHtml(part.src)}" alt="${escapeHtml(alt)}" ${cropAttrs} />`;
    }).join("");
    const captionHtml = caption.trim() ? `\n<figcaption>${inlineCaptionMarkdown(caption)}</figcaption>` : "";
    const tagHtml = tags.split(",").map(normalizeTag).filter(Boolean).map((t) => `<span>${escapeHtml(t)}</span>`).join(" ");
    const showDate = cleanDate !== previousDate;
    const cls = `timeline-card preview-card ${showDate ? "" : "date-continuation"}`;
    previousDate = cleanDate;
    return `<article class="${cls}">${showDate ? `<time>${escapeHtml(cleanDate)}</time>` : ""}<figure>\n<div class="timeline-media-grid media-count-${Math.min(mediaParts.length, 6)} remainder-${mediaParts.length % 3}">${media}</div>${captionHtml}\n<div class="timeline-tags">${tagHtml}</div>\n</figure></article>`;
  }).join("\n");
}

function normalizeTimelineSourceLine(line: string): string | null {
  const match = line.match(MEDIA_RE);
  if (!match) return null;
  const tags = Array.from(new Set(match[5].split(",").map(normalizeTag).filter(Boolean))).sort().join(",");
  const live = match[4] ? ` "live:${match[4].trim()}"` : "";
  const src = match[3].split("|").map((part) => formatMediaSourcePart(parseMediaSourcePart(part))).join("|");
  return `${match[1]}[${match[2].trim()}](${src}${live})<${tags}>{${match[6].trim()}}`;
}

function formatTimelineSource(md: string): string {
  const entries: TimelineSourceEntry[] = [];
  const otherLines: string[] = [];
  md.split(/\r?\n/).forEach((line, index) => {
    const normalized = normalizeTimelineSourceLine(line);
    if (!normalized) {
      if (line.trim()) otherLines.push(line.trimEnd());
      return;
    }
    const match = normalized.match(MEDIA_RE);
    const date = match?.[6]?.trim() || "";
    if (!isValidDate(date)) {
      otherLines.push(line.trimEnd());
      return;
    }
    entries.push({ line: normalized, date, originalIndex: index });
  });
  entries.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.originalIndex - b.originalIndex;
  });
  return [...otherLines, ...entries.map((entry) => entry.line)].join("\n\n").trimEnd() + (entries.length || otherLines.length ? "\n" : "");
}

function validateTimelineMarkdown(md: string): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const lines = md.split(/\r?\n/);
  lines.forEach((line, index) => {
    const lineNo = index + 1;
    if (!line.trim()) return;
    if (!/^\s*[!@]\[/.test(line)) return;
    const match = line.match(MEDIA_RE);
    if (!match) {
      messages.push({ line: lineNo, level: "error", message: "Media item does not match ![caption](image)<tags>{YYYY-MM-DD} or @[caption](video)<tags>{YYYY-MM-DD}" });
      return;
    }
    const marker = match[1];
    const liveSrc = match[4];
    const tags = match[5].split(",").map(normalizeTag).filter(Boolean);
    const date = match[6].trim();
    const parsedSrc = parseMediaSourcePart(match[3]);
    if (marker === "@" && liveSrc) messages.push({ line: lineNo, level: "warning", message: "Video items ignore live: sources" });
    if (marker === "@" && parsedSrc.volume !== undefined && !/@v\d{1,3}$/i.test(match[3])) messages.push({ line: lineNo, level: "warning", message: "Video volume should use @vNN, e.g. @v35" });
    if (marker === "!" && match[3].includes("@v")) messages.push({ line: lineNo, level: "warning", message: "Image items ignore @v volume suffixes" });
    if (marker === "!" && match[3].includes("|") && liveSrc) messages.push({ line: lineNo, level: "warning", message: "Multi-image items ignore live: sources" });
    if (!isValidDate(date)) messages.push({ line: lineNo, level: "error", message: "Invalid date; expected a real YYYY-MM-DD date" });
    if (tags.length === 0) messages.push({ line: lineNo, level: "error", message: "At least one tag is required" });
    if (new Set(tags).size !== tags.length) messages.push({ line: lineNo, level: "warning", message: "Duplicate tag" });
    if (tags.some((tag) => tag.includes(" "))) messages.push({ line: lineNo, level: "warning", message: "Tags with spaces will be hyphenated" });
  });
  return messages;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function TimelineWorkbench({ initialMonth, initialBody, months }: Props) {
  const router = useRouter();
  const [month, setMonth] = useState(initialMonth);
  const [body, setBody] = useState(initialBody);
  const [status, setStatus] = useState("");
  const [dragging, setDragging] = useState(false);
  const editorRef = useRef<EditorView | null>(null);
  const savedRef = useRef({ month: initialMonth, body: initialBody });
  const hasUnsavedChanges = month !== savedRef.current.month || body !== savedRef.current.body;
  const validation = useMemo(() => validateTimelineMarkdown(body), [body]);
  const extensions = useMemo(() => [markdown(), EditorView.lineWrapping], []);
  const knownTags = useMemo(() => {
    const tags = new Set<string>();
    for (const line of body.split(/\r?\n/)) {
      const match = line.match(MEDIA_RE);
      if (match) match[5].split(",").map(normalizeTag).filter(Boolean).forEach((tag) => tags.add(tag));
    }
    return Array.from(tags).sort();
  }, [body]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  function changeMonth(nextMonth: string) {
    if (!nextMonth || nextMonth === month) return;
    if (hasUnsavedChanges && !confirm("You have unsaved changes. Switch months and discard them?")) return;
    router.push(`/admin?month=${nextMonth}`);
  }

  async function save({ publish }: { publish: boolean }) {
    if (!/^\d{4}-\d{2}$/.test(month)) { setStatus("Invalid month"); return; }
    const errors = validation.filter((msg) => msg.level === "error");
    if (publish && errors.length && !confirm(`${errors.length} validation error(s). Publish anyway?`)) return;
    setStatus(publish ? "Publishing…" : "Saving…");
    const res = await fetch(`${BASE}/api/timeline/source`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, body, push: publish }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(json.error || `Failed (${res.status})`);
      return;
    }
    const savedBody = typeof json.body === "string" ? json.body : body;
    if (savedBody !== body) setBody(savedBody);
    savedRef.current = { month, body: savedBody };
    setStatus(json.gitWarning ? `Saved (git: ${json.gitWarning})` : publish ? "Published + sorted ✓" : "Saved ✓");
    router.refresh();
  }

  async function uploadFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    setStatus(`Uploading ${file.name}…`);
    const res = await fetch(`${BASE}/api/upload`, { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) { setStatus(json.error || "Upload failed"); return null; }
    setStatus(`Uploaded ${file.name}`);
    return { url: json.url as string, liveUrl: json.liveUrl as string | undefined };
  }

  function insertAtCursor(text: string) {
    const view = editorRef.current;
    if (!view) {
      setBody((b) => `${b}${b.endsWith("\n") ? "" : "\n"}${text}\n`);
      return;
    }
    const { from, to } = view.state.selection.main;
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
    view.focus();
  }

  async function handleFiles(files: FileList | File[]) {
    const plainImages: string[] = [];
    const snippets: string[] = [];
    for (const file of Array.from(files)) {
      const uploaded = await uploadFile(file);
      if (!uploaded) continue;
      const isVideo = file.type.startsWith("video/");
      if (!isVideo && !uploaded.liveUrl) plainImages.push(uploaded.url);
      else if (uploaded.liveUrl) snippets.push(`![caption](${uploaded.url} "live:${uploaded.liveUrl}")<tag>{${todayISO()}}`);
      else snippets.push(`@[caption](${uploaded.url}@v100)<tag>{${todayISO()}}`);
    }
    if (plainImages.length === 1) snippets.unshift(`![caption](${plainImages[0]})<tag>{${todayISO()}}`);
    else if (plainImages.length > 1) snippets.unshift(`![caption](${plainImages.join("|")})<tag>{${todayISO()}}`);
    if (snippets.length) insertAtCursor(`\n${snippets.join("\n\n")}\n`);
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

  function normalizeDocument() {
    setBody(formatTimelineSource(body));
  }

  const previewBody = useMemo(() => formatTimelineSource(body), [body]);

  useEffect(() => {
    const videos = document.querySelectorAll<HTMLVideoElement>(".source-preview video[data-volume]");
    for (const video of videos) {
      video.volume = Math.max(0, Math.min(100, Number(video.dataset.volume || 100))) / 100;
    }
  }, [previewBody]);

  function updatePreviewCrop(lineIndex: number, mediaIndex: number, x: number, y: number) {
    const lines = previewBody.split(/\r?\n/);
    const line = lines[lineIndex];
    const match = line?.match(MEDIA_RE);
    if (!match || match[1] !== "!") return;
    const parts = match[3].split("|").map(parseMediaSourcePart);
    const part = parts[mediaIndex];
    if (!part) return;
    parts[mediaIndex] = { ...part, positionX: clampPercent(x), positionY: clampPercent(y) };
    const live = match[4] ? ` "live:${match[4].trim()}"` : "";
    lines[lineIndex] = `${match[1]}[${match[2].trim()}](${parts.map(formatMediaSourcePart).join("|")}${live})<${match[5].trim()}>{${match[6].trim()}}`;
    setBody(lines.join("\n"));
  }

  function onPreviewPointerDown(e: React.PointerEvent<HTMLElement>) {
    const img = (e.target as HTMLElement | null)?.closest?.("img[data-crop-line]") as HTMLImageElement | null;
    if (!img) return;
    const targetImg = img;
    e.preventDefault();
    const lineIndex = Number(targetImg.dataset.cropLine);
    const mediaIndex = Number(targetImg.dataset.cropIndex);
    const start = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      x: Number(targetImg.dataset.cropX || 50),
      y: Number(targetImg.dataset.cropY || 50),
    };
    let latest = { x: start.x, y: start.y };
    targetImg.classList.add("is-panning");

    function move(ev: PointerEvent) {
      latest = {
        x: clampPercent(start.x - ((ev.clientX - start.pointerX) / targetImg.clientWidth) * 100),
        y: clampPercent(start.y - ((ev.clientY - start.pointerY) / targetImg.clientHeight) * 100),
      };
      targetImg.style.objectPosition = `${latest.x}% ${latest.y}%`;
    }
    function up() {
      targetImg.classList.remove("is-panning");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      updatePreviewCrop(lineIndex, mediaIndex, latest.x, latest.y);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }

  return (
    <div className="admin-shell timeline-workbench">
      <div className="admin-bar">
        <strong>Timeline</strong>
        <a href="/" style={{ fontSize: 13 }}>public</a>
        <form action={`${BASE}/api/auth/logout`} method="post" style={{ display: "inline" }}><button>Sign out</button></form>
        <select value={month} onChange={(e) => changeMonth(e.target.value)}>
          {months.map((m) => <option key={m.month} value={m.month}>{m.month}{m.tracked ? "" : " · local"}</option>)}
          {!months.some((m) => m.month === month) ? <option value={month}>{month} · new</option> : null}
        </select>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <button onClick={() => router.push(`/admin?month=${todayISO().slice(0, 7)}`)}>This month</button>
        <button onClick={normalizeDocument}>Normalize + sort</button>
        <span className="grow" />
        <span className="status">{status || (hasUnsavedChanges ? "Unsaved changes" : "")}</span>
        <button onClick={() => save({ publish: false })}>Save</button>
        <button className="primary" onClick={() => save({ publish: true })}>Publish</button>
      </div>

      <div className="workbench-grid">
        <div className={"editor-pane dropzone" + (dragging ? " dragging" : "")} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
          <CodeMirror
            value={body}
            extensions={extensions}
            onChange={(v) => setBody(v)}
            onCreateEditor={(view) => { editorRef.current = view; }}
            theme="light"
            basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
          />
        </div>
        <aside className="timeline-sidecar">
          <section className="validation-panel">
            <h2>Validation</h2>
            <p>{body.split(/\r?\n/).filter((line) => MEDIA_RE.test(line)).length} timeline item(s) · {knownTags.length} tag(s)</p>
            {knownTags.length ? <div className="timeline-tags tag-list">{knownTags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
            {validation.length === 0 ? <p className="ok">✓ no syntax issues</p> : (
              <ul>
                {validation.map((msg, i) => <li key={i} className={msg.level}><strong>Line {msg.line}:</strong> {msg.message}</li>)}
              </ul>
            )}
          </section>
          <section className="preview-pane source-preview" onPointerDown={onPreviewPointerDown}>
            <h2>Preview</h2>
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw]}>{expandTimelineMarkdown(previewBody)}</ReactMarkdown>
          </section>
        </aside>
      </div>

      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 12 }}>
        Source format: ![caption](image)&lt;tag1,tag2&gt;{'{YYYY-MM-DD}'} · ![caption](image1|image2|image3)&lt;tag&gt;{'{YYYY-MM-DD}'} · @[caption](video@v75)&lt;tag&gt;{'{YYYY-MM-DD}'}. Use @v0-100 for default video volume. Drag/drop media to upload and insert snippets.
      </p>
    </div>
  );
}
