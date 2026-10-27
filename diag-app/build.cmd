@echo off
rem Compile PC2Diag.exe sous Windows. Necessite Go 1.24+ : https://go.dev/dl/
cd /d "%~dp0"
if "%1"=="" (set VERSION=1.10.2) else (set VERSION=%1)
rem le diagnostic detaille est le Diag Atelier du site, integre a l'exe
copy /y ..\resources\diag\diag-atelier.html atelier.html >nul
rem icone, manifeste et informations de version de l'exe (antivirus)
go run github.com/tc-hib/go-winres@v0.3.3 make --in winres/winres.json --arch amd64 --product-version %VERSION% --file-version %VERSION% --out rsrc
if not exist dist mkdir dist
set GOOS=windows
set GOARCH=amd64
set CGO_ENABLED=0
go build -trimpath -ldflags "-H windowsgui -X main.Version=%VERSION%" -o dist\PC2Diag-%VERSION%.exe .
echo dist\PC2Diag-%VERSION%.exe
