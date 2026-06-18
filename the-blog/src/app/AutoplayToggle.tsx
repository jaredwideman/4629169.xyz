"use client";

import { useEffect, useState } from "react";

const AUTOPLAY_KEY = "blog-video-autoplay";
const MUTED_KEY = "blog-video-muted";

export function getAutoplaySetting() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(AUTOPLAY_KEY) !== "false";
}

export function getMutedSetting() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MUTED_KEY) !== "false";
}

export default function AutoplayToggle() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(getAutoplaySetting());
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    window.localStorage.setItem(AUTOPLAY_KEY, String(next));
    window.dispatchEvent(new CustomEvent("blog-video-autoplay-change", { detail: { enabled: next } }));
  }

  return (
    <button
      type="button"
      className={"autoplay-toggle " + (enabled ? "is-on" : "is-off")}
      onClick={toggle}
      aria-pressed={enabled}
      title={enabled ? "Autoplay is on" : "Autoplay is off"}
    >
      autoplay
    </button>
  );
}

export function MuteToggle() {
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    setMuted(getMutedSetting());
  }, []);

  function toggle() {
    const next = !muted;
    setMuted(next);
    window.localStorage.setItem(MUTED_KEY, String(next));
    window.dispatchEvent(new CustomEvent("blog-video-muted-change", { detail: { muted: next } }));
  }

  return (
    <button
      type="button"
      className={"mute-toggle " + (muted ? "is-on" : "is-off")}
      onClick={toggle}
      aria-pressed={muted}
      title={muted ? "Videos are muted" : "Videos are unmuted"}
    >
      {muted ? "muted" : "unmuted"}
    </button>
  );
}
