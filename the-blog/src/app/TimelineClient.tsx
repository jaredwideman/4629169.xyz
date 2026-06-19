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
  const loadingRef = useRef(false);

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
    loadingRef.current = true;
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
      if (requestId === requestIdRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const json = await fetchPage(activeTags, nextCursor);
    setItems((existing) => {
      const seen = new Set(existing.map((item) => item.id));
      return [...existing, ...json.items.filter((item) => !seen.has(item.id))];
    });
    setNextCursor(json.nextCursor);
    setAvailableTags(json.tags);
    loadingRef.current = false;
    setLoading(false);
  }, [activeTags, fetchPage, nextCursor]);

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
        <TimelineMediaGrid media={media} />
        {item.captionHtml ? <figcaption dangerouslySetInnerHTML={{ __html: item.captionHtml }} /> : null}
      </figure>
      <div className="timeline-tags">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
    </article>
  );
}

type CardMedia = { kind: string; src: string; liveSrc?: string; altText: string; positionX?: number; positionY?: number; volume?: number };

type MediaRow = { indexes: number[]; aspectSum: number };

function buildSmartRows(aspects: number[]): MediaRow[] {
  if (aspects.length <= 1) return [{ indexes: aspects.map((_a, i) => i), aspectSum: aspects.reduce((a, b) => a + b, 0) || 1 }];

  if (aspects.length === 4) {
    return [{ indexes: [0, 1, 2, 3], aspectSum: aspects.reduce((a, b) => a + b, 0) }];
  }

  const targetAspect = 2.7;
  const maxPerRow = 3;
  const sums = aspects.reduce<number[]>((acc, aspect) => [...acc, acc[acc.length - 1] + aspect], [0]);
  const memo = new Map<number, { cost: number; rows: MediaRow[] }>();

  function rowAspect(from: number, to: number) {
    return sums[to] - sums[from];
  }

  function bestFrom(index: number): { cost: number; rows: MediaRow[] } {
    if (index >= aspects.length) return { cost: 0, rows: [] };
    const cached = memo.get(index);
    if (cached) return cached;

    let best: { cost: number; rows: MediaRow[] } | null = null;
    const remaining = aspects.length - index;
    const maxCount = Math.min(maxPerRow, remaining);
    for (let count = 1; count <= maxCount; count++) {
      // Avoid layouts like 3 + 1 when 2 + 2 would be much more balanced.
      if (remaining > 1 && remaining - count === 1) continue;
      const aspectSum = rowAspect(index, index + count);
      const continuation = bestFrom(index + count);
      const singletonPenalty = count === 1 && aspects.length > 1 ? 1.5 : 0;
      const cost = Math.abs(aspectSum - targetAspect) + singletonPenalty + continuation.cost;
      if (!best || cost < best.cost) {
        best = {
          cost,
          rows: [{ indexes: Array.from({ length: count }, (_v, i) => index + i), aspectSum }, ...continuation.rows],
        };
      }
    }

    const result = best || { cost: 0, rows: [{ indexes: [index], aspectSum: aspects[index] }] };
    memo.set(index, result);
    return result;
  }

  return bestFrom(0).rows;
}

function TimelineMediaGrid({ media }: { media: CardMedia[] }) {
  const [aspects, setAspects] = useState<Record<number, number>>({});
  const canSmartLayout = media.length > 1 && media.every((m) => m.kind === "image");
  const hasAllAspects = canSmartLayout && media.every((_m, index) => aspects[index]);
  const rows = useMemo(() => hasAllAspects ? buildSmartRows(media.map((_m, index) => aspects[index])) : [], [aspects, hasAllAspects, media]);

  function noteAspect(index: number, img: HTMLImageElement) {
    if (!canSmartLayout || !img.naturalWidth || !img.naturalHeight) return;
    const aspect = img.naturalWidth / img.naturalHeight;
    setAspects((existing) => existing[index] === aspect ? existing : { ...existing, [index]: aspect });
  }

  if (hasAllAspects) {
    return (
      <div className="timeline-media-smart">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="timeline-media-row">
            {row.indexes.map((index) => (
              <div key={`${media[index].src}:${index}`} className="timeline-media-cell" style={{ flex: `${aspects[index]} 1 0` }}>
                <TimelineMedia media={media[index]} index={index} onImageLoad={noteAspect} crop={false} />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`timeline-media-grid media-count-${Math.min(media.length, 6)} remainder-${media.length % 3}`}>
      {media.map((m, index) => <TimelineMedia key={`${m.src}:${index}`} media={m} index={index} onImageLoad={noteAspect} crop />)}
    </div>
  );
}

function TimelineMedia({ media, index, onImageLoad, crop }: { media: CardMedia; index: number; onImageLoad?: (index: number, img: HTMLImageElement) => void; crop: boolean }) {
  const [position, setPosition] = useState({ x: media.positionX ?? 50, y: media.positionY ?? 50 });
  const style = crop ? { objectPosition: `${position.x}% ${position.y}%` } : undefined;

  function onPointerDown(e: React.PointerEvent<HTMLImageElement>) {
    if (!crop) return;
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

  if (media.kind === "video") return <video src={media.src} playsInline muted loop autoPlay preload="metadata" data-auto-video data-volume={media.volume ?? 100} />;
  if (media.kind === "live-photo") {
    return <span className="live-photo"><img src={media.src} data-live-src={media.liveSrc} alt={media.altText} style={style} onPointerDown={onPointerDown} onLoad={(e) => onImageLoad?.(index, e.currentTarget)} draggable={false} /><span className="live-badge">▶</span></span>;
  }
  return <img src={media.src} alt={media.altText} loading="lazy" style={style} onPointerDown={onPointerDown} onLoad={(e) => onImageLoad?.(index, e.currentTarget)} draggable={false} />;
}
