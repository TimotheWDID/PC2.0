package main

import (
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// Espace disque, façon TreeSize : parcourt un lecteur ou un dossier et garde en
// mémoire l'arbre des dossiers avec leur taille. Les fichiers ne sont pas gardés
// un par un : seuls comptent la taille de leur dossier, les plus gros fichiers et
// le total par type (extension). L'interface descend ensuite dans l'arbre dossier
// par dossier (duDir), sans reparcourir le disque.

const (
	duTopFiles = 200 // plus gros fichiers gardés
	duMaxRows  = 300 // sous-dossiers renvoyés par dossier, le reste est regroupé
)

type duNode struct {
	id       int
	name     string
	parent   *duNode
	children []*duNode
	size     int64 // fichiers de ce dossier et de ses sous-dossiers
	files    int64 // nombre de fichiers, sous-dossiers compris
	dirs     int64 // nombre de sous-dossiers, à tous les niveaux
	ownSize  int64 // fichiers directement dans ce dossier
	ownFiles int64
	modTime  time.Time // fichier le plus récent, sous-dossiers compris
	denied   bool      // accès refusé (lancer en administrateur pour le lire)
	skipped  bool      // jonction ou lien symbolique, non suivi
}

func (n *duNode) path() string {
	if n.parent == nil {
		return n.name
	}
	return filepath.Join(n.parent.path(), n.name)
}

type duFile struct {
	Path string `json:"path"`
	Size int64  `json:"size"`
	Mod  string `json:"mod,omitempty"`
}

type duExt struct {
	Ext   string `json:"ext"`
	Size  int64  `json:"size"`
	Count int64  `json:"count"`
}

type duScan struct {
	root    *duNode
	started time.Time
	seconds float64

	mu       sync.Mutex
	nodes    []*duNode
	top      []duFile // trié du plus gros au plus petit, duTopFiles au plus
	minTop   atomic.Int64
	exts     map[string]*duExt
	nFiles   atomic.Int64
	nDirs    atomic.Int64
	nBytes   atomic.Int64
	nDenied  atomic.Int64
	nCloud   atomic.Int64 // octets des fichiers en ligne uniquement, non comptés
	current  atomic.Value // dossier en cours, pour la progression
	canceled bool
}

// duWalk parcourt root. Plusieurs dossiers sont lus en parallèle : sur un SSD
// le parcours va bien plus vite. Annulable par ctx.
func duWalk(ctx context.Context, root string) (*duScan, error) { return duWalkLive(ctx, root, nil) }

// duWalkLive : comme duWalk, et publie le parcours dans live dès son début (progression).
func duWalkLive(ctx context.Context, root string, live chan<- *duScan) (*duScan, error) {
	root = filepath.Clean(root)
	if _, err := os.Stat(root); err != nil {
		return nil, err
	}
	s := &duScan{started: time.Now(), exts: map[string]*duExt{}}
	s.root = s.newNode(root, nil)
	s.current.Store(root)
	if live != nil {
		live <- s
	}
	workers := runtime.NumCPU() * 2
	if workers > 16 {
		workers = 16
	}
	sem := make(chan struct{}, workers)
	s.walkDir(ctx, s.root, sem)
	s.sum(s.root)
	s.seconds = time.Since(s.started).Seconds()
	s.canceled = ctx.Err() != nil
	return s, nil
}

func (s *duScan) newNode(name string, parent *duNode) *duNode {
	s.mu.Lock()
	n := &duNode{id: len(s.nodes), name: name, parent: parent}
	s.nodes = append(s.nodes, n)
	s.mu.Unlock()
	return n
}

func (s *duScan) walkDir(ctx context.Context, n *duNode, sem chan struct{}) {
	if ctx.Err() != nil {
		return
	}
	p := n.path()
	s.current.Store(p)
	entries, err := os.ReadDir(p)
	if err != nil && len(entries) == 0 {
		n.denied = true
		s.nDenied.Add(1)
		return
	}
	exts := map[string]*duExt{}
	for _, e := range entries {
		if !e.IsDir() && e.Type()&(fs.ModeSymlink|fs.ModeIrregular) != 0 && duIsLinkDir(e) {
			// jonction (« Documents and Settings »…) ou lien vers un dossier : déjà compté ailleurs
			c := s.newNode(e.Name(), n)
			c.skipped = true
			n.children = append(n.children, c)
			continue
		}
		if e.IsDir() {
			n.children = append(n.children, s.newNode(e.Name(), n))
			s.nDirs.Add(1)
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		size := info.Size()
		if duOnlineOnly(info) {
			// fichier OneDrive « disponible en ligne uniquement » : n'occupe pas le disque
			s.nCloud.Add(size)
			continue
		}
		n.ownSize += size
		n.ownFiles++
		if mt := info.ModTime(); mt.After(n.modTime) {
			n.modTime = mt
		}
		ext := strings.ToLower(filepath.Ext(e.Name()))
		if ext == "" || len(ext) > 12 {
			ext = "(sans extension)"
		}
		x := exts[ext]
		if x == nil {
			x = &duExt{Ext: ext}
			exts[ext] = x
		}
		x.Size += size
		x.Count++
		if size > s.minTop.Load() {
			s.addTop(duFile{Path: filepath.Join(p, e.Name()), Size: size, Mod: info.ModTime().Format("2006-01-02")})
		}
	}
	s.nFiles.Add(n.ownFiles)
	s.nBytes.Add(n.ownSize)
	if len(exts) > 0 {
		s.mu.Lock()
		for k, v := range exts {
			x := s.exts[k]
			if x == nil {
				s.exts[k] = v
			} else {
				x.Size += v.Size
				x.Count += v.Count
			}
		}
		s.mu.Unlock()
	}
	var wg sync.WaitGroup
	for _, c := range n.children {
		if c.skipped {
			continue
		}
		select {
		case sem <- struct{}{}:
			wg.Add(1)
			go func(c *duNode) {
				defer func() { <-sem; wg.Done() }()
				s.walkDir(ctx, c, sem)
			}(c)
		default:
			s.walkDir(ctx, c, sem)
		}
	}
	wg.Wait()
}

func (s *duScan) addTop(f duFile) {
	s.mu.Lock()
	defer s.mu.Unlock()
	i := sort.Search(len(s.top), func(i int) bool { return s.top[i].Size < f.Size })
	if i >= duTopFiles {
		return
	}
	s.top = append(s.top, duFile{})
	copy(s.top[i+1:], s.top[i:])
	s.top[i] = f
	if len(s.top) > duTopFiles {
		s.top = s.top[:duTopFiles]
	}
	if len(s.top) == duTopFiles {
		s.minTop.Store(s.top[len(s.top)-1].Size)
	}
}

// sum calcule les totaux de chaque dossier une fois le parcours fini.
func (s *duScan) sum(n *duNode) {
	n.size, n.files, n.dirs = n.ownSize, n.ownFiles, 0
	for _, c := range n.children {
		s.sum(c)
		n.size += c.size
		n.files += c.files
		n.dirs += c.dirs
		if !c.skipped {
			n.dirs++
		}
		if c.modTime.After(n.modTime) {
			n.modTime = c.modTime
		}
	}
	sort.Slice(n.children, func(i, j int) bool {
		if n.children[i].size != n.children[j].size {
			return n.children[i].size > n.children[j].size
		}
		return strings.ToLower(n.children[i].name) < strings.ToLower(n.children[j].name)
	})
}

func (s *duScan) progress() map[string]any {
	cur, _ := s.current.Load().(string)
	return map[string]any{
		"files": s.nFiles.Load(), "dirs": s.nDirs.Load(), "bytes": s.nBytes.Load(),
		"denied": s.nDenied.Load(), "current": cur, "seconds": int(time.Since(s.started).Seconds()),
	}
}

// ---------------------------------------------------------------- vues pour l'interface

type duRow struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	Size    int64  `json:"size"`
	Files   int64  `json:"files"`
	Dirs    int64  `json:"dirs"`
	Mod     string `json:"mod,omitempty"`
	Denied  bool   `json:"denied,omitempty"`
	Skipped bool   `json:"skipped,omitempty"`
}

func rowOf(n *duNode) duRow {
	r := duRow{ID: n.id, Name: n.name, Size: n.size, Files: n.files, Dirs: n.dirs, Denied: n.denied, Skipped: n.skipped}
	if !n.modTime.IsZero() {
		r.Mod = n.modTime.Format("2006-01-02")
	}
	return r
}

// summary : le résultat du parcours, envoyé à l'interface à la fin.
func (s *duScan) summary() map[string]any {
	exts := make([]duExt, 0, len(s.exts))
	for _, x := range s.exts {
		exts = append(exts, *x)
	}
	sort.Slice(exts, func(i, j int) bool { return exts[i].Size > exts[j].Size })
	if len(exts) > 100 {
		exts = exts[:100]
	}
	return map[string]any{
		"root": s.root.path(), "rootId": s.root.id, "size": s.root.size, "files": s.root.files, "dirs": s.root.dirs,
		"denied": s.nDenied.Load(), "cloud": s.nCloud.Load(), "seconds": round2(s.seconds), "canceled": s.canceled,
		"top": s.top, "exts": exts,
	}
}

// dir renvoie un dossier et ses sous-dossiers, du plus gros au plus petit.
func (s *duScan) dir(id int) map[string]any {
	if id < 0 || id >= len(s.nodes) {
		return nil
	}
	n := s.nodes[id]
	var crumbs []duRow
	for p := n; p != nil; p = p.parent {
		crumbs = append([]duRow{{ID: p.id, Name: p.name}}, crumbs...)
	}
	rows := make([]duRow, 0, len(n.children))
	var rest duRow
	for i, c := range n.children {
		if i < duMaxRows {
			rows = append(rows, rowOf(c))
			continue
		}
		rest.Size += c.size
		rest.Files += c.files
		rest.Dirs++
	}
	out := map[string]any{"dir": rowOf(n), "path": n.path(), "crumbs": crumbs, "rows": rows,
		"own": map[string]int64{"size": n.ownSize, "files": n.ownFiles}}
	if rest.Dirs > 0 {
		out["rest"] = rest
	}
	return out
}

// contains : le chemin fait partie du dossier analysé (pour « Ouvrir dans l'Explorateur »).
func (s *duScan) contains(p string) bool {
	rel, err := filepath.Rel(s.root.path(), filepath.Clean(p))
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

// csv : les dossiers jusqu'à depth niveaux sous la racine, pour un export tableur.
func (s *duScan) csv(depth int) string {
	var b strings.Builder
	b.WriteString("\xEF\xBB\xBFDossier;Taille (octets);Taille;Fichiers;Sous-dossiers;Dernière modification\r\n")
	var walk func(n *duNode, d int)
	walk = func(n *duNode, d int) {
		r := rowOf(n)
		b.WriteString(csvField(n.path()) + ";" + itoa(n.size) + ";" + humanSize(n.size) + ";" + itoa(n.files) + ";" + itoa(n.dirs) + ";" + r.Mod + "\r\n")
		if d >= depth {
			return
		}
		for _, c := range n.children {
			if !c.skipped && c.size > 0 {
				walk(c, d+1)
			}
		}
	}
	walk(s.root, 0)
	b.WriteString("\r\nPlus gros fichiers;Taille (octets);Taille;;;Dernière modification\r\n")
	for _, f := range s.top {
		b.WriteString(csvField(f.Path) + ";" + itoa(f.Size) + ";" + humanSize(f.Size) + ";;;" + f.Mod + "\r\n")
	}
	return b.String()
}

func csvField(s string) string {
	if strings.ContainsAny(s, ";\"\r\n") {
		return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
	}
	return s
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var d [20]byte
	i := len(d)
	for n > 0 {
		i--
		d[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		d[i] = '-'
	}
	return string(d[i:])
}

func humanSize(n int64) string {
	units := []string{"o", "Ko", "Mo", "Go", "To"}
	v, u := float64(n), 0
	for v >= 1024 && u < len(units)-1 {
		v /= 1024
		u++
	}
	if u == 0 {
		return itoa(n) + " o"
	}
	s := formatFloat(v)
	if strings.Contains(s, ".") {
		s = strings.Replace(strings.TrimSuffix(strings.TrimRight(s, "0"), "."), ".", ",", 1)
	}
	return s + " " + units[u]
}

func formatFloat(v float64) string {
	if v >= 100 {
		return itoa(int64(v + 0.5))
	}
	x := int64(v*10 + 0.5)
	return itoa(x/10) + "." + itoa(x%10)
}
