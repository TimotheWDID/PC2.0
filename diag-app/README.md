# PC2 Diag (application Windows)

Application Windows de diagnostic et de dépannage de Planete-Computers 2.0, reprise
de `DiagnosticPC.exe` (Go + fenêtre WebView2 + collecte PowerShell), avec en
plus l'envoi du rapport au site de ticketing, sur un ticket ou en « diag
rapide ». Son diagnostic détaillé est le **Diag Atelier du site**, intégré à
l'exe : même affichage, même rapport, et le diagnostic envoyé se rouvre sur le
site à l'identique.

## Fonctions

- **Analyse** en lecture seule : système et BIOS, processeur, mémoire
  (barrettes), cartes graphiques et écrans, audio, températures, disques
  (santé, usure SSD, erreurs, heures), volumes et BitLocker, batterie (usure,
  cycles), périphériques en erreur, cartes réseau, écrans bleus, arrêts
  brutaux, erreurs WHEA et disque, plantages d'applications et de services,
  diagnostic mémoire, Windows Update, sécurité (antivirus, pare-feu,
  Secure Boot, TPM, UAC, SMBv1, comptes), services, démarrage, logiciels,
  intégrité DISM, réseau et Internet.
- **Diag atelier** : la page Diag Atelier du site (vues technicien et client,
  viabilité, Windows 11, tests manuels, export PDF / JSON)
  remplie avec l'analyse. On peut y ajouter un relevé HWiNFO ou un rapport
  batterie, comme sur le site.
- **Tests manuels** : écran (aplats de couleur plein écran), clavier (les
  touches s'allument), souris et pavé tactile, son gauche / droite, webcam et
  micro, charge, réseau, USB, ventilateur, châssis. Chaque test se note OK, KO
  ou non testé ; les résultats et les notes sont ceux de la section « Tests
  manuels » du Diag atelier et partent au site avec le rapport.
- **Résumé et problèmes** : score, constats classés par gravité avec la
  marche à suivre, arborescence Matériel / Windows, contrôles réussis.
- **Capteurs en direct** (chaque seconde) : processeur, fréquence, mémoire,
  disques, réseau, carte graphique, zones thermiques, batterie. Les cartes
  NVIDIA et AMD donnent en plus température, charge et consommation, lues
  auprès de leur pilote (NVML, ADL), sans rien installer. Quand HWiNFO tourne
  (la version portable suffit) avec « Shared Memory Support », ses capteurs
  s'ajoutent : températures du processeur par cœur, consommation, ventilateurs.
- **Relevé des capteurs** : enregistré dès le lancement (4 h au plus),
  « Nouveau relevé » pour repartir de zéro avant un test en charge. Il part au
  site avec l'analyse au format d'un relevé de surveillance HWiNFO : le Diag
  Atelier (dans l'exe et sur le site) l'affiche en courbes. Un relevé HWiNFO
  ajouté à la main dans le Diag atelier reste prioritaire.
- **Espace disque**, façon TreeSize : choisir un lecteur (ou un dossier), puis
  explorer la **carte** (chaque dossier est un rectangle dont la surface est
  proportionnelle à sa taille, sur trois niveaux, un clic pour y entrer) ou la
  liste des dossiers du plus gros au plus petit, avec la part de
  chacun, le nombre de fichiers et la date de dernière modification. Onglets
  « Plus gros fichiers » (les 200 plus gros) et « Types de fichiers » (total
  par extension), ouverture dans l'Explorateur et export CSV dans
  `PC2Diag-rapports`. Lecture seule, plusieurs dossiers lus en parallèle ; les
  jonctions et liens ne sont pas suivis (pas de double compte) et les fichiers
  OneDrive « en ligne uniquement » ne sont pas comptés, puisqu'ils ne sont pas
  sur le disque. Sans droits administrateur, les dossiers inaccessibles sont
  signalés.
- **Réparations**, une par une ou enchaînées (préréglages « Entretien
  complet », « Réparer Windows Update », « Réparer le réseau ») : point de
  restauration, DISM, SFC, chkdsk en ligne ou au redémarrage, nettoyage,
  réinitialisation de Windows Update, recherche de mises à jour, pile réseau,
  cache DNS, heure, analyse Defender, pare-feu, SMBv1, diagnostic mémoire,
  pilote de batterie. Sortie en direct, arrêt possible, redémarrage à la fin
  avec réouverture automatique de l'application.
- **Test de batterie** : santé, test de décharge (avec ou sans charge CPU),
  dépannage d'une batterie non reconnue.
- **Rapport client** : la fiche Client du Diag Atelier du site (verdict,
  échelle « Où en est votre ordinateur ? », tuiles, conseils), avec en plus le
  comparatif avant / après intervention à partir de l'historique et les
  travaux réalisés, **rapport technique** détaillé et **rapport
  d'inventaire** personnalisable, en HTML imprimable en PDF.
- **Tickets** : les tickets du site, comme sur la page du ticket. Liste
  « Mes tickets », « Non attribués », tous les ouverts, terminés, tout, avec
  recherche (n°, client, téléphone, titre, n° de série) et le nombre
  d'actions à faire ; onglet « À faire » qui reprend les actions non faites
  de tous les tickets ouverts. La fiche d'un ticket a :
  - le statut, la priorité et « Me l'attribuer » ;
  - **Fiche** : demande du client, objets déposés, mot de passe de session
    (masqué, à afficher ou copier), coordonnées et note interne du client,
    commandes et devis liés, actions à faire ;
  - **Suivi technicien** : l'historique du ticket, l'ajout d'un événement
    (types et textes préremplis du site, date, actions à réaliser et listes
    de tâches du site), cocher une action, retirer un événement avec sa
    raison ou le restaurer ;
  - **Échanges et notes** : la conversation avec le client et les notes
    internes, réponse au client prévenu par e-mail ou SMS (modèles de SMS du
    site) ou sans le prévenir, note interne avec mention `@prénomnom` d'un
    collègue, pièces jointes, « Valider la mention », suppression de ses
    messages ;
  - **Fichiers** : fichiers du ticket, des échanges et fiches client des
    diagnostics ; ajout (interne ou visible par le client), changement de
    visibilité, suppression, envoi au client par e-mail ;
  - **Diagnostics** : ceux du ticket, à ouvrir sur le site, fiche client et
    case « Visible » par le client ; « Envoyer l'analyse ici » prépare
    l'envoi de l'analyse en cours sur ce ticket ;
  - **Appareil** : la fiche de l'appareil et son historique, avec l'ajout
    d'une intervention (batterie, écran, stockage…).

  Tout passe par le site avec le compte du technicien associé : l'historique,
  les notifications au client et les mentions sont les mêmes que depuis la
  page du ticket. La fiche ouverte se met à jour chaque minute (sauf pendant
  une saisie). Les fichiers ouverts depuis un ticket sont enregistrés dans
  `PC2Diag-rapports\Tickets\<n°>\` ; un fichier exécutable n'est pas lancé,
  il est seulement montré dans l'Explorateur.
- **Envoyer au site** : association avec une clé, recherche du ticket ou
  diag rapide, envoi de l'analyse en cours ou d'une analyse enregistrée, avec
  la liste des réparations lancées. L'envoi est celui du bouton « Envoyer au
  ticket » du Diag Atelier : rapport, valeurs de la fiche appareil, tests manuels et
  fichiers (l'analyse, et les relevés HWiNFO ou batterie ajoutés). La fiche
  appareil du ticket est complétée (seuls les champs vides sont remplis, les
  différences sont signalées).

## Compatibilité avec le Diag Atelier du site

Le Diag Atelier accepte l'analyse de l'application (`Analyse_….json`) comme
une source de plus, à côté du rapport système HWiNFO, du relevé de
surveillance HWiNFO et du rapport batterie Windows : sans l'exe sous la main,
les exports HWiNFO et `powercfg /batteryreport` marchent toujours. Les quatre
peuvent être combinés ; quand le rapport système HWiNFO est là, il prime pour
l'identité de la machine. L'analyse de l'application ajoute ses propres
sections : stabilité, sécurité, mises à jour, espace disque, périphériques,
réseau, logiciels et réparations faites.

PC assemblé : quand le BIOS garde les textes par défaut du fabricant de la
carte mère (« To be filled by O.E.M. », « System manufacturer »…), le fabricant
et le modèle affichés et envoyés au site sont ceux de la carte mère, avec la
mention « PC assemblé ».

## Portable : rien n'est installé sur le PC du client

L'exe se lance depuis une clé USB, sans installation. Tout ce qu'il garde est
rangé **à côté de l'exe** :

- `PC2Diag-config.json` : en-tête de la société, adresse du site et clé
  d'accès ;
- `PC2Diag-rapports\` : les analyses (historique pour le comparatif avant /
  après), les rapports HTML et le journal `PC2Diag-journal.txt`.
- `PC2Diag-rapports\PC2Diag-collecte_<date>.txt` : le détail de chaque
  analyse (les 10 dernières), avec l'heure de début et la durée de chaque
  vérification. Si l'analyse reste bloquée sur une étape, la dernière ligne
  nomme la vérification qui ne rend pas la main ; `PC2Diag-journal.txt` note
  aussi, chaque minute, l'étape qui ne progresse plus. Les vérifications de
  l'étape 4 (BitLocker, volumes, `fsutil dirty`, taille des fichiers
  temporaires) sont abandonnées au bout de 15 à 30 s si elles ne répondent pas.

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
| GET | `/tickets?q=&scope=` | tickets (`open` par défaut, `mine`, `unassigned`, `closed`, `all`) |
| GET | `/todos` | actions non faites des tickets ouverts |
| GET | `/tickets/{id}` | le ticket complet : fiche, suivi, échanges, fichiers, diagnostics, appareil, choix des formulaires |
| PATCH | `/tickets/{id}/status`, `/priority` | statut, priorité |
| POST | `/tickets/{id}/assign-me` | s'attribuer le ticket |
| POST | `/tickets/{id}/timeline-events` | événement de suivi (avec actions) |
| PATCH, DELETE | `/tickets/{id}/timeline-events/{e}/actions`, `/{e}`, `/{e}/restore` | cocher une action, retirer, restaurer |
| POST | `/tickets/{id}/device-events` | intervention sur l'appareil |
| POST, DELETE | `/tickets/{id}/messages`, `/messages/{m}`, `/messages/{m}/validate-mention` | réponse, note interne, pièces jointes |
| POST, PATCH, DELETE | `/tickets/{id}/files`, `/files/send`, `/files/{f}` | fichiers du ticket |
| GET | `…/files/{f}/download`, `…/messages/{m}/attachments/{a}`, `…/diagnostics/{d}/client-report` | téléchargements (mêmes chemins que sur le site) |
| PATCH | `/tickets/{id}/diagnostics/{d}/visibility` | diagnostic visible par le client |
| POST | `/diagnostics` | multipart, comme « Envoyer au ticket » : `ticket_id?`, `report`, `inventory`, `state`, `files[]`, `file_sources[]`, `file_names[]`, `file_encodings[]` |

Côté site, le suivi (statut, priorité, attribution, événements, interventions
appareil) passe par `App\Support\TicketWorkflow`, partagé avec la page du
ticket ; les échanges et les fichiers passent par les contrôleurs du site
(`MessageController`, `TicketFileController`).

Le rapport a le format `diag-atelier` et se rouvre dans le Diag Atelier. Les
rapports au format `diag-app` des versions 1.0 à 1.2 (JSON) restent acceptés et
s'affichent par la vue `resources/views/diagnostics/app-report.blade.php`.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `ui.html` | interface (vues, règles de diagnostic, rapports client et inventaire, Diag atelier intégré, tickets du site) |
| `atelier.html` | copie de `resources/diag/diag-atelier.html` faite par la compilation (non versionnée) |
| `report.html` | modèle du rapport technique (`__DATA__`, `__BRAND__`) |
| `collect.ps1` | collecte en lecture seule |
| `actions.go` | liste des réparations et leurs étapes |
| `api.go` | client de l'API (envoi multipart du Diag Atelier, appels des tickets, pièces jointes, téléchargements) |
| `rsrc_windows_amd64.syso`, `winres/icon.png` | icône Planete-Computers 2.0 de l'exe |
| `main_windows.go` | fenêtre, pont `goCall`, analyse, historique, rapports, site |
| `runner_windows.go` | exécution des réparations, redémarrage, outils Windows |
| `sensors_windows.go` | capteurs en direct (compteurs PDH) |
| `battery_windows.go` | test de décharge |
| `gpu_windows.go` | capteurs des cartes graphiques NVIDIA (NVML) et AMD (ADL) |
| `hwinfo.go`, `hwinfo_windows.go` | lecture des capteurs de HWiNFO (mémoire partagée) |
| `diskusage.go`, `diskusage_windows.go` | espace disque : parcours des dossiers, arbre pour la carte, lecteurs, export CSV |

## Compiler

Go 1.24 ou plus récent, depuis n'importe quel système :

```sh
./build.sh 1.5.0        # Linux, macOS, Git Bash
build.cmd 1.5.0         # invite de commandes Windows
```

Les scripts copient d'abord `resources/diag/diag-atelier.html` dans
`atelier.html` : l'exe embarque toujours le Diag Atelier du dépôt. Recompiler
l'exe après une modification du Diag Atelier.

Résultat : `dist/PC2Diag.exe`, un seul fichier sans installation. Il faut le
runtime WebView2 (présent sur Windows 10 et 11 à jour). Pour proposer le
téléchargement sur la page Diag rapide, copier l'exe dans
`public/downloads/PC2Diag.exe` sur le serveur.

Icône : `winres/icon.png` (logo Planete-Computers 2.0). Pour la changer,
`go-winres simply --icon winres/icon.png --manifest none --arch amd64 --out rsrc`
régénère `rsrc_windows_amd64.syso`.

Tests : `go test ./...` ; pour vérifier les scripts PowerShell des
réparations, `PSDUMP=<dossier> go test -run TestDumpPS` les écrit dans ce
dossier.

L'exe n'est pas signé : Windows SmartScreen peut afficher un avertissement au
premier lancement (« Informations complémentaires » › « Exécuter quand
même »). Une signature de code le supprime.
