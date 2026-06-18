import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const ALG = "HS256";
const COOKIE = "blog_session";
const SESSION_DAYS = 30;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET is not set or too short");
  return new TextEncoder().encode(s);
}

export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(email: string) {
  return allowedEmails().includes(email.trim().toLowerCase());
}

export type SessionPayload = { email: string };
export type LinkPayload = { email: string; nonce: string; purpose: "magic" };

export async function signSession(email: string) {
  return await new SignJWT({ email })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .setSubject("session")
    .sign(secret());
}

export async function signMagicLink(email: string) {
  const nonce = crypto.randomUUID();
  return await new SignJWT({ email, nonce, purpose: "magic" })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("15m")
    .setSubject("magic")
    .sign(secret());
}

export async function verifyToken<T>(token: string, expectedSub: "session" | "magic"): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.sub !== expectedSub) return null;
    return payload as unknown as T;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.delete(COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return null;
  return await verifyToken<SessionPayload>(token, "session");
}

export async function requireSession(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s || !isAllowed(s.email)) throw new Error("UNAUTHORIZED");
  return s;
}
