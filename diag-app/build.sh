#!/usr/bin/env sh
# Compile PC2Diag.exe (Windows 64 bits) depuis Linux, macOS ou Windows (Git Bash).
# Nécessite Go 1.24 ou plus récent : https://go.dev/dl/
set -e
cd "$(dirname "$0")"
VERSION="${1:-1.0.0}"
mkdir -p dist
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath \
  -ldflags "-H windowsgui -s -w -X main.Version=$VERSION" \
  -o dist/PC2Diag.exe .
echo "dist/PC2Diag.exe (v$VERSION)"
