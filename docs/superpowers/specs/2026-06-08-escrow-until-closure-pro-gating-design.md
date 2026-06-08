# Séquestre jusqu'à clôture + masquage des données prospect au pro — Design

Date : 2026-06-08
Statut : approuvé (design)

## Objectif

Deux règles métier liées à la **clôture de campagne**, web + mobile, front + back :

1. **Côté prospect** — la récompense d'une relation `accepted` reste en **séquestre**
   tant que la campagne n'est pas **clôturée**. Elle bascule en disponible/retirable
   **à la clôture** (date de fin courante, prolongation incluse).
2. **Côté pro** — tant que la campagne n'est pas clôturée, le pro **ne voit pas** les
   données des prospects ayant accepté : il voit seulement **les compteurs**
   (nombre d'acceptés / refusés) + les stats de sa propre campagne. À la clôture,
   il récupère l'accès complet (liste, révélation, détails).

## Principe central

Tout est gaté sur **la clôture réelle** = `campaigns.status = 'completed'`
(posée par `close_campaign_settle()` à la `ends_at` **courante**). Aucune date
n'est « figée » à l'acceptation → la **prolongation** (`extend`, qui décale
`ends_at`) repousse automatiquement le crédit ET l'accès pro. Pas de colonne
snapshot.

## Décisions validées

| # | Décision |
|---|----------|
| 1 | Pendant la campagne active : le pro garde les stats de SA campagne (matchés/envoyés/en attente/**acceptés/refusés**/budget/progression) mais **zéro donnée par prospect** (option 1b). |
| 2 | Clôture = automatique à `ends_at` (pas de clôture anticipée manuelle). Déclenchement à **fiabiliser**. |
| 3 | La récompense reste en séquestre **jusqu'à la clôture** (suppression de la règle « 3 min après lancement »). |
| 4 | La **prolongation** repousse crédit + accès à la fin de la période prolongée (géré par le gating sur `completed`). |

## Existant (références)

- `campaigns.status` enum : `draft | active | paused | completed | canceled`.
  `ends_at` décalé par `POST /api/pro/campaigns/[id]/extend` (une seule fois,
  `extension_used`). Clôture : `close_campaign_settle(p_campaign_id)`
  (`supabase/migrations/20260524045110_*.sql`) → `status='completed'`,
  `settled_at=now()`, appelle `settle_ripe_relations()`.
- `processCampaignLifecycle(admin)` (`lib/lifecycle/campaign.ts:34`) ferme les
  campagnes `active && ends_at <= now()`. Appelé **uniquement** par
  `settleRipeRelationsAndNotify()` (`lib/settle/ripe.ts:29`), lui-même lazy sur
  les endpoints **prospect** (wallet, movements, relations, fiscal). → fragile.
- `settle_ripe_relations()` (`supabase/migrations/20260528130000_*.sql:264-337`) :
  condition actuelle `r.status='accepted' AND c.created_at <= now() - interval '3 minutes'`.
- Accès pro aux acceptés : `app/api/pro/campaigns/[id]/route.ts` (funnel + contacts),
  `app/api/pro/contacts/route.ts`, `app/api/pro/acceptances/route.ts`,
  `app/api/pro/contacts/[relationId]/reveal/route.ts`,
  `app/api/pro/contacts/[relationId]/details/route.ts`.
- UI : `public/prototype/components/Pro.jsx` (Campaigns ~1050-1312, Contacts ~5080+),
  `public/prototype/components/Prospect.jsx` (séquestre ~2335-2463).

## A. Back — libération du séquestre à la clôture

Migration `supabase/migrations/<ts>_settle_on_campaign_closure.sql` (appliquée via
SQL Editor/MCP + fichier committé). `create or replace function
public.settle_ripe_relations()` — **seul changement** : la CTE `ripe` ne
sélectionne que les relations dont la **campagne est clôturée** :

```sql
-- AVANT
where r.status = 'accepted'
  and c.created_at <= now() - interval '3 minutes'
-- APRÈS
where r.status = 'accepted'
  and c.status = 'completed'
```

Le reste de la RPC (transition `accepted→settled`, escrow→credit, retour table)
est inchangé. Conséquence : l'escrow prospect reste `pending` jusqu'à ce que
`close_campaign_settle` passe la campagne en `completed` (à `ends_at` courant),
puis `settle_ripe_relations` (appelée dans `close_campaign_settle` et en lazy)
le bascule en `credit/completed` (disponible). Libellé : remplacer « délai de
validation écoulé » par « campagne clôturée » (cosmétique, dans la RPC).

## B. Back — fiabiliser le déclenchement de la clôture

`processCampaignLifecycle` n'est aujourd'hui appelé qu'en lazy côté prospect.
Ajouts :

1. **Cron quotidien** : dans `app/api/admin/digest/route.ts` (bloc `daily`,
   à côté de la bascule CNIL / sweep non-réponse), appeler
   `processCampaignLifecycle(admin)` (idempotent). Filet : les campagnes se
   clôturent et les séquestres se libèrent même sans visite prospect.
2. **À l'accès pro** : au début des routes pro qui dépendent de la clôture
   (`app/api/pro/campaigns/route.ts` liste, `app/api/pro/campaigns/[id]`,
   `app/api/pro/contacts`, `app/api/pro/acceptances`), appeler
   `processCampaignLifecycle(admin)` (lazy, best-effort, try/catch) → quand le
   pro regarde après la fin, la campagne se clôture et ses données apparaissent.

`processCampaignLifecycle` reste idempotent ; les appels concurrents sont sans
risque (verrous SQL dans `close_campaign_settle`).

## C. Back — masquer les données prospect au pro avant clôture

Règle commune : une relation n'est exposée au pro (données par prospect) que si
**sa campagne est `completed`**. Les **compteurs** restent calculés de toutes les
relations.

1. `app/api/pro/campaigns/[id]/route.ts` : conserver le `funnel`
   (matched/sent/pending/accepted/refused/expired/settled) tel quel. Pour
   `contacts` : si `camp.status !== 'completed'` → `contacts = []` et ajouter au
   payload `contactsLocked: true`, `lockedUntil: camp.ends_at`. Sinon, comportement
   actuel.
2. `app/api/pro/contacts/route.ts` : la requête ne renvoie que les relations dont
   la campagne est `completed` (filtrer côté requête ou post-filtre sur le join
   `campaigns.status`). Les campagnes actives n'apparaissent pas dans la liste
   Contacts.
3. `app/api/pro/acceptances/route.ts` : idem — uniquement les acceptations de
   campagnes `completed`.
4. `app/api/pro/contacts/[relationId]/reveal/route.ts` et `.../details/route.ts` :
   garde-fou — si la campagne de la relation n'est pas `completed`, retourner
   **403** (`{ error: "campaign_not_closed" }`) avant toute révélation/audit.

## D. Front web — Pro (`public/prototype/components/Pro.jsx`)

- **Détail campagne** (utilise `/api/pro/campaigns/[id]`) : garder le funnel +
  budget/progression. Quand `contactsLocked` : remplacer la liste des contacts par
  un état verrouillé — icône cadenas + « Données des prospects disponibles à la
  clôture » + date (`lockedUntil`), avec les **compteurs acceptés/refusés** mis en
  avant. Aucune ligne par prospect, aucun bouton révéler/détails.
- **Section Contacts** (utilise `/api/pro/contacts`) : ne liste que les campagnes
  closes (piloté par l'API). Optionnel : note « les campagnes en cours
  apparaîtront ici à leur clôture ».
- Bump cache prototype = automatique au déploiement (`PROTOTYPE_VERSION`).

## E. Front web — Prospect (`public/prototype/components/Prospect.jsx`)

Déjà conforme : carte « En séquestre » (sous-titre « Déblocage à la clôture de la
campagne »), `availableAt = relation.campaigns.ends_at` (lit la date **courante**
→ gère la prolongation). Vérifier seulement que les libellés restent cohérents.
Pas de changement structurel attendu.

## F. Mobile (worktree `worktree-mobile-app`)

Le mobile consomme le même backend → A/B/C/le gating s'appliquent
automatiquement. À adapter côté UI mobile :

- Écran campagne pro : afficher l'état verrouillé (compteurs acceptés/refusés +
  « disponible à la clôture ») quand `contactsLocked`.
- Écran/liste contacts pro : seules les campagnes closes apparaissent.
- Prospect : séquestre déjà affiché (parité) — vérifier le libellé.

Localisation exacte des écrans mobiles à confirmer au plan.

## G. Tests

- `settle_ripe_relations` : ne settle PAS une relation dont la campagne est
  `active`/`paused` ; settle quand la campagne est `completed`. (Vérif SQL/MCP.)
- `/api/pro/campaigns/[id]` : `contactsLocked=true` + `contacts=[]` si active ;
  contacts présents si completed ; funnel toujours présent.
- `/api/pro/contacts` & `/acceptances` : excluent les campagnes non closes.
- reveal/details : 403 si campagne non close.
- Prolongation : après `extend`, la clôture (et donc crédit + accès) se fait au
  nouveau `ends_at` (gating sur `completed`, pas de snapshot → couvert par les
  tests de gating + un test d'intégration ciblé).

## Points notables / edge cases

- Campagnes déjà actives au déploiement : leurs séquestres en cours se libèrent à
  leur clôture (au lieu de 3 min) — conforme à l'intention. Le pro perd l'accès
  aux acceptés en cours jusqu'à clôture (changement voulu).
- `paused` : non `completed` → séquestre maintenu, données verrouillées.
- `refused` : comptés en « refusés », jamais settled (aucun argent). 
- Implication finance/produit : inchangée (l'argent ne bouge qu'à la clôture, ce
  qui est l'intention).

## Séquencement

- Phase 1 — `main` (web + back) : A, B, C, D, E + tests. Migration appliquée via
  MCP, puis commit/push → déploiement.
- Phase 2 — `worktree-mobile-app` : F (UI mobile).
