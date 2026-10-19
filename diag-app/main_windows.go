//go:build windows

package main

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	webview2 "github.com/jchv/go-webview2"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

//go:embed ui.html
var uiHTML string

//go:embed collect.ps1
var collectPS string

// ---------------------------------------------------------------- config

// L'application est portable : tout ce qu'elle garde (adresse du site, clé
// d'accès, copies des rapports) est rangé à côté de l'exe, sur la clé USB du
// technicien. Rien n'est écrit dans le registre ni dans le profil du client.

type config struct {
	Server string `json:"server"`
	Token  string `json:"token"`
}

func exeDir() string {
	exe, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(exe)
}

func cfgPath() string { return filepath.Join(exeDir(), "PC2Diag-config.json") }

func loadConfig() config {
	var c config
	if b, err := os.ReadFile(cfgPath()); err == nil {
		_ = json.Unmarshal(b, &c)
	}
	return c
}

func (c config) save() error {
	b, _ := json.MarshalIndent(c, "", "  ")
	if err := os.WriteFile(cfgPath(), b, 0o600); err != nil {
		return fmt.Errorf("impossible d'écrire à côté de l'exe (%s) : %w", exeDir(), err)
	}
	return nil
}

// ---------------------------------------------------------------- Windows

func isAdmin() bool { return windows.GetCurrentProcessToken().IsElevated() }

func shellExecute(verb, file, args string) error {
	v, _ := windows.UTF16PtrFromString(verb)
	f, _ := windows.UTF16PtrFromString(file)
	var a *uint16
	if args != "" {
		a, _ = windows.UTF16PtrFromString(args)
	}
	return windows.ShellExecute(0, v, f, a, nil, windows.SW_SHOWNORMAL)
}

// relaunchElevated restarts the app as administrator (UAC). Returns false when
// the technician refused: the app then runs with limited checks.
func relaunchElevated(args []string) bool {
	exe, err := os.Executable()
	if err != nil {
		return false
	}
	quoted := make([]string, 0, len(args)+1)
	for _, a := range args {
		quoted = append(quoted, syscall.EscapeArg(a))
	}
	quoted = append(quoted, "--elevated")
	return shellExecute("runas", exe, strings.Join(quoted, " ")) == nil
}

// setDPIAware keeps the window sharp on high-DPI screens (per-monitor v2).
func setDPIAware() {
	proc := windows.NewLazySystemDLL("user32.dll").NewProc("SetProcessDpiAwarenessContext")
	if proc.Find() == nil {
		_, _, _ = proc.Call(^uintptr(3)) // DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = -4
	}
}

func openURL(u string) error {
	p, err := url.Parse(u)
	if err != nil || (p.Scheme != "https" && p.Scheme != "http") {
		return errors.New("adresse invalide")
	}
	return shellExecute("open", u, "")
}

// ---------------------------------------------------------------- app

type app struct {
	w        webview2.WebView
	mu       sync.Mutex
	cfg      config
	me       *Me
	meErr    string
	ticket   *Ticket
	report   *Report
	inv      map[string]any
	scanning bool
	machine  string
}

func (a *app) client() *Client {
	return NewClient(a.cfg.Server, a.cfg.Token, a.machine)
}

func (a *app) emit(ev map[string]any) {
	b, _ := json.Marshal(ev)
	a.w.Dispatch(func() { a.w.Eval("window.onGoEvent && window.onGoEvent(" + string(b) + ")") })
}

func (a *app) state() map[string]any {
	a.mu.Lock()
	defer a.mu.Unlock()
	st := map[string]any{
		"version": Version,
		"admin":   isAdmin(),
		"machine": a.machine,
		"server":  a.cfg.Server,
		"paired":  a.cfg.Server != "" && a.cfg.Token != "",
		"me":      a.me,
		"meError": a.meErr,
		"ticket":  a.ticket,
	}
	if a.report != nil {
		st["result"] = summary(a.report, a.inv)
	}
	return st
}

func summary(r *Report, inv map[string]any) map[string]any {
	return map[string]any{
		"machine":   r.Machine,
		"status":    r.Status,
		"viability": r.Viability,
		"findings":  r.Findings,
		"inventory": inv,
	}
}

func (a *app) checkPairing() {
	c := a.client()
	me, err := c.Me()
	a.mu.Lock()
	if err != nil {
		a.me, a.meErr = nil, err.Error()
	} else {
		a.me, a.meErr = me, ""
	}
	a.mu.Unlock()
}

var stepRe = regexp.MustCompile(`^##STEP\|(\d+)\|(\d+)\|(.*)$`)

func (a *app) scan() (map[string]any, error) {
	a.mu.Lock()
	if a.scanning {
		a.mu.Unlock()
		return nil, errors.New("une analyse est déjà en cours")
	}
	a.scanning = true
	a.mu.Unlock()
	defer func() { a.mu.Lock(); a.scanning = false; a.mu.Unlock() }()

	dir, err := os.MkdirTemp("", "pc2diag")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)
	script := filepath.Join(dir, "collect.ps1")
	out := filepath.Join(dir, "result.json")
	// BOM UTF-8 : sans lui, PowerShell 5.1 lit les accents du script en ANSI
	if err := os.WriteFile(script, append([]byte{0xEF, 0xBB, 0xBF}, collectPS...), 0o600); err != nil {
		return nil, err
	}

	progress := filepath.Join(dir, "progress.txt")
	ps := filepath.Join(os.Getenv("SystemRoot"), `System32\WindowsPowerShell\v1.0\powershell.exe`)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()
	cmd := exec.CommandContext(ctx, ps, "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, "-Out", out, "-Progress", progress)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: windows.CREATE_NO_WINDOW}
	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output
	a.log("Analyse lancée (administrateur : %v)", isAdmin())
	if err := cmd.Start(); err != nil {
		a.log("PowerShell introuvable ou bloqué : %v", err)
		return nil, fmt.Errorf("impossible de lancer PowerShell : %w", err)
	}

	// L'avancement passe par un fichier : la sortie de PowerShell sans console
	// peut rester en mémoire tampon jusqu'à la fin.
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	started, last := time.Now(), ""
	var waitErr error
	for running := true; running; {
		select {
		case waitErr = <-done:
			running = false
		case <-time.After(500 * time.Millisecond):
		}
		ev := map[string]any{"type": "tick", "elapsed": int(time.Since(started).Seconds())}
		if b, err := os.ReadFile(progress); err == nil {
			line := strings.TrimSpace(strings.TrimPrefix(string(b), "\ufeff"))
			if m := stepRe.FindStringSubmatch("##STEP|" + line); m != nil {
				n, _ := strconv.Atoi(m[1])
				total, _ := strconv.Atoi(m[2])
				ev["n"], ev["total"], ev["label"] = n, total, strings.ToValidUTF8(m[3], "?")
				if line != last {
					last = line
					a.log("Étape %s", line)
				}
			}
		}
		a.emit(ev)
	}
	if output.Len() > 0 {
		a.log("Sortie PowerShell :\n%s", strings.ToValidUTF8(output.String(), "?"))
	}

	raw, err := os.ReadFile(out)
	if err != nil {
		if ctx.Err() != nil {
			return nil, errors.New("l'analyse a dépassé 15 minutes et a été arrêtée")
		}
		a.log("Aucun résultat (%v)", waitErr)
		return nil, fmt.Errorf("la collecte n'a rien produit (%v). Détails dans PC2Diag-journal.txt à côté de l'exe", waitErr)
	}
	a.log("Collecte terminée en %s", time.Since(started).Round(time.Second))
	var data map[string]any
	if err := json.Unmarshal(raw, &data); err != nil {
		return nil, fmt.Errorf("résultat de collecte illisible : %w", err)
	}

	report := Analyze(data, time.Now())
	inv := Inventory(data)
	a.mu.Lock()
	a.report, a.inv = &report, inv
	a.mu.Unlock()
	if p, err := a.saveReport(); err == nil {
		a.emit(map[string]any{"type": "saved", "path": p})
	}
	return summary(&report, inv), nil
}

// saveReport keeps a local copy of the last report, to resend it later if
// the site was unreachable.
func (a *app) log(format string, args ...any) {
	f, err := os.OpenFile(filepath.Join(exeDir(), "PC2Diag-journal.txt"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "%s  %s\r\n", time.Now().Format("2006-01-02 15:04:05"), fmt.Sprintf(format, args...))
}

func (a *app) saveReport() (string, error) {
	a.mu.Lock()
	r, inv := a.report, a.inv
	a.mu.Unlock()
	if r == nil {
		return "", errors.New("aucune analyse à enregistrer")
	}
	dir := filepath.Join(exeDir(), "PC2Diag-rapports")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	name := regexp.MustCompile(`[^\pL\pN_.-]+`).ReplaceAllString(str(r.Machine["computer"]), "_")
	p := filepath.Join(dir, time.Now().Format("2006-01-02_15h04")+"_"+name+".json")
	b, _ := json.MarshalIndent(map[string]any{"report": r, "inventory": inv}, "", " ")
	return p, os.WriteFile(p, b, 0o600)
}

func (a *app) send(ticketID int) (*SendResult, error) {
	a.mu.Lock()
	r, inv := a.report, a.inv
	a.mu.Unlock()
	if r == nil {
		return nil, errors.New("lancez d'abord l'analyse")
	}
	return a.client().Send(ticketID, *r, inv)
}

func (a *app) handle(method string, args json.RawMessage) (any, error) {
	switch method {
	case "state":
		return a.state(), nil
	case "pair":
		var p struct{ Server, Token string }
		_ = json.Unmarshal(args, &p)
		server, token := NormalizeServer(p.Server), strings.TrimSpace(p.Token)
		if server == "" || token == "" {
			return nil, errors.New("indiquez l'adresse du site et la clé")
		}
		me, err := NewClient(server, token, a.machine).Me()
		if err != nil {
			return nil, err
		}
		a.mu.Lock()
		a.cfg.Server, a.cfg.Token = server, token
		err = a.cfg.save()
		a.me, a.meErr = me, ""
		a.mu.Unlock()
		if err != nil {
			return nil, err
		}
		return a.state(), nil
	case "unpair":
		a.mu.Lock()
		a.cfg.Token = ""
		_ = a.cfg.save()
		a.me = nil
		a.mu.Unlock()
		return a.state(), nil
	case "recheck":
		a.checkPairing()
		return a.state(), nil
	case "tickets":
		var p struct{ Q string }
		_ = json.Unmarshal(args, &p)
		return a.client().Tickets(p.Q)
	case "selectTicket":
		var p struct{ ID int }
		_ = json.Unmarshal(args, &p)
		if p.ID <= 0 {
			a.mu.Lock()
			a.ticket = nil
			a.mu.Unlock()
			return a.state(), nil
		}
		t, err := a.client().Ticket(p.ID)
		if err != nil {
			return nil, err
		}
		a.mu.Lock()
		a.ticket = t
		a.mu.Unlock()
		return a.state(), nil
	case "scan":
		return a.scan()
	case "send":
		a.mu.Lock()
		id := 0
		if a.ticket != nil {
			id = a.ticket.ID
		}
		a.mu.Unlock()
		return a.send(id)
	case "save":
		return a.saveReport()
	case "open":
		var p struct{ URL string }
		_ = json.Unmarshal(args, &p)
		return nil, openURL(p.URL)
	case "elevate":
		if relaunchElevated(nil) {
			a.w.Dispatch(a.w.Terminate)
			return nil, nil
		}
		return nil, errors.New("élévation refusée")
	}
	return nil, fmt.Errorf("action inconnue : %s", method)
}

func main() {
	args := os.Args[1:]
	elevated := false
	for _, a := range args {
		if a == "--elevated" {
			elevated = true
		}
	}

	// Les relevés SMART, BitLocker, DISM et une partie des journaux exigent les
	// droits administrateur : on relance une fois via l'UAC.
	if !isAdmin() && !elevated {
		if relaunchElevated(args) {
			return
		}
	}

	setDPIAware()
	cleanupLegacy()
	a := &app{cfg: loadConfig()}
	a.machine, _ = os.Hostname()

	// Cache de la fenêtre WebView2 dans un dossier temporaire, effacé à la fermeture
	cache, err := os.MkdirTemp("", "pc2diag-webview")
	if err != nil {
		cache = filepath.Join(os.TempDir(), "pc2diag-webview")
	}
	defer removeAllRetry(cache)

	w := webview2.NewWithOptions(webview2.WebViewOptions{
		AutoFocus: true,
		DataPath:  cache,
		WindowOptions: webview2.WindowOptions{
			Title:  "PC2 Diag",
			Width:  1040,
			Height: 780,
			Center: true,
		},
	})
	if w == nil {
		msg, _ := windows.UTF16PtrFromString("WebView2 est introuvable. Installez « Microsoft Edge WebView2 Runtime » puis relancez PC2 Diag.")
		title, _ := windows.UTF16PtrFromString("PC2 Diag")
		windows.MessageBox(0, msg, title, windows.MB_ICONERROR)
		removeAllRetry(cache)
		os.Exit(1)
	}
	a.w = w

	_ = w.Bind("goCall", func(id int, method string, params json.RawMessage) {
		go func() {
			res, err := a.handle(method, params)
			errMsg := ""
			if err != nil {
				errMsg = err.Error()
			}
			b, _ := json.Marshal(res)
			e, _ := json.Marshal(errMsg)
			w.Dispatch(func() {
				w.Eval(fmt.Sprintf("window.__goDone(%d, %s, %s)", id, e, b))
			})
		}()
	})

	go func() {
		if a.cfg.Server != "" && a.cfg.Token != "" {
			a.checkPairing()
		}
		a.emit(map[string]any{"type": "state", "state": a.state()})
	}()

	w.SetHtml(uiHTML)
	w.Run()
	w.Destroy()
}

// removeAllRetry deletes a folder the WebView2 processes may still hold for a
// moment after the window closed.
func removeAllRetry(dir string) {
	for i := 0; i < 20; i++ {
		if os.RemoveAll(dir) == nil {
			return
		}
		time.Sleep(250 * time.Millisecond)
	}
}

// cleanupLegacy removes what the first version (1.0.0) left on the PC:
// the pc2diag:// protocol and its folders in the user profile.
func cleanupLegacy() {
	base := `Software\Classes\pc2diag`
	for _, sub := range []string{`\shell\open\command`, `\shell\open`, `\shell`, ``} {
		_ = registry.DeleteKey(registry.CURRENT_USER, base+sub)
	}
	for _, env := range []string{"APPDATA", "LOCALAPPDATA"} {
		if root := os.Getenv(env); root != "" {
			removeAllRetry(filepath.Join(root, "PC2Diag"))
		}
	}
}
