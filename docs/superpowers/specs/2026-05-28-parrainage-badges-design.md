# Badges de parrainage (couronne) + numéro de fondateur — Design

## Contexte

Le système de parrainage existe **déjà** de bout en bout côté back-end :

- Table `public.waitlist` avec `ref_code` (code du parrain) et
  `referrer_ref_code` (code utilisé par le filleul à l'inscription).
- `GET /api/prospect/parrainage` renvoie `refCode`, la liste des
  `filleuls`, `count`, `cap` (= 10), `remaining`, `vipEligible`.
- Un trigger Postgres
  (`20260504100000_waitlist_referrer.sql`) **bloque** toute nouvelle
  inscription au-delà de 10 filleuls par code (exception `P0001`).
- Un « fondateur » (`prospects.is_founder`) = un compte dont l'e-mail est
  présent dans la waitlist avant la date de lancement
  (`20260508120000_founders_program.sql`).
- « Parrain » et « fondateur » sont **conceptuellement fusionnés**
  (cf. `20260512190000_founder_vip_bonus.sql`).

Cette feature **n'invente pas** de parrainage : elle ajoute une couche de
**présentation** (badge couronne par palier, numéro de fondateur, popup
explicatif) et **désactive le lien** de parrainage côté UI une fois le
plafond atteint.

La feature doit être déployée **à l'identique sur le web (Next.js) et le
mobile (React Native / Expo, worktree `worktree-mobile-app`)**, qui
partagent le même back-end `/api/*`.

## Objectifs (in-scope)

- **Badge couronne** attribué selon le nombre de filleuls du membre :
  - 0 filleul → **aucun badge**
  - 1-2 → 👑 **cuivre**
  - 3-9 → 👑 **argent**
  - 10 → 👑 **or**
- **Numéro de fondateur** (`#23`) = rang d'inscription sur la waitlist
  (ordre `created_at` croissant ; 1ᵉʳ inscrit = `#1`). Calculé à la
  lecture, **sans nouvelle colonne DB**.
- **Popup au clic sur le badge** (identique web + mobile), affichant :
  - la couronne du palier courant + le numéro de fondateur ;
  - les **3 paliers** (couleur + plage de filleuls), chacun avec un
    libellé d'avantage en **placeholder « à venir »** ;
  - le **palier courant mis en évidence**.
- **Désactivation du lien de parrainage** dans l'écran Parrainage
  (web + mobile) quand `remaining === 0` : lien grisé + message
  « Plafond de 10 filleuls atteint ».
- **Emplacements du badge** :
  - **Web** : `Pro.jsx` → `ProHeader`, à droite du label
    `— {raison sociale} · {secteur}`.
  - **Mobile** : `app/(prospect)/portefeuille.tsx` (écran d'accueil) →
    hero gradient, à droite du greeting.
- Centraliser la logique de palier (seuils) dans **une seule** lib
  partagée pour éviter la duplication web/mobile.

## Non-objectifs (YAGNI)

- Définir le **contenu** des avantages cuivre/argent/or (placeholders
  pour l'instant, à remplir plus tard par l'utilisateur).
- Toute modification du mécanisme de bonus existant (VIP +5 €, ×2
  fondateur) : on **affiche**, on ne recalcule pas la récompense.
- Stockage en base du numéro de fondateur ou du palier (tout est dérivé
  à la lecture depuis `waitlist`).
- Badge / numéro pour un membre à **0 filleul** (pas de surface
  d'affichage — choix produit assumé).
- Affichage du badge ailleurs que les 2 emplacements ci-dessus (ex :
  dashboard prospect web, listes de contacts pro…).

## Décisions tranchées

1. **Numéro de fondateur = rang d'inscription waitlist** (`created_at`
   croissant), calculé à la lecture. Pas de colonne ajoutée.
2. **0 filleul = pas de badge** → donc ni popup ni numéro visible.
3. **Couronne mobile = pastille `LinearGradient`** aux couleurs du palier
   (pattern existant `CoinBadge`), **sans** ajouter `react-native-svg`.
4. **Web sur `Pro.jsx`** (choix explicite utilisateur) : le badge
   n'apparaît pour un pro **que si son e-mail est dans la waitlist**.
   Sinon `badgeTier = null` → rien ne s'affiche. Comportement assumé.

## Architecture

### 1. Lib partagée — `lib/waitlist/referral.ts` (nouveau)

```ts
export type ReferralBadgeTier = "cuivre" | "argent" | "or";

export function referralBadgeTier(count: number): ReferralBadgeTier | null {
  if (count >= 10) return "or";
  if (count >= 3)  return "argent";
  if (count >= 1)  return "cuivre";
  return null;
}

export type ReferralStatus = {
  refCode: string;
  count: number;
  cap: number;          // 10
  remaining: number;
  badgeTier: ReferralBadgeTier | null;
  founderNumber: number | null;   // rang waitlist (1-based), null si pas inscrit
  isFounder: boolean;             // = présent dans la waitlist
};

// getReferralStatus(admin, email) :
//   - lit la row waitlist par email (ilike) → refCode (+ created_at).
//   - compte les filleuls (referrer_ref_code = refCode).
//   - founderNumber = count(*) waitlist WHERE created_at <= myCreatedAt.
//   - badgeTier = referralBadgeTier(count).
//   - si pas de row waitlist : isFounder=false, founderNumber=null,
//     badgeTier dérivé du count (0 → null), refCode = refCodeFromEmail(email).
```

Le calcul du numéro réutilise `created_at` de la row waitlist : un simple
`select count(*) from waitlist where created_at <= :myCreatedAt`. Index
`created_at` existant suffisant pour le volume pré-lancement.

> **Note sémantique** : ici `isFounder` = « présent dans la waitlist » et
> `founderNumber` = rang d'inscription parmi **tous** les inscrits waitlist.
> C'est **volontairement distinct** de la colonne DB `prospects.is_founder`
> (qui exige `created_at <= launch_at` et gate la fenêtre de bonus). On ne
> touche pas à cette colonne ni au mécanisme de bonus : on n'expose qu'un
> numéro/affichage dérivé de la waitlist.

### 2. API

- **Étendre** `GET /api/prospect/parrainage/route.ts** : refactoré pour
  s'appuyer sur `getReferralStatus`, en **conservant** la forme de réponse
  actuelle (`refCode`, `filleuls`, `count`, `cap`, `remaining`,
  `vipEligible`, `launchAt`, `vip*`) et en **ajoutant** :
  - `badgeTier: "cuivre" | "argent" | "or" | null`
  - `founderNumber: number | null`
  - `isFounder: boolean`

  Consommé par : écran Parrainage web (`Prospect.jsx`), écran + hero
  mobile (`useParrainage`).

- **Nouveau** `GET /api/me/referral/route.ts** : wrapper neutre (role-
  agnostique) qui appelle `getReferralStatus` et renvoie
  `{ badgeTier, founderNumber, isFounder, count, cap, remaining, refCode }`.
  Consommé par `ProHeader` (espace pro) pour éviter d'appeler un endpoint
  nommé « prospect » depuis le dashboard pro.

### 3. Front-end web

- **`public/prototype/components/Pro.jsx`** :
  - `ProHeader` (≈ ligne 400) : fetch `/api/me/referral`, rendu d'un
    `<ReferralBadge tier founderNumber/>` à droite du label
    `— {raison} · {secteur}` (seulement si `badgeTier !== null`).
  - Composant **`ReferralBadge`** (couronne SVG inline recolorée par
    palier) + **`ReferralBadgePopup`** (modal : couronne + `#numéro` +
    3 paliers avec avantage placeholder + palier courant en surbrillance).
    Réutilisable, défini dans `Pro.jsx` (ou un petit fichier partagé du
    prototype si déjà chargé par les deux dashboards).
- **`public/prototype/components/Prospect.jsx`** :
  - Écran Parrainage (`Parrainage()`, ≈ 6287-6573) : quand
    `remaining === 0`, griser le lien/bouton de copie + message
    « Plafond de 10 filleuls atteint ».

### 4. Front-end mobile (`worktree-mobile-app/mobile`)

- **`lib/queries.ts`** : étendre le type `Parrainage` (+ `badgeTier`,
  `founderNumber`, `isFounder`).
- **`components/`** : composant `ReferralBadge` (pastille `LinearGradient`
  cuivre/argent/or + glyphe couronne) + `ReferralBadgePopup` (Modal RN :
  couronne + `#numéro` + 3 paliers + palier courant).
- **`app/(prospect)/portefeuille.tsx`** (hero, ≈ 187-192) : afficher le
  badge à droite du greeting (flex-row) si `badgeTier !== null` ; tap →
  ouvre le popup. Source : `useParrainage()`.
- **`app/(prospect)/parrainage.tsx`** : quand `remaining === 0`, griser le
  lien + message plafond.

### Palette des couleurs

| Palier | Filleuls | Couleur (référence) |
|--------|----------|---------------------|
| cuivre | 1-2 | dégradé cuivre (#B87333 / #8C5A2B) |
| argent | 3-9 | dégradé argent (#C0C0C0 / #8A8A8A) |
| or | 10 | dégradé or (#FCD34D / #B8860B) — cohérent avec le doré VIP existant |

Couleurs finales harmonisées avec les variables CSS du prototype web et
les `tone` NativeWind du mobile lors de l'implémentation.

## Flux de données

1. À l'affichage du dashboard pro (web) / de l'accueil (mobile), le front
   appelle l'API (`/api/me/referral` ou `useParrainage`).
2. L'API lit la waitlist par e-mail Clerk → `getReferralStatus`.
3. Le front affiche le badge si `badgeTier !== null`.
4. Au clic/tap, le popup affiche numéro + paliers + palier courant
   (déduit de `badgeTier`).
5. L'écran Parrainage lit `remaining` pour activer/désactiver le lien.

## Gestion des erreurs / cas limites

- **Pas d'e-mail primaire Clerk** → API renvoie l'état « pas de badge »
  (comme aujourd'hui : 400 `no_email` sur `/api/prospect/parrainage` ;
  `/api/me/referral` renverra `badgeTier: null` plutôt que 400 pour ne
  pas casser le header).
- **Pas inscrit waitlist** → `founderNumber: null`, `isFounder: false`,
  `badgeTier` dérivé du count (0 → null).
- **Membre à 0 filleul** → aucun badge, aucun popup (assumé).
- **`remaining === 0`** → lien désactivé (UI) ; le back reste la source de
  vérité (trigger Postgres).
- L'API reste tolérante si `app_config` / `launch_at` absent (le numéro
  ne dépend pas de `launch_at`, seulement du rang `created_at`).

## Tests

- **Unitaire** `referralBadgeTier`: 0→null, 1→cuivre, 2→cuivre,
  3→argent, 9→argent, 10→or, 11→or.
- **Unitaire** `getReferralStatus` (mock Supabase) : présence/absence de
  row waitlist, calcul du rang, calcul du count.
- **API** `/api/me/referral` : authentifié vs non, e-mail dans/hors
  waitlist.
- **Manuel web** : badge visible dans `ProHeader` selon le count, popup au
  clic, lien grisé à 10 dans l'écran Parrainage.
- **Manuel mobile** : badge dans le hero accueil, popup au tap, lien grisé
  à 10 dans l'écran parrainage.

## Impacts inter-plateformes

- L'extension de `/api/prospect/parrainage` est **rétro-compatible**
  (champs ajoutés, rien retiré) → ne casse pas le mobile existant.
- Le nouveau `/api/me/referral` est additif.
- Aucune migration DB (calcul à la lecture).
