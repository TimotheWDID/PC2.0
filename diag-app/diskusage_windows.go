//go:build windows

package main

import (
	"context"
	"io/fs"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"golang.org/x/sys/windows"
)

// jonction ou lien symbolique vers un dossier (Go ne le marque pas comme dossier)
func duIsLinkDir(e fs.DirEntry) bool {
	info, err := e.Info()
	if err != nil {
		return true
	}
	a, ok := info.Sys().(*syscall.Win32FileAttributeData)
	return !ok || a.FileAttributes&syscall.FILE_ATTRIBUTE_DIRECTORY != 0
}

const (
	fileAttributeOffline            = 0x00001000
	fileAttributeRecallOnOpen       = 0x00040000
	fileAttributeRecallOnDataAccess = 0x00400000
)

// fichier OneDrive (ou autre stockage en ligne) dont le contenu n'est pas sur le disque
func duOnlineOnly(info fs.FileInfo) bool {
	a, ok := info.Sys().(*syscall.Win32FileAttributeData)
	return ok && a.FileAttributes&(fileAttributeRecallOnOpen|fileAttributeRecallOnDataAccess|fileAttributeOffline) != 0
}

type duDrive struct {
	Root    string `json:"root"`
	Label   string `json:"label"`
	FS      string `json:"fs"`
	Kind    string `json:"kind"`
	Total   uint64 `json:"total"`
	Free    uint64 `json:"free"`
	Current bool   `json:"current,omitempty"` // lecteur d'où tourne l'exe (clé du diag)
}

// duDrives : les lecteurs locaux et amovibles, avec leur espace libre.
func duDrives() []duDrive {
	mask, err := windows.GetLogicalDrives()
	if err != nil {
		return nil
	}
	exeVol := strings.ToUpper(filepath.VolumeName(exeDir()))
	var out []duDrive
	for i := 0; i < 26; i++ {
		if mask&(1<<uint(i)) == 0 {
			continue
		}
		root := string(rune('A'+i)) + `:\`
		rp, _ := windows.UTF16PtrFromString(root)
		kind := ""
		switch windows.GetDriveType(rp) {
		case windows.DRIVE_FIXED:
			kind = "Disque local"
		case windows.DRIVE_REMOVABLE:
			kind = "Amovible"
		default:
			continue // réseau, CD, RAM disk : pas d'intérêt ici
		}
		var free, total, totalFree uint64
		if windows.GetDiskFreeSpaceEx(rp, &free, &total, &totalFree) != nil || total == 0 {
			continue // lecteur de carte vide
		}
		label := make([]uint16, windows.MAX_PATH+1)
		fsName := make([]uint16, windows.MAX_PATH+1)
		_ = windows.GetVolumeInformation(rp, &label[0], uint32(len(label)), nil, nil, nil, &fsName[0], uint32(len(fsName)))
		out = append(out, duDrive{Root: root, Label: windows.UTF16ToString(label), FS: windows.UTF16ToString(fsName), Kind: kind,
			Total: total, Free: totalFree, Current: strings.EqualFold(root[:2], exeVol)})
	}
	return out
}

// ---------------------------------------------------------------- pont avec l'interface

var du struct {
	sync.Mutex
	scan   *duScan
	cancel context.CancelFunc
}

// startDiskScan lance le parcours de root en arrière-plan : progression par
// l'évènement « duProgress », résultat par « duDone ».
func (a *app) startDiskScan(root string) bool {
	root = strings.TrimSpace(root)
	if len(root) == 2 && root[1] == ':' {
		root += `\`
	}
	if root == "" || !filepath.IsAbs(root) {
		return false
	}
	du.Lock()
	if du.cancel != nil {
		du.Unlock()
		return false
	}
	ctx, cancel := context.WithCancel(context.Background())
	du.cancel = cancel
	du.scan = nil
	du.Unlock()

	a.log("Espace disque : analyse de %s", root)
	live := make(chan *duScan, 1)
	go func() {
		s, err := duWalkLive(ctx, root, live)
		du.Lock()
		du.cancel = nil
		if err == nil {
			du.scan = s
		}
		du.Unlock()
		cancel()
		if err != nil {
			a.emitGo("duError", "Impossible de lire "+root+" : "+err.Error())
			return
		}
		sum := s.summary()
		sum["view"] = s.dir(s.root.id)
		a.log("Espace disque : %s analysé en %.0f s, %d fichiers", root, s.seconds, s.root.files)
		a.emitGo("duDone", sum)
	}()
	go func() {
		var s *duScan
		select {
		case s = <-live:
		case <-ctx.Done():
			return
		}
		t := time.NewTicker(300 * time.Millisecond)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				a.emitGo("duProgress", s.progress())
			}
		}
	}()
	return true
}

func cancelDiskScan() bool {
	du.Lock()
	defer du.Unlock()
	if du.cancel == nil {
		return false
	}
	du.cancel()
	return true
}

func diskDir(id int) map[string]any {
	du.Lock()
	s := du.scan
	du.Unlock()
	if s == nil {
		return nil
	}
	return s.dir(id)
}

func diskTree(id, depth int) *duTree {
	du.Lock()
	s := du.scan
	du.Unlock()
	if s == nil {
		return nil
	}
	if depth < 1 || depth > 4 {
		depth = 3
	}
	return s.tree(id, depth)
}

// diskReveal ouvre l'Explorateur sur un dossier ou un fichier du parcours.
func diskReveal(p string) bool {
	du.Lock()
	s := du.scan
	du.Unlock()
	if s == nil || !s.contains(p) {
		return false
	}
	return shellExecute("open", "explorer.exe", "/select,"+syscall.EscapeArg(filepath.Clean(p))) == nil
}

func diskCSV() (string, error) {
	du.Lock()
	s := du.scan
	du.Unlock()
	if s == nil {
		return "", nil
	}
	name := "Espace-disque_" + safeName(strings.TrimRight(s.root.path(), `:\`)) + "_" + time.Now().Format("20060102_1504") + ".csv"
	return saveCSV(name, s.csv(3))
}
