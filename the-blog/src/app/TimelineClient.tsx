"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LivePhotoScript from "./LivePhotoScript";
import AutoplayToggle from "./AutoplayToggle";
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
const ESTIMATED_ITEM_HEIGHT = 560;
const OVERSCAN = 4;

function setQueryTags(tags: string[]) {
  const url = new URL(window.location.href);
  if (tags.length) url.searchParams.set("tags", tags.join(","));
  else url.searchParams.delete("tags");
  window.location.href = url.toString();
}

export default function TimelineClient({ initialItems, initialCursor, allTags, selectedTags }: Props) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState({ start: 0, end: Math.min(initialItems.length, 10) });
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const tagsKey = selectedTags.join(",");

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading) return;
    setLoading(true);
    const params = new URLSearchParams({ cursor: nextCursor, limit: "12" });
    if (tagsKey) params.set("tags", tagsKey);
    const res = await fetch(`${BASE}/api/timeline?${params.toString()}`);
    const json = await res.json() as PagePayload;
    setItems((existing) => {
      const seen = new Set(existing.map((item) => item.id));
      return [...existing, ...json.items.filter((item) => !seen.has(item.id))];
    });
    setNextCursor(json.nextCursor);
    setLoading(false);
  }, [loading, nextCursor, tagsKey]);

  useEffect(() => {
    const onScroll = () => {
      const start = Math.max(0, Math.floor(window.scrollY / ESTIMATED_ITEM_HEIGHT) - OVERSCAN);
      const visible = Math.ceil(window.innerHeight / ESTIMATED_ITEM_HEIGHT) + OVERSCAN * 2;
      setRange({ start, end: Math.min(items.length, start + visible) });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [items.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    }, { rootMargin: "900px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const visibleItems = useMemo(() => items.slice(range.start, range.end), [items, range]);
  const topSpacer = range.start * ESTIMATED_ITEM_HEIGHT;
  const bottomSpacer = Math.max(0, (items.length - range.end) * ESTIMATED_ITEM_HEIGHT);

  function toggleTag(tag: string) {
    const next = selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag].sort();
    setQueryTags(next);
  }

  return (
    <>
      <div className="timeline-toolbar">
        <AutoplayToggle />
        <div className="tag-filter" aria-label="Filter by tags">
          {allTags.map(({ tag, count }) => {
            const active = selectedTags.includes(tag);
            return <button key={tag} className={active ? "active" : ""} onClick={() => toggleTag(tag)}>#{tag} <span>{count}</span></button>;
          })}
          {selectedTags.length ? <button className="clear" onClick={() => setQueryTags([])}>clear</button> : null}
        </div>
      </div>

      {items.length === 0 ? <p className="empty">No timeline items match this filter.</p> : null}

      <section className="timeline" aria-live="polite">
        <div style={{ height: topSpacer }} />
        {visibleItems.map((item) => <TimelineCard key={item.id} item={item} />)}
        <div style={{ height: bottomSpacer }} />
      </section>
      <div ref={sentinelRef} className="timeline-sentinel">{loading ? "Loading…" : nextCursor ? "Scroll for more" : items.length ? "End" : ""}</div>
      <LivePhotoScript />
    </>
  );
}

function TimelineCard({ item }: { item: TimelineItem }) {
  return (
    <article className="timeline-card">
      <time dateTime={item.date}>{item.date}</time>
      <figure>
        {item.kind === "video" ? (
          <video src={item.src} controls playsInline data-auto-video />
        ) : item.kind === "live-photo" ? (
          <span className="live-photo"><img src={item.src} data-live-src={item.liveSrc} alt={item.altText} /><span className="live-badge">▶</span></span>
        ) : (
          <img src={item.src} alt={item.altText} loading="lazy" />
        )}
        {item.captionHtml ? <figcaption dangerouslySetInnerHTML={{ __html: item.captionHtml }} /> : null}
      </figure>
      <div className="timeline-tags">{item.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
    </article>
  );
}
