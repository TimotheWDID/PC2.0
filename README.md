# SupportPC - Documentation Projet

## 1) Presentation du projet
SupportPC est une application web de support technique basee sur Laravel 12 + Inertia.js + React + TypeScript.

Objectif principal:
- Centraliser la gestion des tickets SAV.
- Suivre les commandes associees aux tickets.
- Permettre les echanges (messages) autour d'un ticket.
- Gerer les agents, les utilisateurs et certains parametres (profil, mot de passe, 2FA, etiquette ticket).

## 2) Stack technique
- Backend: PHP 8.2+, Laravel 12
- Frontend: React 19, TypeScript, Inertia.js, Vite 7, Tailwind CSS 4
- Base de donnees: SQLite (par defaut en local) ou MySQL/MariaDB en environnement reel
- Outils qualite: ESLint, Prettier, Pest/PHPUnit

Dependances notables:
- `coderflex/laravel-ticket`
- `laravel/fortify`
- `mailgun/mailgun-php`

## 3) Modules fonctionnels
Les routes montrent les principaux domaines metier:
- Dashboard
- Tickets (CRUD, statut, priorite, lien avec commande, impression etiquette)
- Messages de ticket (liste, ajout, suppression)
- Commandes (CRUD, creation en lot, statut)
- Utilisateurs (CRUD + note interne + envoi setup mot de passe)
- Agents (CRUD)
- Parametres utilisateur (profil, mot de passe, apparence, 2FA, etiquette ticket)

## 4) Arborescence utile
- `app/Http/Controllers`: logique des actions HTTP
- `app/Models`: modeles metier (`Ticket`, `Commande`, `Message`, `Agent`, etc.)
- `routes/`: definition des routes web par domaine
- `resources/js/`: interface React/TypeScript
- `database/migrations`: structure de base de donnees
- `database/seeders`: donnees de depart
- `config/`: configuration applicative

## 5) Prerequis
Prerequis minimaux pour developpement local:
- PHP 8.2+
- Composer 2+
- Node.js 20+ (recommande) et npm
- Une base de donnees:
  - SQLite (rapide en local), ou
  - MySQL/MariaDB
- Extensions PHP usuelles Laravel (selon environnement):
  - `mbstring`, `openssl`, `pdo`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath`, `fileinfo`

## 6) Installation locale
1. Cloner le projet:
```bash
git clone <url-du-repo>
cd SupportPC
```

2. Installer les dependances backend:
```bash
composer install
```

3. Creer le fichier d'environnement:
```bash
cp .env.example .env
php artisan key:generate
```

4. Configurer la base de donnees dans `.env`.

5. Lancer les migrations:
```bash
php artisan migrate
```

6. (Optionnel) Seeder des donnees:
```bash
php artisan db:seed
```

7. Installer les dependances frontend:
```bash
npm install
```

8. Lancer en developpement:
```bash
composer run dev
```

Alternative (setup rapide):
```bash
composer run setup
```

## 7) Commandes utiles (dev/qualite)
- Lancer les tests:
```bash
composer run test
```

- Verifier types TypeScript:
```bash
npm run types
```

- Lint frontend:
```bash
npm run lint
```

- Formater:
```bash
npm run format
```

- Build production frontend:
```bash
npm run build
```

## 8) Strategie de versionning conseillee
Workflow simple recommande:
1. Creer une branche de feature: `feature/nom-court`
2. Developper + tester en local
3. Ouvrir une Pull Request vers `main`
4. Validation + merge
5. Tagger une version (ex: `v1.3.0`)
6. Deployer cette version en production

Exemple:
```bash
git checkout main
git pull origin main
git tag v1.3.0
git push origin v1.3.0
```

## 9) Procedure pour push une nouvelle version en production
Cette section est le runbook principal.

### 9.1 Avant de deployer
- Verifier que la PR est mergee sur `main`.
- Verifier que les tests passent.
- Verifier les migrations (impact schema/donnees).
- Sauvegarder la base de donnees de production.

### 9.2 Deploiement standard (serveur Linux)
Dans le dossier de l'application sur le serveur:
```bash
cd /var/www/supportpc
git fetch --all
git checkout main
git pull origin main

composer install --no-dev --optimize-autoloader
npm ci
npm run build

php artisan migrate --force

php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

php artisan queue:restart
```

Si vous utilisez un process manager (supervisor/systemd), redemarrer proprement les workers PHP-FPM/queue selon votre infra.

### 9.3 Deploiement base sur tag (plus sur)
```bash
cd /var/www/supportpc
git fetch --tags
git checkout v1.3.0

composer install --no-dev --optimize-autoloader
npm ci
npm run build
php artisan migrate --force
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan queue:restart
```

### 9.4 Rollback rapide
En cas de probleme apres deploiement:
```bash
cd /var/www/supportpc
git reflog --date=local -n 5
# identifier le commit precedent stable

git checkout <commit_ou_tag_stable>
composer install --no-dev --optimize-autoloader
npm ci
npm run build
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan queue:restart
```

Si une migration destructive a ete appliquee, restaurer depuis sauvegarde BDD.

## 10) Variables d'environnement importantes (production)
A adapter dans `.env` en prod:
- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://votre-domaine`
- `DB_*` (connexion base de donnees)
- `MAIL_*` (SMTP/Mailgun)
- `QUEUE_CONNECTION` (ex: database, redis)
- `CACHE_STORE` (ex: database, redis)

Bonnes pratiques:
- Ne jamais versionner `.env`.
- Faire une sauvegarde BDD avant migration.
- Deployer de preference avec un tag (version figee).

## 11) Checklist de mise en production
- [ ] Backup base de donnees effectue
- [ ] Tests OK
- [ ] Build frontend OK
- [ ] Migrations validees
- [ ] Variables `.env` verifiees
- [ ] Cache Laravel regenere
- [ ] Workers queue redemarres
- [ ] Verification fonctionnelle post-deploiement (login, dashboard, tickets, commandes)

---

## 12) Notes d'exploitation
- En local, la commande `composer run dev` demarre le serveur Laravel, le worker queue et Vite en parallele.
- En production, separer les processus (web, queue, scheduler) et superviser les workers (supervisor/systemd).
- Penser a configurer une tache cron pour le scheduler Laravel si des taches planifiees sont utilisees:
```bash
* * * * * cd /var/www/supportpc && php artisan schedule:run >> /dev/null 2>&1
```
