"use client";

import { useEffect, useState } from "react";

interface GuestEntry {
  name: string;
  activities: string[];
}

const REVEAL_THRESHOLD = 8;

export function GuestList() {
  const [guests, setGuests] = useState<GuestEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGuests() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/guests`);
        if (res.ok) {
          const data = await res.json();
          setGuests(data.guests ?? []);
        }
      } catch {
        // silently fail — guest list is a nice-to-have
      } finally {
        setLoading(false);
      }
    }
    fetchGuests();
  }, []);

  const count = guests.length;
  const revealed = count >= REVEAL_THRESHOLD;

  if (loading) {
    return (
      <div className="text-muted animate-pulse">
        <h2 className="text-3xl font-bold mb-4">Who&apos;s Coming</h2>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-4">Who&apos;s Coming</h2>
      {!revealed ? (
        <div>
          <p className="text-muted text-lg">
            <span className="text-accent font-bold text-2xl">{count}</span> /{" "}
            {REVEAL_THRESHOLD} RSVPs so far.
          </p>
          <p className="text-muted/60 mt-2">
            Guest list unlocks at {REVEAL_THRESHOLD}. Be the reason someone else
            says yes.
          </p>
          <div className="mt-6 w-full bg-card-bg rounded-full h-3 overflow-hidden border border-card-border">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${(count / REVEAL_THRESHOLD) * 100}%` }}
            />
          </div>
        </div>
      ) : (
        <div>
          <p className="text-muted mb-6">
            <span className="text-accent font-bold">{count}</span> people are
            in. Here&apos;s who:
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {guests.map((guest, i) => (
              <div
                key={i}
                className="bg-card-bg border border-card-border rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <span className="font-medium">{guest.name}</span>
                <span className="text-muted text-xs">
                  {guest.activities.join(" \u00B7 ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
