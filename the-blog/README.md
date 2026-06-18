# the-blog

Personal blog for 4629169.xyz. Next.js (App Router) + magic-link auth + markdown editor.

See repo root `SETUP.md` for one-time server configuration.

## Local dev

```bash
cp .env.example .env.local      # fill in ALLOWED_EMAILS, SESSION_SECRET
npm install
npm run dev                     # http://localhost:3001
```

If `RESEND_API_KEY` isn't set, magic links are logged to the server console.

## Routes

- `/blog` — public post list
- `/blog/[slug]` — public post page (drafts hidden unless logged in)
- `/blog/admin/login` — magic-link sign-in
- `/blog/admin` — post dashboard (requires session + email allowlist)
- `/blog/admin/new`, `/blog/admin/edit/[slug]` — split-pane editor

## Storage

- Posts: `posts/YYYY-MM-DD-slug.md` (frontmatter via gray-matter) under `BLOG_CONTENT_DIR`.
- Uploads: `UPLOADS_DIR/YYYY/MM/<id>.<ext>` (NOT in git). On the Windows server this is `C:\apps\blog-media\uploads`, served dynamically at `/blog/uploads/...`.
