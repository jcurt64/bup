# Programme Fondateur — Design

## Contexte

La waitlist actuelle (table `public.waitlist`) collecte les pré-inscriptions
sans aucun privilège associé après lancement. Cette feature transforme les
inscrits en **« fondateurs »** au moment où ils créent leur compte Clerk,
avec deux avantages :

1. **Priorité +10 min** sur les flash deals (visibles uniquement aux
   fondateurs pendant les 10 premières minutes après création de la
   campagne).
2. **Doublement des gains** sur le 1er mois post-lancement, financé par le
   pro (avec opt-out par campagne).

Le tout doit s'intégrer cohéremment côté BD, API, UI prospect, UI pro et
contenu légal (CGU/CGV).

## Objectifs (in-scope)

- Marquer durablement les inscrits waitlist comme « fondateurs » à la
  création de leur compte.
- Filtrer les flash deals selon le statut fondateur pour appliquer la
  fenêtre de priorité de 10 min.
- Doubler la récompense versée au prospect fondateur (et le débit du
  pro) lors de l'acceptation, dans la fenêtre 1 mois post-lancement,
  sauf opt-out de la campagne.
- Afficher un badge fondateur dans le dashboard prospect.
- Afficher dans la modale flash deal le gain réel attendu (avec bonus
  si applicable).
- Annoncer clairement le surcoût aux pros lors de la création/récap de
  campagne.
- Mentionner le bonus fondateur dans l'email d'acceptation.
- Ajouter les articles correspondants en CGU et CGV.

## Non-objectifs (YAGNI)

- Panneau admin pour modifier la date de lancement (UPDATE SQL direct).
- Notification temps réel aux fondateurs lors de la création d'un flash
  deal (le polling existant des cards suffit).
- Historique consolidé des bonus payés/touchés au-delà du flag par
  relation.
- Re-cotation rétroactive de relations déjà acceptées avant la
  migration.
- Cap sur le nombre de fondateurs.

## Architecture — vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│  Trigger SQL : sync_founder_status() sur prospects          │
│  ─────────────────────────────────────────────────────────  │
│  INSERT/UPDATE prospects (email)                            │
│    → si email ∈ waitlist ET now() ≤ app_config.launch_at   │
│      → prospects.is_founder = true                         │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────┐    ┌──────────────────────────────┐
│  /api/landing/       │    │  RPC accept_relation_tx       │
│  flash-deals (GET)   │    │  ─────────────────────────────│
│  ──────────────────  │    │  Lit is_founder + launch_at + │
│  Si non-fondateur :  │    │  campaigns.founder_bonus_      │
│  filtre              │    │  enabled                       │
│  now()-created_at    │    │  Si éligible : reward × 2 +   │
│  ≥ 10 min            │    │  débit pro × 2 + flag         │
│  Calcule reward      │    │  founder_bonus_applied        │
│  visible (×2 si      │    │                                │
│  founder + window +  │    │                                │
│  enabled)            │    │                                │
└──────────────────────┘    └──────────────────────────────┘
```

## 1. Modèle de données

### Migration `20260508120000_founders_program.sql`

```sql
-- Table de configuration globale (singleton).
create table public.app_config (
  id boolean primary key default true check (id),
  launch_at timestamptz not null,
  updated_at timestamptz default now()
);
-- Insert initial : à customiser au déploiement.
insert into public.app_config (id, launch_at)
values (true, '2026-06-01T08:00:00Z')
on conflict (id) do nothing;

-- Flag fondateur sur le prospect.
alter table public.prospects
  add column is_founder boolean not null default false;
create index prospects_is_founder_idx on public.prospects (is_founder)
  where is_founder = true;

-- Toggle pro par campagne (default ON).
alter table public.campaigns
  add column founder_bonus_enabled boolean not null default true;

-- Snapshot bonus appliqué (audit + email).
alter table public.relations
  add column founder_bonus_applied boolean not null default false;

-- Trigger : quand l'email arrive dans prospect_identity (à la création
-- ou mise à jour), on recalcule prospects.is_founder. Le trigger doit
-- s'attacher à prospect_identity et non à prospects parce que
-- ensureProspect() insère prospects AVANT prospect_identity (cf.
-- lib/sync/prospects.ts) — l'email n'existe donc pas encore au moment
-- de l'INSERT sur prospects.
create or replace function public.sync_founder_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_launch_at timestamptz;
  v_email_in_waitlist boolean;
begin
  -- Si email absent (NULL), on remet is_founder à false (cas d'un
  -- effacement RGPD ou d'un identity créé sans email).
  if new.email is null then
    update public.prospects
       set is_founder = false
     where id = new.prospect_id;
    return new;
  end if;

  -- Date de lancement.
  select launch_at into v_launch_at from public.app_config where id = true;
  if v_launch_at is null then
    return new;  -- config absente : pas de mise à jour.
  end if;

  -- Email présent dans waitlist AVANT la date de lancement ?
  select exists (
    select 1 from public.waitlist w
     where lower(w.email) = lower(new.email)
       and w.created_at <= v_launch_at
  ) into v_email_in_waitlist;

  update public.prospects
     set is_founder = v_email_in_waitlist
   where id = new.prospect_id;

  return new;
end;
$$;

create trigger prospect_identity_sync_founder_status
  after insert or update of email on public.prospect_identity
  for each row execute function public.sync_founder_status();

-- Helper : statut fenêtre bonus 1 mois.
create or replace function public.is_within_founder_bonus_window()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_config
     where now() <= launch_at + interval '1 month'
  );
$$;
grant execute on function public.is_within_founder_bonus_window() to anon, authenticated;
```

### Notes importantes

- Le trigger est attaché à **`prospect_identity`** (et non `prospects`)
  parce que c'est dans cette table que l'email atterrit, et le flux
  `ensureProspect()` insère `prospects` *avant* `prospect_identity`. Le
  trigger se déclenche en `AFTER INSERT OR UPDATE OF email` pour
  re-évaluer le statut quand un utilisateur change son email (palier 1).
- Le statut `is_founder` est calculé *côté waitlist* : un fondateur peut
  changer son email après coup sans perdre son statut **tant que** le
  nouvel email reste dans la waitlist. Si un fondateur change pour un
  email hors waitlist, il perd le statut.
- L'index partiel `where is_founder = true` rend les lookups fondateur
  très efficaces sans pénaliser la table majoritaire.
- La colonne `relations.founder_bonus_applied` est figée à l'acceptation
  (snapshot) — pas de retour arrière.

## 2. Module helper côté Next.js

`lib/founders/index.ts` (nouveau) :

```ts
export type FounderContext = {
  isFounder: boolean;
  isWithinBonusWindow: boolean;
};

export async function getFounderContext(
  admin: SupabaseClient,
  prospectId: string | null,
): Promise<FounderContext>;
```

Utilisé par `/api/landing/flash-deals` et lors du calcul d'affichage du
récap pro. La RPC `accept_relation_tx` fait elle-même les lectures côté
SQL pour atomicité.

## 3. Flash deals — fenêtre priorité 10 min

`app/api/landing/flash-deals/route.ts` :

- Si appel anonyme **OU** prospect non-fondateur :
  filtre `created_at <= now() - interval '10 minutes'` sur les campagnes.
- Si prospect fondateur : aucun filtre temporel ajouté.
- Le `costPerContactCents` retourné est doublé si **prospect.is_founder ET
  is_within_founder_bonus_window() ET campaigns.founder_bonus_enabled**.
  Le payload reflète exactement ce que le prospect touchera.
- Un nouveau champ `founderBonusApplied: boolean` dans le payload permet
  à la modale d'afficher un badge « Bonus fondateur ×2 ».

## 4. Bonus financier — RPC `accept_relation_tx`

Modification de la fonction existante (migration séparée pour ne pas la
toucher en aveugle) :

```sql
create or replace function public.accept_relation_tx(p_relation_id uuid)
returns void
language plpgsql
... -- même squelette que l'existant
declare
  ...
  v_is_founder boolean;
  v_bonus_enabled boolean;
  v_in_window boolean;
  v_apply_bonus boolean := false;
  v_reward_cents bigint;
begin
  -- ... (vérifs existantes : ownership, status pending, expiration)

  -- Lecture des trois conditions.
  select p.is_founder into v_is_founder
    from public.prospects p
    join public.relations r on r.prospect_id = p.id
   where r.id = p_relation_id;

  select c.founder_bonus_enabled into v_bonus_enabled
    from public.campaigns c
    join public.relations r on r.campaign_id = c.id
   where r.id = p_relation_id;

  v_in_window := public.is_within_founder_bonus_window();

  v_apply_bonus := v_is_founder and v_bonus_enabled and v_in_window;

  -- Calcul du reward effectif.
  v_reward_cents := v_cost_per_contact_cents;
  if v_apply_bonus then
    v_reward_cents := v_reward_cents * 2;
  end if;

  -- Vérif solde pro suffisant pour le montant éventuellement doublé.
  if v_pro_balance_cents < v_reward_cents then
    raise exception 'insufficient_pro_funds';
  end if;

  -- Update relation : reward + flag bonus.
  update public.relations
     set status = 'accepted',
         decided_at = now(),
         reward_cents = v_reward_cents,
         founder_bonus_applied = v_apply_bonus
   where id = p_relation_id;

  -- Escrow : déjà v_reward_cents, donc x2 si bonus.
  -- ... (reste de la logique d'escrow inchangée)
end;
$$;
```

**Garde-fou** : si le pro n'a pas le solde pour 2×, l'acceptation échoue
avec `insufficient_pro_funds` (déjà mappé en HTTP 402 côté API). Le
prospect verra le message d'erreur et pourra réessayer plus tard ou
contacter le pro.

## 5. UI

### 5.1 Modale flash deal home (`app/page.tsx`)

- Si `deal.founderBonusApplied === true` → afficher un petit badge gold
  « Bonus fondateur ×2 » sous le label « Récompense ».
- Le montant principal affiché reste celui retourné par l'API (déjà
  doublé si applicable).

### 5.2 Création campagne (`public/prototype/components/Pro.jsx`)

Étape « Réglages campagne » :
- Nouveau toggle « Activer le bonus fondateur (+100% le 1er mois) »
  (default ON).
- Sous-texte : « Pendant le mois suivant le lancement officiel, chaque
  acceptation par un fondateur vous coûtera 2× le tarif palier choisi.
  Vous pouvez désactiver cette option : vos campagnes resteront visibles
  mais les fondateurs gagneront le tarif standard. »

Étape « Récapitulatif » :
- Tableau ajouté :
  ```
  Coût standard    : 1,00 € × N contacts = X €
  Bonus fondateur  : jusqu'à 2,00 € × N contacts (mois 1 uniquement)
                     = max Y € si tous fondateurs
  ```
- Si toggle OFF : ligne « Bonus fondateur : désactivé pour cette
  campagne ».

### 5.3 Email `lib/email/relation-accepted.ts`

Si la relation a `founder_bonus_applied = true`, le template ajoute une
section :

> 🎖️ **Bonus fondateur appliqué**  
> Vous touchez **X,XX €** au lieu de **Y,YY €** grâce à votre statut de
> fondateur·ice (+100% sur le 1er mois post-lancement).

Le service `sendRelationAccepted` reçoit déjà l'objet relation complet ;
on lit `founder_bonus_applied` pour brancher la section.

### 5.4 Badge dashboard prospect

Dans `public/prototype/components/Prospect.jsx` (composant `TopBar` ou
`ProspectHeader`) : si `profile.is_founder === true`, afficher un petit
badge gold « Fondateur » à côté du nom. La donnée transite par le payload
existant `/api/prospect/me` (à enrichir avec `is_founder`).

## 6. Légal

### 6.1 CGU (`app/cgu/page.tsx`) — nouvel article

> **Programme Fondateur**  
> Toute personne s'étant inscrite sur la liste d'attente avant la date
> officielle de lancement de BUUPP devient « Fondateur·ice » lors de la
> création de son compte. Ce statut, permanent, ouvre droit à :
> - une **priorité de 10 minutes** sur les sollicitations « flash deal »
>   (visibles aux Fondateur·ices avant le grand public) ;
> - un **doublement de la récompense** versée pour chaque sollicitation
>   acceptée pendant le **1er mois suivant le lancement**, sauf
>   indication contraire du professionnel à l'origine de la sollicitation.
> Aucune action n'est requise de la part du Fondateur·ice : le bénéfice
> est calculé automatiquement à l'acceptation.

### 6.2 CGV (`app/cgv/page.tsx`) — nouvel article

> **Bonus Fondateur — Conséquence pour le Professionnel**  
> Pendant le 1er mois suivant le lancement officiel de BUUPP, chaque
> acceptation d'une sollicitation par un prospect Fondateur·ice donne
> lieu à un débit de 2× le tarif palier choisi sur le solde du
> Professionnel. Lors de la création d'une campagne, le Professionnel
> peut désactiver cette mécanique pour la campagne concernée — ses
> sollicitations resteront alors visibles aux Fondateur·ices, mais ces
> derniers gagneront le tarif standard. Le Professionnel reconnaît être
> dûment informé de ce surcoût avant validation de la campagne.

## Gestion d'erreurs

- **Pro solde insuffisant pour le 2×** : `accept_relation_tx` raise
  `insufficient_pro_funds`, déjà mappée en HTTP 402 côté API. Modale
  affiche l'erreur ; le prospect peut réessayer (le pro doit recharger).
- **Trigger `sync_founder_status` ne tourne pas (BD KO)** : le prospect
  garde `is_founder = false` par défaut, dégradation silencieuse, pas de
  bonus mais pas de crash. Re-sync manuel possible.
- **app_config absent** : le helper `is_within_founder_bonus_window()`
  retourne `false`, donc aucun bonus n'est jamais appliqué — fail-safe.

## Tests (à couvrir au plan d'implémentation)

- **SQL** : tests unitaires de `sync_founder_status` sur cas
  (waitlist+temps OK, waitlist absent, waitlist+temps après launch).
- **SQL** : tests de `accept_relation_tx` avec/sans bonus, vérif débit
  pro doublé, vérif solde insuffisant.
- **API** : `/api/landing/flash-deals` filtre 10 min anonyme/founder.
- **E2E manuel** : flow complet création campagne pro → acceptation
  par fondateur → vérif solde pro et compteur prospect doublés, email
  reçu avec mention bonus.

## Rollout

1. Déployer migration BD (table `app_config`, colonnes, trigger, RPC mise
   à jour) avec `launch_at` à une date passée pour fail-safe (la fenêtre
   1 mois est expirée par défaut → aucun bonus appliqué).
2. Déployer code Next.js + prototype.
3. Le jour J — exécuter `update app_config set launch_at = '<vraie date>'`
   pour activer la fenêtre.
4. Re-syncer les prospects existants : `update prospect_identity set
   email = email where email is not null` — re-touche la colonne `email`
   sans la modifier, ce qui déclenche le trigger `AFTER UPDATE OF email`
   pour chaque prospect_identity existante (one-shot après migration).
