# Bonus fondateur — conditions de déblocage

> Spec de conception — 2026-07-23
> Remplace le déblocage inconditionnel décrit dans
> `2026-06-06-founder-signup-bonus-design.md`.

## 1. Contexte

Le bonus fondateur de 5,00 € récompense les prospects inscrits sur la liste
d'attente avant le lancement (`prospects.is_founder = true`, positionné par un
trigger sur `prospect_identity` quand l'email figure dans `waitlist`).

Mécanisme actuel, en production :

1. Le prospect se préinscrit sur `/liste-attente`.
2. Il ouvre un compte prospect → le trigger passe `is_founder = true`.
3. Le cron quotidien (`/api/admin/digest`, 18 h) appelle
   `distributeFounderBonusIfLaunched()`. Dès que `app_config.launch_at` est
   dépassé, la RPC `apply_founder_signup_bonus()` insère une transaction
   `signup_bonus` / `completed` de 500 cents, pose le drapeau d'idempotence
   `prospects.founder_signup_bonus_applied`, puis déclenche une notification
   cloche ciblée et un email Brevo.
4. Le montant entre immédiatement dans « Disponible » et devient retirable.

La seule condition est donc : *email en waitlist + compte créé + lancement
passé*. Aucune contrepartie n'est demandée au bénéficiaire.

## 2. Nouvelle règle

Le bonus se débloque quand **les deux** conditions sont réunies :

- **Ancienneté** : 3 mois calendaires révolus depuis la création du compte
  prospect (`prospects.created_at + interval '3 months'`).
- **Activité** : au moins une sollicitation acceptée, c'est-à-dire au moins une
  ligne `relations` du prospect avec `status ∈ ('accepted', 'settled')`. Une
  relation `settled` a nécessairement été acceptée auparavant, d'où les deux
  valeurs.

`app_config.launch_at` est conservé comme **plancher** : aucun déblocage avant
le lancement officiel, même si les 3 mois sont écoulés. La date effective de
déblocage est donc `greatest(created_at + 3 mois, launch_at)`.

### Décisions produit actées

- **Aucune reprise rétroactive.** Les fondateurs déjà crédités (transaction
  `signup_bonus` / `completed`) conservent leur bonus, débloqué, sans
  vérification des nouvelles conditions. La migration ne touche aucune ligne
  `completed` existante.
- **Aucune expiration.** Si les conditions ne sont jamais réunies, le bonus
  reste en attente indéfiniment. Pas de date limite, pas de reprise, pas de
  purge.

## 3. Approche retenue — crédit immédiat verrouillé

La transaction est écrite **dès que le compte fondateur existe**, en
`status = 'pending'`. Elle est visible dans le portefeuille comme « en attente
de déblocage », avec les deux conditions et leur progression. Quand les deux
conditions tombent, la ligne passe en `completed` : elle rejoint le solde
disponible et devient retirable, avec notification.

Deux raisons de préférer ce modèle au crédit purement différé :

- **Il est déjà idiomatique dans ce code.** Le séquestre des relations suit
  exactement ce cycle (`type='escrow'`, `pending` → `completed`, chip « En
  séquestre », RPC ensembliste `settle_ripe_relations` + wrapper paresseux
  `settleRipeRelationsAndNotify`). On réutilise le pattern plutôt que d'en
  inventer un second.
- **Les agrégats filtrent déjà `status = 'completed'`.** Une transaction
  `signup_bonus` en `pending` est automatiquement exclue du solde, du cumul et
  des gains du mois sans modifier une seule requête d'agrégation. Le
  verrouillage est obtenu par construction, pas par une exception à maintenir.

S'y ajoute l'effet produit : un bonus visible mais verrouillé transforme
« accepter une sollicitation » en objectif concret. Un bonus invisible pendant
trois mois n'incite à rien.

## 4. Modèle de données

Nouvelle migration `supabase/migrations/20260723142716_founder_bonus_unlock_conditions.sql`.

### 4.1 Source de vérité des conditions

Une seule fonction SQL définit l'état de déblocage, consommée à la fois par la
RPC de déblocage et par l'API de lecture. Aucune duplication de la règle.

```sql
create or replace function public.founder_bonus_unlock_state(p_prospect_id uuid)
returns table (
  unlock_at       timestamptz,  -- greatest(created_at + 3 mois, launch_at)
  has_acceptance  boolean,
  met             boolean
)
```

- `unlock_at` = `greatest(prospects.created_at + interval '3 months', app_config.launch_at)`
- `has_acceptance` = `exists (select 1 from relations where prospect_id = p_prospect_id and status in ('accepted','settled'))`
- `met` = `now() >= unlock_at and has_acceptance`

### 4.2 Provisionnement

`provision_founder_signup_bonus(p_prospect_id uuid) returns boolean` — insère
la transaction `signup_bonus` / **`pending`** de 500 cents et pose
`founder_signup_bonus_applied = true`, sous `for update` sur la ligne prospect.
Idempotente : renvoie `false` si le prospect n'est pas fondateur ou si le
drapeau est déjà posé.

**Changement de sémantique du drapeau** : `founder_signup_bonus_applied`
signifiait « crédité » ; il signifie désormais « **provisionné** » (la ligne
existe, quel que soit son statut). Les lignes existantes à `true` correspondent
à des bonus `completed`, ce qui reste cohérent : provisionné *et* débloqué.

Le provisionnement n'est **pas** conditionné à `launch_at` — le prospect doit
voir son bonus en attente dès l'ouverture du compte.

### 4.3 Déblocage

`unlock_ripe_founder_signup_bonuses()` — RPC ensembliste calquée sur
`settle_ripe_relations`. Verrouille puis fait passer en `completed` toutes les
transactions `signup_bonus` / `pending` dont le prospect satisfait
`founder_bonus_unlock_state(...).met`, et renvoie les lignes effectivement
transitionnées :

```sql
returns table (
  prospect_id     uuid,
  transaction_id  uuid,
  clerk_user_id   text,
  email           text,
  prenom          text
)
```

Ne renvoyer que les lignes réellement transitionnées garantit **une seule**
notification par bonus, même sous appels concurrents.

### 4.4 Compatibilité de déploiement

`apply_founder_signup_bonus(uuid)` est conservée et redéfinie comme fin
wrapper déprécié appelant `provision_founder_signup_bonus`. Sans cela, le code
actuellement en production appellerait une fonction disparue entre
l'application de la migration et le déploiement du code.

### 4.5 Index

```sql
create index if not exists transactions_signup_bonus_pending_idx
  on public.transactions (account_id)
  where type = 'signup_bonus' and status = 'pending' and account_kind = 'prospect';
```

Le balayage du job de déblocage reste borné aux seuls bonus en attente.

### 4.6 Droits

Les deux nouvelles fonctions sont `security definer`, `revoke` sur
`public, anon, authenticated`, `grant execute` au seul `service_role` —
identique à l'existant.

## 5. Flux applicatif

### 5.1 Synchronisation

Un module unique `lib/founder-bonus/sync.ts` expose
`syncFounderBonusesAndNotify(admin)` qui, dans l'ordre :

1. provisionne en `pending` les fondateurs sans ligne de bonus ;
2. appelle `unlock_ripe_founder_signup_bonuses()` ;
3. pour chaque ligne débloquée, insère le broadcast cloche ciblé et envoie
   l'email — en réutilisant les gabarits existants (`BROADCAST` de
   `distribute.ts`, `sendFounderBonusEmail`), dont le texte reste exact au
   moment du déblocage : le bonus est bien crédité, disponible et retirable.

Appelé depuis :

- le **cron quotidien** existant (`/api/admin/digest`), à la place de
  `distributeFounderBonusIfLaunched` ;
- en **lecture paresseuse** au début de `/api/prospect/wallet` et
  `/api/prospect/movements`, comme `settleRipeRelationsAndNotify`, pour que
  l'affichage ne soit jamais en retard sur la réalité.

Le provisionnement n'a **qu'une seule implémentation**, exportée par
`sync.ts` sous la forme `provisionFounderBonuses(admin, { confirm })`.
`lib/founder-bonus/distribute.ts` est **supprimé** : son rôle se réduisait à
créditer, ce que plus personne ne fait directement. L'endpoint admin
`/api/admin/founder-bonus/distribute` conserve son contrat dry-run/confirm et
appelle désormais `provisionFounderBonuses` — il ne distribue plus, il
provisionne, et insère donc des lignes `pending`. Le gabarit de broadcast et
l'envoi d'email migrent vers `sync.ts`, où ils servent au déblocage.

### 5.2 Contrat `/api/prospect/wallet`

Champs ajoutés, sans rupture des existants :

| Champ | Sens |
|---|---|
| `signupBonusCents` / `Eur` | inchangé — bonus **débloqué** (`completed`) seul |
| `signupBonusPendingCents` / `Eur` | bonus en attente de déblocage |
| `signupBonusUnlockAt` | date effective de déblocage (ISO) ou `null` |
| `signupBonusHasAcceptance` | `true` si ≥ 1 relation acceptée |
| `signupBonusLocked` | `true` s'il existe un bonus en attente |

`signupBonusCents` garde volontairement sa sémantique : le mobile déjà déployé
le consomme pour la mention « dont X € de bonus fondateur » et continuera
d'afficher le bon montant sans mise à jour.

### 5.3 Historique des mouvements

`lib/prospect/transactions.ts` :

- `statusLabel('signup_bonus', 'pending')` → `"En attente de déblocage"` ;
- `statusChip('signup_bonus', 'pending')` → `"warn"` (orange, comme le
  séquestre) ;
- `SIGNUP_BONUS_ORIGIN` inchangé.

`GAIN_TRANSACTION_TYPES` reste inchangé : le filtrage par `status='completed'`
suffit à exclure le bonus verrouillé.

### 5.4 Correction du calcul de retrait

`app/api/prospect/payout/withdraw/route.ts:104` liste les types de gain **en
dur** (`["credit","referral_bonus"]`) et omet `signup_bonus`, à rebours de
`GAIN_TRANSACTION_TYPES` utilisé par `/api/prospect/wallet`. Conséquence
actuelle : un fondateur dont le solde repose sur le seul bonus voit
`canWithdraw: true` puis reçoit `insufficient_funds`. La route est alignée sur
`GAIN_TRANSACTION_TYPES`. Le filtre `status = 'completed'` déjà présent
maintient le bonus verrouillé hors du solde retirable.

## 6. Interface prospect (web)

`public/prototype/components/Prospect.jsx`, onglet Portefeuille.

- **Carte bonus verrouillé**, affichée seulement si `signupBonusLocked` : les
  5,00 € présentés comme en attente, avec les deux conditions et leur état —
  ⏳ « Débloqué le 12 octobre 2026 » (depuis `signupBonusUnlockAt`) et ✓/○
  « Au moins une sollicitation acceptée » (depuis `signupBonusHasAcceptance`).
  Une condition remplie s'affiche cochée, en vert.
- **Carte « Disponible »** : la mention « dont X € de bonus fondateur » reste
  pilotée par `signupBonusEur` et ne s'affiche donc qu'après déblocage.
- **Historique** : la ligne en attente reprend le traitement visuel du
  séquestre (chip orange) au lieu du fond vert « crédité ».

Le mobile est répliqué dans un second temps, sur le worktree dédié. Aucune
régression d'ici là : le mobile lit `signupBonusCents`, qui vaut 0 tant que le
bonus est verrouillé.

## 7. Tests

- `tests/lib/founder-bonus/sync.test.ts` — provisionnement idempotent et
  silencieux (aucune notification au provisionnement), une seule cloche et un
  seul email par bonus débloqué, bénéficiaire sans email ni `clerk_user_id`
  débloqué sans notification, écarts `unlocked`/`broadcasted`/`emailed`
  remontés.
- `tests/lib/prospect/transactions.test.ts` — libellé et chip du couple
  `('signup_bonus','pending')`, non-régression du couple `('signup_bonus','completed')`.
- `tests/api/admin/founder-bonus-distribute.test.ts` — adapté au nouveau
  résultat `{ eligible, provisioned, errors }`.
- Les tests de `distribute.ts` disparaissent avec le module.

**La matrice des conditions elle-même n'est pas couverte par Vitest** : elle vit
dans `founder_bonus_unlock_state`, en SQL, et la base locale a divergé de la
base distante — un test d'intégration Postgres n'existe nulle part dans ce
dépôt et ne sera pas introduit pour cette seule fonction. Elle est validée par
une requête de contrôle exécutée dans le SQL Editor juste après l'application
de la migration, décrite dans le plan d'implémentation (section Déploiement).
C'est une limite assumée : une erreur dans la règle SQL ne serait pas
rattrapée par la suite de tests.

## 8. Déploiement

1. Appliquer la migration en prod **via le SQL Editor**, puis
   `supabase migration repair` — jamais `db push` (bases locale et distante
   divergées).
2. La migration passe **avant** le code : le wrapper déprécié de §4.4 garantit
   que le code en place continue de fonctionner dans l'intervalle.
3. Déployer le code web sur `main` (Vercel automatique).
4. Répliquer l'UI mobile sur le worktree `worktree-mobile-app`, puis build EAS.

Aucune donnée existante n'est modifiée : les bonus déjà `completed` restent
débloqués et retirables.
