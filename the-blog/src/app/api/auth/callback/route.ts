import { NextRequest, NextResponse } from "next/server";
import { isAllowed, signSession, verifyToken, type LinkPayload } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const publicUrl = (process.env.PUBLIC_URL || new URL(req.url).origin).replace(/\/$/, "");
  const payload = await verifyToken<LinkPayload>(token, "magic");
  if (!payload || payload.purpose !== "magic" || !isAllowed(payload.email)) {
    return NextResponse.redirect(`${publicUrl}${base}/admin/login?error=${encodeURIComponent("Invalid or expired link")}`);
  }
  const session = await signSession(payload.email);
  const res = NextResponse.redirect(`${publicUrl}${base}/admin`);
  res.cookies.set("blog_session", session, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
