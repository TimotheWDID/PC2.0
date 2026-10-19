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

## Portable : rien n'est installé sur le PC du client

L'exe se lance depuis une clé USB, sans installation. Tout ce qu'il garde est
rangé **à côté de l'exe** :

- `PC2Diag-config.json` : adresse du site et clé d'accès ;
- `PC2Diag-rapports\` : une copie de chaque rapport (pour le renvoyer si le
  site était injoignable).

Sur le PC analysé, rien n'est écrit dans le registre ni dans le profil de
l'utilisateur. Le cache de la fenêtre et les fichiers de collecte vont dans
le dossier temporaire et sont effacés à la fermeture. Seule la demande de
droits administrateur (UAC) apparaît au lancement : ces droits servent à lire
l'état SMART, BitLocker et l'intégrité DISM. Si on refuse, l'analyse tourne
quand même avec des relevés réduits.

La clé d'accès est en clair dans `PC2Diag-config.json` : si la clé USB est
perdue, révoquez la clé depuis la page Diag rapide.

## Liaison avec le site

1. Sur le site, page **Diag rapide** › carte **Application PC2 Diag** ›
   **Créer une clé d'association**.
2. Dans l'application, saisir l'adresse du site et la clé, puis **Associer**
   (une seule fois par clé USB).
3. Chercher le ticket (n°, client ou titre) ou choisir **Diag rapide**.
4. **Lancer l'analyse** puis **Envoyer** : le rapport apparaît sur le ticket
   (ou dans Diag rapide) et s'ouvre en un clic.

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
