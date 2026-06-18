import Link from "next/link";

type Props = { searchParams: Promise<{ sent?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return (
    <div className="login-card">
      <h1>Sign in</h1>
      {sp.sent ? (
        <p className="notice">Check your email for a sign-in link. It expires in 15 minutes.</p>
      ) : (
        <>
          <p>Enter your email. If it&rsquo;s on the allowlist, you&rsquo;ll get a magic link.</p>
          {sp.error ? <p className="error">{decodeURIComponent(sp.error)}</p> : null}
          <form action={`${base}/api/auth/request`} method="post">
            <input type="email" name="email" required placeholder="you@example.com" autoFocus />
            <button type="submit">Send link</button>
          </form>
        </>
      )}
      <p style={{ marginTop: 24, fontSize: 12 }}>
        <Link href="/">← back to blog</Link>
      </p>
    </div>
  );
}
