# Bonus fondateur 5 € à l'inscription — Design

Date : 2026-06-06
Auteur : implémentation assistée
Statut : approuvé (design), spec en revue

## Objectif

Créditer un **bonus fictif de 5,00 € (500 cents)** sur le portefeuille de chaque
prospect **fondateur** — c'est-à-dire un compte dont l'email est présent dans la
table `waitlist` (matérialisé par le flag `prospects.is_founder = true`). Le
crédit doit :

- apparaître dans le portefeuille comme un gain réel, **retirable** (choix 2-b) ;
- être **mis en valeur** distinctement comme « Bonus fondateur » côté **web et
  mobile** ;
- déclencher un **message in-app ciblé + un email** envoyés **uniquement aux
  bénéficiaires**.

Contraintes :

- **Versement fictif** : aucune écriture comptable réelle côté Stripe pour
  l'instant (le débit du compte Stripe BUUPP est documenté comme étape future).
- **Ne pas toucher au code de la date de lancement** (`app_config.launch_at`,
  trigger `sync_founder_status`, fenêtre fondateur). On consomme `is_founder` tel
  quel.
- **Idempotence** : un prospect ne peut jamais être crédité deux fois.

## Décisions validées

| # | Décision |
|---|----------|
| 1 | Éligibilité = flag existant `prospects.is_founder = true` (= email en waitlist). |
| 2 | Bonus **pleinement crédité et retirable** (inclus dans `available`). |
| 3 | Message envoyé **uniquement aux bénéficiaires** ; canal = **cloche in-app (broadcast ciblé) + email**. |
| 4 | Nouvelle valeur d'enum dédiée `transaction_type = 'signup_bonus'` (pas de réutilisation de `credit` + détection texte). |

## Architecture

Flux découpé en briques isolées et testables :

```
[Migration DB]  enum signup_bonus + colonne flag + RPC idempotente
      │
      ▼
[RPC apply_founder_signup_bonus]  ← seule voie d'écriture du crédit
      │
      ├──► insert transactions(type='signup_bonus', status='completed', +500)
      └──► prospects.founder_signup_bonus_applied = true
      │
      ▼
[API wallet]      signup_bonus compté dans month/lifetime/available
[API movements]   signup_bonus → origin "Bonus fondateur 🎁", chip good, kind
      │
      ▼
[UI web Prospect.jsx]   ligne d'historique mise en valeur (pastille dorée)
[UI mobile worktree]    même mise en valeur (dark mode + Fraunces)
      │
      ▼
[Endpoint admin distribute]  backfill éligibles → RPC + broadcast ciblé + email
```

## A. Migration DB

Fichier : `supabase/migrations/<timestamp>_founder_signup_bonus.sql`
Application : **SQL Editor** (remote) + commit du fichier + `supabase migration
repair` (jamais `db push` — local et remote divergés).

1. Ajout de la valeur d'enum (à committer/exécuter **avant** tout usage —
   `ALTER TYPE ... ADD VALUE` ne peut pas être utilisé dans la même transaction
   que son premier usage ; on l'isole en début de migration) :

   ```sql
   alter type public.transaction_type add value if not exists 'signup_bonus';
   ```

2. Colonne d'idempotence :

   ```sql
   alter table public.prospects
     add column if not exists founder_signup_bonus_applied boolean not null default false;
   ```

3. RPC `SECURITY DEFINER`, idempotente :

   ```sql
   create or replace function public.apply_founder_signup_bonus(p_prospect_id uuid)
   returns boolean
   language plpgsql
   security definer
   set search_path = public
   as $$
   declare
     v_is_founder boolean;
     v_applied boolean;
   begin
     select is_founder, founder_signup_bonus_applied
       into v_is_founder, v_applied
       from public.prospects
      where id = p_prospect_id
      for update;

     if not found or v_is_founder is not true or v_applied is true then
       return false;
     end if;

     insert into public.transactions
       (account_id, account_kind, type, status, amount_cents, description)
     values
       (p_prospect_id, 'prospect', 'signup_bonus', 'completed', 500,
        'Bonus fondateur à l''inscription');

     update public.prospects
        set founder_signup_bonus_applied = true
      where id = p_prospect_id;

     return true;
   end;
   $$;
   ```

   `for update` verrouille la row prospect le temps de la transaction → deux
   appels concurrents ne peuvent pas créditer deux fois.

## B. Calcul du solde — `app/api/prospect/wallet/route.ts`

Ajouter `'signup_bonus'` aux deux filtres `.in("type", [...])` (lignes 83 et 90)
des requêtes `gainsLifetime` et `gainsMonth` :

```ts
.in("type", ["credit", "referral_bonus", "signup_bonus"])
```

Conséquence (voulue, choix 2-b) : le bonus entre dans `lifetimeCents` et
`monthCents`, donc dans `availableCents = lifetimeCents − withdrawnCents`, et un
prospect avec le seul bonus atteint le seuil de retrait (5 €). Mettre à jour le
commentaire de tête (« Définition d'une transaction "gain" ») en conséquence.

## C. Historique des mouvements — `app/api/prospect/movements/route.ts`

1. `statusLabel` (ligne ~97) : ajouter
   `if (type === "signup_bonus") return status === "completed" ? "Crédité" : status;`
2. `statusChip` (ligne ~111) : inclure `signup_bonus` dans la branche `good`.
3. `originLabel` (ligne ~118) : pour `type === "signup_bonus"`, retourner
   directement `"Bonus fondateur 🎁"` (transaction hors-relation : `description`
   conviendrait aussi, mais on force un libellé canonique et stylé).
4. Dans le `.map` final (ligne ~294), ajouter au payload de chaque mouvement un
   champ `kind: r.type` (ou plus ciblé `isSignupBonus: r.type === 'signup_bonus'`)
   pour permettre le ciblage UI sans dépendre du texte d'`origin`.

## D. Mise en valeur UI — Web

Fichier : `public/prototype/components/Prospect.jsx`, composant `Portefeuille`
(rendu de ligne ~2542-2576).

- Sur la ligne où `m.kind === 'signup_bonus'` (ou `m.isSignupBonus`) : appliquer
  un fond accentué léger sur le `<tr>` et afficher dans la colonne Origine une
  pastille « Bonus fondateur » avec icône cadeau, en réutilisant le style
  `chip` + variables de thème (`var(--good)` / classes existantes), **sans
  couleur en dur**, pour rester cohérent avec les 4 thèmes.
- Bumper `PROTOTYPE_VERSION` pour buster le cache iframe immutable (cf. contrat
  cache prototype).

## E. Mise en valeur UI — Mobile

Branche `worktree-mobile-app` (worktree `.claude/worktrees/mobile-app`). Le
mobile consomme le même backend `/api/prospect/*` ; A/B/C le servent
automatiquement. Seul l'écran portefeuille mobile a besoin du highlight de ligne
équivalent, en respectant le dark mode (`lib/theme`) et la police Fraunces.
Localisation exacte de l'écran à confirmer au moment du plan.

## F. Distribution + message — endpoint admin one-time

Fichier : `app/api/admin/founder-bonus/distribute/route.ts` (POST), gardé par
`ADMIN_EMAILS` (même garde que `/buupp-admin`).

Comportement :

1. Mode **dry-run** (par défaut, ou `?dryRun=1`) : renvoie `{ eligible }` =
   nombre de prospects `is_founder=true` ET `founder_signup_bonus_applied=false`,
   **sans rien écrire ni envoyer**.
2. Mode **réel** (`?confirm=1`) : pour chaque éligible (jointure
   `prospects` ⋈ `prospect_identity` pour l'email, `clerk_user_id` depuis
   `prospects`) :
   - appeler `apply_founder_signup_bonus(id)` ; si `true` (crédité) :
     - créer un **broadcast ciblé** dans `admin_broadcasts`
       (`audience='prospects'`, `target_clerk_user_id=<clerk>`, titre
       « Votre bonus fondateur est arrivé 🎁 », corps confirmant le +5 €,
       `created_by_admin_id='system'`) ;
     - envoyer l'email via `safeSendMail` + nouveau template
       `lib/email/founder-bonus.ts` (calqué sur `lib/email/waitlist.ts`).
   - dédup : ne pas recréer de broadcast pour un prospect déjà flaggé (la RPC
     renvoie `false` → on skippe broadcast + email).
3. Renvoie un récap `{ eligible, credited, broadcasted, emailed, errors }`.

Garde-fou opérationnel : la distribution réelle (crédits + emails Brevo réels) ne
sera **déclenchée qu'après feu vert explicite**, après un dry-run montrant le
nombre d'éligibles.

Note : le broadcast n'est visible que par les comptes créés **avant** son envoi
(cutoff `created_at >= userSignupAt` dans `/api/me/notifications`) — vrai pour
tous les prospects actuels.

## G. Stripe (hors périmètre immédiat — documenté)

Le versement est fictif : on ne crée pas de `PaymentIntent`/transfert Stripe.
Étape future (au lancement) : refléter le coût total des bonus comme débit réel
sur le compte Stripe BUUPP. Aucune modification du code Stripe dans ce lot.

## H. Tests

- RPC `apply_founder_signup_bonus` : appel sur prospect fondateur → `true` + 1
  transaction +500 ; deuxième appel → `false`, pas de doublon ; prospect non
  fondateur → `false`, aucune écriture.
- `/api/prospect/wallet` : une transaction `signup_bonus` completed est comptée
  dans `lifetimeGainsCents`, `monthGainsCents`, `availableCents` et fait passer
  `canWithdraw` à `true`.
- `/api/prospect/movements` : une transaction `signup_bonus` retourne
  `origin="Bonus fondateur 🎁"`, `statusLabel="Crédité"`, `statusChip="good"`,
  `kind="signup_bonus"`.
- Endpoint distribute : dry-run ne mute rien ; confirm crédite chaque éligible
  une seule fois (idempotent au re-run).

## Séquencement

- **Phase 1 — `main`** : A, B, C, D, F (+ tests). Commit/push → déploiement web
  (sert aussi le mobile en lecture).
- **Phase 2 — `worktree-mobile-app`** : E (highlight UI mobile).
- **Déclenchement distribution** : dry-run puis exécution réelle sur feu vert.
