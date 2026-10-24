package main

import (
	"encoding/json"
	"fmt"
	"path"
	"regexp"
	"sort"
	"strings"
	"time"
)

// Observateur d'événements simplifié : events.ps1 lit les erreurs et les
// avertissements des journaux Système et Application (et quelques jalons :
// démarrages, arrêts, mises à jour, antivirus). Ici, les événements sont
// regroupés (même source, même numéro, même application ou service), puis
// expliqués en français à partir de evKB. Ce qui n'est pas répertorié garde le
// message de Windows.

type evRaw struct {
	T     string          `json:"t"`
	Log   string          `json:"log"`
	Src   string          `json:"src"`
	ID    int             `json:"id"`
	Level int             `json:"lvl"`
	Msg   string          `json:"msg"`
	Props json.RawMessage `json:"p"`
}

// props : PowerShell écrit un tableau, mais une seule valeur peut sortir seule
func (e evRaw) props() []string {
	var out []string
	if json.Unmarshal(e.Props, &out) == nil {
		return out
	}
	var one string
	if json.Unmarshal(e.Props, &one) == nil && one != "" {
		return []string{one}
	}
	return nil
}

type evScanRaw struct {
	Days      int      `json:"days"`
	From      string   `json:"from"`
	To        string   `json:"to"`
	Admin     bool     `json:"admin"`
	Truncated []string `json:"truncated"`
	Errors    []string `json:"errors"`
	Seconds   float64  `json:"seconds"`
	Events    []evRaw  `json:"events"`
}

// evInfo : ce qu'on sait d'un événement, pour l'expliquer simplement.
type evInfo struct {
	Src     []string // sources (fournisseurs) ; « Netw* » : commence par
	IDs     []int    // vide : tous les numéros de la source
	Sev     string   // crit (grave), warn (à surveiller), info (pour information)
	Noise   bool     // sans gravité, masqué par défaut
	Cat     string
	Title   string
	Explain string
	Advice  string
	Subject int    // n° (à partir de 1) de la valeur qui distingue les groupes : application, service…
	SubjRe  string // ou expression dont le 1er groupe donne ce sujet, lue dans le message
	Detail  int    // n° de la valeur montrée dans la chronologie, sans faire un groupe à part
	Act     string // réparation proposée (actions.go)
	Tool    string // outil Windows proposé (runner_windows.go)
	Mark    string // jalon de la chronologie : boot, shutdown, restart, crash, bsod, update, updatefail, wake, threat, chkdsk
}

const (
	catStart   = "Démarrage et arrêts"
	catHW      = "Matériel"
	catDisk    = "Stockage"
	catDrivers = "Pilotes"
	catApps    = "Applications"
	catSvc     = "Services"
	catNet     = "Réseau"
	catUpd     = "Mises à jour"
	catSec     = "Sécurité"
	catSys     = "Système"
)

var evKB = []evInfo{
	// ---- démarrages et arrêts
	{Src: []string{"Microsoft-Windows-Kernel-Power"}, IDs: []int{41}, Sev: "crit", Cat: catStart, Mark: "crash",
		Title:   "Arrêt brutal du PC",
		Explain: "Le PC a redémarré sans s'être éteint proprement : coupure de courant, bouton d'alimentation maintenu, plantage complet ou extinction de sécurité (surchauffe, alimentation qui faiblit).",
		Advice:  "Demander au client s'il a forcé l'arrêt. Sinon, regarder s'il y a un écran bleu à la même heure, surveiller les températures et tester l'alimentation (ou la batterie et le chargeur sur un portable).",
		Tool:    "reliability"},
	{Src: []string{"EventLog"}, IDs: []int{6008}, Sev: "info", Cat: catStart,
		Title:   "L'arrêt précédent n'était pas prévu",
		Explain: "Au démarrage, Windows constate que la dernière extinction n'a pas été faite normalement. Va de pair avec l'« Arrêt brutal du PC ».",
		Advice:  "Voir l'arrêt brutal à la même heure."},
	{Src: []string{"EventLog"}, IDs: []int{6005}, Sev: "info", Cat: catStart, Mark: "boot",
		Title: "Démarrage de Windows", Explain: "Windows a démarré."},
	{Src: []string{"EventLog"}, IDs: []int{6006}, Sev: "info", Cat: catStart, Mark: "shutdown",
		Title: "Arrêt normal de Windows", Explain: "Windows s'est éteint proprement."},
	{Src: []string{"User32"}, IDs: []int{1074}, Sev: "info", Cat: catStart, Mark: "restart", Subject: 1,
		Title:   "Arrêt ou redémarrage demandé",
		Explain: "Un utilisateur ou un programme (Windows Update, un installeur…) a demandé l'arrêt ou le redémarrage du PC. Le programme à l'origine est indiqué."},
	{Src: []string{"Microsoft-Windows-Power-Troubleshooter"}, IDs: []int{1}, Sev: "info", Cat: catStart, Mark: "wake",
		Title: "Sortie de veille", Explain: "Le PC est sorti de veille ou de veille prolongée."},
	{Src: []string{"Microsoft-Windows-WER-SystemErrorReporting", "BugCheck"}, IDs: []int{1001}, Sev: "crit", Cat: catStart, Mark: "bsod",
		Title:   "Écran bleu (plantage de Windows)",
		Explain: "Windows s'est arrêté net sur un écran bleu puis a redémarré. Le code d'arrêt (BugCheck) indique la piste : pilote, mémoire, disque ou matériel.",
		Advice:  "Noter le code d'arrêt. Plusieurs écrans bleus aux codes différents font penser à la mémoire ou à l'alimentation ; toujours le même code, plutôt à un pilote. Lancer un diagnostic mémoire et mettre à jour les pilotes.",
		Act:     "memtest", Tool: "minidump"},
	{Src: []string{"volmgr"}, IDs: []int{45, 46, 49, 161, 162}, Sev: "info", Cat: catStart,
		Title:   "Fichier d'écran bleu impossible à créer",
		Explain: "Windows ne peut pas préparer le fichier qui garde la trace d'un écran bleu (fichier d'échange trop petit ou désactivé, disque plein). Sans gravité tant qu'il n'y a pas d'écran bleu.",
		Advice:  "Si le PC fait des écrans bleus, laisser Windows gérer la taille du fichier d'échange et libérer de la place sur C:."},

	// ---- matériel
	{Src: []string{"Microsoft-Windows-WHEA-Logger"}, IDs: []int{1, 17, 19, 47}, Sev: "warn", Cat: catHW,
		Title:   "Erreur matérielle corrigée",
		Explain: "Le processeur, la mémoire ou une carte (PCIe) a signalé une erreur que le matériel a pu corriger. Isolée, sans conséquence ; répétée, c'est le signe d'un composant fragile.",
		Advice:  "Si elle revient souvent : enlever tout overclocking ou profil XMP, mettre à jour le BIOS, lancer un diagnostic mémoire. Une erreur PCIe vise souvent la carte graphique ou le SSD NVMe.",
		Act:     "memtest"},
	{Src: []string{"Microsoft-Windows-WHEA-Logger"}, IDs: []int{18, 20, 46}, Sev: "crit", Cat: catHW,
		Title:   "Erreur matérielle grave",
		Explain: "Un composant (processeur, mémoire, carte mère, carte PCIe) a signalé une erreur que le matériel n'a pas pu corriger. Elle provoque en général un écran bleu WHEA_UNCORRECTABLE_ERROR.",
		Advice:  "Retirer tout overclocking ou profil XMP, vérifier les températures, tester la mémoire et l'alimentation, mettre à jour le BIOS.",
		Act:     "memtest"},
	{Src: []string{"Microsoft-Windows-Kernel-Processor-Power"}, IDs: []int{37}, Sev: "warn", Cat: catHW,
		Title:   "Processeur ralenti par le BIOS",
		Explain: "Le BIOS a limité la vitesse du processeur, souvent à cause de la chaleur ou d'une alimentation insuffisante (chargeur trop faible sur un portable).",
		Advice:  "Dépoussiérer, vérifier la pâte thermique et le ventilateur, utiliser le chargeur d'origine."},
	{Src: []string{"Microsoft-Windows-Resource-Exhaustion-Detector"}, IDs: []int{2004}, Sev: "warn", Cat: catHW,
		Title:   "Mémoire presque saturée",
		Explain: "Windows a manqué de mémoire. Le message cite les programmes qui en consommaient le plus.",
		Advice:  "Fermer ou désinstaller le programme gourmand, réduire les programmes au démarrage, ajouter de la RAM si cela revient.",
		Tool:    "resmon"},

	// ---- stockage
	{Src: []string{"disk", "Microsoft-Windows-Disk"}, IDs: []int{7}, Sev: "crit", Cat: catDisk,
		Title:   "Secteurs défectueux sur un disque",
		Explain: "Windows n'a pas pu lire une partie du disque : la surface ou la mémoire du disque s'abîme. Les fichiers à cet endroit peuvent être perdus.",
		Advice:  "Sauvegarder les données du client sans attendre, regarder la santé SMART du disque et prévoir son remplacement.",
		Act:     "chkdsk", Tool: "diskmgmt"},
	{Src: []string{"disk", "Microsoft-Windows-Disk", "atapi"}, IDs: []int{9, 11}, Sev: "warn", Cat: catDisk,
		Title:   "Erreur du contrôleur de disque",
		Explain: "La communication avec un disque a échoué : câble SATA ou nappe abîmé, port défaillant, disque qui faiblit, ou clé USB retirée trop tôt.",
		Advice:  "Si c'est un disque interne : changer le câble ou le port, puis surveiller. Si cela continue, sauvegarder et tester le disque.",
		Act:     "chkdsk"},
	{Src: []string{"disk", "Microsoft-Windows-Disk"}, IDs: []int{51, 153}, Sev: "warn", Cat: catDisk,
		Title:   "Lecture ou écriture du disque réessayée",
		Explain: "Windows a dû recommencer des lectures ou écritures sur un disque. Rare : sans conséquence. Fréquent : le disque, son câble ou son contrôleur fatigue (lenteurs, blocages).",
		Advice:  "Regarder la santé SMART du disque. Sur un SSD, mettre à jour son firmware et le pilote de stockage.",
		Act:     "chkdsk"},
	{Src: []string{"disk", "Microsoft-Windows-Disk"}, IDs: []int{157}, Sev: "info", Cat: catDisk,
		Title:   "Disque retiré",
		Explain: "Un disque a disparu en cours d'utilisation : en général une clé USB ou un disque externe débranché sans l'éjecter."},
	{Src: []string{"Ntfs", "Microsoft-Windows-Ntfs"}, IDs: []int{55, 98}, Sev: "crit", Cat: catDisk,
		Title:   "Système de fichiers endommagé",
		Explain: "La structure du disque (NTFS) est abîmée : des fichiers ou dossiers peuvent devenir illisibles. Arrive après des arrêts brutaux ou sur un disque qui faiblit.",
		Advice:  "Lancer une réparation du disque au redémarrage (chkdsk /f), puis vérifier la santé du disque.",
		Act:     "chkdskboot"},
	{Src: []string{"Ntfs", "Microsoft-Windows-Ntfs"}, IDs: []int{50, 57, 137, 140}, Sev: "warn", Cat: catDisk,
		Title:   "Écriture sur le disque perdue",
		Explain: "Windows n'a pas pu finir d'écrire des données sur un disque : disque débranché, en veille trop profonde ou qui ne répond plus.",
		Advice:  "Si c'est le disque interne : vérifier le disque et son câble, et lancer une vérification du disque.",
		Act:     "chkdsk"},
	{Src: []string{"storahci", "stornvme", "iaStorA", "iaStorAC", "iaStorAVC", "iaStorVD", "amdsata", "amd_sata", "nvstor", "storvsc"}, IDs: []int{129}, Sev: "warn", Cat: catDisk,
		Title:   "Contrôleur de stockage réinitialisé",
		Explain: "Un disque n'a pas répondu à temps et Windows a dû relancer le contrôleur. Cela se traduit par des blocages de quelques secondes.",
		Advice:  "Mettre à jour le firmware du SSD, le pilote de stockage (Intel RST, AMD) et le BIOS ; vérifier le câble. Si cela continue, tester le disque.",
		Act:     "chkdsk"},
	{Src: []string{"Microsoft-Windows-Wininit", "Wininit", "Chkdsk"}, IDs: []int{1001, 26212, 26214}, Sev: "info", Cat: catDisk, Mark: "chkdsk",
		Title:   "Vérification du disque (chkdsk)",
		Explain: "Résultat d'une vérification du disque. Le message dit si des erreurs ont été trouvées et corrigées."},

	// ---- pilotes
	{Src: []string{"Display"}, IDs: []int{4101}, Sev: "warn", Cat: catDrivers,
		Title:   "Le pilote graphique a planté puis est reparti",
		Explain: "L'écran a pu clignoter ou se figer quelques secondes : le pilote de la carte graphique a cessé de répondre et Windows l'a relancé.",
		Advice:  "Installer le dernier pilote du fabricant (NVIDIA, AMD, Intel ou celui du portable). Si cela continue, surveiller la température de la carte graphique.",
		Tool:    "devmgmt"},
	{Src: []string{"nvlddmkm"}, Sev: "warn", Cat: catDrivers,
		Title:   "Pilote graphique NVIDIA en erreur",
		Explain: "Le pilote de la carte graphique NVIDIA a signalé une erreur (souvent avec un écran figé ou noir quelques secondes).",
		Advice:  "Réinstaller proprement le dernier pilote NVIDIA, vérifier la température et l'alimentation de la carte.",
		Tool:    "devmgmt"},
	{Src: []string{"amdkmdag", "amdkmdap", "amdwddmg"}, Sev: "warn", Cat: catDrivers,
		Title:   "Pilote graphique AMD en erreur",
		Explain: "Le pilote de la carte graphique AMD a signalé une erreur (souvent avec un écran figé ou noir quelques secondes).",
		Advice:  "Réinstaller proprement le dernier pilote AMD, vérifier la température et l'alimentation de la carte.",
		Tool:    "devmgmt"},
	{Src: []string{"igfx", "igfxn", "igfxnd"}, Sev: "warn", Cat: catDrivers,
		Title:   "Pilote graphique Intel en erreur",
		Explain: "Le pilote de la puce graphique Intel a signalé une erreur.",
		Advice:  "Installer le pilote graphique proposé par le fabricant du PC ou par Intel.",
		Tool:    "devmgmt"},
	{Src: []string{"Microsoft-Windows-DriverFrameworks-UserMode"}, IDs: []int{10110, 10111}, Sev: "warn", Cat: catDrivers,
		Title:   "Pilote d'un périphérique planté",
		Explain: "Le pilote d'un périphérique (souvent USB : téléphone, imprimante, lecteur d'empreintes) a cessé de répondre.",
		Advice:  "Débrancher puis rebrancher le périphérique, mettre à jour ou réinstaller son pilote.",
		Tool:    "devmgmt"},
	{Src: []string{"Microsoft-Windows-Kernel-PnP"}, IDs: []int{219}, Sev: "info", Cat: catDrivers,
		Title:   "Pilote non chargé au démarrage",
		Explain: "Un pilote n'a pas pu se charger au démarrage. Très fréquent et le plus souvent sans conséquence ; ne compte que si un périphérique ne marche pas.",
		Tool:    "devmgmt"},
	{Src: []string{"Microsoft-Windows-Kernel-PnP"}, IDs: []int{411, 441, 442}, Sev: "warn", Cat: catDrivers,
		Title:   "Périphérique qui ne démarre pas",
		Explain: "Windows n'a pas pu démarrer un périphérique (pilote absent, abîmé ou incompatible).",
		Advice:  "Ouvrir le Gestionnaire de périphériques et réinstaller le pilote du périphérique marqué en erreur.",
		Tool:    "devmgmt"},

	// ---- applications
	{Src: []string{"Application Error"}, IDs: []int{1000}, Sev: "warn", Cat: catApps, Subject: 1,
		Title:   "Une application a planté",
		Explain: "Le programme s'est fermé d'un coup. Une fois, c'est sans importance ; s'il plante souvent, il est abîmé, pas à jour ou gêné par un autre logiciel.",
		Advice:  "Mettre à jour ou réinstaller le programme. Si beaucoup d'applications différentes plantent, vérifier les fichiers système (SFC) et la mémoire.",
		Act:     "sfc"},
	{Src: []string{"Application Hang"}, IDs: []int{1002}, Sev: "warn", Cat: catApps, Subject: 1,
		Title:   "Une application s'est figée",
		Explain: "Le programme ne répondait plus et a été fermé (par l'utilisateur ou par Windows).",
		Advice:  "Mettre à jour le programme. Si plusieurs programmes se figent, penser au disque (lenteurs) ou au manque de mémoire."},
	{Src: []string{".NET Runtime"}, IDs: []int{1023, 1025, 1026}, Sev: "warn", Cat: catApps, SubjRe: `(?i)Application\s*:\s*(\S+)`,
		Title:   "Une application .NET a planté",
		Explain: "Un programme écrit en .NET s'est fermé sur une erreur.",
		Advice:  "Mettre à jour ou réinstaller le programme, et installer les mises à jour .NET par Windows Update."},
	{Src: []string{"SideBySide"}, Sev: "warn", Cat: catApps,
		Title:   "Composant Visual C++ manquant ou abîmé",
		Explain: "Un programme n'a pas pu démarrer parce qu'une bibliothèque Microsoft Visual C++ dont il a besoin manque ou est abîmée.",
		Advice:  "Réinstaller les « Microsoft Visual C++ Redistributable » (x86 et x64), puis le programme concerné."},
	{Src: []string{"MsiInstaller"}, IDs: []int{1024, 11708}, Sev: "warn", Cat: catApps,
		Title:   "Installation d'un logiciel échouée",
		Explain: "L'installation ou la mise à jour d'un logiciel n'a pas abouti.",
		Advice:  "Relancer l'installation en administrateur, après un redémarrage."},

	// ---- services
	{Src: []string{"Service Control Manager"}, IDs: []int{7000, 7009, 7022}, Sev: "warn", Cat: catSvc, Subject: 1,
		Title:   "Un service n'a pas pu démarrer",
		Explain: "Un service Windows (programme qui tourne en arrière-plan) n'a pas démarré. Cela compte s'il est utile (réseau, son, impression, antivirus) ; un service d'un logiciel désinstallé ne gêne pas.",
		Advice:  "Si le service est utile, regarder son état dans Services et réinstaller le logiciel qui l'a installé.",
		Tool:    "services"},
	{Src: []string{"Service Control Manager"}, IDs: []int{7023, 7024, 7031, 7034}, Sev: "warn", Cat: catSvc, Subject: 1,
		Title:   "Un service s'est arrêté sur une erreur",
		Explain: "Un service Windows s'est arrêté de façon inattendue. Windows le relance souvent tout seul ; s'il revient souvent, le logiciel ou Windows est abîmé.",
		Advice:  "Si c'est un service de Windows, vérifier les fichiers système (DISM puis SFC). Sinon, mettre à jour ou réinstaller le logiciel concerné.",
		Tool:    "services", Act: "dism"},
	{Src: []string{"Service Control Manager"}, IDs: []int{7001, 7003}, Sev: "info", Cat: catSvc, Subject: 1,
		Title:   "Service non démarré à cause d'un autre",
		Explain: "Ce service attend un autre service qui n'a pas démarré. La cause est l'autre service.", Tool: "services"},
	{Src: []string{"Service Control Manager"}, IDs: []int{7011, 7043}, Sev: "info", Cat: catSvc, Noise: true,
		Title:   "Service trop lent à répondre",
		Explain: "Un service a mis du temps à répondre à Windows. Fréquent juste après le démarrage, sans conséquence en général."},
	{Src: []string{"Service Control Manager"}, IDs: []int{7038}, Sev: "warn", Cat: catSvc, Subject: 1,
		Title:   "Service : connexion refusée",
		Explain: "Un service n'a pas pu s'ouvrir avec son compte (mot de passe changé ou compte supprimé).", Tool: "services"},
	{Src: []string{"Service Control Manager"}, IDs: []int{7045}, Sev: "info", Cat: catSec, Subject: 1,
		Title:   "Nouveau service installé",
		Explain: "Un logiciel a installé un service (programme qui démarre avec Windows). Normal lors d'une installation ; à vérifier si le nom est inconnu ou étrange.",
		Tool:    "services"},

	// ---- réseau
	{Src: []string{"Microsoft-Windows-DNS-Client"}, IDs: []int{1014}, Sev: "info", Cat: catNet,
		Title:   "Nom de site non résolu à temps (DNS)",
		Explain: "Le PC n'a pas trouvé l'adresse d'un site à temps. Quelques fois : sans importance. Souvent : connexion instable ou serveur DNS de la box en difficulté.",
		Advice:  "Vider le cache DNS ; si les pages chargent mal, redémarrer la box ou changer de DNS.",
		Act:     "dnsflush"},
	{Src: []string{"Microsoft-Windows-Dhcp-Client"}, IDs: []int{1001, 1002, 1003}, Sev: "warn", Cat: catNet,
		Title:   "Adresse réseau non obtenue (DHCP)",
		Explain: "Le PC n'a pas reçu d'adresse de la box : pas d'accès à Internet à ce moment-là.",
		Advice:  "Redémarrer la box, vérifier le câble ou le Wi-Fi ; si cela persiste, réinitialiser la pile réseau.",
		Act:     "netreset"},
	{Src: []string{"Tcpip"}, IDs: []int{4199}, Sev: "warn", Cat: catNet,
		Title:   "Conflit d'adresse IP",
		Explain: "Un autre appareil du réseau utilise la même adresse que ce PC.",
		Advice:  "Repasser la carte réseau en adresse automatique (DHCP) ou redémarrer la box.",
		Act:     "netreset"},
	{Src: []string{"Microsoft-Windows-NDIS"}, Sev: "warn", Cat: catNet,
		Title:   "Carte réseau relancée",
		Explain: "La carte réseau ne répondait plus et Windows l'a relancée : coupures de connexion.",
		Advice:  "Mettre à jour le pilote de la carte réseau.", Tool: "devmgmt"},
	{Src: []string{"Netw*", "rtwlan*", "rt640*", "rtcx*", "e1*express", "e2*express", "athw*", "Qcamain*", "bcmwl*", "mrvl*", "b57nd*"}, Sev: "warn", Cat: catNet,
		Title:   "Pilote de la carte réseau en erreur",
		Explain: "Le pilote de la carte Wi-Fi ou Ethernet signale une erreur ou une déconnexion : coupures, Wi-Fi qui décroche.",
		Advice:  "Installer le dernier pilote de la carte réseau (site du fabricant du PC ou de la carte) ; désactiver l'économie d'énergie de la carte.",
		Act:     "netreset", Tool: "devmgmt"},
	{Src: []string{"Microsoft-Windows-Time-Service"}, IDs: []int{36, 47, 129, 134, 50}, Sev: "warn", Cat: catNet,
		Title:   "Heure impossible à synchroniser",
		Explain: "Windows n'a pas pu remettre l'horloge à l'heure par Internet. Une heure fausse provoque des erreurs de certificats et des sites qui refusent de s'ouvrir.",
		Advice:  "Synchroniser l'heure ; si elle se dérègle après chaque arrêt, changer la pile du BIOS.",
		Act:     "timesync"},
	{Src: []string{"Microsoft-Windows-GroupPolicy"}, IDs: []int{1053, 1055, 1129}, Sev: "info", Cat: catNet,
		Title:   "Domaine de l'entreprise injoignable",
		Explain: "Le PC est relié au domaine d'une entreprise et n'a pas pu le joindre (hors du réseau de l'entreprise, c'est normal)."},
	{Src: []string{"NETLOGON"}, IDs: []int{3095, 5719}, Sev: "info", Cat: catNet, Noise: true,
		Title: "Domaine injoignable", Explain: "Le PC n'a pas pu joindre le domaine de l'entreprise. Normal hors du réseau de l'entreprise."},
	{Src: []string{"Schannel"}, Sev: "info", Cat: catNet, Noise: true,
		Title:   "Connexion sécurisée refusée (sans gravité)",
		Explain: "Une connexion chiffrée (TLS) vers un site ou un service n'a pas abouti. Très courant et sans conséquence pour l'utilisateur."},
	{Src: []string{"Microsoft-Windows-Iphlpsvc"}, Sev: "info", Cat: catNet, Noise: true,
		Title: "Service IPv6 de transition (sans gravité)", Explain: "Messages du service IPv6 (Teredo, IP-HTTPS), sans effet sur la connexion."},

	// ---- mises à jour
	{Src: []string{"Microsoft-Windows-WindowsUpdateClient"}, IDs: []int{20}, Sev: "warn", Cat: catUpd, Mark: "updatefail", Subject: 2,
		Title:   "Mise à jour Windows échouée",
		Explain: "Windows n'a pas pu installer une mise à jour. Il réessaie en général tout seul ; si c'est toujours la même, Windows Update est bloqué.",
		Advice:  "Si l'échec se répète : réinitialiser Windows Update, réparer l'image Windows (DISM) et libérer de la place sur C:.",
		Act:     "wureset", Tool: "windowsupdate"},
	{Src: []string{"Microsoft-Windows-WindowsUpdateClient"}, IDs: []int{19}, Sev: "info", Cat: catUpd, Mark: "update", Detail: 1,
		Title: "Mise à jour installée", Explain: "Windows a installé une mise à jour."},
	{Src: []string{"Microsoft-Windows-WindowsUpdateClient"}, IDs: []int{16, 25, 31}, Sev: "warn", Cat: catUpd,
		Title:   "Recherche de mises à jour impossible",
		Explain: "Windows Update n'a pas pu joindre les serveurs de Microsoft ou rechercher les mises à jour.",
		Advice:  "Vérifier la connexion, puis réinitialiser Windows Update.", Act: "wureset"},
	{Src: []string{"Microsoft-Windows-TPM-WMI"}, IDs: []int{1796, 1801}, Sev: "warn", Cat: catSec,
		Title:   "Certificats Secure Boot à mettre à jour",
		Explain: "Les certificats du démarrage sécurisé (Secure Boot) doivent être renouvelés et Windows n'a pas pu le faire. Sans cela, le PC ne recevra plus certaines protections du démarrage.",
		Advice:  "Installer toutes les mises à jour Windows et le dernier BIOS du fabricant, puis redémarrer.",
		Tool:    "windowsupdate"},

	// ---- sécurité
	{Src: []string{"Microsoft-Windows-Windows Defender"}, IDs: []int{1116}, Sev: "crit", Cat: catSec, Mark: "threat",
		Title:   "Menace détectée par l'antivirus",
		Explain: "Microsoft Defender a trouvé un programme malveillant ou indésirable. Le message donne son nom et son emplacement.",
		Advice:  "Vérifier qu'il a bien été supprimé ou mis en quarantaine, puis lancer une analyse complète.",
		Act:     "defender", Tool: "defender"},
	{Src: []string{"Microsoft-Windows-Windows Defender"}, IDs: []int{1117}, Sev: "info", Cat: catSec,
		Title: "Menace traitée par l'antivirus", Explain: "Microsoft Defender a supprimé ou mis en quarantaine une menace.", Tool: "defender"},
	{Src: []string{"Microsoft-Windows-Windows Defender"}, IDs: []int{1118, 1119}, Sev: "crit", Cat: catSec,
		Title:   "Menace que l'antivirus n'a pas pu traiter",
		Explain: "Microsoft Defender a trouvé une menace mais n'a pas réussi à la supprimer.",
		Advice:  "Lancer une analyse hors ligne de Microsoft Defender et un outil de désinfection.", Act: "defender", Tool: "defender"},
	{Src: []string{"Microsoft-Windows-Windows Defender"}, IDs: []int{2001}, Sev: "warn", Cat: catSec,
		Title: "Mise à jour de l'antivirus échouée", Explain: "Microsoft Defender n'a pas pu mettre à jour ses définitions de virus.",
		Advice: "Vérifier la connexion et Windows Update.", Tool: "defender"},
	{Src: []string{"Microsoft-Windows-Windows Defender"}, IDs: []int{3002, 5001, 5008}, Sev: "warn", Cat: catSec,
		Title:   "Protection de l'antivirus coupée ou en panne",
		Explain: "La protection en temps réel de Microsoft Defender a été désactivée ou s'est arrêtée. Normal si un autre antivirus est installé.",
		Advice:  "Si aucun autre antivirus n'est installé, réactiver la protection dans Sécurité Windows.", Tool: "defender"},
	{Src: []string{"Microsoft-Windows-Security-SPP"}, IDs: []int{1058, 8198, 8200, 8230}, Sev: "warn", Cat: catSys,
		Title:   "Activation de Windows impossible",
		Explain: "Windows n'a pas pu vérifier ou renouveler sa licence (souvent faute d'Internet, ou licence absente).",
		Advice:  "Vérifier l'état d'activation dans Paramètres › Système › Activation."},

	// ---- système
	{Src: []string{"Microsoft-Windows-User Profiles Service"}, IDs: []int{1511, 1515}, Sev: "crit", Cat: catSys,
		Title:   "Session ouverte avec un profil temporaire",
		Explain: "Le profil de l'utilisateur n'a pas pu être chargé : il a eu un bureau vide, sans ses fichiers ni ses réglages, et ce qu'il fait n'est pas gardé.",
		Advice:  "Ne pas laisser le client travailler ainsi. Réparer le profil (registre ProfileList) ou créer un nouveau compte et y recopier ses données."},
	{Src: []string{"Microsoft-Windows-User Profiles Service"}, IDs: []int{1500, 1502, 1508}, Sev: "warn", Cat: catSys,
		Title:   "Profil utilisateur impossible à charger",
		Explain: "Windows n'a pas pu charger le profil d'un utilisateur à l'ouverture de session (fichier du profil abîmé ou bloqué).",
		Advice:  "Vérifier les fichiers système et le disque ; si le profil reste abîmé, créer un nouveau compte."},
	{Src: []string{"Microsoft-Windows-User Profiles Service"}, IDs: []int{1530, 1534}, Sev: "info", Cat: catSys, Noise: true,
		Title: "Profil encore utilisé à la fermeture de session (sans gravité)", Explain: "Un programme gardait le profil ouvert à la déconnexion ; Windows s'en occupe tout seul."},
	{Src: []string{"VSS"}, IDs: []int{8193, 8194, 12289, 12293, 13, 8229}, Sev: "warn", Cat: catSys,
		Title:   "Points de restauration en erreur",
		Explain: "Le service des clichés instantanés (points de restauration, sauvegardes) a rencontré une erreur. Les sauvegardes ou les points de restauration peuvent échouer.",
		Advice:  "Créer un point de restauration pour vérifier qu'il aboutit ; sinon vérifier l'espace libre et les fichiers système.",
		Act:     "restore"},
	{Src: []string{"Microsoft-Windows-DistributedCOM"}, Sev: "info", Cat: catSys, Noise: true,
		Title:   "Message interne de Windows (DCOM, sans gravité)",
		Explain: "Messages de permissions ou de délai entre composants de Windows. Présents sur presque tous les PC, sans conséquence : inutile de les corriger."},
	{Src: []string{"Microsoft-Windows-Kernel-EventTracing"}, Sev: "info", Cat: catSys, Noise: true,
		Title: "Journal de traçage interne (sans gravité)", Explain: "Un journal de suivi interne de Windows n'a pas pu démarrer. Sans conséquence."},
	{Src: []string{"Microsoft-Windows-Perflib", "Perflib", "PerfNet", "PerfOS", "PerfDisk", "PerfProc", "LoadPerf"}, Sev: "info", Cat: catSys, Noise: true,
		Title: "Compteurs de performance (sans gravité)", Explain: "Les compteurs qui mesurent les performances d'un composant n'ont pas pu se charger. Sans effet pour l'utilisateur."},
	{Src: []string{"ESENT"}, Sev: "info", Cat: catSys, Noise: true,
		Title: "Base de données interne de Windows (sans gravité)", Explain: "Messages des petites bases de données de Windows (recherche, mises à jour). Sans conséquence en général."},
	{Src: []string{"Microsoft-Windows-CAPI2"}, Sev: "info", Cat: catSys, Noise: true,
		Title: "Certificats (sans gravité)", Explain: "Messages sur les certificats de sécurité de Windows. Sans conséquence en général."},
	{Src: []string{"Microsoft-Windows-WMI"}, IDs: []int{10}, Sev: "info", Cat: catSys, Noise: true,
		Title: "Requête interne WMI invalide (sans gravité)", Explain: "Un programme a fait une demande mal formée à WMI. Sans conséquence."},
	{Src: []string{"Microsoft-Windows-Search"}, Sev: "info", Cat: catSys, Noise: true,
		Title: "Indexation de la recherche (sans gravité)", Explain: "Messages de l'indexation des fichiers pour la recherche Windows."},
	{Src: []string{"Microsoft-Windows-RestartManager"}, Sev: "info", Cat: catSys, Noise: true,
		Title: "Programme non fermé pendant une installation", Explain: "Un installeur n'a pas pu fermer un programme ouvert. Sans conséquence."},
	{Src: []string{"Microsoft-Windows-DeviceSetupManager"}, Sev: "info", Cat: catDrivers, Noise: true,
		Title: "Recherche d'informations de pilotes en ligne (sans gravité)", Explain: "Windows n'a pas pu télécharger les informations d'un périphérique. Sans conséquence."},
	{Src: []string{"Microsoft-Windows-AppModel-Runtime", "Microsoft-Windows-AppReadiness"}, Sev: "info", Cat: catApps, Noise: true,
		Title: "Applications du Microsoft Store (sans gravité)", Explain: "Messages internes des applications du Store."},
	{Src: []string{"edgeupdate", "gupdate", "MicrosoftEdgeUpdate", "GoogleUpdate*"}, Sev: "info", Cat: catApps, Noise: true,
		Title: "Mise à jour du navigateur (sans gravité)", Explain: "Le service de mise à jour d'Edge ou de Chrome n'a pas pu faire sa vérification. Il réessaiera."},
	{Src: []string{"Microsoft-Windows-Kernel-Power"}, IDs: []int{137, 125}, Sev: "info", Cat: catSys, Noise: true,
		Title: "Avertissement du BIOS (ACPI, sans gravité)", Explain: "Message du BIOS sur la gestion de l'énergie, courant et sans conséquence."},
	{Src: []string{"LsaSrv"}, IDs: []int{6038}, Sev: "info", Cat: catSec, Noise: true,
		Title: "Ancienne authentification NTLM (sans gravité)", Explain: "Rappel de Microsoft sur un ancien mode d'authentification, sans conséquence chez un particulier."},
}

func evSrcMatch(pat, src string) bool {
	if strings.HasSuffix(pat, "*") {
		return len(src) >= len(pat)-1 && strings.EqualFold(src[:len(pat)-1], pat[:len(pat)-1])
	}
	if i := strings.Index(pat, "*"); i > 0 { // e1*express
		lo, ls := strings.ToLower(pat), strings.ToLower(src)
		return strings.HasPrefix(ls, lo[:i]) && strings.HasSuffix(ls, lo[i+1:]) && len(ls) > len(lo)-1
	}
	return strings.EqualFold(pat, src)
}

// evLookup : ce qu'on sait d'un événement (nil s'il n'est pas répertorié).
func evLookup(src string, id int) *evInfo {
	for i := range evKB {
		k := &evKB[i]
		okSrc := false
		for _, s := range k.Src {
			if evSrcMatch(s, src) {
				okSrc = true
				break
			}
		}
		if !okSrc {
			continue
		}
		if len(k.IDs) == 0 {
			return k
		}
		for _, x := range k.IDs {
			if x == id {
				return k
			}
		}
	}
	return nil
}

// evGuessCat : catégorie d'un événement non répertorié, d'après sa source.
func evGuessCat(log, src string) string {
	s := strings.ToLower(src)
	switch {
	case strings.Contains(s, "disk") || strings.Contains(s, "ntfs") || strings.Contains(s, "stor") || strings.Contains(s, "volsnap") || strings.Contains(s, "partmgr"):
		return catDisk
	case strings.Contains(s, "display") || strings.Contains(s, "nvlddmkm") || strings.Contains(s, "amdkm") || strings.Contains(s, "igfx") || strings.Contains(s, "pnp") || strings.Contains(s, "driver"):
		return catDrivers
	case strings.Contains(s, "tcpip") || strings.Contains(s, "dns") || strings.Contains(s, "dhcp") || strings.Contains(s, "wlan") || strings.Contains(s, "ndis") || strings.Contains(s, "netbt") || strings.Contains(s, "network"):
		return catNet
	case strings.Contains(s, "update") || strings.Contains(s, "servicing"):
		return catUpd
	case strings.Contains(s, "defender") || strings.Contains(s, "security") || strings.Contains(s, "firewall"):
		return catSec
	case strings.Contains(s, "whea") || strings.Contains(s, "kernel-power") || strings.Contains(s, "acpi") || strings.Contains(s, "processor"):
		return catHW
	case src == "Service Control Manager":
		return catSvc
	case strings.EqualFold(log, "Application"):
		return catApps
	}
	return catSys
}

var evLevelSev = map[int]string{1: "crit", 2: "warn", 3: "info"}

type evOcc struct {
	T   string `json:"t"`
	Msg string `json:"msg,omitempty"`
}

type evGroup struct {
	Key      string   `json:"key"`
	Log      string   `json:"log"`
	Src      string   `json:"src"`
	ID       int      `json:"id"`
	Subject  string   `json:"subject,omitempty"`
	Level    int      `json:"level"` // niveau Windows le plus grave : 1 critique, 2 erreur, 3 avertissement, 4 information
	Sev      string   `json:"sev"`
	Noise    bool     `json:"noise,omitempty"`
	Known    bool     `json:"known"`
	Cat      string   `json:"cat"`
	Title    string   `json:"title"`
	Explain  string   `json:"explain,omitempty"`
	Advice   string   `json:"advice,omitempty"`
	Act      string   `json:"act,omitempty"`
	Tool     string   `json:"tool,omitempty"`
	Count    int      `json:"count"`
	First    string   `json:"first"`
	Last     string   `json:"last"`
	Times    []string `json:"times"`    // les plus récentes d'abord, evMaxTimes au plus
	Messages []evOcc  `json:"messages"` // messages différents, les plus récents d'abord
	Days     []string `json:"days"`     // jours (AAAA-MM-JJ, heure locale) où il apparaît
}

type evMark struct {
	T      string `json:"t"`
	Kind   string `json:"kind"`
	Title  string `json:"title"`
	Detail string `json:"detail,omitempty"`
	Key    string `json:"key"`
}

type evDay struct {
	Date string `json:"date"`
	Crit int    `json:"crit"`
	Warn int    `json:"warn"`
	Info int    `json:"info"`
}

type evResult struct {
	Days      int       `json:"days"`
	From      string    `json:"from"`
	To        string    `json:"to"`
	Admin     bool      `json:"admin"`
	Truncated []string  `json:"truncated,omitempty"`
	Errors    []string  `json:"errors,omitempty"`
	Seconds   float64   `json:"seconds"`
	Total     int       `json:"total"`
	Counts    evCounts  `json:"counts"`
	Groups    []evGroup `json:"groups"`
	Timeline  []evMark  `json:"timeline"`
	Daily     []evDay   `json:"daily"`
}

type evCounts struct {
	Crit  int `json:"crit"`
	Warn  int `json:"warn"`
	Info  int `json:"info"`
	Noise int `json:"noise"`
}

const (
	evMaxTimes    = 60
	evMaxMessages = 3
	evMaxTimeline = 150
)

var evSevOrder = map[string]int{"crit": 0, "warn": 1, "info": 2}

var (
	evPathRe = regexp.MustCompile(`^[A-Za-z]:\\`)
	evHostRe = regexp.MustCompile(`\s+\([^)]*\)$`)
)

// expressions des sujets, compilées une fois
var evRe = func() map[string]*regexp.Regexp {
	m := map[string]*regexp.Regexp{}
	for _, k := range evKB {
		if k.SubjRe != "" {
			m[k.SubjRe] = regexp.MustCompile(k.SubjRe)
		}
	}
	return m
}()

func evSubject(k *evInfo, e evRaw) string {
	s := ""
	if k.Subject > 0 {
		if p := e.props(); len(p) >= k.Subject {
			s = p[k.Subject-1]
		}
	} else if k.SubjRe != "" {
		if m := evRe[k.SubjRe].FindStringSubmatch(e.Msg); m != nil {
			s = m[1]
		}
	}
	s = strings.TrimSpace(s)
	if evPathRe.MatchString(s) { // C:\Windows\System32\winlogon.exe (PC) : winlogon.exe
		s = evHostRe.ReplaceAllString(path.Base(strings.ReplaceAll(s, `\`, "/")), "")
	}
	if r := []rune(s); len(r) > 120 {
		s = string(r[:120]) + "…"
	}
	return s
}

// evFirstLine : la première phrase utile d'un message, pour la chronologie.
func evFirstLine(msg string) string {
	msg = strings.TrimSpace(msg)
	if i := strings.IndexAny(msg, "\r\n"); i > 0 {
		msg = msg[:i]
	}
	if r := []rune(msg); len(r) > 160 {
		msg = string(r[:157]) + "…"
	}
	return msg
}

// groupEvents regroupe et explique les événements lus par events.ps1. loc :
// fuseau des jours de l'histogramme (celui du PC).
func groupEvents(raw evScanRaw, loc *time.Location) evResult {
	res := evResult{Days: raw.Days, From: raw.From, To: raw.To, Admin: raw.Admin, Truncated: raw.Truncated, Errors: raw.Errors, Seconds: raw.Seconds,
		Groups: []evGroup{}, Timeline: []evMark{}, Daily: []evDay{}}
	evs := append([]evRaw(nil), raw.Events...)
	sort.SliceStable(evs, func(i, j int) bool { return evs[i].T > evs[j].T })

	idx := map[string]int{}
	daily := map[string]*evDay{}
	for _, e := range evs {
		k := evLookup(e.Src, e.ID)
		if k == nil && (e.Level < 1 || e.Level > 3) {
			continue // information non répertoriée (jalons d'une autre source)
		}
		subject := ""
		if k != nil {
			subject = evSubject(k, e)
		}
		key := e.Log + "|" + e.Src + "|" + fmt.Sprint(e.ID) + "|" + strings.ToLower(subject)
		i, ok := idx[key]
		if !ok {
			g := evGroup{Key: key, Log: e.Log, Src: e.Src, ID: e.ID, Subject: subject, Level: e.Level, Times: []string{}, Messages: []evOcc{}, Days: []string{}}
			if g.Level < 1 || g.Level > 4 {
				g.Level = 4
			}
			if k != nil {
				g.Known, g.Sev, g.Noise, g.Cat, g.Title, g.Explain, g.Advice, g.Act, g.Tool = true, k.Sev, k.Noise, k.Cat, k.Title, k.Explain, k.Advice, k.Act, k.Tool
			} else {
				g.Sev, g.Cat = evLevelSev[e.Level], evGuessCat(e.Log, e.Src)
				g.Title = evShortSrc(e.Src) + " : événement " + fmt.Sprint(e.ID)
			}
			res.Groups = append(res.Groups, g)
			i = len(res.Groups) - 1
			idx[key] = i
		}
		g := &res.Groups[i]
		g.Count++
		if e.Level >= 1 && e.Level < g.Level {
			g.Level = e.Level
		}
		if g.Last == "" {
			g.Last = e.T
		}
		g.First = e.T
		if len(g.Times) < evMaxTimes {
			g.Times = append(g.Times, e.T)
		}
		if len(g.Messages) < evMaxMessages && e.Msg != "" {
			dup := false
			for _, m := range g.Messages {
				if m.Msg == e.Msg {
					dup = true
					break
				}
			}
			if !dup {
				g.Messages = append(g.Messages, evOcc{T: e.T, Msg: e.Msg})
			}
		}
		t, err := time.Parse(time.RFC3339Nano, e.T)
		day := ""
		if err == nil {
			day = t.In(loc).Format("2006-01-02")
			if n := len(g.Days); n == 0 || g.Days[n-1] != day {
				g.Days = append(g.Days, day)
			}
		}
		if !g.Noise && day != "" {
			d := daily[day]
			if d == nil {
				d = &evDay{Date: day}
				daily[day] = d
			}
			switch g.Sev {
			case "crit":
				d.Crit++
			case "warn":
				d.Warn++
			default:
				d.Info++
			}
		}
		if k != nil && k.Mark != "" && len(res.Timeline) < evMaxTimeline {
			m := evMark{T: e.T, Kind: k.Mark, Title: k.Title, Key: key}
			switch k.Mark {
			case "restart", "updatefail":
				m.Detail = subject
			case "update":
				if p := e.props(); len(p) >= k.Detail && k.Detail > 0 {
					m.Detail = p[k.Detail-1]
				}
			case "bsod", "threat", "chkdsk":
				m.Detail = evFirstLine(e.Msg)
			}
			res.Timeline = append(res.Timeline, m)
		}
	}
	res.Total = 0
	for i := range res.Groups {
		g := &res.Groups[i]
		res.Total += g.Count
		switch {
		case g.Noise:
			res.Counts.Noise += g.Count
		case g.Sev == "crit":
			res.Counts.Crit += g.Count
		case g.Sev == "warn":
			res.Counts.Warn += g.Count
		default:
			res.Counts.Info += g.Count
		}
	}
	sort.SliceStable(res.Groups, func(i, j int) bool {
		a, b := res.Groups[i], res.Groups[j]
		if a.Noise != b.Noise {
			return !a.Noise
		}
		if evSevOrder[a.Sev] != evSevOrder[b.Sev] {
			return evSevOrder[a.Sev] < evSevOrder[b.Sev]
		}
		return a.Last > b.Last
	})
	for _, d := range daily {
		res.Daily = append(res.Daily, *d)
	}
	sort.Slice(res.Daily, func(i, j int) bool { return res.Daily[i].Date < res.Daily[j].Date })
	return res
}

// evShortSrc : « Microsoft-Windows-Kernel-Power » devient « Kernel-Power ».
func evShortSrc(src string) string {
	if s := strings.TrimPrefix(src, "Microsoft-Windows-"); s != "" {
		return s
	}
	return src
}

var evSevLabel = map[string]string{"crit": "Grave", "warn": "À surveiller", "info": "Pour information"}

// csv : les groupes, pour un tableur (séparateur ; comme Excel en français).
func (r evResult) csv(loc *time.Location) string {
	var b strings.Builder
	b.WriteString("\ufeffGravité;Catégorie;Événement;Concerne;Nombre;Premier;Dernier;Journal;Source;ID;Explication;Que faire\r\n")
	f := func(s string) string {
		s = strings.NewReplacer("\r", " ", "\n", " ").Replace(s)
		if strings.ContainsAny(s, ";\"") {
			s = `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
		}
		return s
	}
	dt := func(s string) string {
		if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
			return t.In(loc).Format("02/01/2006 15:04")
		}
		return s
	}
	for _, g := range r.Groups {
		sev := evSevLabel[g.Sev]
		if g.Noise {
			sev = "Sans gravité"
		}
		fmt.Fprintf(&b, "%s;%s;%s;%s;%d;%s;%s;%s;%s;%d;%s;%s\r\n", f(sev), f(g.Cat), f(g.Title), f(g.Subject), g.Count, dt(g.First), dt(g.Last), f(g.Log), f(g.Src), g.ID, f(g.Explain), f(g.Advice))
	}
	return b.String()
}
