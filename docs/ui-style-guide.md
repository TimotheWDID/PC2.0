# SupportPC UI Style Guide

## Objectif
Maintenir un rendu professionnel, coherent et lisible sur toutes les pages desktop/mobile.

## Principes
- Utiliser les tokens de theme, jamais de couleurs Tailwind hardcodees.
- Garder une hierarchie visuelle simple: page -> section -> card -> action.
- Prioriser la lisibilite: contrastes, espacements, feedback clair.

## Tokens a utiliser
- Fond de page: `bg-background`
- Surface card/panel: `bg-card`, `border-border`
- Texte principal: `text-foreground`
- Texte secondaire: `text-muted-foreground`
- Action principale: `bg-primary text-primary-foreground`
- Action secondaire: `variant='outline'` ou `bg-secondary text-secondary-foreground`
- Erreur: `text-destructive`, `border-destructive/25`, `bg-destructive/10`

## Composants
- Boutons: utiliser `Button` et ses variants.
- Inputs/select/textarea: utiliser les composants UI du dossier `components/ui`.
- Mise en page page metier: toujours via `AppLayout`.
- Pages auth: toujours via `AuthLayout`.

## Statuts de commande
Utiliser les classes semantiques definies dans `resources/css/app.css`:
- `status-badge-new`
- `status-badge-panier`
- `status-badge-commande`
- `status-badge-reception`
- `status-badge-traite`

## Responsive
- Mobile-first: commencer en colonne, puis enrichir avec `sm`, `md`, `lg`.
- Cibles tactiles minimum: 40px de haut.
- Eviter les tableaux non scrollables sur mobile: prevoir cartes ou `overflow-x-auto`.

## Accessibilite
- Messages de confirmation/etat: `role='status'` + `aria-live='polite'`.
- Formulaires: labels explicites, erreurs proches du champ.
- Focus visible preserve via les styles focus des composants UI.

## Checklist avant merge
- Aucune couleur hardcodee type `text-blue-600`, `bg-gray-50`, etc.
- Cards et formulaires alignes sur le style commun.
- Desktop + mobile verifies visuellement.
- Feedback utilisateur (success/error/loading) present et lisible.
