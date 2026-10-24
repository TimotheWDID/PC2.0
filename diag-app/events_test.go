package main

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestEvLookup(t *testing.T) {
	cases := []struct {
		src   string
		id    int
		title string
	}{
		{"Microsoft-Windows-Kernel-Power", 41, "Arrêt brutal du PC"},
		{"microsoft-windows-kernel-power", 41, "Arrêt brutal du PC"},
		{"Netwtw10", 5002, "Pilote de la carte réseau en erreur"},
		{"e1dexpress", 27, "Pilote de la carte réseau en erreur"},
		{"Microsoft-Windows-DistributedCOM", 10016, "Message interne de Windows (DCOM, sans gravité)"},
		{"BugCheck", 1001, "Écran bleu (plantage de Windows)"},
	}
	for _, c := range cases {
		k := evLookup(c.src, c.id)
		if k == nil || k.Title != c.title {
			t.Errorf("%s %d : %v", c.src, c.id, k)
		}
	}
	if evLookup("Microsoft-Windows-Kernel-Power", 9999) != nil || evLookup("e1", 1) != nil {
		t.Error("événement inconnu reconnu")
	}
}

func TestEvKBComplete(t *testing.T) {
	acts := map[string]bool{}
	for _, a := range Actions {
		acts[a.ID] = true
	}
	for _, k := range evKB {
		if _, ok := evSevOrder[k.Sev]; !ok || k.Title == "" || k.Explain == "" || k.Cat == "" {
			t.Errorf("entrée incomplète : %+v", k)
		}
		if k.Act != "" && !acts[k.Act] {
			t.Errorf("%s : réparation inconnue %q", k.Title, k.Act)
		}
	}
}

func TestGroupEvents(t *testing.T) {
	raw := `{"days":7,"from":"2026-10-17T08:00:00Z","to":"2026-10-24T08:00:00Z","admin":true,"events":[
	 {"t":"2026-10-23T10:00:00.0000000Z","log":"Application","src":"Application Error","id":1000,"lvl":2,"msg":"chrome a planté","p":["chrome.exe","1.0"]},
	 {"t":"2026-10-22T10:00:00.0000000Z","log":"Application","src":"Application Error","id":1000,"lvl":2,"msg":"chrome a planté","p":["chrome.exe","1.0"]},
	 {"t":"2026-10-22T11:00:00.0000000Z","log":"Application","src":"Application Error","id":1000,"lvl":2,"msg":"word a planté","p":["WINWORD.EXE"]},
	 {"t":"2026-10-21T09:00:00.0000000Z","log":"System","src":"Microsoft-Windows-Kernel-Power","id":41,"lvl":1,"msg":"arrêt","p":"0"},
	 {"t":"2026-10-21T09:01:00.0000000Z","log":"System","src":"EventLog","id":6005,"lvl":4,"msg":"démarrage"},
	 {"t":"2026-10-21T09:02:00.0000000Z","log":"System","src":"Microsoft-Windows-Kernel-General","id":1,"lvl":4,"msg":"heure changée"},
	 {"t":"2026-10-20T09:00:00.0000000Z","log":"System","src":"Microsoft-Windows-DistributedCOM","id":10016,"lvl":3,"msg":"dcom"},
	 {"t":"2026-10-20T09:00:00.0000000Z","log":"System","src":"Truc","id":12,"lvl":2,"msg":"inconnu"},
	 {"t":"2026-10-19T09:00:00.0000000Z","log":"System","src":"Microsoft-Windows-WindowsUpdateClient","id":19,"lvl":4,"msg":"ok","p":["KB123 Mise à jour cumulative","guid"]},
	 {"t":"2026-10-19T08:00:00.0000000Z","log":"Application","src":".NET Runtime","id":1026,"lvl":2,"msg":"Application: Logiciel.exe\nFramework"}
	]}`
	var r evScanRaw
	if err := json.Unmarshal([]byte(raw), &r); err != nil {
		t.Fatal(err)
	}
	res := groupEvents(r, time.UTC)
	if len(res.Groups) != 8 {
		for _, g := range res.Groups {
			t.Log(g.Key)
		}
		t.Fatalf("%d groupes", len(res.Groups))
	}
	if g := res.Groups[0]; g.Title != "Arrêt brutal du PC" || g.Sev != "crit" || g.Level != 1 {
		t.Errorf("premier groupe : %+v", g)
	}
	var chrome *evGroup
	for i, g := range res.Groups {
		if g.Subject == "chrome.exe" {
			chrome = &res.Groups[i]
		}
		if g.Src == ".NET Runtime" && g.Subject != "Logiciel.exe" {
			t.Errorf("sujet .NET : %q", g.Subject)
		}
		if g.Src == "Truc" && (g.Known || g.Sev != "warn" || g.Cat != catSys) {
			t.Errorf("inconnu : %+v", g)
		}
	}
	if chrome == nil || chrome.Count != 2 || len(chrome.Messages) != 1 || chrome.Last != "2026-10-23T10:00:00.0000000Z" || chrome.First != "2026-10-22T10:00:00.0000000Z" || len(chrome.Days) != 2 {
		t.Errorf("chrome : %+v", chrome)
	}
	if last := res.Groups[len(res.Groups)-1]; !last.Noise {
		t.Errorf("le bruit doit finir la liste : %+v", last)
	}
	if res.Counts.Crit != 1 || res.Counts.Noise != 1 || res.Total != 9 {
		t.Errorf("comptes : %+v total %d", res.Counts, res.Total)
	}
	kinds := []string{}
	for _, m := range res.Timeline {
		kinds = append(kinds, m.Kind+":"+m.Detail)
	}
	if strings.Join(kinds, ",") != "boot:,crash:,update:KB123 Mise à jour cumulative" {
		t.Errorf("chronologie : %v", kinds)
	}
	if len(res.Daily) == 0 || res.Daily[0].Date != "2026-10-19" {
		t.Errorf("jours : %+v", res.Daily)
	}
	csv := res.csv(time.UTC)
	if !strings.Contains(csv, "Grave;Démarrage et arrêts;Arrêt brutal du PC;;1;21/10/2026 09:00") {
		t.Errorf("csv :\n%s", csv)
	}
}

func TestEvSubjectPath(t *testing.T) {
	k := &evInfo{Subject: 1}
	e := evRaw{Props: json.RawMessage(`["C:\\Windows\\System32\\RuntimeBroker.exe (PC-ATELIER)"]`)}
	if s := evSubject(k, e); s != "RuntimeBroker.exe" {
		t.Errorf("sujet : %q", s)
	}
	e = evRaw{Props: json.RawMessage(`["Spouleur d'impression"]`)}
	if s := evSubject(k, e); s != "Spouleur d'impression" {
		t.Errorf("sujet : %q", s)
	}
}
