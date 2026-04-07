Set-Location $PSScriptRoot

$env:PORT = "3001"
$env:NEXT_PUBLIC_BASE_PATH = "/the-buckhorner"

# Load .env.local if it exists
$envFile = Join-Path $PSScriptRoot ".env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
        }
    }
}

node node_modules\.bin\next start -p 3001
