package main

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Pistes de diagnostic de l'observateur d'événements : pour chaque événement,
// d'où il vient le plus souvent (evCauses) ; puis ce que les événements de CE PC
// disent en plus (code d'écran bleu, module fautif, code Windows Update, disque
// concerné, apparition au démarrage), et les combinaisons qui ne laissent
// souvent qu'une cause (evCross). Repris du guide « Erreurs Windows : causes et
// pistes de diagnostic ».

// evCauses : provenances possibles, de la plus fréquente à la plus rare, par titre de evKB.
var evCauses = map[string][]string{
	"Arrêt brutal du PC": {
		"Bouton d'alimentation maintenu par le client (PC figé, ou par habitude)",
		"Coupure de courant, multiprise ou prise défaillante",
		"Surchauffe : le PC se coupe pour se protéger (poussière, pâte thermique, ventilateur)",
		"Alimentation qui faiblit en charge, ou batterie et chargeur sur un portable",
		"Plantage complet : voir s'il y a un écran bleu à la même heure",
	},
	"Écran bleu (plantage de Windows)": {
		"Pilote (réseau Wi-Fi, carte graphique, stockage, antivirus, VPN)",
		"Mémoire vive défaillante ou profil XMP / overclocking instable",
		"Disque ou SSD qui faiblit",
		"Alimentation ou surchauffe",
	},
	"Fichier d'écran bleu impossible à créer": {
		"Fichier d'échange désactivé ou trop petit",
		"Disque C: plein",
	},
	"Erreur matérielle corrigée": {
		"Lien PCIe instable : carte graphique ou SSD NVMe (économie d'énergie ASPM, BIOS)",
		"Mémoire vive ou profil XMP / overclocking instable",
		"Processeur (rare, souvent après un overclocking)",
	},
	"Erreur matérielle grave": {
		"Overclocking ou profil XMP instable",
		"Mémoire vive défaillante",
		"Alimentation insuffisante ou qui faiblit",
		"Surchauffe du processeur",
		"Processeur ou carte mère défaillant",
	},
	"Processeur ralenti par le BIOS": {
		"Surchauffe (poussière, pâte thermique sèche, ventilateur)",
		"Chargeur trop faible ou non d'origine sur un portable",
		"Mode d'alimentation économie d'énergie forcé",
	},
	"Mémoire presque saturée": {
		"Programme gourmand ou qui fuit (navigateur avec beaucoup d'onglets, logiciel métier)",
		"Trop peu de RAM pour l'usage (4 Go, voire 8 Go aujourd'hui)",
		"Fichier d'échange désactivé ou trop petit",
	},
	"Secteurs défectueux sur un disque": {
		"Disque dur qui s'use (surface abîmée, choc)",
		"SSD dont la mémoire flash fatigue",
		"Câble ou contrôleur (plus rare : les secteurs sont alors « en attente » dans SMART)",
	},
	"Erreur du contrôleur de disque": {
		"Câble SATA ou nappe abîmé, mal enfoncé",
		"Port SATA ou contrôleur défaillant",
		"Disque qui faiblit",
		"Clé USB ou disque externe retiré sans l'éjecter",
	},
	"Lecture ou écriture du disque réessayée": {
		"Disque ou SSD fatigué",
		"Câble ou port",
		"Économie d'énergie du lien SATA (ALPM) trop agressive",
		"Firmware du SSD ancien",
	},
	"Système de fichiers endommagé": {
		"Arrêts brutaux à répétition",
		"Disque qui faiblit",
		"Disque externe débranché en pleine écriture",
	},
	"Écriture sur le disque perdue": {
		"Disque externe débranché ou mis en veille",
		"Disque interne qui ne répond plus (câble, alimentation, disque)",
	},
	"Contrôleur de stockage réinitialisé": {
		"Firmware du SSD ancien",
		"Pilote de stockage (Intel RST, AMD) ou BIOS à mettre à jour",
		"SSD NVMe qui chauffe",
		"Câble SATA ou disque qui faiblit",
	},
	"Le pilote graphique a planté puis est reparti": {
		"Pilote graphique ancien ou mal installé",
		"Carte graphique qui chauffe",
		"Alimentation juste pour la carte graphique",
		"Overclocking d'usine instable",
	},
	"Pilote graphique NVIDIA en erreur": {
		"Pilote mal installé (réinstaller proprement avec DDU)",
		"Stabilité de la carte (overclocking d'usine, température)",
		"Alimentation de la carte",
	},
	"Pilote graphique AMD en erreur": {
		"Pilote mal installé (réinstaller proprement avec DDU)",
		"Stabilité de la carte (température, overclocking)",
		"Alimentation de la carte",
	},
	"Pilote d'un périphérique planté": {
		"Périphérique USB (téléphone, imprimante, lecteur d'empreintes, dock)",
		"Pilote du périphérique ancien",
		"Port ou câble USB",
	},
	"Une application a planté": {
		"Le programme lui-même (abîmé ou pas à jour)",
		"Un logiciel tiers qui s'y greffe (antivirus, overlay de jeu, extension)",
		"Composant Visual C++ ou .NET abîmé",
		"Mémoire vive, si beaucoup de programmes différents plantent",
	},
	"Une application s'est figée": {
		"Le programme lui-même ou un complément (Outlook, Excel)",
		"Disque lent ou qui faiblit",
		"Mémoire saturée",
	},
	"Une application .NET a planté": {
		"Le programme lui-même",
		".NET abîmé ou version manquante",
	},
	"Composant Visual C++ manquant ou abîmé": {
		"Redistribuable Visual C++ absent ou abîmé",
		"Installation du programme incomplète",
	},
	"Un service n'a pas pu démarrer": {
		"Service d'un logiciel désinstallé (sans conséquence)",
		"Pilote absent pour ce service",
		"PC lent au démarrage : délai dépassé",
		"Fichiers système abîmés (service de Windows)",
	},
	"Un service s'est arrêté sur une erreur": {
		"Spouleur d'impression : pilote d'imprimante",
		"Windows Update, BITS : image Windows abîmée",
		"Service d'un logiciel tiers : logiciel à réinstaller",
	},
	"Nouveau service installé": {
		"Installation normale d'un logiciel ou d'un pilote",
		"Logiciel indésirable (nom inconnu, chemin dans AppData ou Temp)",
	},
	"Nom de site non résolu à temps (DNS)": {
		"Connexion instable (Wi-Fi faible)",
		"Serveur DNS de la box en difficulté",
		"VPN ou antivirus qui filtre le DNS",
	},
	"Adresse réseau non obtenue (DHCP)": {
		"Box redémarrée ou en panne",
		"Câble ou Wi-Fi faible",
		"Carte réseau en économie d'énergie après la veille",
		"Pile réseau de Windows abîmée",
	},
	"Pilote de la carte réseau en erreur": {
		"Pilote ancien (celui de Windows Update plutôt que du fabricant)",
		"Économie d'énergie de la carte (après la veille)",
		"Box ou point d'accès",
		"Carte Wi-Fi défaillante (rare)",
	},
	"Heure impossible à synchroniser": {
		"Pas d'Internet au démarrage",
		"Pile du BIOS usée : l'heure est fausse à chaque allumage",
		"Pare-feu qui bloque NTP",
	},
	"Mise à jour Windows échouée": {
		"Fichiers de Windows Update abîmés",
		"Image Windows abîmée (DISM)",
		"Disque C: plein",
		"Partition de récupération trop petite (KB de sécurité 0x800F0922)",
		"Antivirus tiers ou VPN",
	},
	"Recherche de mises à jour impossible": {
		"Pas d'Internet, proxy ou antivirus",
		"Service Windows Update abîmé",
	},
	"Certificats Secure Boot à mettre à jour": {
		"BIOS ancien",
		"Mises à jour Windows en retard",
	},
	"Menace détectée par l'antivirus": {
		"Téléchargement (crack, logiciel gratuit douteux)",
		"Extension de navigateur ou publicité",
		"Clé USB",
	},
	"Session ouverte avec un profil temporaire": {
		"Profil abîmé après un arrêt brutal",
		"Clé « .bak » en double dans le registre ProfileList",
		"Disque plein ou qui faiblit",
	},
	"Points de restauration en erreur": {
		"Points de restauration désactivés",
		"Logiciel de sauvegarde tiers",
		"Disque plein",
	},
}

// ---------------------------------------------------------------- décodage

// codes d'arrêt des écrans bleus : nom et provenance habituelle
var evBugChecks = map[uint64][2]string{
	0x0A:  {"IRQL_NOT_LESS_OR_EQUAL", "un pilote, très souvent le Wi-Fi, parfois la RAM"},
	0x1A:  {"MEMORY_MANAGEMENT", "la mémoire vive le plus souvent"},
	0x1E:  {"KMODE_EXCEPTION_NOT_HANDLED", "un pilote"},
	0x3B:  {"SYSTEM_SERVICE_EXCEPTION", "un pilote (graphique, antivirus, VPN)"},
	0x4E:  {"PFN_LIST_CORRUPT", "la mémoire vive ou un pilote"},
	0x50:  {"PAGE_FAULT_IN_NONPAGED_AREA", "la mémoire vive ou un pilote, parfois l'antivirus"},
	0x7A:  {"KERNEL_DATA_INPAGE_ERROR", "le disque, son câble ou son contrôleur"},
	0x7E:  {"SYSTEM_THREAD_EXCEPTION_NOT_HANDLED", "un pilote"},
	0x7F:  {"UNEXPECTED_KERNEL_MODE_TRAP", "le matériel (RAM, surchauffe) ou un pilote"},
	0x9F:  {"DRIVER_POWER_STATE_FAILURE", "un pilote, à l'entrée ou à la sortie de veille"},
	0xC2:  {"BAD_POOL_CALLER", "un pilote"},
	0xD1:  {"DRIVER_IRQL_NOT_LESS_OR_EQUAL", "un pilote, très souvent le réseau"},
	0xEF:  {"CRITICAL_PROCESS_DIED", "les fichiers système ou le disque"},
	0xF4:  {"CRITICAL_OBJECT_TERMINATION", "le disque (le système n'arrive plus à le lire)"},
	0x101: {"CLOCK_WATCHDOG_TIMEOUT", "le processeur, l'overclocking ou le BIOS"},
	0x109: {"CRITICAL_STRUCTURE_CORRUPTION", "la mémoire vive ou un pilote"},
	0x116: {"VIDEO_TDR_FAILURE", "le pilote ou la carte graphique (température, alimentation)"},
	0x117: {"VIDEO_TDR_TIMEOUT_DETECTED", "le pilote ou la carte graphique"},
	0x119: {"VIDEO_SCHEDULER_INTERNAL_ERROR", "le pilote graphique"},
	0x124: {"WHEA_UNCORRECTABLE_ERROR", "le matériel : processeur, RAM, alimentation, surchauffe, overclocking"},
	0x133: {"DPC_WATCHDOG_VIOLATION", "le pilote de stockage ou le firmware du SSD"},
	0x139: {"KERNEL_SECURITY_CHECK_FAILURE", "un pilote ou la mémoire vive"},
	0x13A: {"KERNEL_MODE_HEAP_CORRUPTION", "un pilote"},
	0x154: {"UNEXPECTED_STORE_EXCEPTION", "le disque ou le SSD"},
	0x15F: {"CONNECTED_STANDBY_WATCHDOG_TIMEOUT_LIVEDUMP", "un pilote et la veille moderne"},
	0x1CA: {"SYNTHETIC_WATCHDOG_TIMEOUT", "un pilote ou le matériel bloqué"},
	0x1D2: {"WORKER_THREAD_INVALID_STATE", "un pilote"},
}

var evBugRe = regexp.MustCompile(`0x[0-9a-fA-F]{8,16}`)

// evBugCheck : le code d'arrêt d'un écran bleu (message ou 1re valeur), 0 si absent.
func evBugCheck(e evRaw) uint64 {
	cand := e.Msg
	if p := e.props(); len(p) > 0 {
		cand = p[0] + " " + cand
	}
	if m := evBugRe.FindString(cand); m != "" {
		v, _ := strconv.ParseUint(m[2:], 16, 64)
		return v
	}
	return 0
}

func evBugName(code uint64) string {
	if b, ok := evBugChecks[code]; ok {
		return fmt.Sprintf("0x%X %s", code, b[0])
	}
	return fmt.Sprintf("0x%X", code)
}

// codes d'erreur de Windows Update les plus courants
var evWUCodes = map[string]string{
	"0x800f0922": "partition de récupération trop petite, VPN actif ou connexion coupée pendant l'installation",
	"0x80070002": "fichiers d'installation abîmés ou manquants : réinitialiser Windows Update",
	"0x80073712": "composants de Windows abîmés : DISM /RestoreHealth",
	"0x800f081f": "image Windows abîmée : DISM /RestoreHealth",
	"0x800f0831": "image Windows abîmée (une mise à jour précédente manque) : DISM puis réinitialiser Windows Update",
	"0x80070070": "disque C: plein",
	"0x8007000e": "mémoire insuffisante pendant l'installation",
	"0x80240034": "téléchargement échoué : réinitialiser Windows Update",
	"0x8024a105": "téléchargement interrompu : réinitialiser Windows Update",
	"0x80070643": "échec d'installation (souvent la partition de récupération ou .NET)",
	"0x800f0988": "nettoyage des composants nécessaire : DISM /StartComponentCleanup",
	"0x80070005": "accès refusé (antivirus tiers ou droits)",
	"0x8024200b": "installation échouée : réinitialiser Windows Update",
	"0xc1900101": "pilote incompatible avec la mise à jour de version (déconnecter les périphériques, mettre à jour les pilotes)",
}

var (
	evHexRe = regexp.MustCompile(`(?i)0x[0-9a-f]{8}`)
	evExcRe = regexp.MustCompile(`(?i)^(?:0x)?([0-9a-f]{8})$`) // code d'exception, écrit sans 0x par Windows
)

// modules fautifs connus dans les plantages d'applications (Application Error 1000)
func evModuleHint(mod string) string {
	m := strings.ToLower(mod)
	switch {
	case m == "ntdll.dll" || m == "kernelbase.dll" || m == "ucrtbase.dll" || m == "msvcrt.dll":
		return "module de Windows : le programme lui-même est en cause (abîmé, pas à jour) plutôt que Windows"
	case strings.HasPrefix(m, "msvcp") || strings.HasPrefix(m, "vcruntime") || strings.HasPrefix(m, "msvcr"):
		return "bibliothèque Visual C++ : réinstaller les redistribuables Visual C++"
	case m == "clr.dll" || m == "coreclr.dll" || m == "clrjit.dll" || strings.HasPrefix(m, "mscor"):
		return ".NET : réparer ou mettre à jour .NET"
	case strings.HasPrefix(m, "nvwgf") || strings.HasPrefix(m, "nvoglv") || strings.HasPrefix(m, "nvd3d") || strings.HasPrefix(m, "nvcuda"):
		return "pilote graphique NVIDIA : réinstaller le pilote"
	case strings.HasPrefix(m, "atiumd") || strings.HasPrefix(m, "amdxx") || strings.HasPrefix(m, "atio6") || strings.HasPrefix(m, "amdvlk"):
		return "pilote graphique AMD : réinstaller le pilote"
	case strings.HasPrefix(m, "ig") && strings.Contains(m, "umd") || strings.HasPrefix(m, "igd"):
		return "pilote graphique Intel : réinstaller le pilote"
	case m == "d3d11.dll" || m == "d3d12.dll" || m == "dxgi.dll" || m == "d3d9.dll":
		return "DirectX : souvent le pilote graphique"
	case m == "unknown" || m == "":
		return ""
	}
	return "module tiers : chercher à quel logiciel il appartient (antivirus, overlay, extension…)"
}

var evExcCodes = map[string]string{
	"0xc0000005": "violation d'accès",
	"0xc0000409": "dépassement de pile (protection du programme)",
	"0xe0434352": "exception .NET",
	"0xc0000374": "tas corrompu",
	"0x80000003": "point d'arrêt (assertion du programme)",
	"0xc000001d": "instruction non valide (processeur ou overclocking)",
	"0xc0000006": "erreur de lecture du fichier sur le disque",
}

var evHarddiskRe = regexp.MustCompile(`(?i)\\Device\\Harddisk(\d+)`)

// ---------------------------------------------------------------- analyse

type evCross struct {
	Sev      string   `json:"sev"`
	Title    string   `json:"title"`
	Text     string   `json:"text"`
	Evidence []string `json:"evidence"`
	Keys     []string `json:"keys"`
	Act      string   `json:"act,omitempty"`
	Tool     string   `json:"tool,omitempty"`
}

type evSympt struct {
	ID    string   `json:"id"`
	Label string   `json:"label"`
	Keys  []string `json:"keys"`
	None  string   `json:"none"` // piste quand les journaux ne disent rien
}

type evMatch struct {
	Src []string
	IDs []int
}

// symptômes décrits par le client → événements à chercher
var evSymptoms = []struct {
	ID, Label, None string
	M               []evMatch
}{
	{"off", "Il s'éteint ou redémarre tout seul", "Aucun arrêt brutal noté : penser à une mise en veille ou à un redémarrage de Windows Update (voir la chronologie), ou élargir la période.",
		[]evMatch{{[]string{"Microsoft-Windows-Kernel-Power"}, []int{41}}, {[]string{"EventLog"}, []int{6008}}, {[]string{"BugCheck", "Microsoft-Windows-WER-SystemErrorReporting"}, []int{1001}}, {[]string{"Microsoft-Windows-WHEA-Logger"}, []int{18, 20, 46}}, {[]string{"User32"}, []int{1074}}}},
	{"bsod", "Écran bleu", "Aucun écran bleu enregistré : fichier d'échange désactivé (volmgr 46) ou coupure avant l'écran bleu ; regarder le dossier Minidump.",
		[]evMatch{{[]string{"BugCheck", "Microsoft-Windows-WER-SystemErrorReporting"}, []int{1001}}, {[]string{"Microsoft-Windows-WHEA-Logger"}, nil}, {[]string{"volmgr"}, nil}}},
	{"slow", "Il rame ou se fige quelques secondes", "Rien côté disque dans les journaux : regarder le processeur et la mémoire en direct (Capteurs), les programmes au démarrage et l'espace disque.",
		[]evMatch{{[]string{"storahci", "stornvme", "iaStorA", "iaStorAC", "iaStorAVC", "iaStorVD", "amdsata", "amd_sata", "nvstor"}, []int{129}}, {[]string{"disk", "Microsoft-Windows-Disk"}, []int{7, 11, 51, 153}}, {[]string{"Ntfs", "Microsoft-Windows-Ntfs"}, nil}, {[]string{"Microsoft-Windows-Resource-Exhaustion-Detector"}, nil}, {[]string{"Application Hang"}, nil}, {[]string{"Microsoft-Windows-Kernel-Processor-Power"}, []int{37}}}},
	{"screen", "L'écran devient noir puis revient", "Rien côté pilote graphique : vérifier le câble et l'écran, et le rétroéclairage sur un portable.",
		[]evMatch{{[]string{"Display"}, []int{4101}}, {[]string{"nvlddmkm", "amdkmdag", "amdkmdap", "amdwddmg", "igfx", "igfxn", "igfxnd"}, nil}}},
	{"apps", "Un ou des logiciels plantent", "Aucun plantage enregistré : le logiciel se ferme peut-être sans erreur (le réinstaller), ou il plante dans une autre session.",
		[]evMatch{{[]string{"Application Error"}, []int{1000}}, {[]string{"Application Hang"}, []int{1002}}, {[]string{".NET Runtime"}, nil}, {[]string{"SideBySide"}, nil}}},
	{"net", "Internet coupe, le Wi-Fi décroche", "Rien côté carte réseau : la box ou le signal Wi-Fi sont plus probables que le PC (tester avec un autre appareil).",
		[]evMatch{{[]string{"Netw*", "rtwlan*", "rt640*", "rtcx*", "e1*express", "e2*express", "athw*", "Qcamain*", "bcmwl*", "mrvl*", "b57nd*", "Microsoft-Windows-NDIS"}, nil}, {[]string{"Microsoft-Windows-Dhcp-Client"}, nil}, {[]string{"Microsoft-Windows-DNS-Client"}, nil}, {[]string{"Tcpip"}, []int{4199}}}},
	{"wu", "Les mises à jour ne passent pas", "Aucun échec noté sur la période : ouvrir Windows Update pour voir l'état, ou élargir à 30 jours.",
		[]evMatch{{[]string{"Microsoft-Windows-WindowsUpdateClient"}, []int{16, 20, 25, 31}}, {[]string{"Microsoft-Windows-TPM-WMI"}, nil}}},
	{"profile", "Bureau vide, fichiers disparus", "Pas de profil temporaire noté : vérifier OneDrive (fichiers déplacés) et le bon compte utilisateur.",
		[]evMatch{{[]string{"Microsoft-Windows-User Profiles Service"}, []int{1500, 1502, 1508, 1511, 1515}}}},
	{"print", "L'imprimante ne marche plus", "Rien dans les journaux : réinstaller le pilote de l'imprimante et vérifier sa connexion.",
		[]evMatch{{[]string{"Service Control Manager"}, []int{7031, 7034, 7023, 7024}}, {[]string{"Microsoft-Windows-DriverFrameworks-UserMode"}, nil}}},
	{"cert", "Les sites ne s'ouvrent pas, erreur de certificat", "Heure bien synchronisée : penser à l'antivirus (analyse HTTPS) ou au proxy.",
		[]evMatch{{[]string{"Microsoft-Windows-Time-Service"}, nil}, {[]string{"Microsoft-Windows-DNS-Client"}, nil}}},
	{"boot", "Il est lent à démarrer", "Rien de bloquant au démarrage dans les journaux : regarder les programmes au démarrage et l'état du disque.",
		[]evMatch{{[]string{"Service Control Manager"}, []int{7000, 7001, 7009, 7011, 7022}}, {[]string{"Microsoft-Windows-Kernel-PnP"}, nil}}},
	{"virus", "Fenêtres bizarres, publicités, antivirus coupé", "Rien de l'antivirus Microsoft : un autre antivirus est peut-être installé ; lancer une analyse.",
		[]evMatch{{[]string{"Microsoft-Windows-Windows Defender"}, nil}, {[]string{"Service Control Manager"}, []int{7045}}}},
}

func (m evMatch) has(g *evGroup) bool {
	ok := false
	for _, s := range m.Src {
		if evSrcMatch(s, g.Src) {
			ok = true
			break
		}
	}
	if !ok {
		return false
	}
	if len(m.IDs) == 0 {
		return true
	}
	for _, id := range m.IDs {
		if id == g.ID {
			return true
		}
	}
	return false
}

func evTime(s string) time.Time { t, _ := time.Parse(time.RFC3339Nano, s); return t }

func evIs(g *evGroup, src string, ids ...int) bool {
	return evMatch{[]string{src}, ids}.has(g)
}

func plural(n int, one, many string) string {
	if n > 1 {
		return fmt.Sprintf("%d %s", n, many)
	}
	return fmt.Sprintf("%d %s", n, one)
}

// evAnalyze ajoute les causes, les pistes propres à ce PC, le diagnostic croisé et les symptômes.
func evAnalyze(res *evResult, loc *time.Location) {
	res.Cross, res.Symptoms = []evCross{}, []evSympt{}
	var boots []time.Time // démarrages : 6005, et le redémarrage après un arrêt brutal
	for i := range res.Groups {
		g := &res.Groups[i]
		if evIs(g, "EventLog", 6005) || evIs(g, "Microsoft-Windows-Kernel-Power", 41) {
			for _, e := range g.raw {
				boots = append(boots, evTime(e.T))
			}
		}
	}
	sort.Slice(boots, func(i, j int) bool { return boots[i].Before(boots[j]) })
	var bsods []time.Time // écrans bleus enregistrés (BugCheck 1001)
	for i := range res.Groups {
		if g := &res.Groups[i]; evIs(g, "BugCheck", 1001) || evIs(g, "Microsoft-Windows-WER-SystemErrorReporting", 1001) {
			for _, e := range g.raw {
				bsods = append(bsods, evTime(e.T))
			}
		}
	}
	// un arrêt brutal « code 0 » à quelques minutes d'un écran bleu enregistré n'est pas une coupure nette
	nearBsod := func(t time.Time) bool {
		for _, b := range bsods {
			if d := b.Sub(t); d > -5*time.Minute && d < 5*time.Minute {
				return true
			}
		}
		return false
	}
	afterBoot := func(t time.Time) bool { // dans les 5 minutes qui suivent un démarrage
		i := sort.Search(len(boots), func(i int) bool { return boots[i].After(t) })
		return i > 0 && t.Sub(boots[i-1]) <= 5*time.Minute
	}

	for i := range res.Groups {
		g := &res.Groups[i]
		if g.Known && !g.Learned { // une fiche apprise apporte ses propres causes
			g.Causes = evCauses[g.Title]
		}
		g.Hints = evGroupHints(g, nearBsod)
		// au démarrage, à chaque fois ?
		if g.Count >= 2 && !g.Noise && g.Cat != catStart && len(boots) > 0 {
			n := 0
			for _, e := range g.raw {
				if afterBoot(evTime(e.T)) {
					n++
				}
			}
			if n == g.Count {
				g.Hints = append(g.Hints, fmt.Sprintf("Apparaît toujours juste après le démarrage (%d fois sur %d) : un pilote, un service ou un programme lancé avec Windows.", n, g.Count))
			} else if n*10 >= g.Count*7 {
				g.Hints = append(g.Hints, fmt.Sprintf("Apparaît surtout au démarrage (%d fois sur %d).", n, g.Count))
			}
		}
	}
	res.Cross = evCrossRules(res, afterBoot, nearBsod)
	for _, s := range evSymptoms {
		sy := evSympt{ID: s.ID, Label: s.Label, None: s.None, Keys: []string{}}
		for i := range res.Groups {
			g := &res.Groups[i]
			for _, m := range s.M {
				if m.has(g) {
					sy.Keys = append(sy.Keys, g.Key)
					break
				}
			}
		}
		res.Symptoms = append(res.Symptoms, sy)
	}
}

// evGroupHints : ce que les valeurs des événements de ce groupe disent de plus.
func evGroupHints(g *evGroup, nearBsod func(time.Time) bool) []string {
	var h []string
	switch {
	case evIs(g, "Microsoft-Windows-Kernel-Power", 41):
		clean, bug, sleep, button := 0, map[uint64]int{}, 0, 0
		for _, e := range g.raw {
			p := e.props()
			code := uint64(0)
			if len(p) > 0 {
				code, _ = strconv.ParseUint(strings.TrimSpace(p[0]), 10, 64)
			}
			if code == 0 && !nearBsod(evTime(e.T)) {
				clean++
			} else if code != 0 {
				bug[code]++
			}
			if len(p) > 5 && strings.TrimSpace(p[5]) != "" && strings.TrimSpace(p[5]) != "0" {
				sleep++
			}
			if len(p) > 6 && strings.TrimSpace(p[6]) != "" && strings.TrimSpace(p[6]) != "0" {
				button++
			}
		}
		if button > 0 {
			h = append(h, fmt.Sprintf("Bouton d'alimentation maintenu : %s. Le client (ou quelqu'un) a forcé l'arrêt, souvent parce que le PC était figé : chercher ce qui le figeait.", plural(button, "fois", "fois")))
		}
		if sleep > 0 {
			h = append(h, fmt.Sprintf("Coupure pendant une mise en veille : %s. Piste : pilote ou BIOS qui gère mal la veille ; désactiver le démarrage rapide.", plural(sleep, "fois", "fois")))
		}
		if clean-button > 0 {
			h = append(h, fmt.Sprintf("Coupure nette, sans écran bleu : %s. Piste : alimentation, surchauffe ou coupure de courant.", plural(clean-button, "fois", "fois")))
		}
		for code, n := range bug {
			line := fmt.Sprintf("Coupure après un écran bleu %s, %s", evBugName(code), plural(n, "fois", "fois"))
			if b, ok := evBugChecks[code]; ok {
				line += " : pointe vers " + b[1]
			}
			h = append(h, line+".")
		}
	case evIs(g, "BugCheck", 1001) || evIs(g, "Microsoft-Windows-WER-SystemErrorReporting", 1001):
		codes := map[uint64]int{}
		for _, e := range g.raw {
			if c := evBugCheck(e); c != 0 {
				codes[c]++
			}
		}
		keys := make([]uint64, 0, len(codes))
		for c := range codes {
			keys = append(keys, c)
		}
		sort.Slice(keys, func(i, j int) bool { return codes[keys[i]] > codes[keys[j]] })
		for _, c := range keys {
			why := "code peu courant : le minidump nommera le pilote en cause"
			if b, ok := evBugChecks[c]; ok {
				why = "pointe vers " + b[1]
			}
			h = append(h, fmt.Sprintf("Code %s, %s : %s.", evBugName(c), plural(codes[c], "fois", "fois"), why))
		}
		if len(keys) >= 2 {
			h = append(h, "Codes différents d'un écran bleu à l'autre : penser d'abord à la mémoire vive, à l'alimentation ou à la température.")
		} else if len(keys) == 1 && codes[keys[0]] >= 2 {
			h = append(h, "Toujours le même code : un pilote le plus souvent. Le dossier Minidump le nomme (WinDbg ou BlueScreenView).")
		}
	case evIs(g, "Microsoft-Windows-WindowsUpdateClient", 20):
		seen := map[string]bool{}
		for _, e := range g.raw {
			p := e.props()
			c := ""
			if len(p) > 0 {
				c = strings.ToLower(evHexRe.FindString(p[0]))
			}
			if c == "" {
				c = strings.ToLower(evHexRe.FindString(e.Msg))
			}
			if c == "" || seen[c] {
				continue
			}
			seen[c] = true
			if why, ok := evWUCodes[c]; ok {
				h = append(h, "Erreur "+c+" : "+why+".")
			} else {
				h = append(h, "Erreur "+c+" : code moins courant, à chercher avec le nom de la mise à jour.")
			}
		}
		if g.Count >= 2 {
			h = append(h, fmt.Sprintf("Cette mise à jour a échoué %s : Windows Update ne s'en sortira pas seul.", plural(g.Count, "fois", "fois")))
		}
	case evIs(g, "Application Error", 1000):
		mods, excs := map[string]int{}, map[string]int{}
		for _, e := range g.raw {
			p := e.props()
			if len(p) > 3 && p[3] != "" {
				mods[p[3]]++
			}
			if len(p) > 6 {
				if m := evExcRe.FindStringSubmatch(p[6]); m != nil {
					excs["0x"+strings.ToLower(m[1])]++
				}
			}
		}
		for m, n := range mods {
			line := fmt.Sprintf("Module fautif %s (%s)", m, plural(n, "fois", "fois"))
			if why := evModuleHint(m); why != "" {
				line += " : " + why
			}
			h = append(h, line+".")
		}
		for c, n := range excs {
			if why, ok := evExcCodes[c]; ok {
				h = append(h, fmt.Sprintf("Exception %s (%s), %s.", c, why, plural(n, "fois", "fois")))
			}
		}
	case evIs(g, "disk", 7, 11, 51, 153) || evIs(g, "Microsoft-Windows-Disk", 7, 11, 51, 153):
		disks := map[string]int{}
		for _, e := range g.raw {
			if m := evHarddiskRe.FindStringSubmatch(e.Msg); m != nil {
				disks[m[1]]++
			}
		}
		for d, n := range disks {
			line := fmt.Sprintf("Disque n° %s concerné (%s)", d, plural(n, "fois", "fois"))
			if d == "0" {
				line += " : en général le disque où est installé Windows"
			} else {
				line += " : un second disque ou un disque externe (vérifier dans Gestion des disques)"
			}
			h = append(h, line+".")
		}
	case evIs(g, "Service Control Manager", 7031, 7034, 7023, 7024):
		s := strings.ToLower(g.Subject)
		switch {
		case strings.Contains(s, "spoul") || strings.Contains(s, "spooler") || strings.Contains(s, "impression"):
			h = append(h, "C'est le spouleur d'impression : un pilote d'imprimante le fait planter. Supprimer les imprimantes inutiles et réinstaller le pilote de la bonne.")
		case strings.Contains(s, "windows update") || strings.Contains(s, "bits") || strings.Contains(s, "service de transfert intelligent"):
			h = append(h, "Service de Windows Update : réinitialiser Windows Update, puis DISM.")
		case strings.Contains(s, "audio") || strings.Contains(s, "son"):
			h = append(h, "Service du son : réinstaller le pilote audio.")
		}
	}
	return h
}

// evCrossRules : combinaisons d'événements de ce PC qui laissent souvent une seule cause.
func evCrossRules(res *evResult, afterBoot, nearBsod func(time.Time) bool) []evCross {
	var out []evCross
	find := func(match func(g *evGroup) bool) []*evGroup {
		var l []*evGroup
		for i := range res.Groups {
			if g := &res.Groups[i]; match(g) {
				l = append(l, g)
			}
		}
		return l
	}
	count := func(l []*evGroup) int {
		n := 0
		for _, g := range l {
			n += g.Count
		}
		return n
	}
	keys := func(ls ...[]*evGroup) []string {
		k := []string{}
		for _, l := range ls {
			for _, g := range l {
				k = append(k, g.Key)
			}
		}
		return k
	}
	near := func(a, b []*evGroup, win time.Duration) int { // événements de a avec un événement de b à moins de win
		n := 0
		for _, ga := range a {
			for _, ea := range ga.raw {
				ta := evTime(ea.T)
			loop:
				for _, gb := range b {
					for _, eb := range gb.raw {
						d := evTime(eb.T).Sub(ta)
						if d < 0 {
							d = -d
						}
						if d <= win {
							n++
							break loop
						}
					}
				}
			}
		}
		return n
	}

	kp := find(func(g *evGroup) bool { return evIs(g, "Microsoft-Windows-Kernel-Power", 41) })
	bsod := find(func(g *evGroup) bool {
		return evIs(g, "BugCheck", 1001) || evIs(g, "Microsoft-Windows-WER-SystemErrorReporting", 1001)
	})
	wheaFatal := find(func(g *evGroup) bool { return evIs(g, "Microsoft-Windows-WHEA-Logger", 18, 20, 46) })
	wheaOK := find(func(g *evGroup) bool { return evIs(g, "Microsoft-Windows-WHEA-Logger", 1, 17, 19, 47) })
	stor := find(func(g *evGroup) bool { return g.ID == 129 && g.Cat == catDisk })
	diskRetry := find(func(g *evGroup) bool {
		return evIs(g, "disk", 51, 153) || evIs(g, "Microsoft-Windows-Disk", 51, 153)
	})
	diskBad := find(func(g *evGroup) bool {
		return evIs(g, "disk", 7, 11) || evIs(g, "Microsoft-Windows-Disk", 7, 11) || evIs(g, "atapi", 9, 11)
	})
	ntfs := find(func(g *evGroup) bool { return evIs(g, "Ntfs", 55, 98) || evIs(g, "Microsoft-Windows-Ntfs", 55, 98) })
	hangs := find(func(g *evGroup) bool { return evIs(g, "Application Hang", 1002) })
	crashes := find(func(g *evGroup) bool { return evIs(g, "Application Error", 1000) })
	gpu := find(func(g *evGroup) bool {
		return evIs(g, "Display", 4101) || evMatch{[]string{"nvlddmkm", "amdkmdag", "amdkmdap", "amdwddmg", "igfx", "igfxn", "igfxnd"}, nil}.has(g)
	})
	tmpProfile := find(func(g *evGroup) bool { return evIs(g, "Microsoft-Windows-User Profiles Service", 1511, 1515) })
	wuFail := find(func(g *evGroup) bool { return evIs(g, "Microsoft-Windows-WindowsUpdateClient", 20) })
	wuSvc := find(func(g *evGroup) bool {
		s := strings.ToLower(g.Subject)
		return evIs(g, "Service Control Manager", 7031, 7034, 7023, 7024) && (strings.Contains(s, "windows update") || strings.Contains(s, "bits") || strings.Contains(s, "transfert intelligent"))
	})
	timeSvc := find(func(g *evGroup) bool { return evIs(g, "Microsoft-Windows-Time-Service") })
	nic := find(func(g *evGroup) bool {
		return g.Cat == catNet && (evIs(g, "Microsoft-Windows-Dhcp-Client") || evIs(g, "Microsoft-Windows-NDIS") || evMatch{[]string{"Netw*", "rtwlan*", "rt640*", "rtcx*", "e1*express", "e2*express", "athw*", "Qcamain*", "bcmwl*", "mrvl*", "b57nd*"}, nil}.has(g))
	})
	wake := find(func(g *evGroup) bool { return evIs(g, "Microsoft-Windows-Power-Troubleshooter", 1) })
	threat := find(func(g *evGroup) bool { return evIs(g, "Microsoft-Windows-Windows Defender", 1116, 1118, 1119) })
	avOff := find(func(g *evGroup) bool { return evIs(g, "Microsoft-Windows-Windows Defender", 5001, 3002, 5008) })
	newSvc := find(func(g *evGroup) bool { return evIs(g, "Service Control Manager", 7045) })
	memLow := find(func(g *evGroup) bool { return evIs(g, "Microsoft-Windows-Resource-Exhaustion-Detector", 2004) })

	// écrans bleus : codes différents ou toujours le même
	codes := map[uint64]int{}
	for _, g := range bsod {
		for _, e := range g.raw {
			if c := evBugCheck(e); c != 0 {
				codes[c]++
			}
		}
	}
	for _, g := range kp {
		for _, e := range g.raw {
			if p := e.props(); len(p) > 0 {
				if c, _ := strconv.ParseUint(strings.TrimSpace(p[0]), 10, 64); c != 0 && len(bsod) == 0 {
					codes[c]++
				}
			}
		}
	}
	nb := 0
	for _, n := range codes {
		nb += n
	}
	switch {
	case len(wheaFatal) > 0 && (len(kp) > 0 || len(bsod) > 0):
		out = append(out, evCross{Sev: "crit", Title: "Plantages d'origine matérielle",
			Text:     "Des erreurs matérielles graves (WHEA) accompagnent les arrêts : le processeur, la mémoire, l'alimentation ou un overclocking sont en cause, pas Windows.",
			Evidence: []string{plural(count(wheaFatal), "erreur matérielle grave", "erreurs matérielles graves"), plural(count(kp)+count(bsod), "arrêt brutal ou écran bleu", "arrêts brutaux ou écrans bleus")},
			Keys:     keys(wheaFatal, kp, bsod), Act: "memtest"})
	case len(codes) >= 2:
		out = append(out, evCross{Sev: "crit", Title: "Écrans bleus aux codes différents",
			Text:     "Chaque plantage a un code différent : c'est le signe d'un problème de fond plutôt que d'un pilote. Mémoire vive d'abord (retirer le profil XMP, tester barrette par barrette), puis alimentation et température.",
			Evidence: []string{fmt.Sprintf("%d codes différents sur %d écrans bleus", len(codes), nb)},
			Keys:     keys(bsod, kp), Act: "memtest"})
	case len(codes) == 1 && nb >= 2:
		var c uint64
		for k := range codes {
			c = k
		}
		why := "un pilote"
		if b, ok := evBugChecks[c]; ok {
			why = b[1]
		}
		out = append(out, evCross{Sev: "crit", Title: "Écrans bleus répétés au même code",
			Text:     fmt.Sprintf("Toujours %s : %s. Le dossier Minidump donne le nom du fichier en cause.", evBugName(c), why),
			Evidence: []string{plural(nb, "écran bleu", "écrans bleus") + " au même code"},
			Keys:     keys(bsod, kp), Tool: "minidump"})
	}

	// arrêts brutaux sans écran bleu
	clean, button := 0, 0
	for _, g := range kp {
		for _, e := range g.raw {
			p := e.props()
			if len(p) > 0 && strings.TrimSpace(p[0]) != "0" && strings.TrimSpace(p[0]) != "" || nearBsod(evTime(e.T)) {
				continue
			}
			if len(p) > 6 && strings.TrimSpace(p[6]) != "" && strings.TrimSpace(p[6]) != "0" {
				button++
			} else {
				clean++
			}
		}
	}
	if clean >= 2 && len(wheaFatal) == 0 {
		out = append(out, evCross{Sev: "crit", Title: "Coupures nettes à répétition",
			Text:     "Le PC se coupe sans écran bleu ni bouton maintenu : c'est presque toujours l'alimentation (ou la batterie et le chargeur), la surchauffe ou le courant. Surveiller les températures pendant un test en charge et tester une autre alimentation ou une autre prise.",
			Evidence: []string{plural(clean, "coupure sans écran bleu", "coupures sans écran bleu")},
			Keys:     keys(kp)})
	}
	if button >= 2 {
		out = append(out, evCross{Sev: "warn", Title: "Arrêts forcés au bouton",
			Text:     "Le bouton d'alimentation a été maintenu plusieurs fois : le PC se figeait sans doute. La vraie panne est ce qui le fige (disque, pilote graphique, mémoire saturée) : regarder les événements juste avant.",
			Evidence: []string{plural(button, "arrêt forcé", "arrêts forcés")},
			Keys:     keys(kp)})
	}

	// juste avant les arrêts brutaux et les écrans bleus
	if len(kp) > 0 {
		before := map[string]int{}
		var crashT []time.Time
		for _, g := range kp {
			for _, e := range g.raw {
				crashT = append(crashT, evTime(e.T))
			}
		}
		for i := range res.Groups {
			g := &res.Groups[i]
			if g.Noise || g.Cat == catStart || g.Sev == "info" {
				continue
			}
			for _, ct := range crashT {
				for _, e := range g.raw {
					if d := ct.Sub(evTime(e.T)); d > 0 && d <= 10*time.Minute {
						before[g.Key]++
						break
					}
				}
			}
		}
		if len(before) > 0 {
			var gs []*evGroup
			for i := range res.Groups {
				if before[res.Groups[i].Key] > 0 {
					gs = append(gs, &res.Groups[i])
				}
			}
			sort.SliceStable(gs, func(i, j int) bool { return before[gs[i].Key] > before[gs[j].Key] })
			if len(gs) > 6 {
				gs = gs[:6]
			}
			var ev []string
			for _, g := range gs {
				name := g.Title
				if g.Subject != "" {
					name += " (" + g.Subject + ")"
				}
				ev = append(ev, fmt.Sprintf("%s : avant %d arrêt(s) sur %d", name, before[g.Key], len(crashT)))
			}
			ks := keys(gs)
			out = append(out, evCross{Sev: "warn", Title: "Juste avant les arrêts brutaux",
				Text:     "Ces erreurs ont eu lieu dans les 10 minutes précédant un redémarrage après arrêt brutal. Celle qui revient avant presque chaque arrêt est la première suspecte.",
				Evidence: ev, Keys: append(ks, keys(kp)...)})
		}
	}

	// disque
	if (len(stor) > 0 || len(diskRetry) > 0) && len(hangs) > 0 {
		if n := near(hangs, append(append([]*evGroup{}, stor...), diskRetry...), 3*time.Minute); n > 0 {
			out = append(out, evCross{Sev: "crit", Title: "Le disque fige le PC",
				Text:     "Des applications se figent au moment où le disque ne répond plus : c'est le disque (ou le SSD) qui bloque le PC. Mettre à jour le firmware du SSD et le pilote de stockage, regarder la santé SMART et la température.",
				Evidence: []string{fmt.Sprintf("%d blocage(s) d'application à moins de 3 minutes d'une erreur du disque", n)},
				Keys:     keys(hangs, stor, diskRetry), Act: "chkdsk"})
		}
	}
	if len(diskBad) > 0 && len(ntfs) > 0 {
		out = append(out, evCross{Sev: "crit", Title: "Disque qui se dégrade",
			Text:     "Le disque a des erreurs de lecture ou de communication et la structure des fichiers est abîmée : sauvegarder les données du client d'abord, puis remplacer le disque.",
			Evidence: []string{plural(count(diskBad), "erreur du disque", "erreurs du disque"), plural(count(ntfs), "erreur du système de fichiers", "erreurs du système de fichiers")},
			Keys:     keys(diskBad, ntfs), Tool: "diskmgmt"})
	}
	if count(kp) >= 2 && (len(ntfs) > 0 || len(tmpProfile) > 0) {
		out = append(out, evCross{Sev: "warn", Title: "Les coupures ont abîmé Windows",
			Text:     "Après des arrêts brutaux répétés, le système de fichiers ou le profil de l'utilisateur est abîmé. Régler d'abord la cause des coupures, puis réparer (chkdsk au redémarrage, profil).",
			Evidence: []string{plural(count(kp), "arrêt brutal", "arrêts brutaux"), plural(count(ntfs)+count(tmpProfile), "dégât constaté", "dégâts constatés")},
			Keys:     keys(kp, ntfs, tmpProfile), Act: "chkdskboot"})
	}

	// carte graphique
	gpuBsod := false
	for c := range codes {
		if c == 0x116 || c == 0x117 || c == 0x119 {
			gpuBsod = true
		}
	}
	if len(gpu) > 0 && (gpuBsod || count(gpu) >= 3) {
		t := "Le pilote graphique plante à répétition"
		if gpuBsod {
			t += " jusqu'à l'écran bleu"
		}
		out = append(out, evCross{Sev: map[bool]string{true: "crit", false: "warn"}[gpuBsod], Title: "Carte graphique ou son pilote",
			Text:     t + " : réinstaller proprement le pilote (DDU puis pilote du fabricant), surveiller la température de la carte et vérifier son alimentation.",
			Evidence: []string{plural(count(gpu), "erreur du pilote graphique", "erreurs du pilote graphique")},
			Keys:     keys(gpu, bsod), Tool: "devmgmt"})
	}

	// plantages d'applications variés
	apps := map[string]bool{}
	for _, g := range crashes {
		apps[strings.ToLower(g.Subject)] = true
	}
	if len(apps) >= 3 {
		if len(wheaOK) > 0 || len(wheaFatal) > 0 {
			out = append(out, evCross{Sev: "crit", Title: "Mémoire vive suspecte",
				Text:     "Beaucoup de programmes différents plantent et le matériel signale des erreurs : la mémoire vive est la première suspecte. Lancer un test mémoire long.",
				Evidence: []string{fmt.Sprintf("%d programmes différents ont planté", len(apps)), plural(count(wheaOK)+count(wheaFatal), "erreur matérielle", "erreurs matérielles")},
				Keys:     keys(crashes, wheaOK, wheaFatal), Act: "memtest"})
		} else {
			out = append(out, evCross{Sev: "warn", Title: "Plantages de programmes variés",
				Text:     "Plusieurs programmes différents plantent sans erreur matérielle : vérifier les fichiers système (DISM puis SFC), puis un antivirus tiers ou un logiciel qui s'injecte partout ; un test mémoire si cela continue.",
				Evidence: []string{fmt.Sprintf("%d programmes différents ont planté", len(apps))},
				Keys:     keys(crashes), Act: "sfc"})
		}
	}
	if len(memLow) > 0 && len(hangs) > 0 {
		out = append(out, evCross{Sev: "warn", Title: "Mémoire saturée et blocages",
			Text:     "Windows a manqué de mémoire et des programmes se sont figés : identifier le programme gourmand (le message de l'événement le cite), alléger le démarrage ou ajouter de la RAM.",
			Evidence: []string{plural(count(memLow), "alerte de mémoire saturée", "alertes de mémoire saturée"), plural(count(hangs), "blocage", "blocages")},
			Keys:     keys(memLow, hangs), Tool: "resmon"})
	}

	// Windows Update
	if count(wuFail) >= 3 || (len(wuFail) > 0 && len(wuSvc) > 0) {
		out = append(out, evCross{Sev: "warn", Title: "Windows Update bloqué",
			Text:     "Les mises à jour échouent à répétition : réinitialiser Windows Update, réparer l'image (DISM) et libérer de la place sur C:. Les codes d'erreur dans le détail précisent la cause.",
			Evidence: []string{plural(count(wuFail), "échec de mise à jour", "échecs de mise à jour")},
			Keys:     keys(wuFail, wuSvc), Act: "wureset"})
	}
	// heure
	if len(timeSvc) > 0 {
		atBoot := 0
		for _, g := range timeSvc {
			for _, e := range g.raw {
				if afterBoot(evTime(e.T)) {
					atBoot++
				}
			}
		}
		if atBoot >= 2 {
			out = append(out, evCross{Sev: "warn", Title: "Heure perdue à chaque démarrage",
				Text:     "L'heure n'arrive pas à se synchroniser juste après le démarrage, à plusieurs reprises : si elle est fausse à l'allumage, la pile du BIOS (CR2032) est usée.",
				Evidence: []string{fmt.Sprintf("%d échec(s) de synchronisation au démarrage", atBoot)},
				Keys:     keys(timeSvc), Act: "timesync"})
		}
	}
	// réseau après la veille
	if len(nic) > 0 && len(wake) > 0 {
		if n := near(wake, nic, 5*time.Minute); n >= 2 {
			out = append(out, evCross{Sev: "warn", Title: "Réseau perdu après la veille",
				Text:     "La carte réseau décroche à la sortie de veille : décocher « Autoriser l'ordinateur à éteindre ce périphérique » dans ses propriétés et installer le pilote du fabricant.",
				Evidence: []string{fmt.Sprintf("%d sortie(s) de veille suivie(s) d'une erreur réseau", n)},
				Keys:     keys(nic, wake), Tool: "devmgmt"})
		}
	}
	// infection
	if len(threat) > 0 && (len(avOff) > 0 || len(newSvc) > 0) {
		ev := []string{plural(count(threat), "menace détectée", "menaces détectées")}
		if len(avOff) > 0 {
			ev = append(ev, "protection de l'antivirus coupée")
		}
		if len(newSvc) > 0 {
			ev = append(ev, plural(count(newSvc), "nouveau service installé", "nouveaux services installés"))
		}
		out = append(out, evCross{Sev: "crit", Title: "Infection possible",
			Text:     "Une menace a été détectée et, en plus, l'antivirus a été coupé ou un service a été installé : faire une analyse hors ligne de Microsoft Defender et un outil de désinfection, puis vérifier les services et les programmes au démarrage.",
			Evidence: ev, Keys: keys(threat, avOff, newSvc), Act: "defender", Tool: "defender"})
	}
	sort.SliceStable(out, func(i, j int) bool { return evSevOrder[out[i].Sev] < evSevOrder[out[j].Sev] })
	return out
}
