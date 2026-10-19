//go:build windows

package main

import (
	"bufio"
	"context"
	_ "embed"
	"encoding/base64"
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
	"unsafe"

	webview2 "github.com/jchv/go-webview2"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

//go:embed ui.html
var uiHTML string

//go:embed collect.ps1
var collectPS string

const protocol = "pc2diag"

// ---------------------------------------------------------------- config

type config struct {
	Server   string `json:"server"`
	TokenEnc string `json:"token"` // clé d'accès chiffrée par DPAPI (compte Windows courant)
}

func appDir(env string) string {
	base := os.Getenv(env)
	if base == "" {
		base = os.TempDir()
	}
	dir := filepath.Join(base, "PC2Diag")
	_ = os.MkdirAll(dir, 0o700)
	return dir
}

func cfgPath() string { return filepath.Join(appDir("APPDATA"), "config.json") }

func loadConfig() config {
	var c config
	if b, err := os.ReadFile(cfgPath()); err == nil {
		_ = json.Unmarshal(b, &c)
	}
	return c
}

func (c config) save() error {
	b, _ := json.MarshalIndent(c, "", "  ")
	return os.WriteFile(cfgPath(), b, 0o600)
}

func (c config) token() string {
	if c.TokenEnc == "" {
		return ""
	}
	raw, err := base64.StdEncoding.DecodeString(c.TokenEnc)
	if err != nil {
		return ""
	}
	plain, err := dpapi(raw, false)
	if err != nil {
		return ""
	}
	return string(plain)
}

func (c *config) setToken(t string) error {
	if t == "" {
		c.TokenEnc = ""
		return nil
	}
	enc, err := dpapi([]byte(t), true)
	if err != nil {
		return err
	}
	c.TokenEnc = base64.StdEncoding.EncodeToString(enc)
	return nil
}

func dpapi(data []byte, protect bool) ([]byte, error) {
	if len(data) == 0 {
		return nil, errors.New("donnée vide")
	}
	in := windows.DataBlob{Size: uint32(len(data)), Data: &data[0]}
	var out windows.DataBlob
	var err error
	if protect {
		err = windows.CryptProtectData(&in, nil, nil, 0, nil, windows.CRYPTPROTECT_UI_FORBIDDEN, &out)
	} else {
		err = windows.CryptUnprotectData(&in, nil, nil, 0, nil, windows.CRYPTPROTECT_UI_FORBIDDEN, &out)
	}
	if err != nil {
		return nil, err
	}
	defer windows.LocalFree(windows.Handle(unsafe.Pointer(out.Data)))
	return append([]byte(nil), unsafe.Slice(out.Data, out.Size)...), nil
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

// registerProtocol makes pc2diag:// links from the site open this exe.
func registerProtocol() {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	k, _, err := registry.CreateKey(registry.CURRENT_USER, `Software\Classes\`+protocol, registry.ALL_ACCESS)
	if err != nil {
		return
	}
	defer k.Close()
	_ = k.SetStringValue("", "URL:PC2 Diag")
	_ = k.SetStringValue("URL Protocol", "")
	cmd, _, err := registry.CreateKey(k, `shell\open\command`, registry.ALL_ACCESS)
	if err != nil {
		return
	}
	defer cmd.Close()
	_ = cmd.SetStringValue("", `"`+exe+`" "%1"`)
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

type deepLink struct {
	action string
	server string
	token  string
	ticket int
}

func parseDeepLink(args []string) *deepLink {
	for _, a := range args {
		if !strings.HasPrefix(strings.ToLower(a), protocol+":") {
			continue
		}
		u, err := url.Parse(a)
		if err != nil {
			return nil
		}
		q := u.Query()
		action := u.Host
		if action == "" {
			action = strings.Trim(u.Opaque, "/")
		}
		t, _ := strconv.Atoi(strings.TrimPrefix(q.Get("ticket"), "#"))
		return &deepLink{action: action, server: q.Get("server"), token: q.Get("token"), ticket: t}
	}
	return nil
}

func (a *app) client() *Client {
	return NewClient(a.cfg.Server, a.cfg.token(), a.machine)
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
		"paired":  a.cfg.Server != "" && a.cfg.TokenEnc != "",
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

	ps := filepath.Join(os.Getenv("SystemRoot"), `System32\WindowsPowerShell\v1.0\powershell.exe`)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()
	cmd := exec.CommandContext(ctx, ps, "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, "-Out", out)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: windows.CREATE_NO_WINDOW}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	cmd.Stderr = nil
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("impossible de lancer PowerShell : %w", err)
	}
	sc := bufio.NewScanner(stdout)
	for sc.Scan() {
		line := strings.ToValidUTF8(strings.TrimSpace(sc.Text()), "?")
		if m := stepRe.FindStringSubmatch(line); m != nil {
			n, _ := strconv.Atoi(m[1])
			total, _ := strconv.Atoi(m[2])
			a.emit(map[string]any{"type": "step", "n": n, "total": total, "label": m[3]})
		}
	}
	waitErr := cmd.Wait()

	raw, err := os.ReadFile(out)
	if err != nil {
		if ctx.Err() != nil {
			return nil, errors.New("l'analyse a dépassé 15 minutes et a été arrêtée")
		}
		return nil, fmt.Errorf("la collecte n'a rien produit (%v)", waitErr)
	}
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
func (a *app) saveReport() (string, error) {
	a.mu.Lock()
	r, inv := a.report, a.inv
	a.mu.Unlock()
	if r == nil {
		return "", errors.New("aucune analyse à enregistrer")
	}
	dir := filepath.Join(appDir("LOCALAPPDATA"), "rapports")
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
		a.cfg.Server = server
		err = a.cfg.setToken(token)
		if err == nil {
			err = a.cfg.save()
		}
		a.me, a.meErr = me, ""
		a.mu.Unlock()
		if err != nil {
			return nil, fmt.Errorf("enregistrement de la clé impossible : %w", err)
		}
		return a.state(), nil
	case "unpair":
		a.mu.Lock()
		_ = a.cfg.setToken("")
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

	registerProtocol()

	// Les relevés SMART, BitLocker, DISM et une partie des journaux exigent les
	// droits administrateur : on relance une fois via l'UAC.
	if !isAdmin() && !elevated {
		if relaunchElevated(args) {
			return
		}
	}

	setDPIAware()
	a := &app{cfg: loadConfig()}
	a.machine, _ = os.Hostname()

	link := parseDeepLink(args)
	if link != nil && link.server != "" {
		server := NormalizeServer(link.server)
		if link.action == "pair" && link.token != "" {
			a.cfg.Server = server
			if a.cfg.setToken(link.token) == nil {
				_ = a.cfg.save()
			}
		} else if a.cfg.Server == "" {
			a.cfg.Server = server
			_ = a.cfg.save()
		}
	}

	w := webview2.NewWithOptions(webview2.WebViewOptions{
		AutoFocus: true,
		DataPath:  filepath.Join(appDir("LOCALAPPDATA"), "webview"),
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
		os.Exit(1)
	}
	defer w.Destroy()
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
		if a.cfg.Server != "" && a.cfg.TokenEnc != "" {
			a.checkPairing()
		}
		a.mu.Lock()
		paired := a.me != nil
		a.mu.Unlock()
		if link != nil && link.ticket > 0 && paired {
			if t, err := a.client().Ticket(link.ticket); err == nil {
				a.mu.Lock()
				a.ticket = t
				a.mu.Unlock()
			}
		}
		a.emit(map[string]any{"type": "state", "state": a.state()})
	}()

	w.SetHtml(uiHTML)
	w.Run()
}
