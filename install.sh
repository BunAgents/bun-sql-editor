#!/usr/bin/env bash
set -euo pipefail

REPO="BunAgents/bun-sql-editor"
BIN_NAME="bun-sql-editor"

# Prefer user-local dir (no sudo); fall back to /usr/local/bin
if [ -d "$HOME/.local/bin" ] || mkdir -p "$HOME/.local/bin" 2>/dev/null; then
  INSTALL_DIR="$HOME/.local/bin"
else
  INSTALL_DIR="/usr/local/bin"
fi

# ── Detect platform ───────────────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)
    case "$ARCH" in
      arm64)  ARTIFACT="bun-sql-editor-macos-arm64" ;;
      x86_64) ARTIFACT="bun-sql-editor-macos-x64" ;;
      *)      echo "Unsupported macOS architecture: $ARCH"; exit 1 ;;
    esac
    ;;
  Linux)
    case "$ARCH" in
      x86_64) ARTIFACT="bun-sql-editor-linux-x64" ;;
      *)      echo "Unsupported Linux architecture: $ARCH"; exit 1 ;;
    esac
    ;;
  *)
    echo "Unsupported OS: $OS"
    echo "Windows users: download from https://github.com/$REPO/releases"
    exit 1
    ;;
esac

# ── macOS: create .app bundle ─────────────────────────────────────────────────
create_macos_app() {
  APP_DIR="/Applications/Bun SQL Editor.app"
  CONTENTS="$APP_DIR/Contents"
  MACOS_DIR="$CONTENTS/MacOS"
  RESOURCES_DIR="$CONTENTS/Resources"

  mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

  # Launcher script — starts binary then opens browser
  BIN_PATH_FOR_LAUNCHER="$(command -v "$BIN_NAME" 2>/dev/null || echo "$INSTALL_DIR/$BIN_NAME")"
  cat > "$MACOS_DIR/bun-sql-editor-launcher" <<LAUNCHER
#!/usr/bin/env bash
"$BIN_PATH_FOR_LAUNCHER" &
sleep 1
open http://localhost:1983
LAUNCHER
  chmod +x "$MACOS_DIR/bun-sql-editor-launcher"

  # Info.plist
  cat > "$CONTENTS/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>bun-sql-editor-launcher</string>
  <key>CFBundleIdentifier</key>
  <string>com.bunagents.bun-sql-editor</string>
  <key>CFBundleName</key>
  <string>Bun SQL Editor</string>
  <key>CFBundleDisplayName</key>
  <string>Bun SQL Editor</string>
  <key>CFBundleVersion</key>
  <string>1.0</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>LSUIElement</key>
  <false/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

  # Fetch and convert SVG icon → icns (best-effort, skip if tools missing)
  if command -v rsvg-convert &>/dev/null && command -v iconutil &>/dev/null; then
    ICONSET="$RESOURCES_DIR/AppIcon.iconset"
    mkdir -p "$ICONSET"
    SVG_URL="https://raw.githubusercontent.com/$REPO/main/landing/logo.svg"
    TMP_SVG="$(mktemp /tmp/bsql-icon-XXXXXX.svg)"
    curl -fsSL "$SVG_URL" -o "$TMP_SVG" 2>/dev/null || true
    for SIZE in 16 32 64 128 256 512; do
      rsvg-convert -w $SIZE -h $SIZE "$TMP_SVG" -o "$ICONSET/icon_${SIZE}x${SIZE}.png" 2>/dev/null || true
      rsvg-convert -w $((SIZE*2)) -h $((SIZE*2)) "$TMP_SVG" -o "$ICONSET/icon_${SIZE}x${SIZE}@2x.png" 2>/dev/null || true
    done
    iconutil -c icns "$ICONSET" -o "$RESOURCES_DIR/AppIcon.icns" 2>/dev/null || true
    rm -rf "$ICONSET" "$TMP_SVG"
  fi

  echo "✓ Created: $APP_DIR"
}

# ── Linux: create .desktop entry ─────────────────────────────────────────────
create_linux_desktop() {
  DESKTOP_DIR="$HOME/.local/share/applications"
  ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
  mkdir -p "$DESKTOP_DIR" "$ICON_DIR"

  # Launcher script — starts binary then opens browser
  LAUNCHER_PATH="$HOME/.local/share/bun-sql-editor-launcher.sh"
  BIN_PATH_FOR_LAUNCHER="$(command -v "$BIN_NAME" 2>/dev/null || echo "$INSTALL_DIR/$BIN_NAME")"
  cat > "$LAUNCHER_PATH" <<LAUNCHER
#!/usr/bin/env bash
"$BIN_PATH_FOR_LAUNCHER" &
sleep 1
xdg-open http://localhost:1983
LAUNCHER
  chmod +x "$LAUNCHER_PATH"

  # Download icon (PNG fallback from SVG via rsvg-convert or ImageMagick)
  ICON_PATH="$ICON_DIR/bun-sql-editor.png"
  SVG_URL="https://raw.githubusercontent.com/$REPO/main/landing/logo.svg"
  if command -v rsvg-convert &>/dev/null; then
    TMP_SVG="$(mktemp /tmp/bsql-icon-XXXXXX.svg)"
    curl -fsSL "$SVG_URL" -o "$TMP_SVG" 2>/dev/null && \
      rsvg-convert -w 256 -h 256 "$TMP_SVG" -o "$ICON_PATH" 2>/dev/null || true
    rm -f "$TMP_SVG"
  elif command -v convert &>/dev/null; then
    TMP_SVG="$(mktemp /tmp/bsql-icon-XXXXXX.svg)"
    curl -fsSL "$SVG_URL" -o "$TMP_SVG" 2>/dev/null && \
      convert -background none -resize 256x256 "$TMP_SVG" "$ICON_PATH" 2>/dev/null || true
    rm -f "$TMP_SVG"
  fi

  ICON_VALUE="${ICON_PATH:-bun-sql-editor}"

  cat > "$DESKTOP_DIR/bun-sql-editor.desktop" <<DESKTOP
[Desktop Entry]
Name=Bun SQL Editor
Comment=Local SQL workbench for PostgreSQL, MySQL, MongoDB, ClickHouse
Exec=$LAUNCHER_PATH
Icon=$ICON_VALUE
Terminal=false
Type=Application
Categories=Development;Database;
StartupNotify=true
DESKTOP

  chmod +x "$DESKTOP_DIR/bun-sql-editor.desktop"

  # Refresh desktop database if available
  command -v update-desktop-database &>/dev/null && \
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true

  echo "✓ Created launcher: $DESKTOP_DIR/bun-sql-editor.desktop"
}

# ── Uninstall mode ────────────────────────────────────────────────────────────
if [ "${1:-}" = "uninstall" ] || [ "${1:-}" = "remove" ]; then
  BIN_PATH="$INSTALL_DIR/$BIN_NAME"

  if [ "$OS" = "Darwin" ]; then
    APP_DIR="/Applications/Bun SQL Editor.app"
    [ -d "$APP_DIR" ] && rm -rf "$APP_DIR" && echo "✓ Removed: $APP_DIR"
  elif [ "$OS" = "Linux" ]; then
    rm -f "$HOME/.local/share/applications/bun-sql-editor.desktop"
    rm -f "$HOME/.local/share/icons/hicolor/256x256/apps/bun-sql-editor.png"
    rm -f "$HOME/.local/share/bun-sql-editor-launcher.sh"
    command -v update-desktop-database &>/dev/null && \
      update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
    echo "✓ Removed launcher and icon"
  fi

  if [ ! -f "$BIN_PATH" ]; then
    echo "$BIN_NAME is not installed at $BIN_PATH"
    exit 0
  fi
  if [ -w "$INSTALL_DIR" ]; then
    rm "$BIN_PATH"
  else
    sudo rm "$BIN_PATH"
  fi
  echo "✓ Removed: $BIN_PATH"
  exit 0
fi

# ── Check current version ─────────────────────────────────────────────────────
# Use a 2-second timeout — old binaries start a server instead of printing version
CURRENT_VERSION=""
EXISTING_BIN="$(command -v "$BIN_NAME" 2>/dev/null || true)"
if [ -n "$EXISTING_BIN" ]; then
  CURRENT_VERSION="$(set +e; "$EXISTING_BIN" --version 2>/dev/null & VPID=$!; sleep 2; kill "$VPID" 2>/dev/null; wait "$VPID" 2>/dev/null; set -e)" || true
fi

# ── Resolve latest release ────────────────────────────────────────────────────
echo "Fetching latest release..."
LATEST_URL="https://api.github.com/repos/$REPO/releases/latest"

if command -v curl &>/dev/null; then
  RELEASE_JSON="$(curl -fsSL "$LATEST_URL")"
elif command -v wget &>/dev/null; then
  RELEASE_JSON="$(wget -qO- "$LATEST_URL")"
else
  echo "curl or wget is required"; exit 1
fi

DOWNLOAD_URL="$(echo "$RELEASE_JSON" | grep -o "\"browser_download_url\": \"[^\"]*${ARTIFACT}\"" | head -1 | cut -d'"' -f4)"

if [ -z "$DOWNLOAD_URL" ]; then
  echo "Could not find release artifact: $ARTIFACT"
  echo "Check https://github.com/$REPO/releases"
  exit 1
fi

VERSION="$(echo "$RELEASE_JSON" | grep -o '"tag_name": "[^"]*"' | head -1 | cut -d'"' -f4)"

# ── Skip if already up to date ────────────────────────────────────────────────
if [ -n "$CURRENT_VERSION" ] && [ "$CURRENT_VERSION" = "$VERSION" ]; then
  echo "Already up to date: $BIN_NAME $VERSION"
  exit 0
fi

if [ -n "$CURRENT_VERSION" ]; then
  echo "Updating $BIN_NAME $CURRENT_VERSION → $VERSION..."
else
  echo "Installing $BIN_NAME $VERSION ($ARTIFACT)..."
fi

# ── Download ──────────────────────────────────────────────────────────────────
TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

if command -v curl &>/dev/null; then
  curl -fsSL "$DOWNLOAD_URL" -o "$TMP_FILE"
else
  wget -qO "$TMP_FILE" "$DOWNLOAD_URL"
fi

chmod +x "$TMP_FILE"

# ── Remove macOS quarantine ───────────────────────────────────────────────────
if [ "$OS" = "Darwin" ]; then
  xattr -d com.apple.quarantine "$TMP_FILE" 2>/dev/null || true
fi

# ── Install binary ────────────────────────────────────────────────────────────
if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP_FILE" "$INSTALL_DIR/$BIN_NAME"
else
  echo "Installing to $INSTALL_DIR (requires sudo)..."
  sudo mv "$TMP_FILE" "$INSTALL_DIR/$BIN_NAME"
fi

# Warn if install dir is not on PATH
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *) echo "  ⚠ Add $INSTALL_DIR to your PATH:"
     echo "    echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.zshrc && source ~/.zshrc" ;;
esac

# ── Create shortcut ───────────────────────────────────────────────────────────
if [ "$OS" = "Darwin" ]; then
  create_macos_app
elif [ "$OS" = "Linux" ]; then
  create_linux_desktop
fi

echo ""
if [ -n "$CURRENT_VERSION" ]; then
  echo "✓ Updated: $BIN_NAME $CURRENT_VERSION → $VERSION"
else
  echo "✓ Installed: $INSTALL_DIR/$BIN_NAME ($VERSION)"
fi
echo ""
echo "Run:  $BIN_NAME"
echo "Then open http://localhost:1983"
