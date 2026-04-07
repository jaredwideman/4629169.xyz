"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface ActivityDef {
  label: string;
  time: string;
  day: "friday" | "saturday";
}

const ACTIVITY_DEFS: ActivityDef[] = [
  { label: "Morning Golf", time: "~9am", day: "friday" },
  { label: "BBQ", time: "~1pm", day: "friday" },
  { label: "Liftlock Cruise", time: "~3pm", day: "friday" },
  { label: "Backyard Campfire", time: "evening", day: "friday" },
  { label: "Goatchella", time: "daytime", day: "saturday" },
];

type Activity = string;

interface GuestEntry {
  name: string;
  activities: Activity[];
  dietary: string;
  showDietary: boolean;
}

const MAX_GUESTS = 4;

function emptyGuest(): GuestEntry {
  return { name: "", activities: [], dietary: "", showDietary: false };
}

export function RSVPForm() {
  const [guests, setGuests] = useState<GuestEntry[]>([emptyGuest()]);
  const [fridayArrival] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function updateGuest(index: number, updates: Partial<GuestEntry>) {
    setGuests((prev) =>
      prev.map((g, i) => (i === index ? { ...g, ...updates } : g))
    );
  }

  function toggleActivity(guestIndex: number, activity: Activity) {
    setGuests((prev) =>
      prev.map((g, i) => {
        if (i !== guestIndex) return g;
        const has = g.activities.includes(activity);
        return {
          ...g,
          activities: has
            ? g.activities.filter((a) => a !== activity)
            : [...g.activities, activity],
        };
      })
    );
  }

  const [expandingIn, setExpandingIn] = useState<number | null>(null);
  const [collapsingOut, setCollapsingOut] = useState<number | null>(null);
  const animating = expandingIn !== null || collapsingOut !== null;
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // When a new card mounts collapsed, expand it on the next frame
  useEffect(() => {
    if (expandingIn === null) return;
    const frame = requestAnimationFrame(() => {
      setExpandingIn(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [expandingIn]);

  const addGuest = useCallback(() => {
    if (guests.length >= MAX_GUESTS || animating) return;
    setExpandingIn(guests.length);
    setGuests((prev) => [...prev, emptyGuest()]);
  }, [guests.length, animating]);

  const removeGuest = useCallback((index: number) => {
    if (guests.length <= 1 || animating) return;
    setCollapsingOut(index);
    setTimeout(() => {
      setGuests((prev) => prev.filter((_, i) => i !== index));
      setCollapsingOut(null);
    }, 300);
  }, [guests.length, animating]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const filledGuests = guests.filter((g) => g.name.trim());
    if (filledGuests.length === 0) {
      setError("Need at least one name.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guests: filledGuests.map((g) => ({
            name: g.name,
            activities: g.activities,
            dietary: g.dietary || null,
          })),
          friday_arrival: fridayArrival,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={() => setSubmitted(false)}
        />
        <div className="relative bg-card-bg border border-card-border rounded-2xl p-10 max-w-sm mx-6 text-center shadow-2xl">
          <p className="text-4xl font-bold mb-3">You&apos;re in.</p>
          <p className="text-muted text-lg mb-8">
            We&apos;ll send details closer to the date.
          </p>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="px-8 py-3 border border-card-border rounded-full text-muted text-sm hover:border-accent hover:text-accent transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const activityBtn = (active: boolean) =>
    `w-full py-2.5 px-4 rounded-xl border text-sm font-medium text-left transition-all duration-200 flex items-center justify-between ${
      active
        ? "bg-accent/10 border-accent text-accent"
        : "bg-background border-card-border text-muted hover:border-muted/40"
    }`;

  const inputClass =
    "w-full bg-background border border-card-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent transition-colors";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center space-y-6">
      {/* Guest columns */}
      <div className="w-full">
        <label className="block text-sm font-medium text-muted mb-5 text-center">
          Who&apos;s coming?
        </label>
        <div className="flex flex-wrap justify-center gap-5">
          {guests.map((guest, i) => {
            const isEntering = expandingIn === i;
            const isLeaving = collapsingOut === i;
            const collapsed = isEntering || isLeaving;
            const widthClass =
              guests.length === 1
                ? "sm:w-80"
                : guests.length === 2
                  ? "sm:w-72"
                  : guests.length === 3
                    ? "sm:w-64"
                    : "sm:w-56";
            return (
            <div
              key={i}
              className={`${widthClass} shrink-0 w-full guest-card-wrapper ${
                collapsed ? "collapsed" : "expanded"
              }`}
            >
            <div
              className="overflow-hidden"
            >
            <div
              ref={(el) => { if (el) cardRefs.current.set(i, el); else cardRefs.current.delete(i); }}
              className="bg-card-bg border border-card-border rounded-2xl p-5 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-muted/60 text-xs uppercase tracking-wider">
                  {i === 0 ? "You" : `Guest ${i + 1}`}
                </span>
                {i > 0 && (
                  <button
                    type="button"
                    className="text-muted/30 hover:text-red-400 text-xs transition-colors"
                    onClick={() => removeGuest(i)}
                  >
                    remove
                  </button>
                )}
              </div>

              <input
                type="text"
                required={i === 0}
                className={inputClass}
                placeholder="Name"
                value={guest.name}
                onChange={(e) => updateGuest(i, { name: e.target.value })}
              />

              <div className="flex flex-col gap-3">
                <p className="text-muted/50 text-xs uppercase tracking-wider">
                  Friday, Aug 21
                </p>
                <div className="flex flex-col gap-2">
                  {ACTIVITY_DEFS.filter((a) => a.day === "friday").map((activity) => (
                    <button
                      key={activity.label}
                      type="button"
                      className={activityBtn(guest.activities.includes(activity.label))}
                      onClick={() => toggleActivity(i, activity.label)}
                    >
                      <span>{activity.label}</span>
                      <span className="italic text-xs opacity-60">{activity.time}</span>
                    </button>
                  ))}
                </div>
                <p className="text-muted/50 text-xs uppercase tracking-wider mt-1">
                  Saturday, Aug 22
                </p>
                <div className="flex flex-col gap-2">
                  {ACTIVITY_DEFS.filter((a) => a.day === "saturday").map((activity) => (
                    <button
                      key={activity.label}
                      type="button"
                      className={activityBtn(guest.activities.includes(activity.label))}
                      onClick={() => toggleActivity(i, activity.label)}
                    >
                      <span>{activity.label}</span>
                      <span className="italic text-xs opacity-60">{activity.time}</span>
                    </button>
                  ))}
                </div>
                {guest.activities.length === ACTIVITY_DEFS.length && (
                  <p className="text-xs italic text-center mt-1 text-muted/60">
                    Attending ALL the things makes {guest.name.trim().split(/\s+/)[0] || "you"}
                    <br />
                    <span className="rainbow-text font-semibold whitespace-nowrap">Certified Cool</span>
                  </p>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => updateGuest(i, { showDietary: !guest.showDietary })}
                  className="text-muted/40 text-xs hover:text-muted transition-colors"
                >
                  {guest.showDietary ? "Hide dietary restrictions" : "Dietary restrictions?"}
                </button>
                {guest.showDietary && (
                  <textarea
                    className={`${inputClass} mt-2 resize-none text-sm`}
                    rows={2}
                    placeholder="Vegetarian, allergies, etc."
                    value={guest.dietary}
                    onChange={(e) => updateGuest(i, { dietary: e.target.value })}
                  />
                )}
              </div>
            </div>
            </div>
            </div>
          );
          })}
        </div>

        {guests.length < MAX_GUESTS && (
          <div className="text-center mt-6">
            <button
              type="button"
              onClick={addGuest}
              className="px-6 py-2.5 border border-dashed border-card-border rounded-full text-muted text-sm hover:border-accent hover:text-accent transition-colors"
            >
              + Add another person
            </button>
          </div>
        )}
      </div>

      {/* Submit */}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full max-w-md py-4 bg-accent text-background font-bold text-lg rounded-full hover:bg-accent-soft transition-colors disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}
