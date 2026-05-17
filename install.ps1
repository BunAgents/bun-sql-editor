$ErrorActionPreference = "Stop"

$Repo     = "BunAgents/bun-sql-editor"
$BinName  = "bun-sql-editor.exe"
$Artifact = "bun-sql-editor-windows-x64.exe"

# ── Resolve install dir ───────────────────────────────────────────────────────
$InstallDir = "$env:LOCALAPPDATA\bun-sql-editor"
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir | Out-Null
}

# ── Check current version ─────────────────────────────────────────────────────
$CurrentVersion = ""
$ExistingBin = Join-Path $InstallDir $BinName
if (Test-Path $ExistingBin) {
    try { $CurrentVersion = & $ExistingBin --version 2>$null } catch {}
}

# ── Fetch latest release ──────────────────────────────────────────────────────
Write-Host "Fetching latest release..."
$ApiUrl      = "https://api.github.com/repos/$Repo/releases/latest"
$Release     = Invoke-RestMethod -Uri $ApiUrl -Headers @{ "User-Agent" = "bun-sql-editor-installer" }
$Version     = $Release.tag_name
$DownloadUrl = ($Release.assets | Where-Object { $_.name -eq $Artifact }).browser_download_url

if (-not $DownloadUrl) {
    Write-Error "Could not find release artifact: $Artifact"
    Write-Host "Check https://github.com/$Repo/releases"
    exit 1
}

# ── Skip if already up to date ────────────────────────────────────────────────
if ($CurrentVersion -and $CurrentVersion -eq $Version) {
    Write-Host "Already up to date: bun-sql-editor $Version"
    exit 0
}

if ($CurrentVersion) {
    Write-Host "Updating bun-sql-editor $CurrentVersion -> $Version..."
} else {
    Write-Host "Installing bun-sql-editor $Version..."
}

# ── Download ──────────────────────────────────────────────────────────────────
$TmpFile = Join-Path $env:TEMP $Artifact
Invoke-WebRequest -Uri $DownloadUrl -OutFile $TmpFile

# ── Unblock (removes SmartScreen flag) ───────────────────────────────────────
Unblock-File -Path $TmpFile

# ── Install ───────────────────────────────────────────────────────────────────
Move-Item -Force $TmpFile "$InstallDir\$BinName"

# ── Add to PATH if not already there ─────────────────────────────────────────
$UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($UserPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("PATH", "$UserPath;$InstallDir", "User")
    $env:PATH += ";$InstallDir"
    Write-Host "Added $InstallDir to PATH"
}

Write-Host ""
if ($CurrentVersion) {
    Write-Host "Updated: bun-sql-editor $CurrentVersion -> $Version"
} else {
    Write-Host "Installed: $InstallDir\$BinName ($Version)"
}
Write-Host ""
Write-Host "Run:  bun-sql-editor"
Write-Host "Then open http://localhost:3000"
