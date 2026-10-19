package main

import (
	"bytes"
	"compress/gzip"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
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
