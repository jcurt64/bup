# Pro dashboard — données vivantes (Phase B) — design

Date : 2026-05-04
Statut : approuvé pour implémentation
Phase : B (cf. brainstorming session — A reporté à phase 2 : CampaignDetail + Heatmap réelle)

## Objectif

Remplacer les valeurs hardcodées résiduelles dans la page pro par des
données réelles fetched depuis Supabase, et activer les chips de période
de la "Performance des campagnes". Périmètre : ProHeader, Vue d'ensemble
> Performance des campagnes, Campagnes (liste + toggle pause/play),
Mes informations.

Hors-scope : `CampaignDetail` (lourd, mérite son propre plan), Heatmap
"Meilleurs créneaux" (pseudo-aléatoire OK pour MVP), boutons Dupliquer
et Détails dans la liste Campagnes.

## Architecture

```
ProHeader.useEffect → GET /api/pro/overview
    └── retourne { contactsAcceptedThisMonth, activeCampaignsCount,
                   acceptanceRate, contactsAccepted30d, … }

Overview "Performance des campagnes"
    ├── 3 chips 7J/30J/90J → setRange()
    └── useEffect[range] → GET /api/pro/timeseries?range=…
        └── retourne { range, buckets: [{ start, end, label, count }] }

Campagnes (liste)
    ├── useEffect → GET /api/pro/campaigns
    └── chip "Pause"/"Relancer" → PATCH /api/pro/campaigns/[id]
        └── body: { status: 'paused' | 'active' }

ProDashboard.useEffect → GET /api/pro/info
    └── hydrate companyInfo
MesInformations modale "Modifier" → PATCH /api/pro/info
```

## Composants

### 1. Extension de `/api/pro/overview`

Ajout de 2 champs à la réponse JSON existante :

- `contactsAcceptedThisMonth` : `count(relations)` où `status in
  (accepted, settled)` ET `decided_at >= start_of_calendar_month`.
- `activeCampaignsCount` : `count(campaigns)` où `pro_account_id = proId`
  ET `status = 'active'`.

Pas de changement de signature pour les champs existants. Implémentation :
2 sous-requêtes ajoutées dans le handler, en parallèle des reads
existants via `Promise.all`. Aucun coût supplémentaire significatif —
les données sont déjà filtrées `pro_account_id = proId`.

**ProHeader (Pro.jsx ligne ~89)** : ajoute un `useEffect` qui fetch
`/api/pro/overview` et compose la phrase :

> `{balanceText} de crédit actif · {contactsThisMonth} contacts ce mois`
>
> `{activeCampaigns} campagnes actives · taux d'acceptation moyen
>  {acceptanceRate}% · ROI estimé ×{roi}`

Si l'API n'a pas répondu, on garde `…` pour les valeurs numériques (pas
de zéros prématurés qui donneraient l'impression d'un compte vide).
ROI utilise la même heuristique `(1 + k1 * 0.15).toFixed(1)` que la KPI
card de l'Overview, par cohérence.

### 2. Nouvelle route `/api/pro/timeseries`

`GET /api/pro/timeseries?range=7d|30d|90d`

Body de réponse :

```ts
{
  range: '7d' | '30d' | '90d';
  buckets: Array<{
    start: string;   // ISO date du début du bucket
    end: string;     // ISO date de fin
    label: string;   // libellé prêt à afficher dans la barre
    count: number;   // # acceptations dans le bucket
  }>;
}
```

Découpage :

- **7d** : 7 buckets quotidiens, label = jour de la semaine français
  abrégé (`Lun`, `Mar`, …, `Dim`).
- **30d** : 10 buckets de 3 jours chacun, label = numéro du bucket
  (`J-27`, `J-24`, …, `J-0`) — le dernier inclut aujourd'hui.
- **90d** : 13 buckets hebdomadaires (13×7 = 91 jours, on garde le bucket
  le plus ancien légèrement plus court), label = `S1`..`S13`. Le bucket
  `S13` correspond à la semaine en cours.

Algorithme : 1 SELECT `relations.decided_at` filtré sur
`status in ('accepted','settled')` et `decided_at >= range_start`,
itération JS pour bucketiser. Aucun GROUP BY SQL — quelques milliers
de relations max par pro, JS bucketize est suffisant et plus testable.

`range_start` :
- 7d → `now - 7 days`
- 30d → `now - 30 days`
- 90d → `now - 91 days` (13 semaines exactes)

Composant `BarChart` (Pro.jsx ligne ~248) :
- Devient `function BarChart({ buckets }) {…}`.
- Lit `max = Math.max(...buckets.map(b => b.count), 1)`.
- 3 grid lines aux multiples du max (max/4, max/2, max*0.75, max).
- Label X = `b.label`. Hauteur = `(b.count / max) * H`.
- Couleur dernier bucket = `var(--accent)`, autres = `var(--ink-2)` (pattern actuel).

Composant `Overview` :
- État `range` (default `'30d'`) + état `series` (null = loading).
- `useEffect[range]` fetch `/api/pro/timeseries?range=${range}`.
- 3 chips deviennent boutons actifs, le chip actif a fond `var(--ink)`.

### 3. Onglet Campagnes — liste réelle

`GET /api/pro/campaigns` (nouvelle méthode sur path existant — coexiste
avec POST déjà déployé). Filtre `pro_account_id = proId`. Retourne :

```ts
{
  campaigns: Array<{
    id: string;
    name: string;
    status: 'draft' | 'active' | 'paused' | 'completed' | 'canceled';
    objectiveLabel: string;       // ex. "Prise de rendez-vous"
    budgetEur: number;
    spentEur: number;
    contactsCount: number;        // # relations status accepted|settled
    createdAt: string;            // ISO
    avgCostEur: number;           // cost_per_contact_cents / 100
  }>;
}
```

`objectiveLabel` : `targeting.objectiveId` (`contact|rdv|evt|dl|survey|
promo|addigital`) → libellé humain. Comme `OBJECTIVES` (Pro.jsx) ne peut
pas être importé côté serveur (JSX iframe), on duplique le mapping dans
`lib/campaigns/mapping.ts` via une nouvelle fonction `objectiveLabel(id)`
qui retourne :
- `contact` → "Prise de contact direct"
- `rdv` → "Prise de rendez-vous"
- `evt` → "Événementiel & inscription"
- `dl` → "Contenus à télécharger"
- `survey` → "Études & collecte d'avis"
- `promo` → "Promotions & fidélisation"
- `addigital` → "Publicité digitale"
- fallback → "Campagne"

`contactsCount` : LEFT JOIN sur `relations` filtré
`status in ('accepted','settled')` ; comptage via une `Map<campaignId, count>`
côté Node après un SELECT séparé sur `relations` (plus simple et rapide
qu'un GROUP BY pour les volumes attendus).

Composant `Campagnes` (Pro.jsx ligne ~317) :
- Remplace le tableau `camps` hardcodé par un fetch.
- Filtres "Toutes (X)", "Actives (Y)", "En pause (Z)", "Terminées (W)" :
  X/Y/Z/W calculés depuis la liste réelle.
- Empty state : `{campaigns.length === 0 && <CTA onClick={onCreate}>Créer
  votre première campagne</CTA>}`.
- Le bouton "Détails" devient un no-op temporaire (visible mais pointe
  vers `onDetail(campaign)` qui passe l'objet réel — la page
  `CampaignDetail` reste hardcodée pour cette phase).

### 4. PATCH `/api/pro/campaigns/[id]` — toggle pause/play

Body : `{ status: 'active' | 'paused' }`. Toute autre valeur → 400.
Validation :
- Authentification Clerk.
- Ownership : `campaigns.pro_account_id` matche `ensureProAccount(userId)`.
- Transitions autorisées :
  - `active → paused` : OK.
  - `paused → active` : OK seulement si `ends_at > now()`.
  - Autres transitions (ex. `completed → active`) : 409.

Composant `Campagnes` : le bouton "Pause"/"Relancer" appelle PATCH puis
ré-fetch la liste pour refléter le nouveau statut.

### 5. Mes informations — `/api/pro/info`

`GET /api/pro/info` → retourne :

```ts
{
  raisonSociale: string;
  adresse: string | null;
  ville: string | null;
  codePostal: string | null;
  siren: string | null;
  secteur: string | null;
}
```

`PATCH /api/pro/info` → accepte les mêmes champs (tous optionnels), fait
un `update` ciblé sur `pro_accounts` filtré par `clerk_user_id`. Le SIREN
est validé contre la regex DB (`^[0-9]{9}$`) ; valeur invalide → 400.

Composant `ProDashboard` (ligne ~33) :
- Remplace le `useState({raisonSociale: 'Atelier Mercier', …})` par un
  `useState({raisonSociale: '', adresse: '', ville: '', codePostal: '',
  siren: '', secteur: ''})`.
- `useEffect` au montage : fetch `/api/pro/info`, hydrate l'état.
- `setCompanyInfo` reste exposé tel quel — le composant
  `MesInformations` continue de l'appeler ; on intercepte via un wrapper
  qui fait aussi le PATCH.

Composant `MesInformations` :
- Modale "Modifier" existante : à la confirmation, appelle
  `setInfo({...info, [key]: newValue})` qui déclenche le PATCH.
- Pas de mode optimiste rollback ici — on attend la réponse OK avant de
  fermer la modale (les modifs sont rares et délibérées).
- Au PATCH success, on dispatche `pro:info-changed` (cohérent avec le
  pattern `pro:wallet-changed`) pour permettre à d'autres composants
  d'écouter (ex. ProHeader pour rafraîchir le `raison`).

### 6. Erreurs / cas limites

- ProHeader : si `/api/pro/overview` 401, on n'affiche pas la phrase
  inférieure. Comportement actuel.
- Timeseries : si 0 acceptations dans la période, tous les buckets
  retournent `count: 0`. Le BarChart affiche des barres minuscules
  (max=1, count=0 → height=0). Pas d'empty-state visuel — les chips de
  période suffisent à donner du contexte.
- Campagnes liste vide : empty state CTA "Créer votre première campagne".
- PATCH campagne sur une campagne qui n'appartient pas au pro courant : 403.
- PATCH info sur SIREN non-conforme : 400 avec `{ error: 'invalid_siren' }`.

### 7. Tests manuels

1. Sur le compte pro existant :
   - Header : voir "X contacts ce mois · Y campagnes actives" mis à
     jour selon les données réelles.
2. Vue d'ensemble :
   - Cliquer 7J/30J/90J → le BarChart se ré-rend avec les bons buckets.
3. Onglet Campagnes :
   - Voir la (les) campagne(s) lancée(s) précédemment au lieu des fakes.
   - Cliquer "Pause" sur une campagne active → status passe à `paused`,
     chip devient "En pause".
   - Cliquer "Relancer" → status repasse à `active`.
4. Onglet Mes informations :
   - Recharger la page → champs affichent les valeurs persistées (pas
     "Atelier Mercier" si le pro a saisi autre chose).
   - Modifier la raison sociale → après fermeture de la modale, le
     header reflète la nouvelle valeur.

### 8. Hors-scope confirmés

- `CampaignDetail` : reste hardcodé. Phase 2.
- `Analytics > Heatmap "Meilleurs créneaux"` : reste pseudo-aléatoire.
  Phase 2.
- `Campagnes > Dupliquer` : no-op. Phase 2.
- `Facturation > Renouvellement / Carte enregistrée` : restent
  décoratifs (Stripe portal + carte enregistrée demandent une intégration
  Stripe Customer Portal). Phase 2.
