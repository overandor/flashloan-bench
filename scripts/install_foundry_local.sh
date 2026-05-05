#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="$ROOT_DIR/tools/foundry"
BIN_DIR="$TOOLS_DIR/bin"
TMP_DIR="$ROOT_DIR/.tmp"
mkdir -p "$BIN_DIR" "$TMP_DIR"

ARCHIVE="$TMP_DIR/foundry.tar.gz"
URL="${1:-}"
if [[ -z "$URL" ]]; then
  URL="$(curl -s https://api.github.com/repos/foundry-rs/foundry/releases/latest \
    | rg -o 'https://[^"]*foundry_v[^"]*_darwin_arm64\.tar\.gz' \
    | head -n 1)"
fi

if [[ -z "$URL" ]]; then
  echo "Failed to resolve Foundry macOS arm64 asset URL."
  exit 1
fi

echo "Downloading Foundry from: $URL"
curl -L "$URL" -o "$ARCHIVE"

tar -xzf "$ARCHIVE" -C "$BIN_DIR"
chmod +x "$BIN_DIR/"{forge,anvil,cast,chisel}

echo "Installed Foundry binaries to $BIN_DIR"
echo "Add this for the current shell:"
echo "  export PATH=\"$BIN_DIR:\$PATH\""
