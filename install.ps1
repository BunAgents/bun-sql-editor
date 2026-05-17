$ErrorActionPreference = "Stop"

$Repo       = "BunAgents/bun-sql-editor"
$BinName    = "bun-sql-editor.exe"
$Artifact   = "bun-sql-editor-windows-x64.exe"
$InstallDir = "$env:LOCALAPPDATA\bun-sql-editor"
$ExistingBin = Join-Path $InstallDir $BinName

# ── Create Desktop shortcut ───────────────────────────────────────────────────
function New-Shortcut {
    param($BinPath)

    # Download icon
    $IconPath = Join-Path $InstallDir "bun-sql-editor.ico"
    try {
        $SvgUrl  = "https://raw.githubusercontent.com/$Repo/main/landing/logo.svg"
        $TmpSvg  = Join-Path $env:TEMP "bsql-icon.svg"
        Invoke-WebRequest -Uri $SvgUrl -OutFile $TmpSvg -ErrorAction SilentlyContinue

        # Convert SVG → ICO via System.Drawing (available on Windows 10+)
        Add-Type -AssemblyName System.Drawing
        $bmp = New-Object System.Drawing.Bitmap(256, 256)
        $g   = [System.Drawing.Graphics]::FromImage($bmp)
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.Dispose()
        $bmp.Save($IconPath, [System.Drawing.Imaging.ImageFormat]::Icon)
        $bmp.Dispose()
        Remove-Item $TmpSvg -ErrorAction SilentlyContinue
    } catch {
        $IconPath = $BinPath  # fallback: use binary as icon source
    }

    # Launcher: start binary and open browser
    $LauncherPath = Join-Path $InstallDir "bun-sql-editor-launcher.vbs"
    @"
Set oShell = CreateObject("WScript.Shell")
oShell.Run """$BinPath""", 0, False
WScript.Sleep 1000
oShell.Run "http://localhost:3000"
"@ | Set-Content $LauncherPath

    # Desktop shortcut
    $DesktopPath = [Environment]::GetFolderPath("Desktop")
    $ShortcutPath = Join-Path $DesktopPath "Bun SQL Editor.lnk"
    $Shell    = New-Object -ComObject WScript.Shell
    $Shortcut = $Shell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath      = "wscript.exe"
    $Shortcut.Arguments       = "`"$LauncherPath`""
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.Description     = "Bun SQL Editor — local SQL workbench"
    $Shortcut.IconLocation    = "$IconPath,0"
    $Shortcut.Save()

    Write-Host "Created Desktop shortcut: $ShortcutPath"
}

# ── Remove shortcut ───────────────────────────────────────────────────────────
function Remove-Shortcut {
    $DesktopPath  = [Environment]::GetFolderPath("Desktop")
    $ShortcutPath = Join-Path $DesktopPath "Bun SQL Editor.lnk"
    $LauncherPath = Join-Path $InstallDir "bun-sql-editor-launcher.vbs"
    $IconPath     = Join-Path $InstallDir "bun-sql-editor.ico"

    if (Test-Path $ShortcutPath)  { Remove-Item -Force $ShortcutPath;  Write-Host "Removed: $ShortcutPath" }
    if (Test-Path $LauncherPath)  { Remove-Item -Force $LauncherPath }
    if (Test-Path $IconPath)      { Remove-Item -Force $IconPath }
}

# ── Uninstall mode ────────────────────────────────────────────────────────────
if ($args -contains "uninstall" -or $args -contains "remove") {
    Remove-Shortcut

    if (-not (Test-Path $ExistingBin)) {
        Write-Host "bun-sql-editor is not installed at $ExistingBin"
        exit 0
    }
    Remove-Item -Force $ExistingBin

    # Remove install dir from user PATH
    $UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    $NewPath  = ($UserPath -split ";" | Where-Object { $_ -ne $InstallDir }) -join ";"
    [Environment]::SetEnvironmentVariable("PATH", $NewPath, "User")

    Write-Host "Removed: $ExistingBin"
    Write-Host "Removed $InstallDir from PATH"
    exit 0
}

# ── Resolve install dir ───────────────────────────────────────────────────────
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir | Out-Null
}

# ── Check current version ─────────────────────────────────────────────────────
$CurrentVersion = ""
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

# ── Install binary ────────────────────────────────────────────────────────────
Move-Item -Force $TmpFile "$InstallDir\$BinName"

# ── Add to PATH if not already there ─────────────────────────────────────────
$UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($UserPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("PATH", "$UserPath;$InstallDir", "User")
    $env:PATH += ";$InstallDir"
    Write-Host "Added $InstallDir to PATH"
}

# ── Create Desktop shortcut ───────────────────────────────────────────────────
New-Shortcut -BinPath $ExistingBin

Write-Host ""
if ($CurrentVersion) {
    Write-Host "Updated: bun-sql-editor $CurrentVersion -> $Version"
} else {
    Write-Host "Installed: $InstallDir\$BinName ($Version)"
}
Write-Host ""
Write-Host "Run:  bun-sql-editor   or double-click the Desktop shortcut"
Write-Host "Then open http://localhost:3000"
