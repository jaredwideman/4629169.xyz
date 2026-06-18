"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LivePhotoScript from "./LivePhotoScript";
import AutoplayToggle, { MuteToggle } from "./AutoplayToggle";
import type { TimelineItem } from "@/lib/timeline";

type TagSummary = { tag: string; count: number };
type PagePayload = { items: TimelineItem[]; nextCursor: string | null; tags: TagSummary[] };

type Props = {
  initialItems: TimelineItem[];
  initialCursor: string | null;
  allTags: TagSummary[];
  selectedTags: string[];
};

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

function readQueryTags() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("tags") || params.get("tag") || "";
  return raw.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean).sort();
}

function writeQueryTags(tags: string[]) {
  const url = new URL(window.location.href);
  url.searchParams.delete("tag");
  if (tags.length) url.searchParams.set("tags", tags.join(","));
  else url.searchParams.delete("tags");
  window.history.pushState({}, "", url.toString());
}

function tagsKey(tags: string[]) {
  return tags.join(",");
}

export default function TimelineClient({ initialItems, initialCursor, allTags, selectedTags }: Props) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialCursor);
  const [availableTags, setAvailableTags] = useState(allTags);
  const [activeTags, setActiveTags] = useState(selectedTags);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);

  const activeTagsKey = tagsKey(activeTags);

  const fetchPage = useCallback(async (tags: string[], cursor?: string | null) => {
    const params = new URLSearchParams({ limit: cursor ? "12" : "20" });
    if (cursor) params.set("cursor", cursor);
    if (tags.length) params.set("tags", tags.join(","));
    const res = await fetch(`${BASE}/api/timeline?${params.toString()}`);
    return await res.json() as PagePayload;
  }, []);

  const applyFilter = useCallback(async (tags: string[], updateUrl = true) => {
    const sorted = [...tags].sort();
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setActiveTags(sorted);
    if (updateUrl) writeQueryTags(sorted);
    try {
      const json = await fetchPage(sorted, null);
      if (requestId !== requestIdRef.current) return;
      setItems(json.items);
      setNextCursor(json.nextCursor);
      setAvailableTags(json.tags);
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading) return;
    setLoading(true);
    const json = await fetchPage(activeTags, nextCursor);
    setItems((existing) => {
      const seen = new Set(existing.map((item) => item.id));
      return [...existing, ...json.items.filter((item) => !seen.has(item.id))];
    });
    setNextCursor(json.nextCursor);
    setAvailableTags(json.tags);
    setLoading(false);
  }, [activeTags, fetchPage, loading, nextCursor]);

  useEffect(() => {
    const onPopState = () => applyFilter(readQueryTags(), false);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyFilter]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    }, { rootMargin: "900px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const visibleItems = useMemo(() => items.map((item, index) => ({
    item,
    showDate: index === 0 || items[index - 1]?.date !== item.date,
    sameDateNext: items[index + 1]?.date === item.date,
  })), [items]);
  const displayedTags = useMemo(() => {
    const byTag = new Map(availableTags.map((t) => [t.tag, t]));
    for (const tag of activeTags) if (!byTag.has(tag)) byTag.set(tag, { tag, count: 0 });
    return Array.from(byTag.values()).sort((a, b) => a.tag.localeCompare(b.tag));
  }, [activeTags, availableTags]);

  function toggleTag(tag: string) {
    const next = activeTags.includes(tag) ? activeTags.filter((t) => t !== tag) : [...activeTags, tag];
    void applyFilter(next);
  }

  return (
    <>
      <div className="timeline-toolbar">
        <div className="tag-filter" aria-label="Filter by tags">
          <AutoplayToggle />
          <MuteToggle />
          {displayedTags.map(({ tag, count }) => {
            const active = activeTags.includes(tag);
            return <button key={tag} className={active ? "active" : ""} onClick={() => toggleTag(tag)}>{tag} <span>{count}</span></button>;
          })}
          {activeTags.length ? <button className="clear" onClick={() => applyFilter([])}>clear</button> : null}
        </div>
      </div>

      {items.length === 0 && !loading ? <p className="empty">No timeline items match this filter.</p> : null}

      <section className="timeline" aria-live="polite">
        {visibleItems.map(({ item, showDate, sameDateNext }) => <TimelineCard key={item.id} item={item} showDate={showDate} sameDateNext={sameDateNext} />)}
      </section>
      <div ref={sentinelRef} className="timeline-sentinel">{loading ? "Loading…" : nextCursor ? "Scroll for more" : items.length ? "End" : ""}</div>
      <LivePhotoScript />
    </>
  );
}

function TimelineCard({ item, showDate, sameDateNext }: { item: TimelineItem; showDate: boolean; sameDateNext: boolean }) {
  const media = item.media?.length ? item.media : [{ kind: item.kind, src: item.src, liveSrc: item.liveSrc, altText: item.altText }];
  return (
    <article className={`timeline-card ${sameDateNext ? "same-date-next" : "date-boundary"} ${showDate ? "" : "date-continuation"}`}>
      {showDate ? <time dateTime={item.date}>{item.date}</time> : null}
      <figure>
        <div className={`timeline-media-grid media-count-${Math.min(media.length, 6)} remainder-${media.length % 3}`}>
          {media.map((m, index) => <TimelineMedia key={`${m.src}:${index}`} media={m} />)}
        </div>
        {item.captionHtml ? <figcaption dangerouslySetInnerHTML={{ __html: item.captionHtml }} /> : null}
      </figure>
      <div className="timeline-tags">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
    </article>
  );
}

function TimelineMedia({ media }: { media: { kind: string; src: string; liveSrc?: string; altText: string; positionX?: number; positionY?: number; volume?: number } }) {
  const [position, setPosition] = useState({ x: media.positionX ?? 50, y: media.positionY ?? 50 });
  const style = { objectPosition: `${position.x}% ${position.y}%` };

  function onPointerDown(e: React.PointerEvent<HTMLImageElement>) {
    const target = e.currentTarget;
    const start = { pointerX: e.clientX, pointerY: e.clientY, x: position.x, y: position.y };
    target.setPointerCapture(e.pointerId);
    target.classList.add("is-panning");

    function move(ev: PointerEvent) {
      const next = {
        x: Math.max(0, Math.min(100, start.x - ((ev.clientX - start.pointerX) / target.clientWidth) * 100)),
        y: Math.max(0, Math.min(100, start.y - ((ev.clientY - start.pointerY) / target.clientHeight) * 100)),
      };
      setPosition(next);
    }
    function up() {
      target.classList.remove("is-panning");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }

  if (media.kind === "video") return <video src={media.src} playsInline data-auto-video data-volume={media.volume ?? 100} />;
  if (media.kind === "live-photo") {
    return <span className="live-photo"><img src={media.src} data-live-src={media.liveSrc} alt={media.altText} style={style} onPointerDown={onPointerDown} draggable={false} /><span className="live-badge">▶</span></span>;
  }
  return <img src={media.src} alt={media.altText} loading="lazy" style={style} onPointerDown={onPointerDown} draggable={false} />;
}
