#!/usr/bin/env bash
set -euo pipefail

REPO="BunAgents/bun-sql-editor"
BIN_NAME="bun-sql-editor"
INSTALL_DIR="/usr/local/bin"

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

# ── Uninstall mode ────────────────────────────────────────────────────────────
if [ "${1:-}" = "uninstall" ] || [ "${1:-}" = "remove" ]; then
  BIN_PATH="$INSTALL_DIR/$BIN_NAME"
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
CURRENT_VERSION=""
if command -v "$BIN_NAME" &>/dev/null; then
  CURRENT_VERSION="$("$BIN_NAME" --version 2>/dev/null || true)"
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

# ── Install ───────────────────────────────────────────────────────────────────
if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP_FILE" "$INSTALL_DIR/$BIN_NAME"
else
  echo "Installing to $INSTALL_DIR (requires sudo)..."
  sudo mv "$TMP_FILE" "$INSTALL_DIR/$BIN_NAME"
fi

echo ""
if [ -n "$CURRENT_VERSION" ]; then
  echo "✓ Updated: $BIN_NAME $CURRENT_VERSION → $VERSION"
else
  echo "✓ Installed: $INSTALL_DIR/$BIN_NAME ($VERSION)"
fi
echo ""
echo "Run:  $BIN_NAME"
echo "Then open http://localhost:3000"
