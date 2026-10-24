package main

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestEvCausesTitles(t *testing.T) {
	titles := map[string]bool{}
	for _, k := range evKB {
		titles[k.Title] = true
	}
	for title := range evCauses {
		if !titles[title] {
			t.Errorf("evCauses : titre inconnu %q", title)
		}
	}
	for _, s := range evSymptoms {
		for _, m := range s.M {
			if len(m.Src) == 0 {
				t.Errorf("symptôme %s sans source", s.ID)
			}
		}
	}
}

func evFixture(t *testing.T, events string) evResult {
	t.Helper()
	var r evScanRaw
	if err := json.Unmarshal([]byte(`{"days":7,"events":[`+events+`]}`), &r); err != nil {
		t.Fatal(err)
	}
	return groupEvents(r, time.UTC)
}

func evFindGroup(res evResult, src string, id int) *evGroup {
	for i := range res.Groups {
		if res.Groups[i].Src == src && res.Groups[i].ID == id {
			return &res.Groups[i]
		}
	}
	return nil
}

func evCrossTitles(res evResult) string {
	var l []string
	for _, c := range res.Cross {
		l = append(l, c.Title)
	}
	return strings.Join(l, " | ")
}

func TestEvHintsAndCross(t *testing.T) {
	res := evFixture(t, `
	 {"t":"2026-10-23T10:00:00Z","log":"System","src":"Microsoft-Windows-Kernel-Power","id":41,"lvl":1,"p":["0","0","0","0","0","0","0","0"]},
	 {"t":"2026-10-22T10:00:00Z","log":"System","src":"Microsoft-Windows-Kernel-Power","id":41,"lvl":1,"p":["0","0","0","0","0","0","0","0"]},
	 {"t":"2026-10-21T10:00:00Z","log":"System","src":"Microsoft-Windows-Kernel-Power","id":41,"lvl":1,"p":["0","0","0","0","0","0","133000000000","0"]},
	 {"t":"2026-10-20T10:00:00Z","log":"System","src":"Microsoft-Windows-Kernel-Power","id":41,"lvl":1,"p":["278","1","2","3","4","0","0","0"]},
	 {"t":"2026-10-23T09:55:00Z","log":"System","src":"stornvme","id":129,"lvl":3,"msg":"Reset to device, \\Device\\RaidPort0"},
	 {"t":"2026-10-22T09:57:00Z","log":"System","src":"stornvme","id":129,"lvl":3,"msg":"Reset to device, \\Device\\RaidPort0"},
	 {"t":"2026-10-22T09:58:00Z","log":"Application","src":"Application Hang","id":1002,"lvl":2,"p":["EXCEL.EXE"]},
	 {"t":"2026-10-20T10:01:00Z","log":"System","src":"BugCheck","id":1001,"lvl":2,"msg":"The bugcheck was: 0x00000116 (0x1, 0x2)","p":["0x00000116 (0x1, 0x2)"]},
	 {"t":"2026-10-19T10:01:00Z","log":"System","src":"BugCheck","id":1001,"lvl":2,"msg":"The bugcheck was: 0x0000001a (0x1, 0x2)","p":["0x0000001a (0x1, 0x2)"]},
	 {"t":"2026-10-19T08:00:00Z","log":"System","src":"Microsoft-Windows-WindowsUpdateClient","id":20,"lvl":2,"msg":"erreur 0x800F0922","p":["0x800f0922","KB1"]},
	 {"t":"2026-10-19T07:00:00Z","log":"Application","src":"Application Error","id":1000,"lvl":2,"p":["a.exe","1","0","nvwgf2umx.dll","1","0","c0000005","0"]},
	 {"t":"2026-10-19T07:01:00Z","log":"Application","src":"Application Error","id":1000,"lvl":2,"p":["b.exe","1","0","ntdll.dll","1","0","0xc0000005","0"]},
	 {"t":"2026-10-19T07:02:00Z","log":"Application","src":"Application Error","id":1000,"lvl":2,"p":["c.exe"]},
	 {"t":"2026-10-18T07:00:00Z","log":"System","src":"disk","id":153,"lvl":3,"msg":"The IO operation at logical block address 0x1 for Disk 0 (PDO name: \\Device\\Harddisk0\\DR0) was retried."}`)

	kp := evFindGroup(res, "Microsoft-Windows-Kernel-Power", 41)
	hints := strings.Join(kp.Hints, "\n")
	for _, want := range []string{"Bouton d'alimentation maintenu : 1 fois", "Coupure nette, sans écran bleu : 2 fois", "0x116 VIDEO_TDR_FAILURE"} {
		if !strings.Contains(hints, want) {
			t.Errorf("indices 41 sans %q :\n%s", want, hints)
		}
	}
	if len(kp.Causes) == 0 {
		t.Error("41 sans causes")
	}
	bs := strings.Join(evFindGroup(res, "BugCheck", 1001).Hints, "\n")
	if !strings.Contains(bs, "MEMORY_MANAGEMENT") || !strings.Contains(bs, "Codes différents") {
		t.Errorf("écrans bleus :\n%s", bs)
	}
	if wu := strings.Join(evFindGroup(res, "Microsoft-Windows-WindowsUpdateClient", 20).Hints, "\n"); !strings.Contains(wu, "partition de récupération") {
		t.Errorf("WU : %s", wu)
	}
	var appHints []string
	for _, g := range res.Groups {
		if g.Src == "Application Error" {
			appHints = append(appHints, g.Hints...)
		}
	}
	ah := strings.Join(appHints, "\n")
	if !strings.Contains(ah, "pilote graphique NVIDIA") || !strings.Contains(ah, "le programme lui-même") || !strings.Contains(ah, "violation d'accès") {
		t.Errorf("modules :\n%s", ah)
	}
	if d := strings.Join(evFindGroup(res, "disk", 153).Hints, ""); !strings.Contains(d, "Disque n° 0") {
		t.Errorf("disque : %s", d)
	}

	ct := evCrossTitles(res)
	for _, want := range []string{"Écrans bleus aux codes différents", "Coupures nettes à répétition", "Le disque fige le PC", "Juste avant les arrêts brutaux", "Plantages de programmes variés"} {
		if !strings.Contains(ct, want) {
			t.Errorf("diagnostic croisé sans %q : %s", want, ct)
		}
	}
	for _, c := range res.Cross {
		if c.Title == "Juste avant les arrêts brutaux" && !strings.Contains(strings.Join(c.Evidence, "\n"), "Contrôleur de stockage réinitialisé : avant 2 arrêt(s) sur 4") {
			t.Errorf("juste avant : %v", c.Evidence)
		}
		if c.Act != "" && !func() bool {
			for _, a := range Actions {
				if a.ID == c.Act {
					return true
				}
			}
			return false
		}() {
			t.Errorf("%s : réparation inconnue %s", c.Title, c.Act)
		}
	}
	for _, s := range res.Symptoms {
		if s.ID == "off" && len(s.Keys) != 2 {
			t.Errorf("symptôme off : %v", s.Keys)
		}
		if s.ID == "slow" && len(s.Keys) != 3 {
			t.Errorf("symptôme lent : %v", s.Keys)
		}
	}
}

func TestEvBootHint(t *testing.T) {
	res := evFixture(t, `
	 {"t":"2026-10-23T10:00:00Z","log":"System","src":"EventLog","id":6005,"lvl":4},
	 {"t":"2026-10-23T10:01:00Z","log":"System","src":"Service Control Manager","id":7000,"lvl":2,"p":["Truc"]},
	 {"t":"2026-10-22T10:00:00Z","log":"System","src":"EventLog","id":6005,"lvl":4},
	 {"t":"2026-10-22T10:02:00Z","log":"System","src":"Service Control Manager","id":7000,"lvl":2,"p":["Truc"]}`)
	g := evFindGroup(res, "Service Control Manager", 7000)
	if !strings.Contains(strings.Join(g.Hints, ""), "toujours juste après le démarrage (2 fois sur 2)") {
		t.Errorf("démarrage : %v", g.Hints)
	}
}
