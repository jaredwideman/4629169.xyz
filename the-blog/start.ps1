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

$logDir = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

# Self-restarting loop. If `next start` exits for any reason (crash, OOM,
# scheduler killing it after the default 3-day execution limit), come right
# back. The wrapping scheduled task also has RestartCount/RestartInterval as
# a second line of defense.
while ($true) {
  $stamp = Get-Date -Format "yyyy-MM-dd"
  $log = Join-Path $logDir "blog-$stamp.log"
  try {
    "[$(Get-Date -Format o)] starting next start -p 3001" | Add-Content -Path $log
    & node node_modules/next/dist/bin/next start -p 3001 2>&1 | Add-Content -Path $log
    "[$(Get-Date -Format o)] next exited with code $LASTEXITCODE" | Add-Content -Path $log
  } catch {
    "[$(Get-Date -Format o)] wrapper caught: $_" | Add-Content -Path $log
  }
  Start-Sleep -Seconds 5
}
