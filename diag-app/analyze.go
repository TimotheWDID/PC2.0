package main

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"
)

// Finding is one point of the diagnostic, as shown in the app and on the site.
type Finding struct {
	Level    string `json:"level"` // crit, warn, info, ok
	Category string `json:"category"`
	Title    string `json:"title"`
	Detail   string `json:"detail,omitempty"`
	Advice   string `json:"advice,omitempty"`
}

// Report is what the app sends to the site (format "diag-app").
type Report struct {
	Format      string           `json:"format"`
	Version     string           `json:"version"`
	GeneratedAt string           `json:"generatedAt"`
	Machine     map[string]any   `json:"machine"`
	Status      map[string]any   `json:"status"`
	Viability   map[string]any   `json:"viability"`
	Findings    []Finding        `json:"findings"`
	Data        map[string]any   `json:"data"`
	Actions     []map[string]any `json:"actions,omitempty"` // réparations lancées pendant la session
}

// Categories whose problems mean worn or failing hardware: they weigh on the
// viability score much more than software settings, which a technician fixes.
var hardwareCategories = map[string]bool{
	"Stockage": true, "Batterie": true, "Mémoire": true, "Stabilité": true, "Température": true,
}

// Analyze turns the collected data into findings, an overall status and a
// viability score (is the PC worth repairing).
func Analyze(data map[string]any, now time.Time) Report {
	a := &analyzer{d: data, now: now}
	a.system()
	a.storage()
	a.memory()
	a.battery()
	a.thermal()
	a.stability()
	a.devices()
	a.updates()
	a.security()
	a.network()
	a.software()

	sort.SliceStable(a.findings, func(i, j int) bool {
		return levelRank(a.findings[i].Level) < levelRank(a.findings[j].Level)
	})

	crit, warn := 0, 0
	for _, f := range a.findings {
		switch f.Level {
		case "crit":
			crit++
		case "warn":
			warn++
		}
	}

	overall, label := "good", "Aucun problème détecté"
	switch {
	case crit > 0:
		overall = "crit"
		label = plural(crit, "problème critique", "problèmes critiques")
		if warn > 0 {
			label += ", " + plural(warn, "point à surveiller", "points à surveiller")
		}
	case warn > 0:
		overall = "warn"
		label = plural(warn, "point à surveiller", "points à surveiller")
	}

	score := a.viability()
	level, verdict := "good", "PC viable : la remise en état est rentable"
	switch {
	case score < 45:
		level, verdict = "crit", "PC en fin de vie : remplacement à envisager"
	case score < 70:
		level, verdict = "warn", "PC réparable : chiffrer les pièces avant d'intervenir"
	}

	meta := a.m("meta")
	return Report{
		Format:      "diag-app",
		Version:     Version,
		GeneratedAt: now.Format(time.RFC3339),
		Machine: map[string]any{
			"name":         machineName(meta),
			"computer":     str(meta["computer"]),
			"manufacturer": str(meta["manufacturer"]),
			"serial":       str(meta["serial"]),
			"os":           str(meta["os"]),
		},
		Status:    map[string]any{"overall": overall, "overallLabel": label, "crit": crit, "warn": warn},
		Viability: map[string]any{"score": score, "level": level, "verdict": verdict},
		Findings:  a.findings,
		Data:      data,
	}
}

// Inventory fills the device sheet on the site (same fields as the Diag Atelier).
func Inventory(data map[string]any) map[string]any {
	meta := asMap(data["meta"])
	inv := map[string]any{}
	set := func(k, v string) {
		v = strings.TrimSpace(v)
		if v != "" && !isPlaceholder(v) {
			inv[k] = v
		}
	}
	set("brand", brandName(str(meta["manufacturer"])))
	set("model", modelName(meta))
	set("serial", str(meta["serial"]))
	set("os", strings.TrimPrefix(str(meta["os"]), "Microsoft "))
	set("cpu", cleanCPU(str(asMap(data["cpu"])["name"])))
	if ram := num(asMap(data["mem"])["totalGB"]); ram > 0 {
		inv["ram"] = fmt.Sprint(int(math.Round(ram)))
	}
	storage := 0.0
	for _, d := range list(data["disks"]) {
		if !isUSB(d) {
			storage += num(d["sizeGB"])
		}
	}
	if storage > 0 {
		inv["storage"] = fmt.Sprint(int(math.Round(storage)))
	}
	return inv
}

type analyzer struct {
	d        map[string]any
	now      time.Time
	findings []Finding
	hdd      bool
}

func (a *analyzer) add(level, cat, title, detail, advice string) {
	a.findings = append(a.findings, Finding{level, cat, title, detail, advice})
}

func (a *analyzer) m(key string) map[string]any { return asMap(a.d[key]) }

func (a *analyzer) system() {
	meta := a.m("meta")
	build := int(num(meta["build"]))
	osName := str(meta["os"])
	switch {
	case strings.Contains(osName, "Windows 10"):
		a.add("warn", "Windows", "Windows 10 n'est plus mis à jour",
			"Le support de Windows 10 a pris fin le 14 octobre 2025 : plus de correctifs de sécurité.",
			"Passer à Windows 11 si le PC est compatible (TPM 2.0, Secure Boot, processeur récent).")
	case strings.Contains(osName, "Windows 11") && build > 0 && build < 26100:
		a.add("info", "Windows", "Version de Windows 11 ancienne",
			fmt.Sprintf("%s (build %d)", str(meta["displayVersion"]), build),
			"Installer la dernière mise à jour de fonctionnalités (24H2 ou plus).")
	case strings.Contains(osName, "Windows 7"), strings.Contains(osName, "Windows 8"):
		a.add("crit", "Windows", "Windows obsolète", osName, "Réinstaller un Windows supporté.")
	}
	if up := num(meta["uptimeDays"]); up >= 30 {
		a.add("info", "Windows", "PC pas redémarré depuis longtemps",
			fmt.Sprintf("Allumé depuis %.0f jours (démarrage rapide ou mise en veille).", up),
			"Redémarrer pour appliquer les mises à jour.")
	}
	if d, ok := parseDate(meta["biosDate"]); ok {
		years := a.now.Sub(d).Hours() / 24 / 365.25
		if years >= 8 {
			a.add("info", "Matériel", "Machine ancienne",
				fmt.Sprintf("BIOS daté de %d (environ %.0f ans).", d.Year(), years), "")
		}
	}
	if load := num(asMap(a.d["cpu"])["load"]); load >= 90 {
		a.add("warn", "Performance", "Processeur saturé",
			fmt.Sprintf("Charge de %.0f %% pendant l'analyse.", load),
			"Vérifier les processus gourmands (antivirus, mises à jour, logiciels malveillants).")
	}
}

func (a *analyzer) storage() {
	for _, d := range list(a.d["disks"]) {
		if isUSB(d) {
			continue // clé USB de l'atelier ou disque externe : hors diagnostic
		}
		name := str(d["name"])
		health := str(d["health"])
		if health != "" && !strings.EqualFold(health, "Healthy") {
			a.add("crit", "Stockage", "Disque en mauvais état : "+name,
				"État signalé par Windows : "+health+".",
				"Sauvegarder les données sans attendre et remplacer le disque.")
		}
		if w, ok := d["wear"]; ok && w != nil {
			wear := num(w)
			switch {
			case wear >= 90:
				a.add("crit", "Stockage", "SSD usé : "+name, fmt.Sprintf("Usure %.0f %%.", wear), "Remplacer le SSD.")
			case wear >= 70:
				a.add("warn", "Stockage", "SSD très sollicité : "+name, fmt.Sprintf("Usure %.0f %%.", wear), "Prévoir son remplacement.")
			}
		}
		if num(d["readErr"])+num(d["writeErr"]) > 0 {
			a.add("warn", "Stockage", "Erreurs de lecture/écriture : "+name,
				fmt.Sprintf("%.0f erreur(s) non corrigée(s).", num(d["readErr"])+num(d["writeErr"])),
				"Sauvegarder et tester le disque en profondeur.")
		}
		if t := num(d["temp"]); t >= 70 {
			a.add("warn", "Température", "Disque chaud : "+name, fmt.Sprintf("%.0f °C.", t), "Vérifier la ventilation.")
		}
		if strings.EqualFold(str(d["media"]), "HDD") {
			a.hdd = true
		}
	}
	if a.hdd {
		a.add("info", "Performance", "Disque dur mécanique",
			"Windows est lent sur un disque dur classique.",
			"Le passage à un SSD est l'amélioration la plus rentable.")
	}
	if n := len(asSlice(a.d["smartPredict"])); n > 0 {
		a.add("crit", "Stockage", "Panne de disque annoncée (SMART)",
			fmt.Sprintf("%d disque(s) signalent une défaillance imminente.", n),
			"Sauvegarder immédiatement et remplacer le disque.")
	}
	for _, v := range list(a.d["volumes"]) {
		letter := str(v["letter"])
		size, free, pct := num(v["sizeGB"]), num(v["freeGB"]), num(v["freePct"])
		if size < 20 {
			continue
		}
		switch {
		case pct < 5 || free < 5:
			a.add("crit", "Stockage", "Disque "+letter+" plein", fmt.Sprintf("%.1f Go libres sur %.0f Go (%.0f %%).", free, size, pct),
				"Libérer de la place : Windows et les mises à jour ont besoin d'au moins 15 Go.")
		case pct < 15 || free < 15:
			a.add("warn", "Stockage", "Disque "+letter+" presque plein", fmt.Sprintf("%.1f Go libres sur %.0f Go (%.0f %%).", free, size, pct),
				"Faire du ménage (fichiers temporaires, téléchargements).")
		}
		if b, ok := v["dirty"].(bool); ok && b {
			a.add("warn", "Stockage", "Système de fichiers à vérifier sur "+letter, "Le volume est marqué comme incohérent.", "Lancer chkdsk "+letter+" /f.")
		}
	}
	if j := num(a.d["junkGB"]); j >= 10 {
		a.add("info", "Stockage", "Beaucoup de fichiers temporaires", fmt.Sprintf("%.1f Go récupérables.", j), "Nettoyer les fichiers temporaires.")
	}
}

func (a *analyzer) memory() {
	mem := a.m("mem")
	total := num(mem["totalGB"])
	switch {
	case total > 0 && total < 3.5:
		a.add("crit", "Mémoire", fmt.Sprintf("Seulement %.0f Go de RAM", total), "Insuffisant pour Windows 10/11.", "Ajouter de la mémoire si la carte mère le permet.")
	case total > 0 && total < 7.5:
		a.add("warn", "Mémoire", fmt.Sprintf("Seulement %.0f Go de RAM", total),
			fmt.Sprintf("%d barrette(s), %s emplacement(s).", len(list(mem["modules"])), orQ(mem["slots"])),
			"8 Go minimum pour Windows 11, 16 Go conseillés.")
	}
	if used := num(mem["usedPct"]); used >= 90 {
		a.add("warn", "Performance", "Mémoire saturée", fmt.Sprintf("%.0f %% utilisés.", used), "Fermer les programmes inutiles ou ajouter de la RAM.")
	}
}

func (a *analyzer) battery() {
	b := a.m("battery")
	if present, _ := b["present"].(bool); !present {
		return
	}
	wear := num(b["wearPct"])
	switch {
	case wear >= 50:
		a.add("crit", "Batterie", "Batterie usée", fmt.Sprintf("Usure %.0f %% (capacité restante %.0f %%).", wear, 100-wear), "Remplacer la batterie.")
	case wear >= 30:
		a.add("warn", "Batterie", "Batterie fatiguée", fmt.Sprintf("Usure %.0f %%.", wear), "Autonomie réduite : prévoir le remplacement.")
	}
}

func (a *analyzer) thermal() {
	for _, t := range list(a.d["thermal"]) {
		c := num(t["c"])
		switch {
		case c >= 90:
			a.add("crit", "Température", "Surchauffe", fmt.Sprintf("Zone %s à %.0f °C.", str(t["zone"]), c), "Dépoussiérer et changer la pâte thermique.")
		case c >= 80:
			a.add("warn", "Température", "Température élevée", fmt.Sprintf("Zone %s à %.0f °C.", str(t["zone"]), c), "Vérifier ventilateur et dépoussiérer.")
		}
	}
}

func (a *analyzer) stability() {
	e := a.m("events")
	if n := len(list(e["bsod"])); n > 0 {
		lvl := "warn"
		if n >= 3 {
			lvl = "crit"
		}
		codes := []string{}
		for _, b := range list(e["bsod"]) {
			if c := str(b["code"]); c != "" {
				codes = append(codes, c)
			}
		}
		a.add(lvl, "Stabilité", plural(n, "écran bleu", "écrans bleus")+" en 30 jours",
			strings.Join(uniq(codes), ", "), "Analyser les fichiers minidump, tester la RAM et mettre à jour les pilotes.")
	}
	if n := num(e["kernelPower41"]); n >= 3 {
		a.add("warn", "Stabilité", "Arrêts brutaux répétés", fmt.Sprintf("%.0f redémarrages inattendus en 30 jours.", n), "Vérifier l'alimentation, la batterie et la température.")
	}
	if n := num(e["whea"]); n > 0 {
		lvl := "warn"
		if n >= 10 {
			lvl = "crit"
		}
		a.add(lvl, "Stabilité", "Erreurs matérielles (WHEA)", fmt.Sprintf("%.0f erreur(s) signalée(s) par le processeur ou le bus PCIe.", n), "Tester processeur, RAM et carte mère.")
	}
	if n := num(e["disk"]) + num(e["ntfs"]) + num(e["storReset"]); n > 0 {
		a.add("warn", "Stockage", "Erreurs disque dans les journaux", fmt.Sprintf("%.0f événement(s) disque/NTFS en 30 jours.", n), "Sauvegarder et tester le disque.")
	}
	if n := num(e["appCrashTotal"]); n >= 20 {
		a.add("info", "Stabilité", "Nombreux plantages d'applications", fmt.Sprintf("%.0f plantages en 30 jours.", n), "")
	}
	if r, ok := a.d["reliability"]; ok && r != nil && num(r) < 5 {
		a.add("warn", "Stabilité", "Indice de fiabilité bas", fmt.Sprintf("%.1f / 10.", num(r)), "")
	}
	switch s := str(a.d["dism"]); s {
	case "", "Healthy":
	case "NonRepairable":
		a.add("crit", "Windows", "Image Windows endommagée", "DISM : non réparable.", "Réinstaller Windows.")
	default:
		a.add("warn", "Windows", "Image Windows à réparer", "DISM : "+s+".", "Lancer DISM /RestoreHealth puis sfc /scannow.")
	}
}

func (a *analyzer) devices() {
	devs := list(a.d["devices"])
	if len(devs) == 0 {
		return
	}
	names := []string{}
	for i, d := range devs {
		if i == 5 {
			names = append(names, "…")
			break
		}
		names = append(names, fmt.Sprintf("%s (code %s)", str(d["name"]), orQ(d["code"])))
	}
	a.add("warn", "Pilotes", plural(len(devs), "périphérique en erreur", "périphériques en erreur"), strings.Join(names, ", "), "Installer ou mettre à jour les pilotes.")
}

func (a *analyzer) updates() {
	u := a.m("updates")
	if d, ok := parseDate(u["lastSuccess"]); ok {
		if days := a.now.Sub(d).Hours() / 24; days > 60 {
			a.add("warn", "Windows", "Mises à jour en retard", fmt.Sprintf("Dernière mise à jour réussie il y a %.0f jours.", days), "Lancer Windows Update.")
		}
	}
	if n := len(list(u["failed"])); n > 0 {
		a.add("warn", "Windows", plural(n, "mise à jour en échec", "mises à jour en échec"), str(list(u["failed"])[0]["title"]), "Réparer Windows Update.")
	}
	if b, _ := u["rebootPending"].(bool); b {
		a.add("info", "Windows", "Redémarrage en attente", "Des mises à jour attendent un redémarrage.", "")
	}
}

func (a *analyzer) security() {
	s := a.m("security")
	avs := list(s["av"])
	active := false
	for _, av := range avs {
		if b, _ := av["enabled"].(bool); b {
			active = true
			if up, ok := av["upToDate"].(bool); ok && !up {
				a.add("warn", "Sécurité", "Antivirus pas à jour", str(av["name"]), "Mettre à jour l'antivirus.")
			}
		}
	}
	if len(avs) > 0 && !active {
		a.add("crit", "Sécurité", "Aucun antivirus actif", "", "Activer Microsoft Defender ou l'antivirus installé.")
	}
	if def := asMap(s["defender"]); def != nil {
		if rtp, ok := def["rtp"].(bool); ok && !rtp && !active {
			a.add("warn", "Sécurité", "Protection en temps réel désactivée", "Microsoft Defender", "")
		}
	}
	off := []string{}
	for _, f := range list(s["firewall"]) {
		if b, _ := f["enabled"].(bool); !b {
			off = append(off, str(f["profile"]))
		}
	}
	if len(off) > 0 {
		a.add("warn", "Sécurité", "Pare-feu désactivé", "Profils : "+strings.Join(off, ", "), "Réactiver le pare-feu Windows.")
	}
	if v, ok := s["uac"]; ok && v != nil && num(v) == 0 {
		a.add("warn", "Sécurité", "Contrôle de compte (UAC) désactivé", "", "Réactiver l'UAC.")
	}
	if b, _ := s["smb1"].(bool); b {
		a.add("warn", "Sécurité", "SMBv1 activé", "Protocole obsolète et vulnérable.", "Désactiver SMBv1.")
	}
	if b, _ := s["autologonPwd"].(bool); b {
		a.add("warn", "Sécurité", "Mot de passe de session en clair", "L'ouverture automatique stocke le mot de passe dans le registre.", "")
	}
	if rdp, _ := s["rdp"].(bool); rdp {
		if nla, _ := s["rdpNla"].(bool); !nla {
			a.add("warn", "Sécurité", "Bureau à distance sans NLA", "", "Activer l'authentification au niveau du réseau.")
		}
	}
	if sb, ok := s["secureBoot"].(bool); ok && !sb {
		a.add("info", "Sécurité", "Secure Boot désactivé", "", "Nécessaire pour Windows 11.")
	}
}

func (a *analyzer) network() {
	n := a.m("network")
	if b, ok := n["internet"].(bool); ok && !b {
		a.add("warn", "Réseau", "Pas d'accès Internet", "", "Vérifier la connexion, le proxy ou le pare-feu.")
	} else if b, ok := n["dns"].(bool); ok && !b {
		a.add("warn", "Réseau", "Résolution DNS en échec", strings.Join(strs(n["dnsServers"]), ", "), "Vérifier les serveurs DNS.")
	}
	if ap := strs(n["apipa"]); len(ap) > 0 {
		a.add("warn", "Réseau", "Adresse IP automatique (169.254)", strings.Join(ap, ", "), "La carte n'obtient pas d'adresse du routeur (DHCP).")
	}
}

func (a *analyzer) software() {
	if n := len(list(a.d["startup"])); n >= 15 {
		a.add("info", "Performance", "Beaucoup de programmes au démarrage", fmt.Sprintf("%d programmes.", n), "Désactiver ceux qui sont inutiles.")
	}
	if n := len(list(a.d["services"])); n > 0 {
		names := []string{}
		for _, s := range list(a.d["services"]) {
			names = append(names, firstNonEmpty(str(s["display"]), str(s["name"])))
		}
		a.add("info", "Windows", plural(n, "service automatique arrêté", "services automatiques arrêtés"), strings.Join(names, ", "), "")
	}
}

// viability scores 0-100 how much the PC is worth repairing: hardware wear
// and age weigh, settings a technician fixes in minutes barely do.
func (a *analyzer) viability() int {
	score := 100.0
	for _, f := range a.findings {
		hw := hardwareCategories[f.Category]
		switch {
		case f.Level == "crit" && hw:
			score -= 25
		case f.Level == "warn" && hw:
			score -= 10
		case f.Level == "crit":
			score -= 8
		case f.Level == "warn":
			score -= 3
		}
	}
	if a.hdd {
		score -= 10
	}
	if ram := num(a.m("mem")["totalGB"]); ram > 0 && ram < 7.5 {
		score -= 10
	}
	if d, ok := parseDate(a.m("meta")["biosDate"]); ok {
		years := a.now.Sub(d).Hours() / 24 / 365.25
		switch {
		case years >= 8:
			score -= 15
		case years >= 6:
			score -= 8
		}
	}
	return int(math.Max(0, math.Min(100, math.Round(score))))
}

// ---------------------------------------------------------------- helpers

func levelRank(l string) int {
	switch l {
	case "crit":
		return 0
	case "warn":
		return 1
	case "info":
		return 2
	}
	return 3
}

func plural(n int, one, many string) string {
	if n == 1 {
		return "1 " + one
	}
	return fmt.Sprintf("%d %s", n, many)
}

func asMap(v any) map[string]any {
	m, _ := v.(map[string]any)
	return m
}

func asSlice(v any) []any {
	switch s := v.(type) {
	case []any:
		return s
	case nil:
		return nil
	default:
		return []any{s} // PowerShell sérialise un tableau d'un élément en objet seul
	}
}

func list(v any) []map[string]any {
	out := []map[string]any{}
	for _, x := range asSlice(v) {
		if m, ok := x.(map[string]any); ok {
			out = append(out, m)
		}
	}
	return out
}

func strs(v any) []string {
	out := []string{}
	for _, x := range asSlice(v) {
		if s := str(x); s != "" {
			out = append(out, s)
		}
	}
	return out
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

func num(v any) float64 {
	switch x := v.(type) {
	case float64:
		return x
	case string:
		var f float64
		fmt.Sscan(strings.Replace(x, ",", ".", 1), &f)
		return f
	}
	return 0
}

func orQ(v any) string {
	if s := str(v); s != "" {
		return s
	}
	return "?"
}

func parseDate(v any) (time.Time, bool) {
	s := str(v)
	if len(s) < 10 {
		return time.Time{}, false
	}
	t, err := time.Parse("2006-01-02", s[:10])
	return t, err == nil && t.Year() > 1990
}

func uniq(in []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, s := range in {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func isUSB(d map[string]any) bool { return strings.EqualFold(str(d["bus"]), "USB") }

func isPlaceholder(v string) bool {
	l := strings.ToLower(v)
	for _, p := range []string{"to be filled", "default string", "system serial", "system product", "system manufacturer", "not applicable", "none", "o.e.m", "0123456789", "invalid"} {
		if strings.Contains(l, p) {
			return true
		}
	}
	return false
}

func brandName(m string) string {
	l := strings.ToLower(m)
	switch {
	case strings.Contains(l, "hewlett") || l == "hp":
		return "HP"
	case strings.Contains(l, "lenovo"):
		return "Lenovo"
	case strings.Contains(l, "dell"):
		return "Dell"
	case strings.Contains(l, "asus"):
		return "ASUS"
	case strings.Contains(l, "acer"):
		return "Acer"
	case strings.Contains(l, "micro-star") || l == "msi":
		return "MSI"
	case strings.Contains(l, "microsoft"):
		return "Microsoft"
	}
	return m
}

// Lenovo puts the commercial name (ThinkPad T14…) in the product version and
// a type code (20XYZ…) in the model.
func modelName(meta map[string]any) string {
	model := str(meta["model"])
	if strings.Contains(strings.ToLower(str(meta["manufacturer"])), "lenovo") {
		if p := str(meta["productName"]); p != "" && !isPlaceholder(p) {
			return p
		}
	}
	return model
}

func machineName(meta map[string]any) string {
	brand := brandName(str(meta["manufacturer"]))
	model := modelName(meta)
	if isPlaceholder(model) {
		model = ""
	}
	if model == "" {
		return firstNonEmpty(str(meta["computer"]), "Poste")
	}
	if brand != "" && !isPlaceholder(brand) && !strings.HasPrefix(strings.ToLower(model), strings.ToLower(brand)) {
		return brand + " " + model
	}
	return model
}

func cleanCPU(s string) string {
	for _, r := range []string{"(R)", "(TM)", "(tm)", "CPU ", " Processor"} {
		s = strings.ReplaceAll(s, r, "")
	}
	return strings.Join(strings.Fields(s), " ")
}
