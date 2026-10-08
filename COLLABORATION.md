# Collaboration entre assistants

Ce fichier sert de memoire partagee entre GitHub Copilot et Claude Code.

## Objectif actuel

- Separer les tickets de reparation du suivi commercial des devis.
- Corriger la cause racine des erreurs 419 (CSRF) frequentes qui faisaient perdre les donnees des formulaires en cours de saisie.

## Contexte

- Projet : SupportPC
- Stack : Laravel 11, Inertia.js, React, TypeScript
- Fichier ou fonctionnalite concernee : gestion du token CSRF cote frontend (resources/js/app.tsx et plusieurs pages)

## Travail a faire

- [x] Identifier la cause des 419 (audit)
- [x] Corriger resources/js/app.tsx
- [x] Corriger tous les autres points du meme bug (delete forms, self-assign, process, login)
- [x] Verifier tsc + eslint + build
- [ ] Tester manuellement en conditions reelles (session qui expire/se regenere) - a faire par l'utilisateur en staging/prod
- [ ] Verifier le driver de session en prod (SESSION_DRIVER=file en local, cf. .env:30) si plusieurs workers/instances

## Decisions techniques

- **Cause racine identifiee** : `resources/js/app.tsx` lisait le meta tag `csrf-token` **une seule fois** au chargement de la page et l'injectait en dur dans le header `X-CSRF-TOKEN` de **toutes** les requetes Inertia via `visitOptions`. Comme Inertia est une SPA (pas de rechargement de page entre navigations), ce token ne se rafraichissait jamais. Des que la session regenere son token (temps ecoule, autre onglet, etc.), Laravel rejette la requete en 419. Plus le formulaire restait ouvert longtemps avant soumission, plus le risque etait eleve — exactement le symptome rapporte.
- Laravel priorise la verification CSRF dans cet ordre : champ `_token` du body > header `X-CSRF-TOKEN` > header `X-XSRF-TOKEN` (derive du cookie `XSRF-TOKEN`, toujours frais car renouvele a chaque reponse serveur). Le meme bug (lecture du meta tag fige) etait duplique dans 6 autres fichiers, sous forme de champ `_token` cache ou de header manuel — ces valeurs figees "gagnaient" systematiquement sur le mecanisme cookie, qui lui fonctionnait correctement.
- **Fix** : suppression de toute lecture/injection manuelle du meta tag `csrf-token` cote frontend. On laisse axios (utilise en interne par Inertia) gerer le CSRF automatiquement via le cookie `XSRF-TOKEN`/header `X-XSRF-TOKEN`, qui est toujours a jour car renouvele a chaque reponse HTTP de Laravel. C'est le mecanisme standard Laravel+Inertia+axios, deja partiellement configure dans app.tsx (`axios.defaults.xsrfCookieName`/`xsrfHeaderName`).
- Les formulaires HTML natifs de suppression (`<form action method="POST">` avec `_token` cache) ont ete convertis en appels `router.delete()` d'Inertia (AJAX, pas de rechargement de page complet) : ils beneficient ainsi du meme mecanisme cookie et evitent le champ `_token` fige. Les controleurs backend (`UserController::destroy`, `AgentController::destroy`) renvoient deja un `redirect()->with(...)`, compatible tel quel avec Inertia.
- Demande explicite de l'utilisateur : pas de brouillon localStorage generalise a tous les formulaires — puisque la cause racine (419) est corrigee, ce filet de securite devient superflu. Le brouillon localStorage deja present dans `Tickets/Create.tsx` et `Tickets/KioskCreate.tsx` a ete laisse tel quel (non demande de le retirer).
- Cause aggravante identifiee mais **non corrigee** (hors scope demande) : `SESSION_DRIVER=file` en local (.env:30). A verifier en prod si plusieurs workers PHP-FPM/instances sans disque partage — source additionnelle possible de sessions invalidees.

## Fichiers modifies

- `resources/js/app.tsx` — suppression de l'injection du token CSRF fige (const capturee au chargement + `visitOptions`), on garde uniquement la config axios standard (cookie `XSRF-TOKEN` toujours frais).
- `resources/js/pages/auth/login.tsx` — suppression du champ cache `_token` fige (le composant `<Form>` d'Inertia gere deja le CSRF via le cookie).
- `resources/js/pages/Users/Delete.tsx` — formulaire natif → `router.delete()`.
- `resources/js/pages/Users/Index.tsx` — 2 formulaires natifs de suppression → `router.delete()` via un helper `handleDelete`.
- `resources/js/pages/Agents/Delete.tsx` — formulaire natif → `router.delete()`.
- `resources/js/pages/Agents/Index.tsx` — 4 formulaires natifs de suppression → `router.delete()` via un helper `handleDelete`.
- `resources/js/pages/Tickets/Index.tsx` — suppression du header `X-CSRF-TOKEN` manuel fige dans `handleSelfAssign`.
- `resources/js/pages/InternalTickets/Show.tsx` — suppression du champ `_token` fige dans `handleProcess`.

## Tests et validations

- Commandes executees : `npx tsc --noEmit` (OK, aucune erreur), `npx eslint <fichiers modifies>` (0 erreur, 5 warnings preexistants `no-explicit-any` sans rapport avec les changements), `npm run build` (build OK, artefacts de verification ensuite retires du working tree pour ne pas polluer git — `public/build` est versionne).
- Resultat : build et typecheck passent. Aucun test automatise dedie au CSRF dans le repo (pas de suite de tests frontend detectee).
- Problemes restants : verification manuelle en conditions reelles a faire (laisser un formulaire ouvert longtemps puis soumettre, verifier absence de 419). Verifier le driver de session en prod.

## Notes pour l'autre assistant

- Ne pas reintroduire de lecture manuelle de `document.querySelector('meta[name="csrf-token"]')` pour construire des headers/`_token` — c'est exactement la regression a eviter. Le cookie `XSRF-TOKEN` (via axios) est la seule source fiable en contexte SPA Inertia.
- Si un nouveau formulaire de suppression/action est ajoute, prefer `router.post/patch/delete` d'Inertia plutot qu'un `<form action method="POST">` natif avec `_token` cache.

## Module Devis - MVP

- Un modele `Devis` separe des commandes d'achat a ete ajoute.
- Les agents et administrateurs peuvent creer et suivre les devis ; les utilisateurs standards n'y ont pas acces.
- Statuts disponibles : brouillon, a valider, envoye, accepte, refuse, expire.
- Un PDF peut etre importe dans le stockage prive de Laravel et telecharge depuis le detail du devis.
- Un devis peut etre lie a un ticket existant. Lors de l'acceptation, un ticket de reparation minimal est cree s'il n'existe pas.
- La reference Hiboutik est conservee, mais l'import API automatique reste a implementer.
- La documentation Hiboutik indique une API par compte (`https://{mon-compte}.hiboutik.com/api`) et une authentification Basic/OAuth. Aucun endpoint public specifique aux devis n'a encore ete confirme.
- La vue detail permet maintenant de modifier les notes, previsualiser le PDF dans un iframe, le telecharger et echanger des messages prives entre agents.
- Les messages sont stockes dans `devis_messages` et accessibles via `POST /devis/{devis}/messages`.
- Les messages acceptent les mentions `@prenomnom`, proposent les agents actifs pendant la saisie et envoient une notification database ouvrant directement le devis.
- Les notifications de mentions de devis sont integrees aux insights du dashboard.
- Le PDF peut maintenant etre ajoute ou remplace depuis la fiche du devis via `POST /devis/{devis}/pdf`, meme s'il n'etait pas fourni a la creation.
- Le numero de devis Hiboutik est modifiable depuis la fiche Devis et est synchronise dans le ticket via le champ `tickets.hiboutik_quote_number`.
- Lorsqu'un ticket est cree depuis un devis, son titre commence par `Devis Hiboutik #...` si un numero est renseigne. Un ticket existant conserve son titre personnalise, mais sa reference Hiboutik est mise a jour.
- Migration locale appliquee : `2026_09_22_120000_create_devis_table`.
- Migration locale appliquee : `2026_09_22_130000_create_devis_messages_table`.
- Validations effectuees : `php artisan migrate --force`, `php artisan route:list --name=devis`, `npm run types`, `npm run build`, `git diff --check`.

## Revue du module Devis (Claude Code, 2026-09-22)

- **Bug critique trouve et corrige** : `routes/devis.php` utilisait `Route::resource('devis', DevisController::class)`. Le singulariseur de Laravel (base anglaise) transforme `devis` en `devi`, donc les routes generees pour `show`/`update` attendaient un parametre `{devi}` alors que les methodes du controleur typent `Devis $devis`. Consequence verifiee par test : le binding implicite echouait silencieusement et le controleur recevait un `Devis` **vide** (non persiste) au lieu du bon enregistrement.
  - `GET /devis/{id}` (page de detail) affichait une page quasiment vide (`user`/`ticket` a `null`, aucun champ du devis).
  - `PATCH /devis/{id}` (changement de statut) ne faisait **rien** en base (Eloquent `update()` retourne `false` sur un modele non persiste) tout en affichant un message "Devis mis a jour" — echec silencieux.
  - Fix applique : `Route::resource('devis', DevisController::class)->parameters(['devis' => 'devis'])->only([...])`. Verifie par un test Pest temporaire (show renvoie desormais le bon id/titre/statut, update persiste bien le nouveau statut), puis test supprime (non demande par l'utilisateur de garder une suite de tests dediee).
- **Incoherences de navigation corrigees** (`resources/js/components/app-sidebar.tsx`) :
  - Le lien "Devis" avait ete ajoute a `nonAgentNavItems` (sidebar des clients/utilisateurs standards), alors que `DevisController` renvoie un 403 pour tout utilisateur sans relation `agent`. Retire.
  - `/devis` avait ete ajoute a `adminOnlyPrefixes`, restreignant le lien aux seuls administrateurs dans la sidebar desktop — incoherent avec le controleur (qui autorise tout agent, admin ou non) et avec la nav mobile (`mobile-native-nav.tsx`, deja basee sur `isAgent`). Retire de la liste admin-only.
- **Points mineurs releves, non corriges** (a evaluer par l'autre assistant/l'utilisateur) :
  - `DevisController::store()` fait `unset($devis->pdf)` juste apres `new Devis($validated)` : `pdf` n'etant pas fillable, cette ligne est un no-op — code mort/trompeur, sans impact fonctionnel.
  - `resources/js/pages/Devis/Show.tsx` : le `<select>` de statut fait un `setStatus(nextStatus)` optimiste avant confirmation serveur (`router.patch` sans `onError`/rollback) ; en cas d'echec de validation, le badge afficherait un statut non reellement enregistre.
  - `mobile-native-nav.tsx` : le bouton central de la barre mobile pour les agents pointait vers `/commandes` et pointe desormais vers `/devis` (remplacement, pas ajout) — les agents perdent l'acces rapide "Commandes" en mobile. A confirmer si voulu.
  - Pas de route `destroy` pour `devis` (MVP assume, pas de suppression possible depuis l'UI).
- **Donnees de test residuelles non nettoyees** (permission refusee par le sandbox pour la suppression en base reelle MySQL `supportpc`) : lignes creees pendant la verification manuelle, a supprimer par l'utilisateur ou en relancant la commande avec autorisation :
  - `devis` id 2 ("Test binding") et id 3 ("Diag")
  - `agents` id 5
  - `users` id 18 et 19
- Validation : `npx tsc --noEmit` OK, `npm run build` OK (artefacts de verification retires ensuite), `php artisan test` → 93 passed / 2 failed (echecs pre-existants et sans rapport, `Tests\Feature\Auth\RegistrationTest`, inscription desactivee dans l'app — non lies a ce travail).

## Deuxieme passe de revue (Claude Code, 2026-09-22) — apres ajout messages/mentions/PDF/preview par Copilot

Le fix de route (`->parameters(['devis' => 'devis'])`) a bien ete conserve par Copilot dans ses ajouts suivants. Nouveau perimetre revu : `DevisMessage`, `DevisMentionNotification`, upload/preview PDF, mentions `@prenomnom`, integration aux insights du dashboard, `tickets.hiboutik_quote_number`.

- **Bug trouve et corrige** : `resources/js/pages/Devis/Show.tsx`, fonction `updateStatus()`. Le code faisait :
  ```js
  noteForm.setData('status', nextStatus);
  noteForm.patch(`/devis/${devis.id}`, { preserveScroll: true });
  ```
  `noteForm.patch` (Inertia `useForm`) est un `useCallback` memoïse sur `data` du rendu React en cours (verifie dans `node_modules/@inertiajs/react/dist/index.esm.js`, fonction `submit`, deps `[data, setErrors, transform]`). `setData` ne met a jour `data` qu'au rendu SUIVANT (React batch les mises a jour d'etat dans un handler d'evenement). Consequence : `noteForm.patch()` appele juste apres `setData()` dans le meme handler envoie toujours l'**ancien** statut, jamais celui qui vient d'etre selectionne — le changement de statut via le menu deroulant ne se persiste jamais correctement (toujours en retard d'un cran). Le badge de statut affiche localement (`setStatus`) donnait l'illusion que ca fonctionnait.
  - Fix applique : `updateStatus` appelle desormais `router.patch(...)` directement avec le statut explicite en parametre, au lieu de dependre de l'etat `noteForm.data` pas encore rafraichi.
  - Verifie par lecture du code source Inertia (pas de test end-to-end navigateur ecrit, le bug est une pure timing-issue React/closure, difficilement testable en PHPUnit/Pest).
- **Bug corrige (sur demande explicite de l'utilisateur)** : `DevisController::accept()` lisait `$devis->hiboutik_id` **depuis la base**, pas depuis la requete — si l'utilisateur tapait un nouveau numero Hiboutik puis cliquait directement sur "Synchroniser le numero dans le ticket" / "Accepter" sans avoir clique "Enregistrer" avant, le ticket recevait l'ancien numero, pas celui tout juste saisi.
  - Fix backend : `accept(Request $request, Devis $devis)` valide desormais un `hiboutik_id` optionnel dans le corps de la requete et met a jour `$devis->hiboutik_id` avant de calculer le titre/numero synchronise dans le ticket, si le champ est present dans la requete.
  - Fix frontend : `Devis/Show.tsx`, `accept()` poste maintenant `{ hiboutik_id: noteForm.data.hiboutik_id }` au lieu d'un POST sans corps.
  - Verifie par un test Pest temporaire (creation d'un devis sans hiboutik_id, POST `/devis/{id}/accept` avec un nouveau numero jamais enregistre au prealable, assertion que le devis et le ticket recoivent bien ce numero) : passe, puis test supprime.
- Suite de tests complete relancee apres ces fix : `php artisan test` → toujours 93 passed / 2 failed (memes echecs pre-existants sans rapport). `npx tsc --noEmit` OK.

## Refonte UI/UX de Devis/Show.tsx (Claude Code, 2026-09-22, a la demande de l'utilisateur)

Aucun changement de logique metier (routes, requetes, validations inchangees) — uniquement structure/presentation :

- Badge de statut sorti du positionnement `absolute` (risque de chevauchement avec un titre long/sur mobile) et place dans une barre d'info horizontale sous le `Heading`, avec client + date de creation + bouton retour.
- `<select>` natif du statut remplace par le composant `Select` (shadcn/Radix) deja utilise ailleurs dans l'app, avec un point de couleur par statut (repris dans le badge) pour un reperage visuel plus rapide.
- Carte "Details du devis" separee de la carte "Notes" (avant fusionnees), chacune avec son propre `Label`.
- Champ notes reconnecte directement a `noteForm.data.notes` (suppression d'un `useState` local redondant qui dupliquait l'etat sans utilite).
- Messages entre agents : ajout d'un avatar (initiales) par message pour la lisibilite ; suggestion de mention repositionnee en `bottom-full` relatif au textarea au lieu d'un offset fixe (`bottom-16`) fragile.
- Etats de chargement (`Spinner`) ajoutes sur les boutons Enregistrer / Envoyer / Importer pendant `processing`, auparavant seulement `disabled` sans retour visuel.
- Carte "Document du devis" : etat vide avec icone quand aucun PDF n'est importe ; nom de fichier affiche sous les actions.
- JSX entierement reformate en multi-ligne (le fichier etait ecrit en lignes tres denses, difficile a relire/maintenir).
- Validation : `npx tsc --noEmit`, `npx eslint resources/js/pages/Devis/Show.tsx`, `npm run build` → tous OK (artefacts de build retires ensuite).

## Refonte UI/UX de Devis/Create.tsx (Claude Code, 2026-09-22, a la demande de l'utilisateur)

Aucun changement de validation/route backend — presentation uniquement :

- Champs "Client" et "Ticket lie" : `<select>` natif listant TOUS les utilisateurs/tickets remplace par un champ de recherche avec suggestions filtrees (nom/email pour le client, numero/titre pour le ticket), sur le meme modele deja utilise dans `Commandes/Create.tsx` (coherence inter-pages). Resultats plafonnes a 50 entrees affichees a la fois.
- Champ "Statut initial" : `<select>` natif remplace par le composant `Select` (meme choix que `Devis/Show.tsx`), avec point de couleur par statut.
- Champ "Notes" : `<textarea>` brut remplace par le composant `Textarea` partage.
- Spinner de chargement ajoute sur le bouton de soumission pendant `processing`.
- JSX reformate en multi-ligne (memes lignes tres denses qu'avant sur `Show.tsx`).
- Limite connue, deja presente avant cette refonte et non corrigee ici (hors demande) : si un ticket est pre-selectionne via `?ticket_id=` mais ne fait pas partie des 300 tickets les plus recents renvoyes par le backend, son libelle ne s'affichera pas dans le champ de recherche bien que `ticket_id` soit correctement envoye a la creation.
- Validation : `npx tsc --noEmit`, `npx eslint resources/js/pages/Devis/Create.tsx`, `npm run build` → tous OK (artefacts de build retires ensuite).

## Ajout : creation rapide de client depuis Devis/Create.tsx (Claude Code, 2026-09-22, a la demande de l'utilisateur — "comme sur les tickets")

- Reproduit le pattern deja existant dans `Tickets/Create.tsx` : quand la recherche de client ne trouve aucun resultat (ou via un lien toujours visible sous le champ), une `Dialog` (shadcn) permet de creer un client (prenom, nom, email, telephone) sans quitter la page.
- **Reutilisation de l'endpoint existant `POST /tickets/quick-user`** (`TicketController::quickCreateUser`) plutot que la creation d'un nouvel endpoint dedie : c'est une route generique de creation de client (aucune logique specifique aux tickets dedans), deja protegee par `ensureAgentOrAbort()` — equivalent a la garde deja presente dans `DevisController` (agent ou admin). Dupliquer cette logique cote backend pour un endpoint `/devis/quick-user` n'aurait rien apporte. Le nom de route reste heritage de son usage d'origine ; a renommer un jour si cela pretre a confusion (`routes/tickets.php:27`).
- Simplification volontaire par rapport a la version Tickets : pas de champs adresse/code postal/ville (moins pertinents pour un devis), pas de second dialog de confirmation "aucun email ni telephone" (specifique a la notification de tickets). Seuls prenom (requis), nom, email, telephone sont demandes.
- Le client cree est ajoute a une liste locale (`createdUsers`, fusionnee avec la prop `users` du serveur) et selectionne automatiquement — pas de rechargement de page necessaire.
- Validation : `npx tsc --noEmit`, `npx eslint resources/js/pages/Devis/Create.tsx`, `npm run build` → tous OK (artefacts de build retires ensuite). Aucun changement backend, donc pas de nouveau test PHP necessaire (endpoint deja utilise et fonctionnel via Tickets/Create.tsx).

## Pieces jointes sur les messages de ticket (Claude Code, 2026-09-22, a la demande de l'utilisateur)

Investigation prealable : aucun systeme de piece jointe fonctionnel n'existait (ni sur `tickets` ni sur `messages`). La colonne JSON `messages.attachments` existe depuis la creation du projet (package `coderflex/laravel-ticket` d'origine) mais n'a jamais ete alimentee (`[]` code en dur partout, y compris dans `InboundMailReviewController` et `ImportInboundEmails`) et n'a aucune UI. Choix : ancrage au niveau **message** (pattern recommande par l'investigation), en suivant le meme modele que le module Devis (disque `local` prive, pas de `storage:link`, routes de telechargement controlees).

- Nouvelle table `message_attachments` (migration `2026_09_22_134339_...`) : `id, message_id (FK cascade), path, original_name, mime_type, size, timestamps`.
- Nouveau modele `app/Models/MessageAttachment.php` + relation `Message::fileAttachments(): HasMany`. **Nom volontairement different** de la colonne JSON `attachments` deja existante et fillable sur `Message` (sinon collision : `$message->attachments` aurait continue de resoudre l'attribut JSON, jamais la relation). La colonne JSON legacy est laissee telle quelle (toujours vide), non supprimee (changement de schema hors scope).
- `MessageController::store()` : validation ajoutee (`attachments` : max 5 fichiers, chacun max 6 Mo, types `jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,csv,txt,zip`), upload vers `storage/app/private/tickets/{id}/attachments`, creation des lignes `MessageAttachment`. Le frontend passe desormais par `multipart/form-data` (au lieu de JSON) des qu'au moins un fichier est joint ; le champ `sms_template` (objet imbrique) est alors envoye JSON-encode en string cote client et redecode cote serveur avant validation (`is_string(...) + json_decode + $request->merge(...)`).
- Nouvelle route publique (meme groupe que `tickets.messages.index/store`, hors middleware `auth`, autorisation geree par `authorizeTicketAccess()` qui couvre agent connecte ET lien magique client) : `GET tickets/{ticket}/messages/{message}/attachments/{attachment}` → `downloadAttachment()`, toujours `response()->download()` (jamais `inline`) pour eviter tout risque de rendu de fichier uploade arbitraire (XSS) dans le navigateur.
- `MessageController::destroy()` : suppression des fichiers physiques (`Storage::disk('local')->delete(...)`) en plus des lignes DB (deja cascade via FK) — auparavant les fichiers auraient ete orphelins.
- Refactor mineur en passant : extraction d'un helper prive `serializeMessage()` (le JSON de reponse etait duplique a l'identique entre `index()` et `store()`), reutilise aussi pour serialiser `file_attachments`.
- **Bug de securite preexistant trouve et corrige pendant la revue demandee par l'utilisateur** ("revoir si tout fonctionne correctement pour les tickets") : `MessageController::index()` renvoyait **tous** les messages, y compris les notes internes (`is_internal = true`), a n'importe quel appelant de l'API JSON — le filtrage `isAgent ? messages : messages.filter(m => !m.is_internal)` n'existait que **cote frontend** (`TicketChat.tsx`). Un client authentifie ou via lien magique pouvait donc lire le contenu des notes internes en inspectant la reponse reseau brute, malgre l'UI qui les masquait. Corrige en filtrant `where('is_internal', false)` cote serveur quand `!$this->isAgentContext()`. Le meme controle protege desormais aussi les pieces jointes des notes internes (`downloadAttachment()` renvoie 403 si `is_internal` et non-agent).
- Frontend `resources/js/components/TicketChat.tsx` (partage par `Tickets/Show.tsx`, `ShowV2.tsx`, `PublicShow.tsx` — donc agents ET clients via lien magique) : bouton "Joindre" (trombone), jusqu'a 5 fichiers/message avec validation cote client (memes limites que le backend, message d'erreur immediat), chips avec taille + bouton de retrait, affichage des pieces jointes existantes sous chaque bulle de message (icone image/fichier + nom + taille + lien de telechargement respectant le token de lien magique via `withMagicToken()`).
- Validation : 4 tests Pest temporaires ecrits puis supprimes (upload+telechargement bout-en-bout OK, fuite notes internes confirmee absente apres fix, rejet fichier trop volumineux OK, rejet type de fichier interdit OK). Suite complete : 97 passed / 2 failed (memes echecs pre-existants sans rapport, `RegistrationTest`). `npx tsc --noEmit`, `npx eslint resources/js/components/TicketChat.tsx`, `npm run build` → tous OK.
- Limite connue non traitee (hors scope) : pas d'apercu inline pour les images/PDF joints (contrairement au PDF de devis) — uniquement telechargement, choix volontaire pour eviter la complexite de gestion par type de MIME et le risque de rendu inline de contenu uploade.

## Historique

| Date | Assistant | Action | Resultat |
|------|-----------|--------|----------|
| 2026-09-22 | GitHub Copilot | Creation du fichier de collaboration | Pret a etre utilise |
| 2026-09-22 | Claude Code | Audit 419/CSRF + correctif complet (app.tsx + 6 autres fichiers) | tsc/eslint/build OK, a valider manuellement |
| 2026-09-22 | GitHub Copilot | Creation du module Devis MVP | migration, CRUD Inertia, import PDF, liaison/creation de ticket, navigation ; API Hiboutik a preparer |
| 2026-09-22 | GitHub Copilot | Enrichissement de la vue Devis | notes editables, apercu PDF inline, mini-chat prive entre agents |
| 2026-09-22 | GitHub Copilot | Mentions Devis | autocompletion @prenomnom et notifications dashboard |
| 2026-09-22 | GitHub Copilot | Upload PDF differe | ajout/remplacement du PDF depuis la fiche Devis |
| 2026-09-22 | GitHub Copilot | Reference Hiboutik dans les tickets | numero modifiable, synchronisation et titre de ticket adapte |
| 2026-09-22 | Claude Code | Pieces jointes sur les messages de ticket + fix fuite notes internes | voir section dediee ci-dessous |
| 2026-09-22 | Claude Code | Revue du module Devis : bug critique de route-model-binding corrige (show/update casses), 2 incoherences de nav corrigees | tests OK, donnees de test residuelles a nettoyer manuellement (voir section ci-dessus) |
| 2026-10-08 | Claude Code | Fichiers de ticket internes/externes + envoi au client par email (table `ticket_files`, `TicketFileController`, composant `TicketFiles.tsx`) | 7 tests Pest dedies, suite complete OK, tsc/eslint/build OK |
