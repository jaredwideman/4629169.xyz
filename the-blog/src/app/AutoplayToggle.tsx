"use client";

import { useEffect, useState } from "react";

const KEY = "blog-video-autoplay";

export function getAutoplaySetting() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(KEY) !== "false";
}

export default function AutoplayToggle() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(getAutoplaySetting());
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    window.localStorage.setItem(KEY, String(next));
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
