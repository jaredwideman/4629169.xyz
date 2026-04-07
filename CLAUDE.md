# 4629169.xyz

Personal hub site served at https://4629169.xyz

## Architecture

- Static site. All files in `public/` get deployed to the nginx web root.
- Nginx reverse proxy on a Windows machine handles SSL and routing.
- Jellyfin is proxied at `/jellyfin/` (runs as a Windows service, not part of this repo).
- The Buckhorner will live at `/the-buckhorner/`.

## Deployment

- GitHub Actions self-hosted runner on the Windows server.
- On merge to main, `.github/workflows/deploy.yml` copies `public/*` to `C:\nginx\html\`.
- Do NOT put files outside `public/` that you expect to be served.

## Style

- The landing page uses a Windows 95 desktop aesthetic — keep it consistent.
- No build step. Plain HTML/CSS/JS.

## Git

- No Co-Authored-By lines in commits.
