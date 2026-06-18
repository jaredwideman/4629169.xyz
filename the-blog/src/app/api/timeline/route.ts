import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listTimelineItems } from "@/lib/timeline";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const params = req.nextUrl.searchParams;
  const tags = params.get("tags")?.split(",").filter(Boolean) || [];
  const cursor = params.get("cursor");
  const limit = Number(params.get("limit") || 12);
  const page = await listTimelineItems({ includeDrafts: !!session, tags, cursor, limit });
  return NextResponse.json(page);
}
