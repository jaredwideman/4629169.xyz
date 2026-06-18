import { NextRequest, NextResponse } from "next/server";
import { isAllowed, signMagicLink } from "@/lib/auth";
import { sendMagicLink } from "@/lib/mail";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const publicUrl = (process.env.PUBLIC_URL || new URL(req.url).origin).replace(/\/$/, "");
  if (!email) {
    return NextResponse.redirect(`${publicUrl}${base}/admin/login?error=${encodeURIComponent("Email required")}`, 303);
  }
  // Don't reveal whether email is allowlisted; only send if it is.
  if (isAllowed(email)) {
    const token = await signMagicLink(email);
    const link = `${publicUrl}${base}/api/auth/callback?token=${encodeURIComponent(token)}`;
    try {
      await sendMagicLink(email, link);
    } catch (e) {
      console.error("magic-link send failed", e);
    }
  }
  return NextResponse.redirect(`${publicUrl}${base}/admin/login?sent=1`, 303);
}
