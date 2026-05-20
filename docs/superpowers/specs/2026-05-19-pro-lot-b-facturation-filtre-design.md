# Espace Pro — Lot B : Facturation données réelles + filtre contacts — Design

Date : 2026-05-19
Statut : approuvé (design), prêt pour planification d'implémentation
Approche retenue : **A** (filtrage côté serveur, params optionnels rétro-compatibles)

## Contexte

Lot B issu de la décomposition de la demande Pro multi-items (lots A
livré/déployé, C clos sans code, D livré/déployé, E abandonné par
l'utilisateur). Trois sous-items dans la zone Facturation / détail
campagne du dashboard pro :

1. Card « Abonnement actuel » : afficher campagnes utilisées vs
   restantes (aujourd'hui : libellé plan + prix + max campagnes).
2. Card « Carte enregistrée » : vraies données carte bancaire (Stripe),
   aujourd'hui codées en dur `Visa ••4521 / Expire 08/28`.
3. Bouton « Filtrer » de la liste « Contacts obtenus » d'une campagne :
   aujourd'hui inerte (pas de handler).

(La suppression de la card « Renouvellement » demandée initialement a
déjà été livrée dans le Lot A.)

## Décisions validées

1. **Carte Stripe** : afficher la vraie carte dès maintenant. En mode
   TEST (clés `sk_test`) → carte de test ; au passage LIVE → vraie
   carte, sans changement de code.
2. **Filtres contacts** : Statut, Score, Période. Le filtre « Palier »
   est **abandonné** — `tierLabel` est calculé au niveau campagne
   (`campaign.targeting.requiredTiers`, identique pour tous les contacts
   d'une campagne) → un filtre palier serait non discriminant (mort).
3. **Filtrage côté serveur**, params **optionnels** sur l'endpoint
   campagne existant (rétro-compatible, pas de casse mobile).
4. Le prix mensuel disparaît de la sous-ligne « Abonnement actuel »
   (réaffectée au quota ; le palier reste donné par le libellé du plan).

## Architecture

### 1. Card « Abonnement actuel » (UI seule — aucun backend)

Fichier : `public/prototype/components/Pro.jsx`, fonction `Facturation`,
tableau des cards KPI (~ligne 6007, entrée `'Abonnement actuel'`).

`/api/pro/plan` renvoie déjà `cycleCount` (campagnes lancées dans le
cycle de facturation courant) et `cap` (limite du plan : 2 starter / 10
pro). Modifier l'entrée de la card :

- valeur (slot `r[1]`) : `planInfo ? planInfo.label : '…'` (inchangé).
- sous-ligne (slot `r[2]`) :
  - si `planInfo` et `cycleCount`/`cap` numériques :
    `` `${cycleCount}/${cap} campagnes utilisées · ${Math.max(0, cap - cycleCount)} restante(s)` ``
  - sinon : `'—'`.

`cycleCount`/`cap` sont lus depuis l'objet `planInfo` déjà chargé
(`fetch('/api/pro/plan')`, état `planInfo`). Aucune nouvelle requête.

### 2. Card « Carte enregistrée » (nouvel endpoint + UI)

#### Endpoint : `app/api/pro/wallet/payment-method/route.ts` (créer)

- `export const runtime = "nodejs";`
- `GET` uniquement. Auth pro standard (pattern identique à
  `app/api/pro/wallet/route.ts`) :
  `auth()` → 401 si pas de `userId` ; `currentUser()` pour l'email ;
  `ensureProAccount({ clerkUserId, email })` → `proId` ;
  `createSupabaseAdminClient()`.
- Lire `pro_accounts.stripe_default_payment_method_id` (et
  `stripe_customer_id` pour cohérence) `eq("id", proId).single()`.
- Si `stripe_default_payment_method_id` est null/absent →
  `NextResponse.json({ card: null })`.
- Sinon, dans un `try` :
  - `const stripe = await getStripe();` (depuis `lib/stripe/server.ts`,
    import dynamique déjà en place).
  - `const pm = await stripe.paymentMethods.retrieve(pmId);`
  - réponse :
    ```json
    { "card": { "brand": pm.card?.brand ?? null,
                "last4": pm.card?.last4 ?? null,
                "expMonth": pm.card?.exp_month ?? null,
                "expYear": pm.card?.exp_year ?? null } }
    ```
  - `catch` : log console + `NextResponse.json({ card: null })` (la
    page Facturation ne doit jamais casser à cause de Stripe). Jamais
    de 500 sur cet endpoint d'affichage.

#### UI (`Pro.jsx`, `Facturation`)

- Ajouter un état `payCard` (init `undefined` = chargement) + un
  `fetch('/api/pro/wallet/payment-method', { cache:'no-store' })` dans
  le même `useEffect` que `planInfo` (ou un effet dédié), `setPayCard(j.card)`.
- Entrée card « Carte enregistrée » du tableau :
  - valeur : si `payCard === undefined` → `'…'` ; si `payCard` →
    `` `${titleCase(brand)} ••${last4}` `` ; sinon →
    `'Aucune carte enregistrée'`.
  - sous-ligne : si `payCard` → `` `Expire ${String(expMonth).padStart(2,'0')}/${expYear}` `` ;
    sinon → `'—'`.
  - `titleCase` : `brand[0].toUpperCase()+brand.slice(1)` (ex. `visa` →
    `Visa`), garde `'—'` si brand null.

### 3. Filtre « Contacts obtenus » (endpoint étendu + helper + UI)

#### Helper pur : `lib/pro/filterCampaignContacts.ts` (créer)

Signature :
```ts
export type ContactStatusFilter = "all" | "accepted" | "settled";
export type ContactPeriodFilter = "7d" | "30d" | "90d" | "all";

export type CampaignContact = {
  id: string;
  prospectId: string;
  name: string;
  score: number | null;
  tierLabel: string;
  decidedAt: string;
  statusLabel: string;
  statusChip: string;
  // statut brut conservé pour le filtre (ajouté au map de la route)
  status: string;
};

export function filterCampaignContacts(
  contacts: CampaignContact[],
  opts: { status: ContactStatusFilter; scoreMin: number | null; period: ContactPeriodFilter },
): CampaignContact[];
```
Règles :
- `status` : `accepted` → ne garder que `status === "accepted"` ;
  `settled` → `status === "settled"` ; `all` → garder
  `accepted`+`settled` (inchangé vs aujourd'hui).
- `scoreMin` : si non null, ne garder que `score != null && score >= scoreMin`.
- `period` : si ≠ `all`, ne garder que `new Date(decidedAt) >= cutoff`
  (`cutoff = now - {7|30|90}j`).
- Pur, déterministe, sans I/O → testable.

#### Endpoint : `app/api/pro/campaigns/[id]/route.ts` (modifier)

- Lire les query params optionnels :
  - `cstatus` ∈ `{all,accepted,settled}` (défaut `all`, valeur inconnue → `all`)
  - `cscoremin` : `Number(...)` → entier ≥ 0, sinon `null`
  - `cperiod` ∈ `{7d,30d,90d,all}` (défaut `all`, inconnu → `all`)
- Dans le pipeline `contacts` (~lignes 176-201) : ajouter `status: r.status`
  à l'objet mappé, puis remplacer le `.filter(accepted||settled).slice(0,50)`
  par : map complet (accepted+settled) → `filterCampaignContacts(list, opts)`
  → `.slice(0, 50)`.
- **`funnel` et `activity` restent calculés sur l'ensemble non filtré**
  (ce sont les stats globales de la campagne, pas la vue filtrée).
- Rétro-compatibilité : sans aucun param, comportement **identique** à
  l'actuel (status=all, scoreMin=null, period=all).

#### UI (`Pro.jsx`, `CampaignDetail`, section `tab === 'contacts'`)

- État local : `cFilters = { status:'all', scoreMin:'', period:'all' }`
  + `cFilterOpen` (bool).
- Le bouton « Filtrer » (~ligne 6951) bascule `cFilterOpen`.
- Panneau repliable sous l'en-tête : `<select>` Statut (Tous / En
  séquestre / Crédité), `<input type="number">` Score min, `<select>`
  Période (Tout / 7 j / 30 j / 90 j), boutons « Appliquer » et
  « Réinitialiser ».
- Le fetch existant du détail campagne (état `data`, ~ligne 6916) est
  paramétré : construire la query depuis `cFilters` (n'ajouter un param
  que s'il diffère du défaut) et re-fetch à « Appliquer ».
  « Réinitialiser » remet les défauts et re-fetch sans params.
- Indicateur visuel léger quand un filtre est actif (ex. pastille sur le
  bouton « Filtrer »). Empty state existant réutilisé (« Aucun contact …»).

## Gestion d'erreurs

- `payment-method` : toute erreur Stripe/DB → `{ card: null }` (dégradé,
  jamais 500). UI affiche « Aucune carte enregistrée ».
- `campaigns/[id]` : params invalides → coercition vers défaut (jamais
  d'erreur 400 pour un filtre malformé ; on dégrade vers « non filtré »
  pour ce param).
- Card abonnement : `cycleCount`/`cap` absents → `'—'`.

## Tests

Vitest couvre `lib/` (routes/prototype non testés unitairement — norme
repo).

- **TDD** : `tests/lib/pro/filterCampaignContacts.test.ts` écrit **avant**
  `lib/pro/filterCampaignContacts.ts`. Cas : status all/accepted/settled ;
  scoreMin (inclus/exclu, score null exclu si filtre actif) ; period
  7d/30d/90d/all (bornes ~ageMs) ; combinaisons ; liste vide.
- Vérif globale (non bloquante) : `tsc` 0, `eslint` 0 sur fichiers
  touchés, `vitest` vert (58 existants + nouveaux).
- Vérif manuelle : (a) card abonnement montre `x/cap utilisées · y
  restante(s)` ; (b) card carte = vraie carte test (ou « Aucune carte »
  si pas de PM) ; (c) panneau filtre : Statut/Score/Période modifient la
  liste, funnel inchangé, « Réinitialiser » restaure, sans param =
  liste d'origine.

## Impact mobile / transverse (règle permanente)

- `GET /api/pro/campaigns/[id]` est **partagé avec l'app pro mobile**.
  Les 3 params sont **optionnels** : un appel sans param renvoie
  exactement la même chose qu'aujourd'hui → **aucune casse mobile, aucune
  modif mobile requise**. Endpoint partagé modifié → à signaler.
- `GET /api/pro/wallet/payment-method` : **nouvel endpoint additif**
  (le mobile pourra le consommer plus tard, non requis ici).
- `/api/pro/plan` : **inchangé**.
- **Aucune migration / aucun changement de schéma.**
- Vue concernée = web (prototype `Pro.jsx`). Si parité visuelle mobile
  souhaitée → demande explicite séparée (cf. règle web/mobile).

## Hors périmètre

- Filtre « Palier » (abandonné — non discriminant par campagne).
- Recherche par nom (non retenue).
- Lever/changer le plafond 50 contacts (conservé tel quel, après filtre).
- Pagination des contacts au-delà de 50.
- Passage Stripe LIVE (le code gère déjà LIVE sans modification).
- Lot E (suppression de compte récupérable).
