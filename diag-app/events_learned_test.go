package main

import (
	"encoding/json"
	"testing"
	"time"
)

func TestLearnedEvents(t *testing.T) {
	defer setLearned(nil)
	raw := `{"days":7,"events":[
	 {"t":"2026-10-23T10:00:00.0000000Z","log":"System","src":"Truc","id":12,"lvl":2,"msg":"inconnu"},
	 {"t":"2026-10-22T10:00:00.0000000Z","log":"System","src":"Truc","id":12,"lvl":2,"msg":"inconnu"},
	 {"t":"2026-10-22T10:00:00.0000000Z","log":"System","src":"Microsoft-Windows-Kernel-Power","id":41,"lvl":1,"msg":"arrêt"}
	]}`
	var r evScanRaw
	if err := json.Unmarshal([]byte(raw), &r); err != nil {
		t.Fatal(err)
	}
	find := func(res evResult, src string) *evGroup {
		for i := range res.Groups {
			if res.Groups[i].Src == src {
				return &res.Groups[i]
			}
		}
		t.Fatalf("pas de groupe %s", src)
		return nil
	}

	if g := find(groupEvents(r, time.UTC), "Truc"); g.Known || g.Learned {
		t.Fatalf("événement inconnu reconnu : %+v", g)
	}

	setLearned([]evNote{
		{Source: "truc", EventID: 12, Sev: "crit", Title: "Truc en panne", Explain: "Le truc ne répond plus.", Causes: []string{"Câble", "Pilote"}, By: "Tim Tech"},
		// une fiche ne remplace pas ce que evKB connaît déjà
		{Source: "Microsoft-Windows-Kernel-Power", EventID: 41, Sev: "info", Title: "Autre titre", Explain: "x"},
		{Source: "Vide", EventID: 1}, // sans titre : ignorée
	})
	if len(learnedNotes()) != 2 {
		t.Fatalf("%d fiches", len(learnedNotes()))
	}
	res := groupEvents(r, time.UTC)
	g := find(res, "Truc")
	if !g.Known || !g.Learned || g.Title != "Truc en panne" || g.Sev != "crit" || g.Count != 2 || len(g.Causes) != 2 || g.NoteBy != "Tim Tech" {
		t.Errorf("fiche apprise mal appliquée : %+v", g)
	}
	if k := find(res, "Microsoft-Windows-Kernel-Power"); k.Learned || k.Title != "Arrêt brutal du PC" || len(k.Causes) == 0 {
		t.Errorf("evKB remplacé par une fiche : %+v", k)
	}

	// gravité absente ou inconnue : celle du niveau Windows
	upsertLearned(evNote{Source: "Truc", EventID: 12, Title: "Truc", Explain: "y", Noise: true})
	if g := find(groupEvents(r, time.UTC), "Truc"); g.Sev != "warn" || !g.Noise || g.Title != "Truc" {
		t.Errorf("fiche corrigée mal appliquée : %+v", g)
	}
}
