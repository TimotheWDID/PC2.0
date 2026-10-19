# PC2 Diag (application Windows)

Application Windows de diagnostic et de dépannage, reprise de `DiagnosticPC.exe`
(Go + fenêtre WebView2 + collecte PowerShell), avec en plus l'envoi du rapport
au site de ticketing, sur un ticket ou en « diag rapide ».

## Fonctions

- **Analyse** en lecture seule : système et BIOS, processeur, mémoire
  (barrettes), cartes graphiques et écrans, audio, températures, disques
  (santé, usure SSD, erreurs, heures), volumes et BitLocker, batterie (usure,
  cycles), périphériques en erreur, cartes réseau, écrans bleus, arrêts
  brutaux, erreurs WHEA et disque, plantages d'applications et de services,
  diagnostic mémoire, Windows Update, sécurité (antivirus, pare-feu,
  Secure Boot, TPM, UAC, SMBv1, comptes), services, démarrage, logiciels,
  intégrité DISM, réseau et Internet.
- **Résumé et problèmes** : score, constats classés par gravité avec la
  marche à suivre, arborescence Matériel / Windows, contrôles réussis.
- **Capteurs en direct** (chaque seconde) : processeur, fréquence, mémoire,
  disques, réseau, carte graphique, zones thermiques, batterie.
- **Réparations**, une par une ou enchaînées (préréglages « Entretien
  complet », « Réparer Windows Update », « Réparer le réseau ») : point de
  restauration, DISM, SFC, chkdsk en ligne ou au redémarrage, nettoyage,
  réinitialisation de Windows Update, recherche de mises à jour, pile réseau,
  cache DNS, heure, analyse Defender, pare-feu, SMBv1, diagnostic mémoire,
  pilote de batterie. Sortie en direct, arrêt possible, redémarrage à la fin
  avec réouverture automatique de l'application.
- **Test de batterie** : santé, test de décharge (avec ou sans charge CPU),
  dépannage d'une batterie non reconnue.
- **Rapport client** (smileys, comparatif avant / après intervention à partir
  de l'historique), **rapport technique** détaillé et **rapport
  d'inventaire** personnalisable, en HTML imprimable en PDF.
- **Envoyer au site** : association avec une clé, recherche du ticket ou
  diag rapide, envoi de l'analyse en cours ou d'une analyse enregistrée, avec
  la liste des réparations lancées. La fiche appareil du ticket est complétée
  comme avec le Diag Atelier (seuls les champs vides sont remplis, les
  différences sont signalées).

## Portable : rien n'est installé sur le PC du client

L'exe se lance depuis une clé USB, sans installation. Tout ce qu'il garde est
rangé **à côté de l'exe** :

- `PC2Diag-config.json` : en-tête de la société, adresse du site et clé
  d'accès ;
- `PC2Diag-rapports\` : les analyses (historique pour le comparatif avant /
  après), les rapports HTML et le journal `PC2Diag-journal.txt`.

Si la clé USB est protégée en écriture, ce dossier est créé sur le bureau.

Le cache de la fenêtre et les fichiers de collecte vont dans le dossier
temporaire et sont effacés à la fermeture. Seule exception, demandée
explicitement : quand on coche « Rouvrir le diagnostic après le
redémarrage », une entrée `RunOnce` est ajoutée pour relancer l'exe une fois ;
Windows la supprime dès qu'elle a servi, et l'application l'efface aussi en
cas d'annulation. Les réparations, elles, modifient le système par nature
(c'est leur but) et ne se lancent qu'après confirmation.

La demande de droits administrateur (UAC) apparaît au lancement : ces droits
servent à SMART, BitLocker, DISM et aux réparations. Si on refuse, l'analyse
tourne quand même avec des relevés réduits.

La clé d'accès est en clair dans `PC2Diag-config.json` : si la clé USB est
perdue, révoquez la clé depuis la page Diag rapide.

## Liaison avec le site

1. Sur le site, page **Diag rapide** › carte **Application PC2 Diag** ›
   **Créer une clé d'association**.
2. Dans l'application, **Envoyer au site** : saisir l'adresse du site et la
   clé, puis **Associer** (une seule fois par clé USB).
3. Chercher le ticket (n°, client ou titre) ou choisir **Diag rapide**, puis
   **Envoyer** : le rapport apparaît sur le ticket (ou dans Diag rapide) et
   s'ouvre en un clic.

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

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `ui.html` | interface (vues, règles de diagnostic, rapports client et inventaire) |
| `report.html` | modèle du rapport technique (`__DATA__`, `__BRAND__`) |
| `collect.ps1` | collecte en lecture seule |
| `actions.go` | liste des réparations et leurs étapes |
| `analyze.go`, `api.go` | rapport envoyé au site et client de l'API |
| `main_windows.go` | fenêtre, pont `goCall`, analyse, historique, rapports, site |
| `runner_windows.go` | exécution des réparations, redémarrage, outils Windows |
| `sensors_windows.go` | capteurs en direct (compteurs PDH) |
| `battery_windows.go` | test de décharge |

## Compiler

Go 1.24 ou plus récent, depuis n'importe quel système :

```sh
./build.sh 1.2.0        # Linux, macOS, Git Bash
build.cmd 1.2.0         # invite de commandes Windows
```

Résultat : `dist/PC2Diag.exe`, un seul fichier sans installation. Il faut le
runtime WebView2 (présent sur Windows 10 et 11 à jour). Pour proposer le
téléchargement sur la page Diag rapide, copier l'exe dans
`public/downloads/PC2Diag.exe` sur le serveur.

Tests : `go test ./...` ; pour vérifier les scripts PowerShell des
réparations, `PSDUMP=<dossier> go test -run TestDumpPS` les écrit dans ce
dossier.

L'exe n'est pas signé : Windows SmartScreen peut afficher un avertissement au
premier lancement (« Informations complémentaires » › « Exécuter quand
même »). Une signature de code le supprime.
