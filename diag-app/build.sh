#!/usr/bin/env sh
# Compile PC2Diag.exe (Windows 64 bits) depuis Linux, macOS ou Windows (Git Bash).
# Nécessite Go 1.24 ou plus récent : https://go.dev/dl/
set -e
cd "$(dirname "$0")"
VERSION="${1:-1.10.1}"
# le diagnostic détaillé est le Diag Atelier du site, intégré à l'exe
cp ../resources/diag/diag-atelier.html atelier.html
# icône, manifeste et informations de version (éditeur, produit, version) de l'exe :
# un exe sans ces informations est jugé suspect par une partie des antivirus
go run github.com/tc-hib/go-winres@v0.3.3 make --in winres/winres.json --arch amd64 \
  --product-version "$VERSION" --file-version "$VERSION" --out rsrc
mkdir -p dist
# symboles gardés (pas de -s -w) : un exe Go dépouillé ressemble davantage
# aux programmes malveillants pour les antivirus
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath \
  -ldflags "-H windowsgui -X main.Version=$VERSION" \
  -o "dist/PC2Diag-$VERSION.exe" .
echo "dist/PC2Diag-$VERSION.exe"
