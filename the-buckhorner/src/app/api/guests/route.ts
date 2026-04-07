import { NextResponse } from "next/server";
import { getAllGuests } from "@/lib/storage";

export async function GET() {
  const guests = await getAllGuests();
  return NextResponse.json({ guests });
}
