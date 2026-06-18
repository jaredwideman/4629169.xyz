import { Resend } from "resend";

export async function sendMagicLink(to: string, link: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "onboarding@resend.dev";
  if (!apiKey) {
    // Dev fallback: log the link to the console so you can still get in.
    console.log(`[magic-link] (no RESEND_API_KEY) for ${to}: ${link}`);
    return;
  }
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to,
    subject: "Your blog sign-in link",
    text: `Click to sign in (valid 15 minutes):\n\n${link}\n\nIf you did not request this, ignore this email.`,
    html: `<p>Click to sign in (valid 15 minutes):</p><p><a href="${link}">${link}</a></p><p>If you did not request this, ignore this email.</p>`,
  });
}
