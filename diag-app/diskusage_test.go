package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDiskUsage(t *testing.T) {
	root := t.TempDir()
	write := func(rel string, size int) {
		p := filepath.Join(root, rel)
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, make([]byte, size), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("a.txt", 100)
	write("Videos/film.mkv", 5000)
	write("Videos/clip.MP4", 3000)
	write("Docs/x/y/rapport.pdf", 700)
	write("Docs/note", 50)
	// un lien vers un dossier n'est pas suivi (pas compté deux fois)
	if err := os.Symlink(filepath.Join(root, "Videos"), filepath.Join(root, "lien")); err != nil {
		t.Logf("lien non créé : %v", err)
	}

	s, err := duWalk(context.Background(), root)
	if err != nil {
		t.Fatal(err)
	}
	if s.root.size != 8850 || s.root.files != 5 {
		t.Fatalf("total %d o, %d fichiers ; attendu 8850 o, 5 fichiers", s.root.size, s.root.files)
	}
	if s.root.dirs != 4 {
		t.Fatalf("sous-dossiers %d, attendu 4", s.root.dirs)
	}
	v := s.dir(s.root.id)
	rows := v["rows"].([]duRow)
	if rows[0].Name != "Videos" || rows[0].Size != 8000 || rows[1].Name != "Docs" || rows[1].Size != 750 {
		t.Fatalf("ordre des dossiers : %+v", rows)
	}
	if own := v["own"].(map[string]int64); own["size"] != 100 || own["files"] != 1 {
		t.Fatalf("fichiers du dossier : %+v", own)
	}
	docs := s.dir(rows[1].ID)
	if c := docs["crumbs"].([]duRow); len(c) != 2 || c[1].Name != "Docs" {
		t.Fatalf("fil d'Ariane : %+v", c)
	}
	if len(s.top) != 5 || filepath.Base(s.top[0].Path) != "film.mkv" || s.top[4].Size != 50 {
		t.Fatalf("plus gros fichiers : %+v", s.top)
	}
	sum := s.summary()
	exts := sum["exts"].([]duExt)
	if exts[0].Ext != ".mkv" || exts[1].Ext != ".mp4" {
		t.Fatalf("types : %+v", exts)
	}
	if !s.contains(filepath.Join(root, "Docs", "note")) || s.contains(filepath.Dir(root)) || s.contains(root+"x") {
		t.Fatal("contains")
	}
	csv := s.csv(1)
	if !strings.Contains(csv, "Videos;8000;7,8 Ko;2;0;") {
		t.Fatalf("csv :\n%s", csv)
	}
	if folders, _, _ := strings.Cut(csv, "Plus gros fichiers"); strings.Contains(folders, filepath.Join("Docs", "x")) {
		t.Fatal("csv : profondeur non respectée")
	}
}

func TestDiskTree(t *testing.T) {
	root := t.TempDir()
	for rel, size := range map[string]int{"a/x/1": 4000, "a/2": 1000, "b/3": 3000, "c": 2000, "d/petit": 1} {
		p := filepath.Join(root, rel)
		_ = os.MkdirAll(filepath.Dir(p), 0o755)
		_ = os.WriteFile(p, make([]byte, size), 0o644)
	}
	s, _ := duWalk(context.Background(), root)
	tr := s.tree(s.root.id, 2)
	if tr.Size != 10001 || tr.Own != 2000 || len(tr.Children) != 2 || tr.Rest != 1 {
		t.Fatalf("racine : %+v", tr)
	}
	a := tr.Children[0]
	if a.Name != "a" || a.Own != 1000 || len(a.Children) != 1 || a.Children[0].Children != nil {
		t.Fatalf("niveau 2 : %+v", a)
	}
	if s.tree(-1, 2) != nil || s.tree(len(s.nodes), 2) != nil {
		t.Fatal("id hors limites")
	}
}

func TestDiskUsageCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	s, err := duWalk(ctx, t.TempDir())
	if err != nil || !s.canceled {
		t.Fatalf("annulation : %v %v", err, s)
	}
}

func TestDiskTopFiles(t *testing.T) {
	s := &duScan{}
	for i := 1; i <= duTopFiles+50; i++ {
		s.addTop(duFile{Path: itoa(int64(i)), Size: int64(i)})
	}
	if len(s.top) != duTopFiles || s.top[0].Size != duTopFiles+50 || s.top[duTopFiles-1].Size != 51 {
		t.Fatalf("top : %d fichiers, %d … %d", len(s.top), s.top[0].Size, s.top[len(s.top)-1].Size)
	}
}

func TestHumanSize(t *testing.T) {
	for n, want := range map[int64]string{0: "0 o", 512: "512 o", 1536: "1,5 Ko", 10 << 30: "10 Go", 250 << 30: "250 Go", 1 << 40: "1 To"} {
		if got := humanSize(n); got != want {
			t.Errorf("humanSize(%d) = %q, attendu %q", n, got, want)
		}
	}
}
