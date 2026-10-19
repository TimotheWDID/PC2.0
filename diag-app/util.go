package main

import (
	"fmt"
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
