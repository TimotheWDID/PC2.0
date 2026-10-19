//go:build windows

package main

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unicode/utf16"
	"unicode/utf8"
	"unsafe"

	"golang.org/x/sys/windows"
)

// ---------------------------------------------------------------- réparations

func systemExe(name string) string {
	p := filepath.Join(os.Getenv("SystemRoot"), "System32", name)
	if _, err := os.Stat(p); err == nil {
		return p
	}
	return name
}

func powershellExe() string {
	return systemExe(`WindowsPowerShell\v1.0\powershell.exe`)
}

// psCommand builds a hidden PowerShell call for a script, passed encoded to
// avoid any quoting issue.
func psCommand(ctx context.Context, script string) *exec.Cmd {
	u := utf16.Encode([]rune(script))
	b := make([]byte, len(u)*2)
	for i, c := range u {
		b[2*i], b[2*i+1] = byte(c), byte(c>>8)
	}
	cmd := exec.CommandContext(ctx, powershellExe(), "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", base64.StdEncoding.EncodeToString(b))
	hide(cmd)
	return cmd
}

func hide(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: windows.CREATE_NO_WINDOW}
}

func (a *app) runAction(id string) string {
	act := findAction(id)
	if act == nil {
		return "Réparation inconnue : " + id
	}
	a.mu.Lock()
	if a.runCancel != nil {
		a.mu.Unlock()
		return "Une réparation est déjà en cours."
	}
	ctx, cancel := context.WithCancel(context.Background())
	a.runCancel = cancel
	a.mu.Unlock()

	go func() {
		started := time.Now()
		ok := true
		a.log("Réparation « %s » lancée", act.Title)
		for i, st := range act.Steps {
			if ctx.Err() != nil {
				ok = false
				break
			}
			a.emitGo("actionStep", map[string]any{"index": i, "count": len(act.Steps), "label": st.Label})
			code, err := a.runStep(ctx, id, st)
			switch {
			case ctx.Err() != nil:
				ok = false
			case err != nil:
				a.emitGo("actionLog", map[string]any{"id": id, "line": "Erreur : " + err.Error()})
				ok = ok && st.Soft
			case !codeOK(code, st.OKCodes):
				a.emitGo("actionLog", map[string]any{"id": id, "line": "Code de sortie : " + strconv.Itoa(code)})
				ok = ok && st.Soft
			}
			if !ok {
				break
			}
		}
		a.mu.Lock()
		a.runCancel = nil
		a.mu.Unlock()
		cancel()
		secs := int(time.Since(started).Seconds())
		a.log("Réparation « %s » : %v en %d s", act.Title, ok, secs)
		a.emitGo("actionDone", map[string]any{"id": id, "ok": ok, "seconds": secs, "reboot": act.Reboot})
	}()
	return ""
}

func codeOK(code int, ok []int) bool {
	if len(ok) == 0 {
		return code == 0
	}
	for _, c := range ok {
		if c == code {
			return true
		}
	}
	return false
}

func (a *app) cancelAction() bool {
	a.mu.Lock()
	cancel, pid := a.runCancel, a.runPID
	a.mu.Unlock()
	if cancel == nil {
		return false
	}
	// sfc, dism ou chkdsk lancent leurs propres processus : on arrête tout l'arbre
	if pid > 0 {
		kill := exec.Command(systemExe("taskkill.exe"), "/PID", strconv.Itoa(pid), "/T", "/F")
		hide(kill)
		_ = kill.Run()
	}
	cancel()
	return true
}

func (a *app) runStep(ctx context.Context, id string, st Step) (int, error) {
	var cmd *exec.Cmd
	if st.Exe != "" {
		args := make([]string, len(st.Args))
		for i, s := range st.Args {
			args[i] = strings.ReplaceAll(s, "%SystemDrive%", os.Getenv("SystemDrive"))
		}
		cmd = exec.CommandContext(ctx, systemExe(st.Exe), args...)
		hide(cmd)
		a.emitGo("actionLog", map[string]any{"id": id, "line": "> " + st.Exe + " " + strings.Join(args, " ")})
	} else {
		cmd = psCommand(ctx, psPrelude+"\n"+st.PS)
	}
	exe, _ := os.Executable()
	cmd.Env = append(os.Environ(), "PC2DIAG_EXE="+exe)
	// Un sous-processus qui garde la sortie ouverte ne doit pas bloquer la fin
	cmd.WaitDelay = 5 * time.Second
	r, w := io.Pipe()
	cmd.Stdout, cmd.Stderr = w, w
	if err := cmd.Start(); err != nil {
		return -1, err
	}
	a.mu.Lock()
	a.runPID = cmd.Process.Pid
	a.mu.Unlock()

	done := make(chan struct{})
	go func() {
		splitLines(r, func(line string, replace bool) {
			a.emitGo("actionLog", map[string]any{"id": id, "line": line, "replace": replace})
		})
		close(done)
	}()
	err := cmd.Wait()
	w.Close()
	<-done
	a.mu.Lock()
	a.runPID = 0
	a.mu.Unlock()
	var ee *exec.ExitError
	if errors.As(err, &ee) {
		return ee.ExitCode(), nil
	}
	if err != nil {
		return -1, err
	}
	return 0, nil
}

// splitLines reads a console program's output and calls fn for each line.
// A line ending with a lone \r (progress such as « 45 % ») replaces the
// previous one. sfc writes UTF-16, the other tools the OEM code page.
func splitLines(r io.Reader, fn func(string, bool)) {
	buf := make([]byte, 4096)
	var pending []byte
	mode := 0 // 0 inconnu, 1 UTF-16LE, 2 octets
	var text strings.Builder
	prevCR := false
	flush := func(final bool) {
		s := text.String()
		start := 0
		for i := 0; i < len(s); i++ {
			if s[i] != '\r' && s[i] != '\n' {
				continue
			}
			line := strings.TrimRight(s[start:i], " \t")
			cr := s[i] == '\r'
			if cr && i+1 < len(s) && s[i+1] == '\n' {
				cr = false
				i++
			} else if cr && i+1 == len(s) && !final {
				break // on attend de savoir si \n suit
			}
			if strings.TrimSpace(line) != "" {
				fn(line, prevCR)
				prevCR = cr
			}
			start = i + 1
		}
		rest := s[start:]
		if final && strings.TrimSpace(rest) != "" {
			fn(strings.TrimRight(rest, " \t\r"), prevCR)
			rest = ""
		}
		text.Reset()
		text.WriteString(rest)
	}
	for {
		n, err := r.Read(buf)
		if n > 0 {
			pending = append(pending, buf[:n]...)
			if mode == 0 && len(pending) >= 2 {
				zeros := 0
				for i := 1; i < len(pending); i += 2 {
					if pending[i] == 0 {
						zeros++
					}
				}
				if zeros*3 > len(pending)/2*2 {
					mode = 1
				} else {
					mode = 2
				}
			}
			switch mode {
			case 1:
				m := len(pending) &^ 1
				u := make([]uint16, m/2)
				for i := range u {
					u[i] = uint16(pending[2*i]) | uint16(pending[2*i+1])<<8
				}
				text.WriteString(strings.TrimPrefix(string(utf16.Decode(u)), "\ufeff"))
				pending = pending[m:]
			case 2:
				cut := -1
				for i := len(pending) - 1; i >= 0; i-- {
					if pending[i] == '\n' || pending[i] == '\r' {
						cut = i
						break
					}
				}
				if cut >= 0 {
					text.WriteString(decodeConsole(pending[:cut+1]))
					pending = pending[cut+1:]
				}
			}
			flush(false)
		}
		if err != nil {
			if len(pending) > 0 {
				text.WriteString(decodeConsole(pending))
			}
			flush(true)
			return
		}
	}
}

const cpOEM = 1 // CP_OEMCP

func decodeConsole(b []byte) string {
	if utf8.Valid(b) {
		return string(b)
	}
	// MultiByteToWideChar depuis la page de code OEM (850 en français)
	n, err := windows.MultiByteToWideChar(cpOEM, 0, &b[0], int32(len(b)), nil, 0)
	if err != nil || n == 0 {
		return strings.ToValidUTF8(string(b), "?")
	}
	u := make([]uint16, n)
	if _, err := windows.MultiByteToWideChar(cpOEM, 0, &b[0], int32(len(b)), &u[0], n); err != nil {
		return strings.ToValidUTF8(string(b), "?")
	}
	return string(utf16.Decode(u))
}

// ---------------------------------------------------------------- redémarrage

const runOnceKey = `Software\Microsoft\Windows\CurrentVersion\RunOnce`

func (a *app) reboot(delay int, resume bool) string {
	if delay < 0 {
		delay = 0
	}
	if resume {
		if err := setResume(); err != nil {
			return "impossible de programmer la reprise : " + err.Error()
		}
	}
	cmd := exec.Command(systemExe("shutdown.exe"), "/r", "/t", strconv.Itoa(delay), "/c", "PC2 Diag : redémarrage pour finaliser les réparations.")
	hide(cmd)
	if out, err := cmd.CombinedOutput(); err != nil {
		clearResume()
		return strings.TrimSpace(decodeConsole(append(out, ' '))) + " (" + err.Error() + ")"
	}
	a.log("Redémarrage programmé dans %d s (reprise : %v)", delay, resume)
	return ""
}

func (a *app) cancelReboot() bool {
	cmd := exec.Command(systemExe("shutdown.exe"), "/a")
	hide(cmd)
	_ = cmd.Run()
	clearResume()
	return true
}

// ---------------------------------------------------------------- outils Windows

var tools = map[string][2]string{
	"devmgmt":       {"mmc.exe", "devmgmt.msc"},
	"reliability":   {"perfmon.exe", "/rel"},
	"startup":       {"taskmgr.exe", "/0 /startup"},
	"services":      {"mmc.exe", "services.msc"},
	"netplwiz":      {"netplwiz.exe", ""},
	"lusrmgr":       {"mmc.exe", "lusrmgr.msc"},
	"uac":           {"UserAccountControlSettings.exe", ""},
	"defender":      {"windowsdefender:", ""},
	"minidump":      {"explorer.exe", `%SystemRoot%\Minidump`},
	"eventvwr":      {"mmc.exe", "eventvwr.msc"},
	"diskmgmt":      {"mmc.exe", "diskmgmt.msc"},
	"msinfo32":      {"msinfo32.exe", ""},
	"resmon":        {"resmon.exe", ""},
	"storagesense":  {"ms-settings:storagesense", ""},
	"windowsupdate": {"ms-settings:windowsupdate", ""},
}

func openTool(id string) error {
	t, ok := tools[id]
	if !ok {
		return fmt.Errorf("outil inconnu : %s", id)
	}
	args := strings.ReplaceAll(t[1], "%SystemRoot%", os.Getenv("SystemRoot"))
	return shellExecute("open", t[0], args)
}

// ---------------------------------------------------------------- mesures système

type memoryStatusEx struct {
	Length               uint32
	MemoryLoad           uint32
	TotalPhys            uint64
	AvailPhys            uint64
	TotalPageFile        uint64
	AvailPageFile        uint64
	TotalVirtual         uint64
	AvailVirtual         uint64
	AvailExtendedVirtual uint64
}

var (
	kernel32                 = windows.NewLazySystemDLL("kernel32.dll")
	procGlobalMemoryStatusEx = kernel32.NewProc("GlobalMemoryStatusEx")
	procGetSystemPowerStatus = kernel32.NewProc("GetSystemPowerStatus")
	procGetTickCount64       = kernel32.NewProc("GetTickCount64")
)

func memoryStatus() (memoryStatusEx, bool) {
	var m memoryStatusEx
	m.Length = uint32(unsafe.Sizeof(m))
	r, _, _ := procGlobalMemoryStatusEx.Call(uintptr(unsafe.Pointer(&m)))
	return m, r != 0
}

type powerStatus struct {
	ACLineStatus        byte
	BatteryFlag         byte
	BatteryLifePercent  byte
	SystemStatusFlag    byte
	BatteryLifeTime     uint32
	BatteryFullLifeTime uint32
}

func powerState() (powerStatus, bool) {
	var p powerStatus
	r, _, _ := procGetSystemPowerStatus.Call(uintptr(unsafe.Pointer(&p)))
	return p, r != 0
}

func hasBattery() bool {
	p, ok := powerState()
	return ok && p.BatteryFlag != 128 && p.BatteryFlag != 255
}

func uptimeHours() float64 {
	r, _, _ := procGetTickCount64.Call()
	return float64(r) / 3.6e6
}
