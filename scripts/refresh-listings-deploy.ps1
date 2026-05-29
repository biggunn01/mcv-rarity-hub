param(
  [switch]$ForceDeploy,
  [int]$LockMinutes = 25
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$LogDir = Join-Path $RepoRoot "logs"
$LockFile = Join-Path $RepoRoot "tmp\refresh-listings-deploy.lock"
$LogFile = Join-Path $LogDir "refresh-listings-deploy.log"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $LockFile -Parent) | Out-Null

function Write-RefreshLog {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -Path $LogFile -Value $line
  Write-Output $line
}

function Get-ListingsFingerprint {
  $listingDir = Join-Path $RepoRoot "data\market\opensea-listings"
  if (!(Test-Path $listingDir)) {
    return ""
  }

  $items = Get-ChildItem -Path $listingDir -Filter "*.json" |
    Sort-Object FullName |
    ForEach-Object {
      $hash = Get-FileHash -Algorithm SHA256 -Path $_.FullName
      "{0}:{1}:{2}" -f $_.Name, $_.Length, $hash.Hash
    }

  return ($items -join "|")
}

function Invoke-Logged {
  param(
    [string]$Command,
    [string[]]$Arguments
  )

  Write-RefreshLog ("RUN {0} {1}" -f $Command, ($Arguments -join " "))
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $Command @Arguments 2>&1 | ForEach-Object { Write-RefreshLog ([string]$_) }
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorPreference
  }

  if ($exitCode -ne 0) {
    throw "Command failed with exit code ${exitCode}: $Command"
  }
}

Set-Location $RepoRoot

if (Test-Path $LockFile) {
  $lockAge = (Get-Date) - (Get-Item $LockFile).LastWriteTime
  if ($lockAge.TotalMinutes -lt $LockMinutes) {
    Write-RefreshLog "SKIP another refresh appears active; lock age $([math]::Round($lockAge.TotalMinutes, 1))m"
    exit 0
  }

  Write-RefreshLog "Removing stale lock age $([math]::Round($lockAge.TotalMinutes, 1))m"
  Remove-Item -Path $LockFile -Force
}

try {
  Set-Content -Path $LockFile -Value ("pid={0}`nstarted={1:o}" -f $PID, (Get-Date))

  $before = Get-ListingsFingerprint
  Invoke-Logged "node" @("scripts\import-opensea-listings.mjs")
  $after = Get-ListingsFingerprint

  if ($ForceDeploy -or $before -ne $after) {
    Write-RefreshLog "Listings changed; rebuilding and deploying production"
    Invoke-Logged "npm.cmd" @("run", "build")
    Invoke-Logged "vercel.cmd" @("deploy", "--prod")
    Write-RefreshLog "DONE deployed refreshed listing data"
  } else {
    Write-RefreshLog "DONE listings unchanged; deploy skipped"
  }
} catch {
  Write-RefreshLog ("ERROR " + $_.Exception.Message)
  exit 1
} finally {
  if (Test-Path $LockFile) {
    Remove-Item -Path $LockFile -Force
  }
}
