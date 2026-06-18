import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const publicUrl = (process.env.PUBLIC_URL || new URL(req.url).origin).replace(/\/$/, "");
  const res = NextResponse.redirect(`${publicUrl}${base}/admin/login`, 303);
  res.cookies.delete("blog_session");
  return res;
}
