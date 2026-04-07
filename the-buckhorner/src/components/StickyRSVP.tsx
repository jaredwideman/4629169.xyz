"use client";

import { useEffect, useState } from "react";

export function StickyRSVP() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const rsvpEl = document.getElementById("rsvp");
    function onScroll() {
      const scrollPercent =
        window.scrollY /
        (document.documentElement.scrollHeight - window.innerHeight);
      if (scrollPercent < 0.1) {
        setVisible(false);
        return;
      }
      if (rsvpEl) {
        const rect = rsvpEl.getBoundingClientRect();
        setVisible(rect.top > window.innerHeight);
      } else {
        setVisible(true);
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <a
      href="#rsvp"
      className="fixed bottom-6 right-6 z-40 px-6 py-3 bg-accent text-background font-semibold rounded-full hover:bg-accent-soft transition-all duration-300 shadow-lg animate-fade-up"
    >
      I&apos;ve heard enough, RSVP
    </a>
  );
}
