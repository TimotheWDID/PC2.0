package main

import (
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"unicode/utf8"
)

func asMap(v any) map[string]any {
	m, _ := v.(map[string]any)
	return m
}

func str(v any) string {
	switch x := v.(type) {
	case string:
		return strings.TrimSpace(x)
	case float64:
		return fmt.Sprint(x)
	case bool:
		return fmt.Sprint(x)
	}
	return ""
}

// chunkAt returns about size bytes of s from off, cut on a character
// boundary, and the offset of the next piece (0 at the end).
func chunkAt(s string, off, size int) (string, int) {
	if off < 0 || off >= len(s) {
		return "", 0
	}
	end := off + size
	if end >= len(s) {
		return s[off:], 0
	}
	for end > off+1 && !utf8.RuneStart(s[end]) {
		end--
	}
	return s[off:end], end
}

// sensor is one live reading sent to the interface (event « sensors »).
type sensor struct {
	ID string  `json:"id"`
	G  string  `json:"g"`
	L  string  `json:"l"`
	U  string  `json:"u"`
	V  float64 `json:"v"`
	K  string  `json:"k,omitempty"` // colonne du relevé envoyé au site (format HWiNFO), voir sensorLog dans ui.html
}

func round2(v float64) float64 { return math.Round(v*100) / 100 }

// pruneFiles keeps the keep most recent files of dir whose name starts with
// prefix (their names end with a sortable date) and deletes the others.
func pruneFiles(dir, prefix string, keep int) {
	entries, _ := os.ReadDir(dir)
	var names []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasPrefix(e.Name(), prefix) {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	for len(names) > keep {
		os.Remove(filepath.Join(dir, names[0]))
		names = names[1:]
	}
}
