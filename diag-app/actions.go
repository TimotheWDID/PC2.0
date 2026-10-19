package main

// Réparations proposées dans l'onglet « Réparations ». Chaque action est une
// suite d'étapes : un programme Windows (sfc, dism, chkdsk…) ou un script
// PowerShell. Leur sortie est affichée en direct dans l'interface.

type Step struct {
	Label   string
	Exe     string   // programme de System32, ou vide pour un script PowerShell
	Args    []string // %SystemDrive% est remplacé par le lecteur système
	PS      string
	Soft    bool  // un échec de cette étape n'arrête pas l'action
	OKCodes []int // codes de sortie considérés comme réussis (défaut : 0)
}

type Action struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Group    string `json:"group"`
	Duration string `json:"duration"`
	Desc     string `json:"desc"`
	Risk     string `json:"risk,omitempty"`
	Reboot   bool   `json:"reboot"`
	Steps    []Step `json:"-"`
}

const psPrelude = `try{[Console]::OutputEncoding=[Text.Encoding]::UTF8}catch{};$ErrorActionPreference='Continue';$ProgressPreference='SilentlyContinue';`

func findAction(id string) *Action {
	for i := range Actions {
		if Actions[i].ID == id {
			return &Actions[i]
		}
	}
	return nil
}

var Actions = []Action{
	{
		ID: "restore", Title: "Point de restauration", Group: "Avant de commencer", Duration: "1 min",
		Desc:  "Photo de l'état actuel de Windows, à faire avant toute réparation. Windows n'en accepte qu'un par 24 h.",
		Steps: []Step{{Label: "Création du point de restauration", PS: `Enable-ComputerRestore -Drive "$env:SystemDrive\" ; Checkpoint-Computer -Description 'PC2 Diag - avant reparation' -RestorePointType MODIFY_SETTINGS -WarningVariable w; if($w){Write-Output "Windows a refusé : un point de restauration existe déjà depuis moins de 24 h."} else {Write-Output 'Point de restauration créé.'}`}},
	},
	{
		ID: "dism", Title: "Réparer l'image Windows (DISM)", Group: "Réparer Windows", Duration: "10 à 20 min",
		Desc:  "Télécharge depuis Windows Update les fichiers système endommagés. À lancer avant SFC. Connexion Internet requise.",
		Steps: []Step{{Label: "DISM RestoreHealth", Exe: "dism.exe", Args: []string{"/Online", "/Cleanup-Image", "/RestoreHealth"}, OKCodes: []int{0, 3010}}},
	},
	{
		ID: "sfc", Title: "Vérifier les fichiers système (SFC)", Group: "Réparer Windows", Duration: "10 à 15 min",
		Desc:  "Contrôle et remplace les fichiers système modifiés ou corrompus.",
		Steps: []Step{{Label: "sfc /scannow", Exe: "sfc.exe", Args: []string{"/scannow"}}},
	},
	{
		ID: "chkdsk", Title: "Analyser le disque C: (en ligne)", Group: "Disque et nettoyage", Duration: "2 à 10 min",
		Desc:  "Recherche les erreurs du système de fichiers sans bloquer le PC.",
		Steps: []Step{{Label: "chkdsk /scan", Exe: "chkdsk.exe", Args: []string{"%SystemDrive%", "/scan"}, OKCodes: []int{0, 1, 2}}},
	},
	{
		ID: "chkdskboot", Title: "Réparer le disque C: au redémarrage", Group: "Disque et nettoyage", Duration: "Au redémarrage", Reboot: true,
		Desc: "Marque C: pour une vérification complète (chkdsk /f) au prochain démarrage. Le démarrage sera plus long.",
		Steps: []Step{{Label: "Programmation de la vérification", PS: `fsutil dirty set $env:SystemDrive | Write-Output
if($LASTEXITCODE -eq 0){ Write-Output 'Vérification programmée : elle se lancera au prochain démarrage.' } else { exit 1 }`}},
	},
	{
		ID: "cleanup", Title: "Nettoyer les fichiers temporaires", Group: "Disque et nettoyage", Duration: "2 à 10 min",
		Desc: "Vide les dossiers temporaires (fichiers de plus de 24 h), le cache de téléchargement Windows Update, puis compacte le magasin de composants Windows.",
		Steps: []Step{
			{Label: "Nettoyage des dossiers temporaires", PS: `$p=@($env:TEMP,"$env:windir\Temp"); $sd="$env:windir\SoftwareDistribution\Download"
function Sz($d){ (Get-ChildItem $d -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum }
$before=0; foreach($d in $p+$sd){ $before+= [double](Sz $d) }
$keep=@(); if($env:PC2DIAG_EXE){ $keep += [IO.Path]::GetFullPath($env:PC2DIAG_EXE).ToLower() }
function Protected($f){ if((Split-Path $f -Leaf) -like 'pc2diag*'){ return $true }; $x=$f.ToLower().TrimEnd('\'); foreach($k in $keep){ if($k -eq $x -or $k.StartsWith($x + '\') -or $x.StartsWith($k)){ return $true } }; $false }
foreach($d in $p){ Write-Output "Nettoyage de $d"; Get-ChildItem $d -Force -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-1) -and -not (Protected $_.FullName) } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }
Write-Output "Cache Windows Update"; Stop-Service wuauserv,bits -Force -ErrorAction SilentlyContinue
Get-ChildItem $sd -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Start-Service bits,wuauserv -ErrorAction SilentlyContinue
$after=0; foreach($d in $p+$sd){ $after+= [double](Sz $d) }
Write-Output ("Espace libéré : {0:N2} Go" -f (($before-$after)/1GB))`},
			{Label: "Compactage du magasin de composants", Exe: "dism.exe", Args: []string{"/Online", "/Cleanup-Image", "/StartComponentCleanup"}, Soft: true, OKCodes: []int{0, 3010}},
		},
	},
	{
		ID: "wureset", Title: "Réinitialiser Windows Update", Group: "Windows Update", Duration: "2 à 5 min",
		Desc: "Arrête les services, renomme les dossiers SoftwareDistribution et catroot2, redémarre les services et relance une recherche. Corrige la plupart des mises à jour bloquées.",
		Risk: "L'historique des mises à jour affiché sera vidé (les mises à jour installées restent).",
		Steps: []Step{
			{Label: "Réinitialisation des composants", PS: `$s='wuauserv','bits','cryptsvc','msiserver'
Write-Output 'Arrêt des services...'; Stop-Service $s -Force -ErrorAction SilentlyContinue
foreach($d in "$env:windir\SoftwareDistribution","$env:windir\System32\catroot2"){
  if(Test-Path "$d.old"){ Remove-Item "$d.old" -Recurse -Force -ErrorAction SilentlyContinue }
  if(Test-Path $d){ Rename-Item $d "$d.old" -ErrorAction SilentlyContinue; if(Test-Path "$d.old"){Write-Output "$d renommé"} else {Write-Output "Impossible de renommer $d"} } }
Write-Output 'Redémarrage des services...'; Start-Service $s -ErrorAction SilentlyContinue; Write-Output 'Terminé.'`},
			{Label: "Recherche de mises à jour", Exe: "UsoClient.exe", Args: []string{"StartScan"}, Soft: true},
		},
	},
	{
		ID: "wuenable", Title: "Réactiver Windows Update", Group: "Windows Update", Duration: "Immédiat",
		Desc:  "Remet le service wuauserv en démarrage manuel et le démarre.",
		Steps: []Step{{Label: "Réactivation du service", PS: `Set-Service wuauserv -StartupType Manual; Start-Service wuauserv; Write-Output ('Service Windows Update : ' + (Get-Service wuauserv).Status)`}},
	},
	{
		ID: "wuscan", Title: "Rechercher les mises à jour", Group: "Windows Update", Duration: "1 min",
		Desc: "Lance une recherche Windows Update et ouvre la page des mises à jour.",
		Steps: []Step{
			{Label: "Recherche de mises à jour", Exe: "UsoClient.exe", Args: []string{"StartScan"}, Soft: true},
			{Label: "Ouverture de Windows Update", PS: `Start-Process 'ms-settings:windowsupdate'; Write-Output 'Page Windows Update ouverte.'`, Soft: true},
		},
	},
	{
		ID: "netreset", Title: "Réinitialiser la pile réseau", Group: "Réseau", Duration: "1 min", Reboot: true,
		Desc: "Vide le cache DNS, renouvelle l'adresse IP, réinitialise Winsock et TCP/IP. Corrige les « connecté mais pas d'Internet ».",
		Risk: "La connexion est coupée quelques secondes (attention si vous êtes en prise en main à distance).",
		Steps: []Step{
			{Label: "Cache DNS", Exe: "ipconfig.exe", Args: []string{"/flushdns"}, Soft: true},
			{Label: "Libération de l'adresse IP", Exe: "ipconfig.exe", Args: []string{"/release"}, Soft: true},
			{Label: "Renouvellement de l'adresse IP", Exe: "ipconfig.exe", Args: []string{"/renew"}, Soft: true},
			{Label: "Réinitialisation de Winsock", Exe: "netsh.exe", Args: []string{"winsock", "reset"}},
			{Label: "Réinitialisation de TCP/IP", Exe: "netsh.exe", Args: []string{"int", "ip", "reset"}, Soft: true},
		},
	},
	{
		ID: "dnsflush", Title: "Vider le cache DNS", Group: "Réseau", Duration: "Immédiat",
		Desc:  "Utile quand un site ne s'affiche plus après un changement d'hébergement ou de box.",
		Steps: []Step{{Label: "Cache DNS", Exe: "ipconfig.exe", Args: []string{"/flushdns"}}},
	},
	{
		ID: "timesync", Title: "Synchroniser l'heure", Group: "Réseau", Duration: "Immédiat",
		Desc: "Une heure fausse provoque des erreurs de certificats (sites en erreur, Outlook, activation).",
		Steps: []Step{{Label: "Synchronisation", PS: `Set-Service w32time -StartupType Manual -ErrorAction SilentlyContinue; Start-Service w32time -ErrorAction SilentlyContinue
w32tm /resync /force | Write-Output
if($LASTEXITCODE -ne 0){
  Write-Output 'Nouvel essai avec time.windows.com...'
  w32tm /config /manualpeerlist:"time.windows.com,0x9" /syncfromflags:manual /update | Out-Null
  Restart-Service w32time -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2
  w32tm /resync /force | Write-Output }
Write-Output ('Heure du PC : ' + (Get-Date).ToString('dd/MM/yyyy HH:mm:ss'))`}},
	},
	{
		ID: "defender", Title: "Analyse antivirus rapide (Defender)", Group: "Sécurité", Duration: "5 à 15 min",
		Desc: "Télécharge les dernières définitions puis lance une analyse rapide.",
		Steps: []Step{{Label: "Analyse Defender", PS: `Write-Output 'Mise à jour des définitions...'; Update-MpSignature -ErrorAction Continue
Write-Output 'Analyse rapide en cours...'; Start-MpScan -ScanType QuickScan
$t=@(Get-MpThreatDetection -ErrorAction SilentlyContinue | Where-Object { $_.InitialDetectionTime -gt (Get-Date).AddHours(-1) })
if($t.Count){ Write-Output "$($t.Count) menace(s) détectée(s) : ouvrez Sécurité Windows pour les traiter." } else { Write-Output 'Aucune menace détectée.' }`}},
	},
	{
		ID: "firewall", Title: "Réactiver le pare-feu Windows", Group: "Sécurité", Duration: "Immédiat",
		Desc:  "Active le pare-feu sur les profils Domaine, Privé et Public.",
		Risk:  "À ne pas faire si un pare-feu tiers (antivirus payant) le remplace volontairement.",
		Steps: []Step{{Label: "Activation du pare-feu", Exe: "netsh.exe", Args: []string{"advfirewall", "set", "allprofiles", "state", "on"}}},
	},
	{
		ID: "smb1off", Title: "Désactiver SMBv1", Group: "Sécurité", Duration: "Immédiat",
		Desc:  "Coupe le protocole de partage obsolète exploité par WannaCry.",
		Risk:  "Un vieux NAS ou copieur qui ne parle que SMBv1 ne sera plus accessible.",
		Steps: []Step{{Label: "Désactivation de SMBv1", PS: `Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force; Write-Output 'SMBv1 désactivé côté serveur.'`}},
	},
	{
		ID: "memtest", Title: "Diagnostic de mémoire Windows", Group: "Matériel", Duration: "Au redémarrage",
		Desc:  "Ouvre le Diagnostic de mémoire Windows. Le test lui-même s'exécute AU REDÉMARRAGE (écran bleu avec barre de progression), pas dans cette fenêtre. Choisissez « Redémarrer maintenant » dans la fenêtre qui s'ouvre. Le résultat apparaît dans l'analyse suivante.",
		Risk:  "Enregistrez vos documents : le test demande un redémarrage.",
		Steps: []Step{{Label: "Ouverture du diagnostic mémoire", PS: `Start-Process "$env:windir\System32\mdsched.exe"; Write-Output "La fenêtre Windows est ouverte. Suivez-y les instructions (le test s'exécutera au redémarrage)."`}},
	},
	{
		ID: "batteryreset", Title: "Réinitialiser le pilote de batterie (ACPI)", Group: "Matériel", Duration: "1 min",
		Desc: "Supprime puis réinstalle les périphériques ACPI de batterie et d'adaptateur secteur. À essayer quand la batterie n'est plus reconnue (icône croix rouge, « aucune batterie détectée »).",
		Risk: "La charge peut sembler figée quelques secondes pendant la réinstallation. Ne débranchez pas le secteur.",
		Steps: []Step{{Label: "Réinstallation du pilote", PS: `$d=@(Get-PnpDevice -Class Battery -EA SilentlyContinue)
if($d.Count -eq 0){ Write-Output 'Aucun périphérique de classe Batterie dans Windows.' } else {
foreach($x in $d){ Write-Output ("Suppression : " + $x.FriendlyName); pnputil /remove-device $x.InstanceId 2>&1 | Out-Null }
Write-Output 'Nouvelle détection du matériel...'; pnputil /scan-devices 2>&1 | Out-Null
Start-Sleep -Seconds 2
$a=@(Get-PnpDevice -Class Battery -EA SilentlyContinue | Where-Object { $_.Status -eq 'OK' })
Write-Output ("Périphériques de batterie actifs après réinitialisation : " + $a.Count)
if($a.Count -gt 0){ Write-Output 'La batterie est de nouveau prise en charge par Windows.' } else { Write-Output 'Toujours rien : essayez le reset matériel (bouton Reset ou débrancher la batterie) selon la marque.' } }`}},
	},
}

// Script de lecture de la batterie pendant le test de décharge (valeurs en mWh, mW, mV).
const batteryPointPS = psPrelude + `
$s=@(Get-CimInstance -Namespace root/wmi -ClassName BatteryStatus -EA SilentlyContinue)
$b=@(Get-CimInstance Win32_Battery -EA SilentlyContinue)
if($s.Count -eq 0){ Write-Output '{}'; exit }
$rest=($s|Measure-Object RemainingCapacity -Sum).Sum
$disc=($s|Measure-Object DischargeRate -Sum).Sum
$chg=($s|Measure-Object ChargeRate -Sum).Sum
$rate = if($disc -and $disc -gt 0){ $disc } elseif($chg -and $chg -gt 0){ -$chg } else { 0 }
$pct=[int](($b|Measure-Object EstimatedChargeRemaining -Average).Average)
[pscustomobject]@{rest=[int]$rest;rate=[int]$rate;volt=[int]$s[0].Voltage;ac=[bool]$s[0].PowerOnline;pct=$pct} | ConvertTo-Json -Compress`
