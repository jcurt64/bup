# Escalade « non-réponse prospect » — conception

**Date :** 2026-06-05
**Statut :** validé (design), à implémenter

## Problème

Un professionnel peut déjà signaler un prospect injoignable via l'évaluation
**« non atteint »** (`POST /api/pro/contacts/[relationId]/evaluation`). Aujourd'hui,
au-delà de 2 occurrences, le seul effet est un event admin + un message courtois
au prospect. On veut une **échelle d'escalade** progressive pour responsabiliser
les prospects qui acceptent des sollicitations puis ne répondent jamais, tout en
restant **courtois et non culpabilisant**.

## Vocabulaire

- **Strike** = une évaluation « non atteint » posée par un pro sur une relation
  acceptée/settled. Comptage **tous pros confondus** (différents pros comptent).
  Un même contact (relation) ne compte **qu'une seule fois**, même si le pro
  bascule plusieurs fois atteint ↔ non atteint.

## Échelle d'escalade

Chaque palier est appliqué **une seule fois** (idempotence via un marqueur de
niveau stocké sur le prospect). Les strikes sont comptés via un compteur entier
dédié (pas dérivé des lignes, pour permettre une remise à zéro propre).

| Strikes | Effet | Message au prospect |
|---|---|---|
| **2** | **Signalement** : `admin_event` *warning* (comportement actuel conservé) | rappel courtois « un pro n'a pas pu vous joindre… » (message existant) |
| **3** | **Malus BUUPP Score persistant de −100 pts** (plancher 0) | message courtois : on l'informe que son score a été ajusté suite à des non-réponses, sans reproche |
| **4** | **Restriction d'acceptation de 2 mois** : le bouton « Accepter » est bloqué côté serveur | (a) à l'entrée en restriction : message courtois d'info ; (b) à chaque tentative d'accept : message expliquant la pause temporaire et la date de fin |

## Cycle de vie / remise à zéro

- La **restriction** (`accept_restricted_until`) expire d'elle-même : le garde
  d'acceptation compare simplement `accept_restricted_until > now()`.
- À l'**expiration de la restriction** (chemin niveau 4) → **remise à zéro
  complète** : `non_response_strikes = 0`, `non_response_level = 0`,
  `score_malus = 0`, `accept_restricted_until = null`, recompute du score, et un
  message courtois « bienvenue, ardoise repartie à neuf » (optionnel mais
  cohérent avec le ton).
- **Décision actée :** un prospect qui plafonne au **niveau 3** (malus appliqué
  mais jamais de niveau 4) **conserve son malus** jusqu'à atteindre le niveau 4.
  Pas de dégradé temporel automatique au niveau 3.

## Modèle de données (nouvelle migration)

Sur `public.prospects` :
- `non_response_strikes int not null default 0` — compteur de strikes.
- `non_response_level smallint not null default 0` — plus haut palier déjà
  appliqué (0/2/3/4). Anti double-application.
- `score_malus int not null default 0` — malus persistant soustrait du BUUPP
  Score.
- `accept_restricted_until timestamptz` — fin de la restriction (NULL = libre).

Sur `public.relations` :
- `non_atteint_counted boolean not null default false` — garantit qu'un contact
  ne compte qu'une fois dans les strikes.

Migration appliquée sur le remote via MCP `apply_migration` puis fichier local
renommé pour matcher la version remote (cf. workflow établi, jamais `db push`).

## Composants & flux

### 1. Moteur d'escalade — `lib/prospect/non-response.ts` (nouveau)

Fonction pure-ish `applyNonResponseEscalation(admin, prospectId)` appelée depuis
la route d'évaluation pro **uniquement quand un nouveau strike est compté** :

1. Lit l'état courant (`non_response_strikes`, `non_response_level`,
   `clerk_user_id`).
2. Applique séquentiellement les paliers nouvellement franchis
   (`strikes >= seuil && level < seuil`), en mettant à jour `non_response_level`,
   `score_malus`, `accept_restricted_until` selon le palier.
3. Émet pour chaque palier franchi : un `admin_event` (types
   `prospect.non_atteint_threshold`, `prospect.non_response_score_penalty`,
   `prospect.non_response_accept_restricted`) + un `admin_broadcasts` ciblé
   (`target_clerk_user_id`) courtois.
4. Si un palier ≥ 3 est franchi, recompute le score (pour appliquer le malus).

Fonction `liftExpiredNonResponseRestriction(admin, prospectId, row)` : si
`accept_restricted_until <= now()`, effectue la remise à zéro complète +
recompute du score + broadcast « ardoise repartie ». Appelée :
- lazy au début du garde d'acceptation (UX immédiate),
- dans le balayage du cron quotidien (équité du matching même si le prospect ne
  revient pas).

### 2. Comptage du strike — `app/api/pro/contacts/[relationId]/evaluation/route.ts`

Refonte de `maybeTriggerAlert` → délègue à `applyNonResponseEscalation`. Le strike
n'est compté que si `relations.non_atteint_counted = false` lors du passage à
« non atteint » ; on pose alors `non_atteint_counted = true` et on incrémente
`non_response_strikes` (UPDATE atomique conditionnel pour éviter le double
comptage concurrent).

### 3. Intégration score — `lib/prospect/score.ts`

`computeAndPersistProspectScore` lit `prospects.score_malus` et calcule
`score = max(0, round(avgPct * 10) - score_malus)`. Le `bupp_score` persisté et le
snapshot d'historique utilisent ce score pénalisé.

### 4. Garde d'acceptation — `app/api/prospect/relations/[id]/decision/route.ts`

Pour `action === "accept"`, **avant** le garde « données complètes » et le
rate-limit :
1. Appel `liftExpiredNonResponseRestriction` (lazy reset si la restriction a
   expiré).
2. Si `accept_restricted_until > now()` → `403` avec
   `{ error: "accept_restricted", restrictedUntil, message }`. Message courtois
   indiquant la pause et la date de fin (format JJ/MM/AAAA).

### 5. Balayage cron — route du digest quotidien

La route cron existante (`/api/admin/digest`, 1 cron/jour sur Hobby) gagne un
balayage : pour chaque prospect avec `accept_restricted_until <= now()`, appliquer
`liftExpiredNonResponseRestriction`. Idempotent.

### 6. Front web — `public/prototype/components/Prospect.jsx`

Le handler `postDecision` surface le message du `403 accept_restricted` comme il
le fait déjà pour `422 tiers_incomplete` / `429 rate_limited` (modale / toast).
Les 3 messages courtois d'escalade arrivent déjà dans « Mes messages » (ce sont
des `admin_broadcasts`, rendus tels quels) — aucun code UI dédié nécessaire.

### 7. Front mobile — `mobile/app/(prospect)/...` (worktree)

Parité : surface le message `accept_restricted` dans le flux d'acceptation mobile
(même endpoint, même payload). Les broadcasts « Mes messages » sont déjà rendus
côté mobile.

## Ton des messages (courtois, non agressif)

- **Niveau 3 (malus)** : « Bonjour, nous avons ajusté votre BUUPP Score suite à
  plusieurs sollicitations acceptées restées sans réponse. Rien de définitif :
  en répondant aux prochaines sollicitations que vous acceptez, votre score
  remontera naturellement. Merci de votre compréhension. »
- **Niveau 4 (restriction)** : « Bonjour, pour préserver la qualité du service
  pour tous, l'acceptation de nouvelles sollicitations est mise en pause sur
  votre compte pendant 2 mois (jusqu'au JJ/MM/AAAA). Vous pourrez ensuite
  accepter de nouveau. Vous restez libre de compléter votre profil entre-temps.
  Merci de votre compréhension. »
- **Garde accept (403)** : version courte du message niveau 4 avec la date de
  fin.
- **Remise à zéro** : « Bonne nouvelle : la pause sur votre compte est terminée,
  vous pouvez de nouveau accepter des sollicitations. À bientôt sur BUUPP ! »

## Tests

- `lib/prospect/non-response.ts` : test unitaire de la machine d'escalade
  (transitions 0→2→3→4, idempotence, remise à zéro). Mock du client Supabase
  façon `tests/lib/waitlist/referral.test.ts`.
- `lib/prospect/score.ts` : test que `score_malus` est bien soustrait (plancher 0).
- Garde d'acceptation : test de la branche `accept_restricted` (helper pur de
  décision si extrait).

## Hors périmètre (YAGNI)

- Pas de remboursement / avoir au pro (non demandé).
- Pas de contestation par le prospect du malus/restriction.
- Pas de dégradé temporel du malus au niveau 3 (cf. décision ci-dessus).
- Pas de réglages admin pour modifier les seuils (constantes en code).
