"use client";

export function ScrollArrow({
  to,
  direction = "down",
}: {
  to: string;
  direction?: "up" | "down";
}) {
  return (
    <a
      href={`#${to}`}
      className={`block mx-auto w-10 h-10 text-muted/30 hover:text-muted/60 transition-colors ${
        direction === "down" ? "mt-12" : "mb-12"
      }`}
      aria-label={`Scroll ${direction}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`w-full h-full animate-gentle-bounce ${
          direction === "up" ? "rotate-180" : ""
        }`}
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </a>
  );
}
