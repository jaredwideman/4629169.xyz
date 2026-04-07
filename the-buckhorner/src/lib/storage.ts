import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const RSVPS_FILE = path.join(DATA_DIR, "rsvps.json");

interface GuestEntry {
  name: string;
  activities: string[];
}

interface RSVPRecord {
  id: string;
  guests: GuestEntry[];
  dietary_notes: string | null;
  friday_arrival: boolean;
  created_at: string;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readRSVPs(): RSVPRecord[] {
  ensureDataDir();
  if (!fs.existsSync(RSVPS_FILE)) return [];
  return JSON.parse(fs.readFileSync(RSVPS_FILE, "utf-8"));
}

function writeRSVPs(rsvps: RSVPRecord[]) {
  ensureDataDir();
  fs.writeFileSync(RSVPS_FILE, JSON.stringify(rsvps, null, 2));
}

export async function upsertRSVP(data: {
  guests: GuestEntry[];
  dietary_notes: string | null;
  friday_arrival: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const rsvps = readRSVPs();
  const primaryName = data.guests[0]?.name;

  const existing = rsvps.findIndex(
    (r) => r.guests[0]?.name.toLowerCase() === primaryName.toLowerCase()
  );

  const record: RSVPRecord = {
    id: existing >= 0 ? rsvps[existing].id : crypto.randomUUID(),
    guests: data.guests,
    dietary_notes: data.dietary_notes,
    friday_arrival: data.friday_arrival,
    created_at:
      existing >= 0 ? rsvps[existing].created_at : new Date().toISOString(),
  };

  if (existing >= 0) {
    rsvps[existing] = record;
  } else {
    rsvps.push(record);
  }
  writeRSVPs(rsvps);
  return { success: true };
}

export async function getAllGuests(): Promise<GuestEntry[]> {
  return readRSVPs().flatMap((r) => r.guests);
}

export async function getGuestCount(): Promise<number> {
  const guests = await getAllGuests();
  return guests.length;
}
