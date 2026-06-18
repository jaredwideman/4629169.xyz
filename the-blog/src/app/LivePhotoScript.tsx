"use client";

import { useEffect } from "react";

export default function LivePhotoScript() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const wrapper = target?.closest?.(".live-photo") as HTMLElement | null;
      if (!wrapper) return;
      const img = wrapper.querySelector("img[data-live-src]") as HTMLImageElement | null;
      if (!img) return;
      const liveSrc = img.dataset.liveSrc;
      const stillSrc = img.dataset.stillSrc || img.src;
      if (!liveSrc) return;
      img.dataset.stillSrc = stillSrc;
      const isLive = img.dataset.live === "true";
      img.src = isLive ? stillSrc : liveSrc;
      img.dataset.live = isLive ? "false" : "true";
      wrapper.classList.toggle("is-live", !isLive);
    }

    function setupVideos() {
      const videos = Array.from(document.querySelectorAll<HTMLVideoElement>("article.post video"));
      for (const video of videos) {
        video.removeAttribute("controls");
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
      }
      return videos;
    }

    let videos = setupVideos();

    function updateVideoPlayback() {
      const topSafe = window.innerHeight * 0.08;
      const bottomSafe = window.innerHeight * 0.92;
      for (const video of videos) {
        const rect = video.getBoundingClientRect();
        const safeHeight = bottomSafe - topSafe;
        const center = rect.top + rect.height / 2;
        const fullyInsideSafeArea = rect.top >= topSafe && rect.bottom <= bottomSafe;
        const tallButCentered = rect.height > safeHeight && center >= topSafe && center <= bottomSafe;
        const visibleAtAll = rect.bottom > 0 && rect.top < window.innerHeight;
        const shouldPlay = visibleAtAll && (fullyInsideSafeArea || tallButCentered);
        if (shouldPlay) {
          if (video.paused) video.play().catch(() => {});
        } else if (!video.paused) {
          video.pause();
        }
      }
    }

    let raf = 0;
    function scheduleVideoUpdate() {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        updateVideoPlayback();
      });
    }

    document.addEventListener("click", onClick);
    window.addEventListener("scroll", scheduleVideoUpdate, { passive: true });
    window.addEventListener("resize", scheduleVideoUpdate);
    updateVideoPlayback();

    // Re-scan shortly after hydration in case streamed HTML/media settles late.
    const rescan = window.setTimeout(() => {
      videos = setupVideos();
      updateVideoPlayback();
    }, 500);

    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("scroll", scheduleVideoUpdate);
      window.removeEventListener("resize", scheduleVideoUpdate);
      window.clearTimeout(rescan);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
