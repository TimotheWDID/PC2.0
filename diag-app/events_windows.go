//go:build windows

package main

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

//go:embed events.ps1
var eventsPS string

// ---------------------------------------------------------------- pont avec l'interface

var evState struct {
	sync.Mutex
	running bool
	last    *evResult
}

// startEventScan lit les journaux des derniers jours en arrière-plan :
// résultat par l'évènement « evDone », échec par « evError ».
func (a *app) startEventScan(days int) bool {
	if days < 1 || days > 90 {
		days = 7
	}
	evState.Lock()
	if evState.running {
		evState.Unlock()
		return false
	}
	evState.running = true
	evState.Unlock()

	a.log("Observateur d'événements : lecture des %d derniers jours", days)
	go func() {
		res, err := readEvents(days)
		evState.Lock()
		evState.running = false
		if err == nil {
			evState.last = res
		}
		evState.Unlock()
		if err != nil {
			a.log("Observateur d'événements en échec : %v", err)
			a.emitGo("evError", err.Error())
			return
		}
		a.log("Observateur d'événements : %d événements, %d groupes en %.0f s", res.Total, len(res.Groups), res.Seconds)
		a.emitGo("evDone", res)
	}()
	return true
}

func readEvents(days int) (*evResult, error) {
	dir, err := os.MkdirTemp("", "pc2diag-ev")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)
	script := filepath.Join(dir, "events.ps1")
	out := filepath.Join(dir, "events.json")
	// BOM UTF-8 : sans lui, PowerShell 5.1 lit les accents du script en ANSI
	body := append([]byte{0xEF, 0xBB, 0xBF}, strings.TrimPrefix(eventsPS, "\ufeff")...)
	if err := os.WriteFile(script, body, 0o600); err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Minute)
	defer cancel()
	started := time.Now()
	cmd := exec.CommandContext(ctx, powershellExe(), "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script,
		"-Out", out, "-Days", strconv.Itoa(days), "-Max", "2000")
	hide(cmd)
	cmd.WaitDelay = 5 * time.Second
	var output bytes.Buffer
	cmd.Stdout, cmd.Stderr = &output, &output
	runErr := cmd.Run()
	b, err := os.ReadFile(out)
	if err != nil {
		if ctx.Err() != nil {
			return nil, errors.New("la lecture des journaux a dépassé 4 minutes et a été arrêtée")
		}
		msg := strings.TrimSpace(strings.ToValidUTF8(output.String(), "?"))
		if r := []rune(msg); len(r) > 300 {
			msg = string(r[:300]) + "…"
		}
		return nil, fmt.Errorf("les journaux n'ont pas pu être lus (PowerShell bloqué ?) : %v %s", runErr, msg)
	}
	var raw evScanRaw
	if err := json.Unmarshal(bytes.TrimPrefix(b, []byte("\xEF\xBB\xBF")), &raw); err != nil {
		return nil, fmt.Errorf("résultat illisible : %w", err)
	}
	res := groupEvents(raw, time.Local)
	res.Seconds = time.Since(started).Round(100 * time.Millisecond).Seconds()
	return &res, nil
}

func eventsCSV() (string, error) {
	evState.Lock()
	r := evState.last
	evState.Unlock()
	if r == nil {
		return "", nil
	}
	return saveCSV("Evenements_"+safeName(hostname())+"_"+time.Now().Format("20060102_1504")+".csv", r.csv(time.Local))
}

func hostname() string { h, _ := os.Hostname(); return h }
