package main

import (
	"encoding/json"
	"testing"
	"time"
)

const sample = `{
 "meta": {"computer":"PC-CLAIRE","manufacturer":"LENOVO","model":"20W0005QFR","productName":"ThinkPad T14 Gen 2i","serial":"PF2ABCDE","os":"Microsoft Windows 10 Professionnel","build":19045,"biosDate":"2016-03-01T00:00:00","uptimeDays":2},
 "cpu": {"name":"11th Gen Intel(R) Core(TM) i5-1135G7 @ 2.40GHz","load":12},
 "mem": {"totalGB":7.7,"usedPct":55,"modules":{"slot":"DIMM 0","sizeGB":8}},
 "disks": [
   {"name":"WDC WD10SPZX","media":"HDD","bus":"SATA","sizeGB":931.5,"health":"Healthy","wear":null},
   {"name":"SanDisk Ultra","media":"Unspecified","bus":"USB","sizeGB":28.6,"health":"Unknown"}
 ],
 "volumes": {"letter":"C:","sizeGB":930,"freeGB":20,"freePct":2},
 "battery": {"present":true,"wearPct":55.2},
 "events": {"bsod":[{"code":"0x0000007e"}],"kernelPower41":0,"whea":0},
 "security": {"av":{"name":"Windows Defender","enabled":false,"upToDate":true},"firewall":[{"profile":"Public","enabled":false}]},
 "network": {"internet":true,"dns":true}
}`

func TestAnalyze(t *testing.T) {
	var data map[string]any
	if err := json.Unmarshal([]byte(sample), &data); err != nil {
		t.Fatal(err)
	}
	r := Analyze(data, time.Date(2026, 10, 19, 0, 0, 0, 0, time.UTC))

	if r.Format != "diag-app" || r.Status["overall"] != "crit" {
		t.Fatalf("status = %v", r.Status)
	}
	if r.Machine["name"] != "Lenovo ThinkPad T14 Gen 2i" {
		t.Errorf("machine = %v", r.Machine["name"])
	}
	titles := map[string]string{}
	for _, f := range r.Findings {
		titles[f.Title] = f.Level
		if f.Title == "Disque en mauvais état : SanDisk Ultra" {
			t.Error("USB key must be ignored")
		}
	}
	for title, level := range map[string]string{
		"Disque C: plein":                  "crit",
		"Batterie usée":                    "crit",
		"Aucun antivirus actif":            "crit",
		"Windows 10 n'est plus mis à jour": "warn",
		"1 écran bleu en 30 jours":         "warn",
		"Pare-feu désactivé":               "warn",
		"Disque dur mécanique":             "info",
		"Seulement 8 Go de RAM":            "",
	} {
		if got := titles[title]; got != level {
			t.Errorf("%q: level %q, want %q", title, got, level)
		}
	}
	if r.Findings[0].Level != "crit" {
		t.Error("findings must be sorted by severity")
	}
	score := r.Viability["score"].(int)
	if score > 45 || r.Viability["level"] != "crit" {
		t.Errorf("viability = %v", r.Viability)
	}

	inv := Inventory(data)
	want := map[string]any{"brand": "Lenovo", "model": "ThinkPad T14 Gen 2i", "serial": "PF2ABCDE", "os": "Windows 10 Professionnel", "ram": "8", "storage": "932", "cpu": "11th Gen Intel Core i5-1135G7 @ 2.40GHz"}
	for k, v := range want {
		if inv[k] != v {
			t.Errorf("inventory %s = %v, want %v", k, inv[k], v)
		}
	}
}

func TestNormalizeServer(t *testing.T) {
	for in, want := range map[string]string{
		"support.exemple.fr":          "https://support.exemple.fr",
		"https://support.exemple.fr/": "https://support.exemple.fr",
		" http://192.168.1.10:8000/ ": "http://192.168.1.10:8000",
		"https://exemple.fr/pc2/?x=1": "https://exemple.fr/pc2",
	} {
		if got := NormalizeServer(in); got != want {
			t.Errorf("NormalizeServer(%q) = %q, want %q", in, got, want)
		}
	}
}
