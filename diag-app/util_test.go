package main

import (
	"bytes"
	"compress/gzip"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"unicode/utf8"
)

func TestChunkAt(t *testing.T) {
	s := strings.Repeat("Diagnostic é à — ✓ ", 5000)
	var got strings.Builder
	off, n := 0, 0
	for {
		part, next := chunkAt(s, off, 1000)
		if !utf8.ValidString(part) {
			t.Fatalf("morceau coupé au milieu d'un caractère à %d", off)
		}
		got.WriteString(part)
		n++
		if next == 0 {
			break
		}
		off = next
	}
	if got.String() != s || n < 10 {
		t.Fatalf("texte recomposé différent (%d morceaux)", n)
	}
}

func TestSendAtelier(t *testing.T) {
	scan := `{"meta":{"computer":"PC-CLAIRE"}}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/diag-app/diagnostics" || r.Header.Get("Authorization") != "Bearer pc2d_x" {
			http.Error(w, "bad", 400)
			return
		}
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		f := r.MultipartForm
		if f.Value["ticket_id"][0] != "12" || !strings.Contains(f.Value["report"][0], "diag-atelier") || f.Value["state"][0] != "null" ||
			f.Value["file_sources[]"][0] != "app" || f.Value["file_names[]"][0] != "Analyse.json" || f.Value["file_encodings[]"][0] != "gzip" {
			http.Error(w, "champs", 400)
			return
		}
		fh := f.File["files[]"][0]
		rd, _ := fh.Open()
		zr, err := gzip.NewReader(rd)
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		b, _ := io.ReadAll(zr)
		if !bytes.Equal(b, []byte(scan)) {
			http.Error(w, "fichier", 400)
			return
		}
		w.WriteHeader(201)
		_ = json.NewEncoder(w).Encode(map[string]any{"id": 5, "report_url": "https://s/r"})
	}))
	defer srv.Close()

	c := NewClient(srv.URL, "pc2d_x", "PC")
	res, err := c.Send(12, AtelierExport{
		Report:    json.RawMessage(`{"format":"diag-atelier"}`),
		Inventory: json.RawMessage(`{"brand":"LENOVO"}`),
		Files:     []AtelierFile{{Source: "app", Name: "Analyse.json", B64: base64.StdEncoding.EncodeToString([]byte(scan))}},
	})
	if err != nil || res.ID != 5 || res.ReportURL != "https://s/r" {
		t.Fatalf("envoi : %v %+v", err, res)
	}
	if _, err := c.Send(0, AtelierExport{}); err == nil {
		t.Fatal("un rapport vide doit être refusé")
	}
}

func TestPruneFiles(t *testing.T) {
	dir := t.TempDir()
	for _, n := range []string{"PC2Diag-collecte_2026-01-03.txt", "PC2Diag-collecte_2026-01-01.txt", "PC2Diag-collecte_2026-01-02.txt", "Analyse_2026-01-01.json"} {
		if err := os.WriteFile(filepath.Join(dir, n), nil, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	pruneFiles(dir, "PC2Diag-collecte_", 2)
	entries, _ := os.ReadDir(dir)
	var got []string
	for _, e := range entries {
		got = append(got, e.Name())
	}
	want := "Analyse_2026-01-01.json PC2Diag-collecte_2026-01-02.txt PC2Diag-collecte_2026-01-03.txt"
	if strings.Join(got, " ") != want {
		t.Fatalf("restants = %v, attendu %s", got, want)
	}
}

func TestTicketFilePath(t *testing.T) {
	cases := []struct{ path, name, want string }{
		{"/tickets/12/files/3/download", "Devis client.pdf", filepath.Join("R", "Tickets", "12", "Devis client.pdf")},
		{"/tickets/12/messages/4/attachments/5", `..\..\Windows\evil.PDF`, filepath.Join("R", "Tickets", "12", "Windows_evil.pdf")},
		{"/tickets/7/diagnostics/2/client-report", "", filepath.Join("R", "Tickets", "7", "fichier")},
		{"/todos", "a:b?.txt", filepath.Join("R", "Tickets", "divers", "a_b.txt")},
	}
	for _, c := range cases {
		if got := ticketFilePath("R", c.path, c.name); got != c.want {
			t.Errorf("ticketFilePath(%q, %q) = %q, attendu %q", c.path, c.name, got, c.want)
		}
	}
	if !runnableExt("setup.EXE") || !runnableExt("x.ps1") || runnableExt("photo.jpg") || runnableExt("rapport.html") {
		t.Error("runnableExt")
	}
}
