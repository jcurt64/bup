# Cookie Consent (RGPD) — Design

## Objectif
Mettre en place un dispositif de gestion des cookies conforme RGPD/CNIL : bouton flottant permanent (bas-gauche), modal de gestion avec toggles par catégorie, bandeau auto-ouvert à la première visite, lien vers la page RGPD du site.

## Périmètre
- Présent sur **toutes les pages** (monté dans `app/layout.tsx`).
- Aucune dépendance externe ajoutée.
- Données fictives — l'utilisateur complétera le catalogue cookies plus tard.

## Architecture

### Fichiers créés
- `app/_components/CookieConsent.tsx` — composant client unique. Exporte `<CookieConsent />`. Gère bandeau, bouton flottant, modal, persistance.
- `app/_components/cookie-data.ts` — catalogue fictif des cookies, structure typée. Modifiable sans toucher au composant.
- `app/rgpd/page.tsx` — page RGPD placeholder (titre + sections vides à compléter).

### Fichiers modifiés
- `app/layout.tsx` — montage de `<CookieConsent />` à l'intérieur du `<body>`, avant `<RouteNav />`.
- `app/page.tsx` — `Footer()` : ajouter `href: "/rgpd"` au lien "RGPD" (les autres liens légaux restent textuels jusqu'à création des pages).

## Modèle de données

### Type `CookieCategory` (dans `cookie-data.ts`)
```ts
type CookieEntry = {
  name: string;        // ex: "_ga"
  provider: string;    // ex: "Google LLC"
  purpose: string;     // finalité humainement lisible
  duration: string;    // ex: "13 mois"
  type: "Premier" | "Tiers"; // 1ère / 3ème partie
};

type CookieCategory = {
  id: "essential" | "preferences" | "statistics" | "marketing";
  title: string;
  description: string;
  legalBasis: string;  // ex: "Consentement (art. 6.1.a RGPD)"
  required: boolean;   // true uniquement pour "essential"
  cookies: CookieEntry[];
};
```

### Catalogue fictif initial
- **Essentiels** (required) : `bupp_session`, `bupp_csrf`, `__cf_bm`
- **Préférences** : `bupp_lang`, `bupp_palette`
- **Statistiques** : `_ga`, `_ga_XXXXX` (Google Analytics)
- **Marketing** : `_fbp` (Meta), `li_at` (LinkedIn Insight)

### Persistance
Clé `localStorage` : `bupp:cookie-consent:v1`
```ts
{
  version: 1,
  decidedAt: ISO_8601,
  expiresAt: ISO_8601,           // decidedAt + 13 mois (CNIL)
  choices: {
    essential: true,             // toujours true
    preferences: boolean,
    statistics: boolean,
    marketing: boolean,
  }
}
```
- Si absent ou `expiresAt` dépassé → bandeau s'auto-ouvre.
- Toute mise à jour réécrit `decidedAt` et `expiresAt`.

## UX

### Bandeau première visite
- Position : bas d'écran, pleine largeur, fond `var(--ink)`, marge intérieure 20-24px.
- Contenu : titre court + 2 lignes de texte expliquant l'usage des cookies + lien "En savoir plus" → `/rgpd`.
- Boutons (même taille, même hiérarchie visuelle) :
  - **Tout refuser** (style outline blanc)
  - **Personnaliser** (style outline blanc) → ouvre le modal
  - **Tout accepter** (style plein, accent)
- Disparaît après tout choix enregistré ; le bouton flottant prend le relais.

### Bouton flottant permanent
- Position : `position: fixed; left: 22px; bottom: 24px; zIndex: 95;` (miroir du `StickyPreinscription` qui est à `right: 22, bottom: 24`).
- Pastille ronde 44px, fond `var(--paper)` ou `var(--ink)` selon contraste, icône cookie SVG inline (ajoutée à `IconName` ou inline locale au composant).
- `aria-label="Gérer les cookies"`.
- Toujours visible (pas de seuil de scroll) une fois le consentement initial donné.

### Modal de gestion
- Overlay `rgba(0,0,0,.5)`, panel centré `maxWidth: 560px`, scrollable, padding généreux.
- En-tête : titre "Gestion des cookies" + croix de fermeture + courte intro + lien "Voir notre politique RGPD" → `/rgpd`.
- Pour chaque catégorie (ordre : essential, preferences, statistics, marketing) :
  - Ligne titre + toggle (essentials : toggle visuellement désactivé et forcé ON).
  - Description finalité + base légale (petit texte secondaire).
  - Détails repliables (`<details>` natif suffit) listant chaque cookie : tableau ou liste (nom · fournisseur · finalité · durée · type).
- Pied : 3 boutons → **Tout refuser**, **Tout accepter**, **Enregistrer mes choix**.
- Fermeture : croix, clic sur overlay, touche `Escape`.

## Comportement & API interne

`<CookieConsent />` gère localement (`useState`) :
- `consent: ConsentState | null`
- `bannerOpen: boolean`
- `modalOpen: boolean`
- `pending: ConsentChoices` (état temporaire pendant l'édition dans le modal)

Hydratation :
- `useEffect` au mount : lire `localStorage`. Si invalide ou expiré → `bannerOpen = true`.
- Tant que pas hydraté, ne rien rendre (évite mismatch SSR).

Helpers exportés (potentiellement utiles ailleurs, mais YAGNI — on ne les exporte que si un besoin se présente) :
- aucun pour la v1.

## Accessibilité
- Modal : `role="dialog"`, `aria-modal="true"`, `aria-labelledby`. Focus trap simple (focus sur premier bouton à l'ouverture, `Escape` ferme).
- Bandeau : `role="region"`, `aria-label="Bandeau de consentement aux cookies"`.
- Toggles : `<button role="switch" aria-checked>` ou `<input type="checkbox">` natif stylé.
- Contraste AA min sur tous les boutons.

## Conformité RGPD couverte
- Refus aussi simple qu'acceptation (boutons même hiérarchie).
- Granularité par catégorie.
- Essentiels distincts, non-désactivables.
- Pour chaque cookie : nom, finalité, durée, fournisseur, type.
- Aucun cookie non-essentiel posé avant consentement (le composant ne charge aucun script tiers — c'est à l'app de lire les choix avant d'injecter ses scripts ; hors scope v1, mais le state est lisible via `localStorage`).
- Consentement révocable à tout moment (bouton flottant).
- Lien vers politique RGPD complète.
- Horodatage `decidedAt` (preuve), expiration 13 mois.

## Hors scope (v1)
- Chargement conditionnel de scripts tiers (Analytics, Pixel) selon les choix — l'utilisateur l'ajoutera quand il branchera ces services.
- I18n : tout en français (cohérent avec `<html lang="fr">`).
- Tests automatisés : pas de framework de tests dans le projet à ce jour.
- Synchronisation serveur du consentement.

## Données fictives — extrait `cookie-data.ts`
Le contenu est volontairement remplaçable. L'utilisateur le complétera avec les vrais cookies utilisés.
