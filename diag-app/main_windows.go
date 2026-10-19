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
	"sort"
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

//go:embed report.html
var reportHTML string

//go:embed collect.ps1
var collectPS string

// Diag Atelier of the site (resources/diag/diag-atelier.html), copied here by
// build.sh / build.cmd: the detailed diagnostic is the same page as on the site.
//
//go:embed atelier.html
var atelierHTML string

// ---------------------------------------------------------------- dossiers et config

// L'application est portable : tout ce qu'elle garde (en-tête de la société,
// adresse du site, clé d'accès, analyses et rapports) est rangé à côté de
// l'exe, sur la clé USB du technicien.

type config struct {
	Server  string `json:"server"`
	Token   string `json:"token"`
	Shop    string `json:"shop"`
	Address string `json:"address"`
	Phone   string `json:"phone"`
	Email   string `json:"email"`
	Tech    string `json:"tech"`
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
		_ = json.Unmarshal(bytes.TrimPrefix(b, []byte("\xEF\xBB\xBF")), &c)
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

var (
	reportsOnce sync.Once
	reportsPath string
)

// reportsDir is PC2Diag-rapports next to the exe, or on the desktop when the
// key is write-protected.
func reportsDir() string {
	reportsOnce.Do(func() {
		for _, d := range []string{exeDir(), filepath.Join(os.Getenv("USERPROFILE"), "Desktop")} {
			p := filepath.Join(d, "PC2Diag-rapports")
			if os.MkdirAll(p, 0o700) != nil {
				continue
			}
			probe := filepath.Join(p, ".pc2diag-test")
			if os.WriteFile(probe, nil, 0o600) == nil {
				os.Remove(probe)
				reportsPath = p
				return
			}
		}
		reportsPath = filepath.Join(os.TempDir(), "PC2Diag-rapports")
		_ = os.MkdirAll(reportsPath, 0o700)
	})
	return reportsPath
}

var unsafeName = regexp.MustCompile(`[^\pL\pN_-]+`)

func safeName(s string) string {
	s = strings.Trim(unsafeName.ReplaceAllString(s, "_"), "_")
	if r := []rune(s); len(r) > 80 {
		s = string(r[:80])
	}
	if s == "" {
		s = "PC"
	}
	return s
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
		if a != "--elevated" {
			quoted = append(quoted, syscall.EscapeArg(a))
		}
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

// setResume reopens the app once after the reboot (RunOnce entry, deleted
// by Windows as soon as it has run).
func setResume() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	k, _, err := registry.CreateKey(registry.CURRENT_USER, runOnceKey, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	return k.SetStringValue("PC2Diag", syscall.EscapeArg(exe)+" --resume")
}

func clearResume() {
	if k, err := registry.OpenKey(registry.CURRENT_USER, runOnceKey, registry.SET_VALUE); err == nil {
		_ = k.DeleteValue("PC2Diag")
		k.Close()
	}
}

// ---------------------------------------------------------------- app

type app struct {
	w       webview2.WebView
	mu      sync.Mutex
	cfg     config
	me      *Me
	meErr   string
	machine string
	resumed bool

	scanning  bool
	lastData  map[string]any
	runCancel context.CancelFunc
	runPID    int
	sensorsOn bool
	batt      *battTest
}

func (a *app) client() *Client {
	a.mu.Lock()
	defer a.mu.Unlock()
	return NewClient(a.cfg.Server, a.cfg.Token, a.machine)
}

// emitGo sends an event to the interface: window.onGo(kind, payload).
func (a *app) emitGo(kind string, payload any) {
	k, _ := json.Marshal(kind)
	p, err := json.Marshal(payload)
	if err != nil {
		return
	}
	a.w.Dispatch(func() { a.w.Eval("window.onGo && window.onGo(" + string(k) + "," + string(p) + ")") })
}

func (a *app) log(format string, args ...any) {
	f, err := os.OpenFile(filepath.Join(reportsDir(), "PC2Diag-journal.txt"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "%s  %s\r\n", time.Now().Format("2006-01-02 15:04:05"), fmt.Sprintf(format, args...))
}

// ---------------------------------------------------------------- analyse

var stepRe = regexp.MustCompile(`^(\d+)\|(\d+)\|(.*)$`)

func (a *app) startScan() bool {
	a.mu.Lock()
	if a.scanning {
		a.mu.Unlock()
		return false
	}
	a.scanning = true
	a.mu.Unlock()
	go func() {
		defer func() { a.mu.Lock(); a.scanning = false; a.mu.Unlock() }()
		started := time.Now()
		data, err := a.collect()
		if err != nil {
			a.log("Analyse en échec : %v", err)
			a.emitGo("scanError", err.Error())
			return
		}
		a.mu.Lock()
		a.lastData = data
		a.mu.Unlock()
		file, err := saveScan(data)
		if err != nil {
			a.log("Analyse non enregistrée : %v", err)
		}
		a.log("Analyse terminée en %s", time.Since(started).Round(time.Second))
		a.emitGo("scanDone", map[string]any{"file": file, "data": data, "seconds": int(time.Since(started).Seconds())})
	}()
	return true
}

func (a *app) collect() (map[string]any, error) {
	dir, err := os.MkdirTemp("", "pc2diag")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)
	script := filepath.Join(dir, "collect.ps1")
	out := filepath.Join(dir, "result.json")
	progress := filepath.Join(dir, "progress.txt")
	// BOM UTF-8 : sans lui, PowerShell 5.1 lit les accents du script en ANSI
	body := append([]byte{0xEF, 0xBB, 0xBF}, strings.TrimPrefix(collectPS, "\ufeff")...)
	if err := os.WriteFile(script, body, 0o600); err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()
	cmd := exec.CommandContext(ctx, powershellExe(), "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, "-Out", out, "-Progress", progress)
	hide(cmd)
	cmd.WaitDelay = 5 * time.Second
	var output bytes.Buffer
	cmd.Stdout, cmd.Stderr = &output, &output
	a.log("Analyse lancée (administrateur : %v)", isAdmin())
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("impossible de lancer PowerShell : %w", err)
	}

	// L'avancement passe par un fichier : sans console, la sortie de
	// PowerShell peut rester en mémoire tampon jusqu'à la fin.
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	last := ""
	var waitErr error
	for running := true; running; {
		select {
		case waitErr = <-done:
			running = false
		case <-time.After(400 * time.Millisecond):
		}
		b, err := os.ReadFile(progress)
		if err != nil {
			continue
		}
		line := strings.TrimSpace(strings.TrimPrefix(string(b), "\ufeff"))
		if m := stepRe.FindStringSubmatch(line); m != nil && line != last {
			last = line
			n, _ := strconv.Atoi(m[1])
			total, _ := strconv.Atoi(m[2])
			a.emitGo("scanProgress", map[string]any{"step": n, "total": total, "label": strings.ToValidUTF8(m[3], "?")})
		}
	}
	raw, err := os.ReadFile(out)
	if err != nil {
		if output.Len() > 0 {
			a.log("Sortie PowerShell :\n%s", strings.ToValidUTF8(output.String(), "?"))
		}
		if ctx.Err() != nil {
			return nil, errors.New("l'analyse a dépassé 15 minutes et a été arrêtée")
		}
		return nil, fmt.Errorf("la collecte n'a pas produit de résultat (PowerShell bloqué par une stratégie ou un antivirus ?) : %v", waitErr)
	}
	var data map[string]any
	if err := json.Unmarshal(bytes.TrimPrefix(raw, []byte("\xEF\xBB\xBF")), &data); err != nil {
		return nil, fmt.Errorf("résultat de collecte illisible : %w", err)
	}
	return data, nil
}

const scanStamp = "2006-01-02_15h04m05s"

func saveScan(data map[string]any) (string, error) {
	name := "Analyse_" + time.Now().Format(scanStamp) + "_" + safeName(str(asMap(data["meta"])["computer"])) + ".json"
	b, err := json.Marshal(data)
	if err != nil {
		return "", err
	}
	return name, os.WriteFile(filepath.Join(reportsDir(), name), b, 0o600)
}

type histItem struct {
	File string `json:"file"`
	Date string `json:"date"`
}

// history lists the analyses kept next to the exe, newest first.
func history() []histItem {
	entries, _ := os.ReadDir(reportsDir())
	out := []histItem{}
	for _, e := range entries {
		n := e.Name()
		if e.IsDir() || !strings.HasPrefix(n, "Analyse_") || !strings.HasSuffix(n, ".json") {
			continue
		}
		date := ""
		stamp := strings.TrimPrefix(n, "Analyse_")
		if len(stamp) >= len(scanStamp) {
			if t, err := time.ParseInLocation(scanStamp, stamp[:len(scanStamp)], time.Local); err == nil {
				date = t.Format(time.RFC3339)
			}
		}
		if date == "" {
			if info, err := e.Info(); err == nil {
				date = info.ModTime().Format(time.RFC3339)
			}
		}
		out = append(out, histItem{File: n, Date: date})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Date > out[j].Date })
	return out
}

func loadScan(file string) (map[string]any, error) {
	if filepath.Base(file) != file || !strings.HasPrefix(file, "Analyse_") {
		return nil, errors.New("analyse introuvable")
	}
	b, err := os.ReadFile(filepath.Join(reportsDir(), file))
	if err != nil {
		return nil, errors.New("analyse introuvable")
	}
	var data map[string]any
	return data, json.Unmarshal(b, &data)
}

// saveHTML writes a report next to the exe and opens it in the browser.
func saveHTML(name, html string) (string, error) {
	p := filepath.Join(reportsDir(), safeName(name)+"_"+time.Now().Format("2006-01-02_15h04")+".html")
	if err := os.WriteFile(p, []byte(html), 0o600); err != nil {
		return "", fmt.Errorf("enregistrement impossible : %w", err)
	}
	_ = shellExecute("open", p, "")
	return p, nil
}

// exportReport fills the technical report with the last analysis.
func (a *app) exportReport(brand json.RawMessage) (string, error) {
	a.mu.Lock()
	data := a.lastData
	a.mu.Unlock()
	if data == nil {
		return "", errors.New("lancez d'abord une analyse")
	}
	d, err := json.Marshal(data)
	if err != nil {
		return "", err
	}
	if len(brand) == 0 || string(brand) == "null" {
		brand = json.RawMessage("{}")
	}
	html := strings.Replace(reportHTML, "__DATA__", string(d), 1)
	html = strings.Replace(html, "__BRAND__", string(brand), 1)
	return saveHTML("Rapport_technique_"+str(asMap(data["meta"])["computer"]), html)
}

// ---------------------------------------------------------------- site

func (a *app) siteState() map[string]any {
	a.mu.Lock()
	defer a.mu.Unlock()
	return map[string]any{
		"version": Version,
		"server":  a.cfg.Server,
		"paired":  a.cfg.Server != "" && a.cfg.Token != "",
		"me":      a.me,
		"meError": a.meErr,
		"scanned": a.lastData != nil,
	}
}

func (a *app) checkPairing() {
	me, err := a.client().Me()
	a.mu.Lock()
	if err != nil {
		a.me, a.meErr = nil, err.Error()
	} else {
		a.me, a.meErr = me, ""
	}
	a.mu.Unlock()
}

// send posts the Diag Atelier export of an analysis to the site.
func (a *app) send(ticketID int, exp AtelierExport) (*SendResult, error) {
	res, err := a.client().Send(ticketID, exp)
	if err != nil {
		a.log("Envoi au site en échec : %v", err)
		return nil, err
	}
	a.log("Rapport envoyé au site (ticket %d)", ticketID)
	return res, nil
}

// ---------------------------------------------------------------- pont avec l'interface

func (a *app) handle(method string, raw json.RawMessage) (any, error) {
	var p []json.RawMessage
	_ = json.Unmarshal(raw, &p)
	arg := func(i int, v any) {
		if i < len(p) {
			_ = json.Unmarshal(p[i], v)
		}
	}
	switch method {
	case "goInfo":
		return map[string]any{"computer": a.machine, "admin": isAdmin(), "resumed": a.resumed, "version": Version, "folder": reportsDir()}, nil
	case "goScan":
		return a.startScan(), nil
	case "goSensorsStart":
		a.startSensors()
		return true, nil
	case "goActions":
		return Actions, nil
	case "goRunAction":
		var id string
		arg(0, &id)
		return a.runAction(id), nil
	case "goCancelAction":
		return a.cancelAction(), nil
	case "goOpenTool":
		var id string
		arg(0, &id)
		return nil, openTool(id)
	case "goGetConfig":
		a.mu.Lock()
		c := a.cfg
		a.mu.Unlock()
		return map[string]string{"shop": c.Shop, "address": c.Address, "phone": c.Phone, "email": c.Email, "tech": c.Tech}, nil
	case "goSaveConfig":
		var c config
		arg(0, &c)
		a.mu.Lock()
		a.cfg.Shop, a.cfg.Address, a.cfg.Phone, a.cfg.Email, a.cfg.Tech = c.Shop, c.Address, c.Phone, c.Email, c.Tech
		err := a.cfg.save()
		a.mu.Unlock()
		return err == nil, nil
	case "goExport":
		var b json.RawMessage
		arg(0, &b)
		return a.exportReport(b)
	case "goOpenPath":
		var f string
		arg(0, &f)
		if rel, err := filepath.Rel(reportsDir(), f); err != nil || strings.HasPrefix(rel, "..") {
			return false, nil
		}
		return shellExecute("open", f, "") == nil, nil
	case "goHistory":
		return history(), nil
	case "goLoadScan":
		var f string
		arg(0, &f)
		return loadScan(f)
	case "goSaveHTML":
		var name, html string
		arg(0, &name)
		arg(1, &html)
		return saveHTML(name, html)
	case "goReboot":
		delay, resume := 60, true
		arg(0, &delay)
		arg(1, &resume)
		return a.reboot(delay, resume), nil
	case "goCancelReboot":
		return a.cancelReboot(), nil
	case "goBatteryTest":
		var minutes int
		var load bool
		arg(0, &minutes)
		arg(1, &load)
		return a.batteryTest(minutes, load), nil
	case "goBatteryCtl":
		var c string
		arg(0, &c)
		return a.batteryCtl(c), nil

	case "goSiteState":
		return a.siteState(), nil
	case "goSitePair":
		var server, token string
		arg(0, &server)
		arg(1, &token)
		server, token = NormalizeServer(server), strings.TrimSpace(token)
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
		return a.siteState(), nil
	case "goSiteUnpair":
		a.mu.Lock()
		a.cfg.Token = ""
		_ = a.cfg.save()
		a.me = nil
		a.mu.Unlock()
		return a.siteState(), nil
	case "goSiteCheck":
		a.checkPairing()
		return a.siteState(), nil
	case "goSiteTickets":
		var q string
		arg(0, &q)
		return a.client().Tickets(q)
	case "goSiteSend":
		var id int
		var exp AtelierExport
		arg(0, &id)
		arg(1, &exp)
		return a.send(id, exp)
	case "goAtelierPart":
		var off int
		arg(0, &off)
		// the Diag Atelier page is over 1 Mo: handed to the interface in pieces
		data, next := chunkAt(atelierHTML, off, 256<<10)
		return map[string]any{"data": data, "next": next}, nil
	case "goOpenURL":
		var u string
		arg(0, &u)
		return nil, openURL(u)
	}
	return nil, fmt.Errorf("fonction inconnue : %s", method)
}

func main() {
	args := os.Args[1:]
	elevated, resumed := false, false
	for _, a := range args {
		switch a {
		case "--elevated":
			elevated = true
		case "--resume":
			resumed = true
		}
	}

	// SMART, BitLocker, DISM, une partie des journaux et toutes les réparations
	// exigent les droits administrateur : on relance une fois via l'UAC.
	if !isAdmin() && !elevated {
		if relaunchElevated(args) {
			return
		}
	}

	setDPIAware()
	cleanupLegacy()
	if resumed {
		clearResume()
	}
	a := &app{cfg: loadConfig(), resumed: resumed}
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
			Title:  "PC2 Diag " + Version,
			Width:  1280,
			Height: 860,
			Center: true,
			IconId: 1, // icône Planète Computers (rsrc_windows_amd64.syso)
		},
	})
	if w == nil {
		msg, _ := windows.UTF16PtrFromString("Ce PC n'a pas le composant Microsoft Edge WebView2 nécessaire à l'interface.\n\nOuvrir la page de téléchargement Microsoft ?")
		title, _ := windows.UTF16PtrFromString("PC2 Diag")
		if r, _ := windows.MessageBox(0, msg, title, windows.MB_ICONERROR|windows.MB_YESNO); r == 6 { // IDYES
			_ = openURL("https://developer.microsoft.com/microsoft-edge/webview2/")
		}
		removeAllRetry(cache)
		os.Exit(1)
	}
	a.w = w
	setWindowIcons(w.Window())

	// Un seul point d'entrée asynchrone : chaque appel tourne dans sa propre
	// goroutine pour ne jamais figer la fenêtre, puis résout sa promesse.
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
			a.emitGo("site", a.siteState())
		}
	}()

	w.SetHtml(uiHTML)
	w.Run()
	w.Destroy()
}

// setWindowIcons gives the title bar (small icon) and the taskbar / Alt+Tab
// (large icon) the Planète Computers logo, each at its native size, so it
// stays sharp whatever the screen scaling.
func setWindowIcons(hwnd unsafe.Pointer) {
	if hwnd == nil {
		return
	}
	user32 := windows.NewLazySystemDLL("user32.dll")
	loadImage, metrics, send := user32.NewProc("LoadImageW"), user32.NewProc("GetSystemMetrics"), user32.NewProc("SendMessageW")
	var inst windows.Handle
	_ = windows.GetModuleHandleEx(0, nil, &inst)
	const (
		imageIcon   = 1
		wmSetIcon   = 0x0080
		iconSmall   = 0
		iconBig     = 1
		smCxIcon    = 11
		smCyIcon    = 12
		smCxSmIcon  = 49
		smCySmIcon  = 50
		resIconMain = 1
	)
	for _, ic := range [][3]uintptr{{iconSmall, smCxSmIcon, smCySmIcon}, {iconBig, smCxIcon, smCyIcon}} {
		cx, _, _ := metrics.Call(ic[1])
		cy, _, _ := metrics.Call(ic[2])
		h, _, _ := loadImage.Call(uintptr(inst), resIconMain, imageIcon, cx, cy, 0)
		if h != 0 {
			send.Call(uintptr(hwnd), wmSetIcon, ic[0], h)
		}
	}
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
