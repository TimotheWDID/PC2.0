@echo off
rem Compile PC2Diag.exe sous Windows. Necessite Go 1.24+ : https://go.dev/dl/
cd /d "%~dp0"
if "%1"=="" (set VERSION=1.0.0) else (set VERSION=%1)
if not exist dist mkdir dist
set GOOS=windows
set GOARCH=amd64
set CGO_ENABLED=0
go build -trimpath -ldflags "-H windowsgui -s -w -X main.Version=%VERSION%" -o dist\PC2Diag.exe .
echo dist\PC2Diag.exe (v%VERSION%)
