"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";

const GOATCHELLA_INFO =
  "A one-day festival on a 200-acre farm in Port Hope. Goat races, pig races, chicken bingo, dog dancing, alpaca meet & greets, hay wagon rides, live music, artisan vendors, face painting, and something called a Mini Shmurgle. Admission is $10.";

export function GoatchellaInfo() {
  const [showTooltip, setShowTooltip] = useState(false);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFading(false);
    setShowTooltip(true);

    timerRef.current = setTimeout(() => {
      setFading(true);
      setTimeout(() => {
        setShowTooltip(false);
        setFading(false);
      }, 500);
    }, 10000);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFading(true);
    setTimeout(() => {
      setShowTooltip(false);
      setFading(false);
    }, 500);
  }, []);

  return (
    <div className="flex flex-col items-center text-center">
      <a href="https://hautegoat.com/goatchella/" target="_blank" rel="noopener noreferrer">
        <Image
          src="/haute-goat.png"
          alt="Haute Goat"
          width={220}
          height={120}
          className="mb-8 hover:opacity-80 transition-opacity"
        />
      </a>

      <p className="text-muted text-lg max-w-md">
        Planning a group trip to Goatchella in Newtonville.
        <br />
        Saturday, August 22.
      </p>

      {/* wtf is goatchella */}
      <div className="relative mt-6">
        <span
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="text-muted/40 text-sm italic rotate-[-2deg] inline-block hover:text-muted/70 transition-colors cursor-help"
        >
          wtf is
          <br />
          goatchella?
        </span>

        {showTooltip && (
          <div
            className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-4 bg-card-bg border border-card-border rounded-xl text-sm text-muted leading-relaxed shadow-lg transition-opacity duration-500 ${
              fading ? "opacity-0" : "opacity-100"
            }`}
          >
            {GOATCHELLA_INFO}
          </div>
        )}
      </div>
    </div>
  );
}
