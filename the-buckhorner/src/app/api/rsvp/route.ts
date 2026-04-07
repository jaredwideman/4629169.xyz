import { NextResponse } from "next/server";
import { upsertRSVP } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { guests, dietary_notes, friday_arrival } = body;

    if (!Array.isArray(guests) || guests.length === 0) {
      return NextResponse.json(
        { error: "At least one guest is required" },
        { status: 400 }
      );
    }

    if (guests.length > 4) {
      return NextResponse.json(
        { error: "Maximum 4 guests per RSVP" },
        { status: 400 }
      );
    }

    const firstGuest = guests[0];
    if (!firstGuest.name?.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const result = await upsertRSVP({
      guests: guests.map((g: { name: string; activities: string[] }) => ({
        name: g.name.trim(),
        activities: g.activities ?? [],
      })),
      dietary_notes: dietary_notes || null,
      friday_arrival: friday_arrival ?? true,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
