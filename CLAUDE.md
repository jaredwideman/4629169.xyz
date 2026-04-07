# 4629169.xyz

Personal hub site served at https://4629169.xyz

## Architecture

- Static site. All files in `public/` get deployed to the nginx web root.
- Nginx reverse proxy on a Windows machine handles SSL and routing.
- Jellyfin is proxied at `/jellyfin/` (runs as a Windows service, not part of this repo).
- The Buckhorner (`the-buckhorner/`) is a Next.js app deployed to `C:\apps\the-buckhorner` on the server, running on port 3001. Nginx proxies `/the-buckhorner/` to it.

## Deployment

- GitHub Actions self-hosted runner on the Windows server.
- On merge to main, `.github/workflows/deploy.yml`:
  1. Copies `public/*` to `C:\nginx\html\` (static site).
  2. Syncs `the-buckhorner/` to `C:\apps\the-buckhorner`, builds, and restarts the Node process on port 3001.
- Do NOT put files outside `public/` that you expect to be served (static site only).
- The Buckhorner uses local JSON file storage (`.data/` directory on the server) for RSVPs.

## Style

- The landing page uses a Windows 95 desktop aesthetic — keep it consistent.
- No build step. Plain HTML/CSS/JS.

## Git

- No Co-Authored-By lines in commits.
