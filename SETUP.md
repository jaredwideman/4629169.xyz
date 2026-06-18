# Blog setup — one-time

Do these steps once. After that, push to `main` and the Action handles everything.

## 1. Resend (magic-link email)

1. Sign up at https://resend.com (free: 100 emails/day).
2. **Quick start (no domain):** use sender `onboarding@resend.dev`. Works immediately, but Resend only lets you send to addresses verified in your account — add your inbox in **Audiences → Contacts** or just use the email tied to your Resend account.
3. **Better:** add a domain you own (e.g. `4629169.xyz`), create the DNS records Resend gives you, and use a sender like `blog@4629169.xyz`. Then you can email any address.
4. Copy your API key from **API Keys** → looks like `re_xxx`.

## 2. GitHub Personal Access Token (so the server can push new posts)

1. https://github.com/settings/tokens?type=beta → **Generate new token (Fine-grained)**.
2. Repository access: **Only select repositories** → `jaredwideman/4629169.xyz`.
3. Permissions: **Repository permissions → Contents: Read and write**.
4. Expiration: 1 year (set a calendar reminder to rotate).
5. Copy the token (`github_pat_...`).

## 3. Generate a session secret

```bash
openssl rand -base64 48
```

## 4. Add GitHub repo secrets

Go to https://github.com/jaredwideman/4629169.xyz/settings/secrets/actions and add:

| Name              | Value                                                                       |
|-------------------|-----------------------------------------------------------------------------|
| `ALLOWED_EMAILS`  | Comma-separated emails allowed to log in. e.g. `you@example.com`            |
| `SESSION_SECRET`  | The output of step 3                                                        |
| `RESEND_API_KEY`  | From step 1                                                                 |
| `MAIL_FROM`       | The verified sender, e.g. `onboarding@resend.dev` or `blog@4629169.xyz`     |
| `BLOG_GIT_PAT`    | The PAT from step 2                                                         |

## 5. Push and deploy

```bash
git push origin main
```

The Action will:
- Remove the old Buckhorner app and nginx rule.
- Add the `/blog/` nginx proxy.
- Clone the repo to `C:\apps\blog-content` (the working checkout the app reads/writes posts in).
- Build & start `the-blog` as a scheduled task on port 3001.

## 6. First sign-in

1. Visit https://4629169.xyz/blog/admin/login
2. Enter your allowlisted email → click the link in your inbox.
3. You're in. Click **New post**, write, drag-drop a photo or video, click **Publish**.
4. Confirm a commit appears at https://github.com/jaredwideman/4629169.xyz/commits/main authored by "Blog Bot".

## Troubleshooting

- **Magic-link email never arrives** — check the runner logs, then look at https://resend.com/emails. If using `onboarding@resend.dev`, your destination email must be verified on Resend.
- **`Saved (git: ...)`** after publish — the post is on disk and live, but the push to GitHub failed. Check that `BLOG_GIT_PAT` has Contents: Read and write on this repo.
- **Logs**: PowerShell job logs go to the Actions run. Live blog logs: scheduled task "The Blog" on the Windows host.
- **Force a rebuild without code changes**: Actions tab → Deploy to server → **Run workflow**.
- **Edit nginx by hand** if needed: `C:\nginx\conf\nginx.conf`, then `C:\nginx\nginx.exe -p C:\nginx -s reload`.

## Backups

- `posts/` lives in git — already backed up.
- `C:\apps\the-blog\public\uploads\` is **not** in git. Set up periodic copies to OneDrive / external drive / S3 once you start uploading things you care about.
