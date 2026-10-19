package main

import (
	"os"
	"path/filepath"
	"strconv"
	"testing"
)

func TestActions(t *testing.T) {
	seen := map[string]bool{}
	for _, a := range Actions {
		if a.ID == "" || a.Title == "" || a.Group == "" || a.Desc == "" || len(a.Steps) == 0 {
			t.Errorf("action incomplète : %+v", a)
		}
		if seen[a.ID] {
			t.Errorf("identifiant en double : %s", a.ID)
		}
		seen[a.ID] = true
		for _, s := range a.Steps {
			if (s.Exe == "") == (s.PS == "") {
				t.Errorf("%s : une étape doit avoir soit un programme soit un script", a.ID)
			}
		}
	}
	// Réparations appelées par l'interface (boutons « Réparer… » et préréglages)
	for _, id := range []string{"restore", "dism", "sfc", "chkdsk", "chkdskboot", "cleanup", "firewall", "smb1off", "wuenable", "netreset", "dnsflush", "defender", "memtest", "wuscan", "wureset", "timesync", "batteryreset"} {
		if findAction(id) == nil {
			t.Errorf("réparation manquante : %s", id)
		}
	}
}

// PSDUMP=dossier go test -run TestDumpPS écrit les scripts PowerShell des
// réparations pour les vérifier avec l'analyseur de PowerShell.
func TestDumpPS(t *testing.T) {
	dir := os.Getenv("PSDUMP")
	if dir == "" {
		t.Skip("PSDUMP non défini")
	}
	for _, a := range Actions {
		for i, s := range a.Steps {
			if s.PS != "" {
				_ = os.WriteFile(filepath.Join(dir, a.ID+"_"+strconv.Itoa(i)+".ps1"), []byte(psPrelude+"\n"+s.PS), 0o644)
			}
		}
	}
	_ = os.WriteFile(filepath.Join(dir, "battery.ps1"), []byte(batteryPointPS), 0o644)
}
