# Acceptation des campagnes — design

Date : 2026-05-04
Statut : approuvé pour implémentation
Stratégie matching : exhaustif au lancement (option A)
Stratégie escrow : à l'acceptation (option B)

## Objectif

Câbler la boucle complète "un pro lance une campagne → des prospects matchants
reçoivent une notification (in-app + email) → ils acceptent ou refusent → les
écrans pro (Mes contacts, Analytics) reflètent les vraies données".

Aujourd'hui :
- le bouton "Lancer la campagne" génère un code random sans rien persister ;
- l'onglet "Mises en relation" prospect affiche 3 fixtures hardcodées ;
- les onglets "Mes contacts" et "Analytics" pro affichent des fixtures.

Après cette itération : tout est lu/écrit en base via Supabase, RLS-safe, avec
notification mail au prospect.

## Architecture

```
Pro clic "Lancer"
    │
    ▼
POST /api/pro/campaigns
    ├── ensureProAccount()
    ├── verify wallet ≥ total + planFee   (rejette 402 sinon)
    ├── INSERT campaigns (active)
    ├── SELECT prospects matchants (LIMIT contacts)
    ├── batch INSERT relations (status=pending, expires_at=+72h)
    └── fire-and-forget : sendRelationInvitation() pour chaque prospect
                           ↓
                        SMTP Gmail → prospect.email
                                     lien : ${APP_URL}/prospect?tab=relations

Prospect ouvre /prospect?tab=relations
    │
    ▼
GET /api/prospect/relations
    └── retourne { pending: [...], history: [...] }

Prospect clique Accepter/Refuser/Annuler
    │
    ▼
POST /api/prospect/relations/[id]/decision
    ├── accept  : pending → accepted   + débit wallet pro (transaction escrow)
    ├── refuse  : pending|accepted → refused
    │             si annulation d'une acceptation : refund au pro
    └── undo    : accepted|refused → pending
                  si depuis accepted : refund au pro
```

## Composants

### 1. Migration DB

Une migration `20260504210000_campaigns_brief_genre.sql` ajoute :

- `campaigns.brief text` — texte rédigé étape 7 du wizard.
- `campaigns.starts_at timestamptz default now()` — date de lancement explicite.
- `campaigns.matched_count integer default 0` — combien de relations créées (= taille du batch insert).
- `prospect_identity.genre text check (genre in ('femme','homme','autre'))` — pour Analytics.
- Index `relations_pro_pending_idx (pro_account_id, status)` (déjà couvert
  par l'index existant, no-op si redondant).

### 2. Backend — création de campagne

`app/api/pro/campaigns/route.ts` (nouveau, `POST` only) :

Body :

```ts
{
  name: string;             // "Bilan postural — Lyon" : libre, fallback sur brief
  objectiveId: string;      // 'contact' | 'rdv' | 'evt' | 'dl' | 'survey' | 'promo' | 'addigital'
  subTypes: string[];       // ['email','sms', ...] — sous-types cochés
  requiredTiers: number[];  // [1..5]
  geo: 'ville' | 'dept' | 'region' | 'national';
  ages: string[];           // ['Tous'] | ['18–25', ...]
  verifLevel: 'p0'|'p1'|'p2'|'p3';
  contacts: number;         // nombre de contacts visés
  days: number;             // durée (info, n'affecte pas l'expiry des relations)
  startDate: string;        // ISO date
  endDate: string;          // ISO date
  brief: string;            // ≤50 chars, mot du pro
  costPerContactCents: number;
  budgetCents: number;
  keywords: string[];
  kwFilter: boolean;        // strict ou priorité
  poolMode: 'standard' | 'pool';
}
```

Réponse :

```ts
{ campaignId: string; matchedCount: number; code: string }
```

Algorithme :

1. `ensureProAccount` (création défensive si webhook Clerk en retard).
2. Lire `pro_accounts.wallet_balance_cents` + `plan_pricing.monthly_cents`.
   Si `wallet < budget + planFee` → renvoyer `402 insufficient_funds`.
3. Mapper `objectiveId` → `campaign_type` enum DB :
   - `contact`  → `prise_de_contact`
   - `rdv`      → `prise_de_rendez_vous`
   - `survey`   → `information_sondage`
   - autres     → `prise_de_contact` par défaut (pas de devis dans le wizard)
   - mapping consigné dans `lib/campaigns/mapping.ts`.
4. INSERT `campaigns` (status=`active`, targeting=jsonb consolidé, brief, starts_at, ends_at=endDate).
5. Construire la requête de matching (cf. section 3) en service_role,
   `LIMIT contacts`.
6. Batch INSERT dans `relations` :
   ```sql
   INSERT INTO relations (campaign_id, pro_account_id, prospect_id,
                          motif, reward_cents, status, expires_at)
   VALUES (...) ON CONFLICT (campaign_id, prospect_id) DO NOTHING
   ```
   `motif` = `brief || obj?.name`. `reward_cents` = `costPerContactCents`
   (mise à 1:1 dans cette itération — le prospect gagne ce que le pro paie).
   `expires_at` = `now() + interval '72 hours'`.
7. Update `campaigns.matched_count` avec le nombre de rows insérées.
8. Pour chaque relation insérée + `prospect_identity.email` non null :
   `sendRelationInvitation` en `Promise.allSettled` non-await — l'erreur
   SMTP n'échoue pas la requête.
9. Réponse `{ campaignId, matchedCount, code: 'BUUPP-' + 8 chars }`.

### 3. Algorithme de matching

Implémenté en service_role (le pro ne peut pas voir directement les
prospects en RLS). Une seule requête SQL combinée pour les 5 critères :

Pseudo-SQL :

```sql
SELECT p.id, pi.email, pi.prenom
FROM prospects p
JOIN prospect_identity pi ON pi.prospect_id = p.id
LEFT JOIN prospect_localisation pl ON pl.prospect_id = p.id
WHERE
  -- Tous les paliers requis présents et NON masqués/supprimés
  NOT EXISTS (
    SELECT 1 FROM unnest($requiredTierKeys) tk
    WHERE tk = ANY(p.removed_tiers) OR tk = ANY(p.hidden_tiers)
  )
  AND (
    p.all_campaign_types = true
    OR $campaignType = ANY(p.campaign_types)
  )
  -- Verification level >= minimum
  AND p.verification::text IN ($acceptableVerifLevels)
  -- Filtre géographique (cas 'national' = pas de filtre)
  AND ($geo = 'national' OR pl.code_postal LIKE $geoPrefix)
  -- (filtre âge appliqué côté Node après SELECT : naissance est text)
  -- N'a pas déjà été sollicité par cette campagne (couvert par UNIQUE (campaign_id, prospect_id))
ORDER BY p.bupp_score DESC, p.id ASC
LIMIT $contacts
```

Détails :

- `requiredTierKeys` : converti depuis le wizard `[1..5]` → `['identity',
  'localisation','vie','pro','patrimoine']` via `TIERS_DATA`.
- `geoPrefix` : `'ville'` → `code_postal LIKE pro.code_postal[:2] || '%'`,
  `'dept'` → 2 premiers chiffres, `'region'` → liste de prefixes (mapping
  région→départements minimal en `lib/geo/regions.ts`), `'national'` → no-op.
- Filtre âge : appliqué **après** le SELECT côté Node, car
  `prospect_identity.naissance` est `text` (cf. migration
  `20260504130000_naissance_to_text.sql`) — un parse + calcul d'âge en JS
  est plus simple qu'une fonction SQL. Si `requiredTiers` ne contient pas
  le palier 1, l'âge n'est pas connu et le filtre est ignoré (le prospect
  n'est pas exclu pour absence d'info âge). Si `ages = ['Tous']`, pas de
  filtre. Sinon mapping `'18–25' → [18,25]`, etc., et on conserve les
  prospects dont l'âge tombe dans **au moins une** des tranches cochées.
- `acceptableVerifLevels` : enum DB = `basique|verifie|certifie|confiance`.
  Mapping wizard `p0..p3` → minimum requis :
  - `p0` → `[basique, verifie, certifie, confiance]` (tous)
  - `p1` → `[verifie, certifie, confiance]`
  - `p2` → `[certifie, confiance]`
  - `p3` → `[confiance]`
  Centralisé dans `lib/campaigns/mapping.ts`.

### 4. Backend — actions du prospect

`app/api/prospect/relations/route.ts` (`GET`) :

Réponse :

```ts
{
  pending: [{
    id, campaignId, proName, proSector,
    motif, brief, reward, tier,
    timer,           // "14 h 22 min" calculé depuis expires_at
    startDate, endDate
  }],
  history: [{
    id, date, proName, tier, decision: 'accepted'|'refused'|'expired',
    status: 'Crédité' | '—',
    gain: number | null
  }]
}
```

Implémentation : 1 requête `SELECT relations.*, campaigns.name, campaigns.brief,
campaigns.starts_at, campaigns.ends_at, pro_accounts.raison_sociale,
pro_accounts.secteur, pro_accounts.ville` filtrée par `prospect_id`,
groupée côté Node en `pending` (status=`pending`) vs `history`
(`accepted`|`refused`|`expired`|`settled`).

`app/api/prospect/relations/[id]/decision/route.ts` (`POST`) :

Body : `{ action: 'accept' | 'refuse' | 'undo' }`.

Logique :

- Lecture en service_role de la `relation` + `campaign` (vérif `prospect_id`
  matche le clerkUserId courant via prospects table).
- `accept` : transition `pending → accepted` autorisée seulement si :
  - `expires_at > now()`,
  - `campaigns.status = 'active'`,
  - `pro_accounts.wallet_balance_cents >= reward_cents`.
  Effets atomiques (RPC SQL function `accept_relation_tx(relation_id)`) :
  - update relation set status=accepted, decided_at=now()
  - decrement pro_accounts.wallet_balance_cents by reward_cents
  - increment campaigns.spent_cents by reward_cents
  - INSERT transaction kind='escrow', account_kind='pro', amount_cents=-reward_cents
  - INSERT transaction kind='escrow', account_kind='prospect', amount_cents=+reward_cents (status=pending)
- `refuse` : `pending → refused` simple update + decided_at. Si l'origine
  était `accepted`, on rembourse via RPC `refund_relation_tx(relation_id)`
  (rollback inverse de l'accept).
- `undo` :
  - `accepted → pending` : autorisé si `campaigns.status = 'active'` et
    `expires_at > now()` ; déclenche `refund_relation_tx`.
  - `refused → pending` : autorisé sous les mêmes conditions, pas d'effet
    financier (le refus n'avait rien débité).

Ces RPCs sont implémentées en SQL dans la migration pour garantir
l'atomicité (Postgres function `language plpgsql security definer`).

### 5. Email — `lib/email/relation.ts`

Calque du template waitlist. Variables : `email`, `prenom`, `proName`,
`proSector`, `motif`, `brief`, `rewardEur`, `expiresAt`. Le CTA est un
gros bouton orange-indigo pointant vers `${APP_URL}/prospect?tab=relations`.

Cas où le mail n'est pas envoyé :
- transport SMTP indisponible (.env vide) → log + continue.
- `prospect_identity.email is null` → skip silencieux.
- erreur d'envoi → log, n'échoue pas le POST.

### 6. Frontend prospect — `Prospect.jsx`

Modifications dans `ProspectProvider` (lignes 105-220 actuelles) :

- Suppression de `INITIAL_PENDING_RELATIONS` (fixtures).
- Ajout d'un fetch initial vers `/api/prospect/relations` (similaire au
  pattern de `/api/prospect/donnees`).
- État remplacé par `{ pending, history, loading }`.
- `acceptRelation(id)` / `refuseRelation(id)` / `undoAcceptRelation(id)` /
  `undoRefuseRelation(id)` → POST vers `/decision` puis revalidation.
- Mode optimiste : on update l'état local immédiatement, on rollback si
  l'API renvoie une erreur (toast simple côté UI).
- `pendingRelationsCount` reste branché, mais sur les vraies données.

Modifications dans `Relations` (lignes 1592-1828) :

- `history` n'est plus hardcodé : utilise le tableau retourné par l'API.
- Mapping des statuts pour la chip ('Acceptée'/'Refusée'/'Expirée') et
  pour la colonne Gain (montant si `accepted+settled`, sinon `—`).

Modifications dans `Shell.jsx` (gestion onglet initial) :

- Lit `?tab=relations` dans le hash de l'URL iframe.
- Passe `initialTab` à `ProspectDashboard`.
- `ProspectDashboard` initialise `sec` à cette valeur si fournie.

Modifications dans `app/prospect/page.tsx` :

- Lit `searchParams.tab`, le passe à `<PrototypeFrame route="prospect" tab={tab} />`.
- `PrototypeFrame` ajoute `?tab=...` dans le hash de l'iframe.

### 7. Frontend pro — `Pro.jsx`

Trois nouvelles routes API :

- `GET /api/pro/contacts` : sélectionne `relations` `accepted`/`settled`
  + jointure prospect_identity (email, telephone) + campagnes. Email/tél
  sont **watermarquées côté serveur** (`marie.l•••@gmail.com`,
  `06 •• •• •• 12`). Score = `prospects.bupp_score`. Évaluation : pas en
  DB encore — on retourne `null` (UI affichera les boutons Valide/Diff/Invalide
  comme aujourd'hui, sans persistance — out-of-scope).

- `GET /api/pro/analytics` : agrégats sur les `relations` du pro :
  - `acceptanceByTier[]` : pour chaque tier 1-5, `taux = accepted / sent`
    où sent = relations dont `targeting.requiredTiers` contient le tier.
  - `geoBreakdown[]` : top 5 villes (depuis `prospect_localisation.ville`)
    avec taux d'acceptation.
  - `ageBreakdown[]` : 6 buckets (18-25, …, 65+) basés sur
    `prospect_identity.naissance`. Skip prospects sans naissance.
  - `sexBreakdown[]` : 3 buckets (femme/homme/autre) basés sur la nouvelle
    colonne `prospect_identity.genre`. Skip prospects sans genre renseigné.

- `GET /api/pro/overview` : `{ contactsAccepted30d, acceptanceRate,
  avgCostCents, roiEstimate }` pour les 4 KPI cards de la Vue d'ensemble.
  Hors-scope strict de la demande mais nécessaire pour cohérence — peut être
  inclus dans le même PR.

Modifications JSX :

- `Contacts()` (Pro.jsx ligne 2057) : remplace `ALL_ROWS` par un fetch
  de `/api/pro/contacts`. Filtres locaux conservés tels quels.
- `Analytics()` (Pro.jsx ligne 2182) : remplace les tableaux hardcodés
  par les données de `/api/pro/analytics`. Heatmap conserve sa logique
  pseudo-aléatoire (out-of-scope, pas de timestamps précis en DB).
- `Overview()` : remplace les 4 KPI cards par les données de
  `/api/pro/overview` (avec fallback sur 0 si compte neuf).

## Sécurité / RLS

- `POST /api/pro/campaigns` : service_role (matching + insert relations
  croise plusieurs prospects, RLS bloquerait).
- `POST /api/prospect/relations/[id]/decision` : service_role pour les
  RPC atomiques (les RLS update sont permissives mais on a besoin du
  service_role pour les cross-table updates wallet/transactions).
- `GET /api/prospect/relations` : peut utiliser le client RLS prospect.
- `GET /api/pro/contacts`, `/analytics`, `/overview` : service_role
  (lecture cross-prospect).

## Erreurs / cas limites

- Wallet pro insuffisant à l'acceptation → la `relation` reste en `pending`,
  l'API renvoie `402 insufficient_pro_funds`. UI prospect : "Ce pro n'a
  plus le crédit pour vous payer — contactez-le".
- Campagne expirée (`ends_at < now()`) au moment de l'acceptation → renvoie
  `409 campaign_expired`.
- Tentative d'`undo` après que la campagne soit `completed` → `403 forbidden`.
- Aucun prospect ne matche → on insère quand même la `campaigns` (statut
  `active`), `matched_count = 0`, pas d'email envoyé. Le pro voit la
  campagne dans son onglet Campagnes avec "0 contact" et peut la mettre
  en pause / la cloner.
- Prospect supprime son compte (RGPD) après acceptation : la cascade
  `prospect_id` → `relations` (ON DELETE CASCADE) supprime aussi les
  rows de transactions liées à `relation_id` (déjà `ON DELETE SET NULL`).
  Le pro ne récupère pas son débit, ce qui est volontaire (le service
  a été rendu).

## Tests manuels

Plan de validation E2E :

1. Créer un prospect A avec palier 1+2 remplis, code postal 69003, naissance 1990, genre 'femme'.
2. Créer un prospect B avec uniquement palier 1, code postal 33000.
3. Créer un compte pro à Lyon, recharger 100 €.
4. Lancer une campagne "Bilan postural" : objectif 'rdv', requiredTiers=[1,2],
   geo='ville' (Lyon), ages=['Tous'], verif='p0', contacts=10.
5. Vérifier dans Supabase : 1 row `campaigns`, 1 row `relations` (prospect A
   uniquement). Mail reçu sur l'email du prospect A.
6. Cliquer le lien dans le mail → atterrit sur `/prospect?tab=relations`.
7. Cliquer "+" sur la card → modale ouvre avec brief + dates + récompense.
8. Cliquer "Accepter" → la card passe en mode "Accord donné". Vérifier
   `pro_accounts.wallet_balance_cents` débité, `transactions` x2 (pro -X,
   prospect +X status=pending).
9. Cliquer "Revenir sur mon acceptation" → la card repasse en pending.
   Vérifier wallet pro re-crédité, transactions complémentaires de refund.
10. Côté pro, onglet "Mes contacts" : vérifier que prospect A apparaît
    avec email watermarqué après ré-acceptation.
11. Onglet "Analytics" : taux palier 1 et 2 calculés, ville Lyon top 1,
    bucket 36-45 ans à 100%, femme à 100%.

## Points laissés volontairement hors-scope

- Cron de settlement automatique (relation accepted + 72h → status=settled,
  transaction prospect status=completed) : à faire dans une itération
  ultérieure, identifié par `relations.settled_at IS NULL AND status=accepted
  AND decided_at < now() - interval '72 hours'`.
- Cron d'expiration (pending + expires_at < now() → status=expired).
- Champ "évaluation" du tableau Mes contacts (Valide/Difficile/Invalide) :
  reste UI-only, pas de persistance.
- Heatmap horaire de l'Analytics : pas de timestamp précis en DB sur
  `decided_at` au-delà de la date, on garde la logique pseudo-aléatoire.
- Mode `pool` (enchère groupée) : stocké dans `targeting.poolMode` mais
  l'algo de matching le traite identique au mode standard pour cette
  itération.
