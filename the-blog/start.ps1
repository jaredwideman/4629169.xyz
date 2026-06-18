$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$env:NODE_ENV = "production"
$env:PORT = "3001"
$env:NEXT_PUBLIC_BASE_PATH = "/blog"
$env:LIBHEIF_SECURITY_LIMITS = "off"
# Load .env.local manually (Next.js does this for `next start`, but the standalone server doesn't always)
if (Test-Path ".env.local") {
  Get-Content .env.local | ForEach-Object {
    if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') {
      [System.Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"'), 'Process')
    }
  }
}
node node_modules/next/dist/bin/next start -p 3001
