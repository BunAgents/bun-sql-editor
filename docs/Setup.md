# Setup

## Install — One Line

**macOS / Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/BunAgents/bun-sql-editor/main/install.sh | bash
```

Detects your platform, downloads the latest binary, removes the macOS quarantine flag, installs to `/usr/local/bin`.

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/BunAgents/bun-sql-editor/main/install.ps1 | iex
```

Downloads the latest binary, clears the SmartScreen flag, installs to `%LOCALAPPDATA%\bun-sql-editor` and adds it to your user PATH.

## Run

```bash
bun-sql-editor
```

Open **http://localhost:3000** in your browser.

```bash
# Custom port
PORT=8080 bun-sql-editor
```

## Manual Download

Go to [Releases](https://github.com/BunAgents/bun-sql-editor/releases) and download the binary for your platform:

| Platform | File |
|----------|------|
| macOS Apple Silicon | `bun-sql-editor-macos-arm64` |
| macOS Intel | `bun-sql-editor-macos-x64` |
| Windows x64 | `bun-sql-editor-windows-x64.exe` |
| Linux x64 | `bun-sql-editor-linux-x64` |

```bash
# macOS / Linux — make executable first
chmod +x bun-sql-editor-macos-arm64
./bun-sql-editor-macos-arm64

# Remove macOS quarantine warning manually
xattr -d com.apple.quarantine bun-sql-editor-macos-arm64
```

> **Windows SmartScreen:** Click "More info" → "Run anyway"

## Build from Source

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/BunAgents/bun-sql-editor
cd bun-sql-editor
bun install
bun run dev              # → http://localhost:3000 with hot reload
bun run build:client     # bundle TypeScript client → app/public/app.js
bun run build            # type check + bundle
bun test                 # 32 unit tests, no DB required
```

Compile a self-contained binary:

```bash
# macOS ARM
bun build --compile --target=bun-darwin-arm64 app/server.ts --outfile=bun-sql-editor

# Linux x64
bun build --compile --target=bun-linux-x64 app/server.ts --outfile=bun-sql-editor

# Windows x64
bun build --compile --target=bun-windows-x64 app/server.ts --outfile=bun-sql-editor.exe
```

## Connection Defaults

| Database | Host | Port |
|----------|------|------|
| PostgreSQL | localhost | 5432 |
| MySQL | localhost | 3306 |
| MongoDB | mongodb://localhost:27017 | — |
| ClickHouse | http://localhost:8123 | — |

Connection details are stored in browser localStorage only — never sent to any external server.
