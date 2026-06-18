"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function DeleteButton({ filename, title, tracked }: { filename: string; title: string; tracked: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const msg = tracked
      ? `Delete "${title}"? This will remove it locally and push the deletion to GitHub.`
      : `Delete local draft/untracked post "${title}"?`;
    if (!confirm(msg)) return;
    setBusy(true);
    const res = await fetch(`${BASE}/api/posts/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, push: tracked }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      alert(json.error || `Delete failed (${res.status})`);
      return;
    }
    if (json.gitWarning) alert(`Deleted locally, but git push failed: ${json.gitWarning}`);
    router.push("/admin");
    router.refresh();
  }

  return (
    <button type="button" onClick={onDelete} disabled={busy} style={{ color: "#b00020" }}>
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
