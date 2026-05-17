# Setup

## Download

Go to [Releases](https://github.com/BunAgents/bun-sql-editor/releases) and download the binary for your platform:

| Platform | File |
|----------|------|
| macOS Apple Silicon | `bun-sql-editor-macos-arm64` |
| macOS Intel | `bun-sql-editor-macos-x64` |
| Windows x64 | `bun-sql-editor-windows-x64.exe` |
| Linux x64 | `bun-sql-editor-linux-x64` |

## Run

```bash
# macOS / Linux — make executable first
chmod +x bun-sql-editor-macos-arm64
./bun-sql-editor-macos-arm64

# Windows
bun-sql-editor-windows-x64.exe

# Custom port
PORT=8080 ./bun-sql-editor-macos-arm64
```

Open http://localhost:3000 in your browser.

## OS Security Warnings

The binary is not code-signed (certificates cost $300–500/year per platform). The source code is public — build it yourself if you prefer.

**macOS:** Right-click → Open → Open. Or run:
```bash
xattr -d com.apple.quarantine bun-sql-editor-macos-arm64
```

**Windows:** SmartScreen → "More info" → "Run anyway"

**Linux:** No warning.

## Build from Source

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/BunAgents/bun-sql-editor
cd bun-sql-editor
bun install
bun run dev   # → http://localhost:3000
```

Compile binary:
```bash
bun build --compile --target=bun-darwin-arm64 app/server.ts --outfile=bun-sql-editor
```

## Connection Defaults

| Database | Host | Port |
|----------|------|------|
| PostgreSQL | localhost | 5432 |
| MySQL | localhost | 3306 |
| MongoDB | mongodb://localhost:27017 | — |
| ClickHouse | http://localhost:8123 | — |

Connection details are stored in browser localStorage only — never sent to any external server.
