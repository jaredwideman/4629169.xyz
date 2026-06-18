# 4629169.xyz

Personal hub site served at https://4629169.xyz

## Architecture

- Static landing page. All files in `public/` get deployed to the nginx web root.
- Nginx reverse proxy on a Windows machine handles SSL and routing.
- Jellyfin is proxied at `/jellyfin/` (runs as a Windows service, not part of this repo).
- Blog app lives in `the-blog/`, deploys to `C:\apps\the-blog`, runs on port 3001, and is proxied at `/blog` and `/blog/`.
- Blog posts are markdown files in repo-root `posts/`.
- On the server, the blog reads/writes posts via `C:\apps\blog-content`, a git checkout of this repo.
- Blog media uploads live on the Windows PC at `C:\apps\blog-media\uploads` and are served dynamically from `/blog/uploads/...`. Media is intentionally not committed to git.

## Deployment

- GitHub Actions self-hosted runner on the Windows server.
- On merge to main, `.github/workflows/deploy.yml`:
  1. Copies `public/*` to `C:\nginx\html\` (static site).
  2. Ensures nginx proxies `/blog` and `/blog/` to `127.0.0.1:3001`.
  3. Maintains `C:\apps\blog-content` for editable markdown posts.
  4. Syncs/builds `the-blog/`, writes `.env.local`, creates `C:\apps\blog-media\uploads`, and restarts the scheduled task "The Blog".

## Style

- The landing page uses a Windows 95 desktop aesthetic — keep it consistent.
- The blog uses a clean modern reading/editing UI.
- Static landing page has no build step. Plain HTML/CSS/JS.

## Git

- No Co-Authored-By lines in commits.
