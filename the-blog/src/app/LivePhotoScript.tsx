"use client";

import { useEffect } from "react";
import { getAutoplaySetting, getMutedSetting, setMutedSetting } from "./AutoplayToggle";

// Shared WebAudio graph so per-video gain works on iOS (Mobile Safari ignores
// HTMLMediaElement.volume but respects GainNode attenuation).
let sharedAudioContext: AudioContext | null = null;
const videoGainGraphs = new WeakMap<HTMLVideoElement, GainNode>();

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx: typeof AudioContext | undefined =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioContext) {
    try {
      sharedAudioContext = new Ctx();
    } catch {
      return null;
    }
  }
  return sharedAudioContext;
}

function ensureVideoGain(video: HTMLVideoElement): GainNode | null {
  const ctx = getAudioContext();
  if (!ctx) return null;
  const existing = videoGainGraphs.get(video);
  if (existing) return existing;
  try {
    const source = ctx.createMediaElementSource(video);
    const gain = ctx.createGain();
    source.connect(gain);
    gain.connect(ctx.destination);
    videoGainGraphs.set(video, gain);
    return gain;
  } catch {
    return null;
  }
}

function applyVideoVolume(video: HTMLVideoElement) {
  const target = Math.max(0, Math.min(100, Number(video.dataset.volume || 100))) / 100;
  // Desktop browsers honor this; iOS ignores it.
  video.volume = target;
  const gain = ensureVideoGain(video);
  if (gain) gain.gain.value = target;
}

export default function LivePhotoScript() {
  useEffect(() => {
    let autoplayEnabled = getAutoplaySetting();
    let mutedEnabled = getMutedSetting();

    function videoIsInSafeViewport(video: HTMLVideoElement) {
      const rect = video.getBoundingClientRect();
      const visibleTop = Math.max(0, rect.top);
      const visibleBottom = Math.min(window.innerHeight, rect.bottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const visibleRatio = rect.height > 0 ? visibleHeight / rect.height : 0;
      return visibleRatio >= 0.8;
    }

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;

      const video = target?.closest?.("video[data-auto-video], article.post video, article.timeline-card video") as HTMLVideoElement | null;
      if (video) {
        if (video.paused) {
          if (videoIsInSafeViewport(video)) {
            video.dataset.userPaused = "false";
            video.play().catch(() => {});
          }
        } else {
          video.dataset.userPaused = "true";
          video.pause();
        }
        return;
      }

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

    function forceMutedForAutoplay() {
      if (mutedEnabled) return;
      mutedEnabled = true;
      setMutedSetting(true);
      for (const video of videos) video.muted = true;
    }

    function autoplayVideo(video: HTMLVideoElement) {
      video.play().catch(() => {
        // Browsers reject unmuted autoplay. If autoplay is enabled, prefer
        // reliable autoplay and flip the muted control back on.
        if (autoplayEnabled && !video.muted) {
          forceMutedForAutoplay();
          video.play().catch(() => {});
        }
      });
    }

    function setupVideos() {
      const found = Array.from(document.querySelectorAll<HTMLVideoElement>("video[data-auto-video], article.post video, article.timeline-card video"));
      for (const video of found) {
        video.removeAttribute("controls");
        video.defaultMuted = mutedEnabled;
        video.muted = mutedEnabled;
        applyVideoVolume(video);
        video.loop = true;
        video.autoplay = autoplayEnabled;
        video.playsInline = true;
        if (video.dataset.videoSetup !== "true") {
          video.dataset.videoSetup = "true";
          video.addEventListener("loadedmetadata", scheduleVideoUpdate);
          video.addEventListener("loadeddata", scheduleVideoUpdate);
          video.addEventListener("canplay", scheduleVideoUpdate);
        }
      }
      return found;
    }

    let videos: HTMLVideoElement[] = [];

    function updateVideoPlayback() {
      for (const video of videos) {
        const safe = videoIsInSafeViewport(video);
        const userPaused = video.dataset.userPaused === "true";
        const shouldPlay = autoplayEnabled && safe && !userPaused;
        if (shouldPlay) {
          if (video.paused) autoplayVideo(video);
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

    function onAutoplayChange(e: Event) {
      const custom = e as CustomEvent<{ enabled: boolean }>;
      autoplayEnabled = custom.detail.enabled;
      for (const video of videos) {
        video.autoplay = autoplayEnabled;
        if (autoplayEnabled) video.dataset.userPaused = "false";
      }
      updateVideoPlayback();
    }

    function onMutedChange(e: Event) {
      const custom = e as CustomEvent<{ muted: boolean }>;
      mutedEnabled = custom.detail.muted;
      for (const video of videos) {
        video.defaultMuted = mutedEnabled;
        video.muted = mutedEnabled;
      }
      updateVideoPlayback();
    }

    videos = setupVideos();

    // iOS requires a user gesture to start an AudioContext. Resume on first
    // interaction so per-video gain takes effect once the user unmutes.
    function resumeAudioContextOnGesture() {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      for (const video of videos) applyVideoVolume(video);
    }
    window.addEventListener("pointerdown", resumeAudioContextOnGesture, { once: false, passive: true });
    window.addEventListener("touchstart", resumeAudioContextOnGesture, { once: false, passive: true });

    document.addEventListener("click", onClick);
    window.addEventListener("scroll", scheduleVideoUpdate, { passive: true });
    window.addEventListener("resize", scheduleVideoUpdate);
    window.addEventListener("blog-video-autoplay-change", onAutoplayChange as EventListener);
    window.addEventListener("blog-video-muted-change", onMutedChange as EventListener);
    updateVideoPlayback();

    const rescan = window.setTimeout(() => {
      videos = setupVideos();
      updateVideoPlayback();
    }, 500);

    const observer = new MutationObserver(() => {
      videos = setupVideos();
      scheduleVideoUpdate();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("scroll", scheduleVideoUpdate);
      window.removeEventListener("resize", scheduleVideoUpdate);
      window.removeEventListener("pointerdown", resumeAudioContextOnGesture);
      window.removeEventListener("touchstart", resumeAudioContextOnGesture);
      window.removeEventListener("blog-video-autoplay-change", onAutoplayChange as EventListener);
      window.removeEventListener("blog-video-muted-change", onMutedChange as EventListener);
      window.clearTimeout(rescan);
      observer.disconnect();
      for (const video of videos) {
        video.removeEventListener("loadedmetadata", scheduleVideoUpdate);
        video.removeEventListener("loadeddata", scheduleVideoUpdate);
        video.removeEventListener("canplay", scheduleVideoUpdate);
        delete video.dataset.videoSetup;
      }
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
