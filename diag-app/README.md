# PC2 Diag (application Windows)

Application Windows qui analyse un poste et envoie son rapport directement au
site de ticketing, sur un ticket ou en « diag rapide ». Elle reprend le
principe de `DiagnosticPC.exe` (Go + fenêtre WebView2 + collecte PowerShell),
avec en plus la liaison au site.

## Ce qu'elle relève

Système et BIOS, processeur, mémoire (barrettes), cartes graphiques,
températures, disques (santé, usure SSD, erreurs, heures), volumes et
BitLocker, batterie (usure, cycles), périphériques en erreur, cartes réseau,
écrans bleus et erreurs des 30 derniers jours, Windows Update, sécurité
(antivirus, pare-feu, Secure Boot, TPM, UAC, SMBv1, RDP), services,
programmes au démarrage, logiciels installés, intégrité DISM, accès réseau et
Internet. Les clés USB (bus USB) sont ignorées pour le diagnostic et
l'inventaire.

L'analyse produit des constats (critique, à surveiller, info), un état
global et un score de viabilité sur 100. La fiche inventaire (marque, modèle,
n° de série, OS, CPU, RAM, stockage) complète l'appareil du ticket comme le
Diag Atelier : seuls les champs vides sont remplis, les différences sont
signalées.

## Liaison avec le site

1. Sur le site, page **Diag rapide** › carte **Application PC2 Diag** ›
   **Créer une clé d'association**.
2. Lancer `PC2Diag.exe` sur le poste, puis cliquer sur **Associer
   l'application ouverte sur ce poste** (lien `pc2diag://pair…`), ou recopier
   l'adresse du site et la clé dans l'application.
3. Depuis un ticket, le bouton **Application** (carte Diagnostic) ouvre
   l'application déjà liée à ce ticket. Sinon, chercher le ticket dans
   l'application ou choisir **Diag rapide**.
4. **Lancer l'analyse** puis **Envoyer** : le rapport apparaît sur le ticket
   (ou dans Diag rapide) et s'ouvre en un clic.

La clé est stockée chiffrée (DPAPI, compte Windows courant) dans
`%APPDATA%\PC2Diag\config.json`. Une copie de chaque rapport est gardée dans
`%LOCALAPPDATA%\PC2Diag\rapports`. Une clé se révoque depuis la page Diag
rapide.

Au premier lancement, l'application enregistre le protocole `pc2diag://`
pour l'utilisateur courant et demande les droits administrateur (UAC),
nécessaires pour SMART, BitLocker et DISM. Si l'élévation est refusée,
l'analyse tourne quand même avec des relevés réduits.

## API utilisée

Préfixe `/api/diag-app`, en-tête `Authorization: Bearer <clé>` :

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| GET | `/me` | vérifie la clé, renvoie le technicien |
| GET | `/tickets?q=` | tickets ouverts (n°, titre, client) |
| GET | `/tickets/{id}` | un ticket |
| POST | `/diagnostics` | `{ ticket_id?, report, inventory }` |

Le rapport a le format `diag-app` et s'affiche sur le site par la vue
`resources/views/diagnostics/app-report.blade.php`.

## Compiler

Go 1.24 ou plus récent, depuis n'importe quel système :

```sh
./build.sh 1.0.0        # Linux, macOS, Git Bash
build.cmd 1.0.0         # invite de commandes Windows
```

Résultat : `dist/PC2Diag.exe`, un seul fichier sans installation. Il faut le
runtime WebView2 (présent sur Windows 10 et 11 à jour). Pour proposer le
téléchargement sur la page Diag rapide, copier l'exe dans
`public/downloads/PC2Diag.exe` sur le serveur.

Tests de l'analyse : `go test ./...`

L'exe n'est pas signé : Windows SmartScreen peut afficher un avertissement au
premier lancement (« Informations complémentaires » › « Exécuter quand
même »). Une signature de code le supprime.
