import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const res = NextResponse.redirect(new URL(`${base}/admin/login`, req.url), 303);
  res.cookies.delete("blog_session");
  return res;
}
