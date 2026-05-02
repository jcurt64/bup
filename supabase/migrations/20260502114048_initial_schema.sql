-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Schéma initial
-- ════════════════════════════════════════════════════════════════════
-- Auth : Clerk (Third-Party Auth Supabase). Les JWT Clerk sont vérifiés
-- par Supabase et `auth.jwt() ->> 'sub'` renvoie l'ID Clerk de l'user.
-- Toute table accessible par le rôle `authenticated` doit avoir RLS ON.
-- ════════════════════════════════════════════════════════════════════

-- ─── Extensions ─────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Enums ──────────────────────────────────────────────────────────
create type public.verification_level as enum (
  'basique', 'verifie', 'certifie', 'confiance'
);

create type public.campaign_type as enum (
  'prise_de_contact', 'prise_de_rendez_vous', 'information_sondage', 'devis_chiffrage'
);

create type public.campaign_status as enum (
  'draft', 'active', 'paused', 'completed', 'canceled'
);

create type public.relation_status as enum (
  'pending', 'accepted', 'refused', 'expired', 'settled'
);

create type public.transaction_type as enum (
  'credit', 'escrow', 'withdrawal', 'topup',
  'campaign_charge', 'referral_bonus', 'refund'
);

create type public.transaction_status as enum (
  'pending', 'completed', 'failed', 'canceled'
);

create type public.pro_plan as enum ('starter', 'pro');

create type public.pro_billing_status as enum (
  'active', 'past_due', 'canceled', 'trialing'
);

create type public.account_kind as enum ('prospect', 'pro');

create type public.tier_key as enum (
  'identity', 'localisation', 'vie', 'pro', 'patrimoine'
);

-- ─── Helper : trigger updated_at ────────────────────────────────────
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Helper : ID Clerk depuis le JWT ────────────────────────────────
-- Centralise la logique pour les policies RLS.
create or replace function public.clerk_user_id()
returns text
language sql
stable
as $$
  select auth.jwt() ->> 'sub'
$$;

-- ════════════════════════════════════════════════════════════════════
-- 1. PROSPECTS — un par particulier
-- ════════════════════════════════════════════════════════════════════
create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  bupp_score integer not null default 0
    check (bupp_score between 0 and 1000),
  verification public.verification_level not null default 'basique',
  removed_tiers public.tier_key[] not null default '{}',
  hidden_tiers public.tier_key[] not null default '{}',
  all_campaign_types boolean not null default true,
  campaign_types public.campaign_type[] not null default '{}',
  categories text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prospects_clerk_user_id_idx on public.prospects (clerk_user_id);

create trigger prospects_set_updated_at
  before update on public.prospects
  for each row execute function public.tg_set_updated_at();

alter table public.prospects enable row level security;

create policy "prospects_select_own" on public.prospects
  for select to authenticated
  using ((select public.clerk_user_id()) = clerk_user_id);

create policy "prospects_insert_own" on public.prospects
  for insert to authenticated
  with check ((select public.clerk_user_id()) = clerk_user_id);

create policy "prospects_update_own" on public.prospects
  for update to authenticated
  using ((select public.clerk_user_id()) = clerk_user_id)
  with check ((select public.clerk_user_id()) = clerk_user_id);

create policy "prospects_delete_own" on public.prospects
  for delete to authenticated
  using ((select public.clerk_user_id()) = clerk_user_id);

-- ════════════════════════════════════════════════════════════════════
-- 2. PALIER 1 — IDENTIFICATION
-- ════════════════════════════════════════════════════════════════════
-- Tables séparées par palier → suppression RGPD art.17 atomique
-- (DELETE sur la table palier sans toucher au reste du profil).
create table public.prospect_identity (
  prospect_id uuid primary key
    references public.prospects(id) on delete cascade,
  prenom text,
  nom text,
  email text,
  telephone text,
  naissance date,
  updated_at timestamptz not null default now()
);

create trigger prospect_identity_set_updated_at
  before update on public.prospect_identity
  for each row execute function public.tg_set_updated_at();

alter table public.prospect_identity enable row level security;

create policy "prospect_identity_owner_all" on public.prospect_identity
  for all to authenticated
  using (
    exists (
      select 1 from public.prospects p
      where p.id = prospect_identity.prospect_id
        and p.clerk_user_id = (select public.clerk_user_id())
    )
  )
  with check (
    exists (
      select 1 from public.prospects p
      where p.id = prospect_identity.prospect_id
        and p.clerk_user_id = (select public.clerk_user_id())
    )
  );

-- ════════════════════════════════════════════════════════════════════
-- 3. PALIER 2 — LOCALISATION
-- ════════════════════════════════════════════════════════════════════
create table public.prospect_localisation (
  prospect_id uuid primary key
    references public.prospects(id) on delete cascade,
  adresse text,
  ville text,
  code_postal text,
  logement text,
  mobilite text,
  updated_at timestamptz not null default now()
);

create trigger prospect_localisation_set_updated_at
  before update on public.prospect_localisation
  for each row execute function public.tg_set_updated_at();

alter table public.prospect_localisation enable row level security;

create policy "prospect_localisation_owner_all" on public.prospect_localisation
  for all to authenticated
  using (
    exists (
      select 1 from public.prospects p
      where p.id = prospect_localisation.prospect_id
        and p.clerk_user_id = (select public.clerk_user_id())
    )
  )
  with check (
    exists (
      select 1 from public.prospects p
      where p.id = prospect_localisation.prospect_id
        and p.clerk_user_id = (select public.clerk_user_id())
    )
  );

-- ════════════════════════════════════════════════════════════════════
-- 4. PALIER 3 — STYLE DE VIE
-- ════════════════════════════════════════════════════════════════════
create table public.prospect_vie (
  prospect_id uuid primary key
    references public.prospects(id) on delete cascade,
  foyer text,
  sports text,
  animaux text,
  vehicule text,
  updated_at timestamptz not null default now()
);

create trigger prospect_vie_set_updated_at
  before update on public.prospect_vie
  for each row execute function public.tg_set_updated_at();

alter table public.prospect_vie enable row level security;

create policy "prospect_vie_owner_all" on public.prospect_vie
  for all to authenticated
  using (
    exists (
      select 1 from public.prospects p
      where p.id = prospect_vie.prospect_id
        and p.clerk_user_id = (select public.clerk_user_id())
    )
  )
  with check (
    exists (
      select 1 from public.prospects p
      where p.id = prospect_vie.prospect_id
        and p.clerk_user_id = (select public.clerk_user_id())
    )
  );

-- ════════════════════════════════════════════════════════════════════
-- 5. PALIER 4 — DONNÉES PROFESSIONNELLES
-- ════════════════════════════════════════════════════════════════════
create table public.prospect_pro (
  prospect_id uuid primary key
    references public.prospects(id) on delete cascade,
  poste text,
  statut text,
  secteur text,
  revenus text,
  updated_at timestamptz not null default now()
);

create trigger prospect_pro_set_updated_at
  before update on public.prospect_pro
  for each row execute function public.tg_set_updated_at();

alter table public.prospect_pro enable row level security;

create policy "prospect_pro_owner_all" on public.prospect_pro
  for all to authenticated
  using (
    exists (
      select 1 from public.prospects p
      where p.id = prospect_pro.prospect_id
        and p.clerk_user_id = (select public.clerk_user_id())
    )
  )
  with check (
    exists (
      select 1 from public.prospects p
      where p.id = prospect_pro.prospect_id
        and p.clerk_user_id = (select public.clerk_user_id())
    )
  );

-- ════════════════════════════════════════════════════════════════════
-- 6. PALIER 5 — PATRIMOINE & PROJETS
-- ════════════════════════════════════════════════════════════════════
create table public.prospect_patrimoine (
  prospect_id uuid primary key
    references public.prospects(id) on delete cascade,
  residence text,
  epargne text,
  projets text,
  updated_at timestamptz not null default now()
);

create trigger prospect_patrimoine_set_updated_at
  before update on public.prospect_patrimoine
  for each row execute function public.tg_set_updated_at();

alter table public.prospect_patrimoine enable row level security;

create policy "prospect_patrimoine_owner_all" on public.prospect_patrimoine
  for all to authenticated
  using (
    exists (
      select 1 from public.prospects p
      where p.id = prospect_patrimoine.prospect_id
        and p.clerk_user_id = (select public.clerk_user_id())
    )
  )
  with check (
    exists (
      select 1 from public.prospects p
      where p.id = prospect_patrimoine.prospect_id
        and p.clerk_user_id = (select public.clerk_user_id())
    )
  );

-- ════════════════════════════════════════════════════════════════════
-- 7. PRO_ACCOUNTS — comptes professionnels
-- ════════════════════════════════════════════════════════════════════
create table public.pro_accounts (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  raison_sociale text not null,
  siren text check (siren is null or siren ~ '^[0-9]{9}$'),
  secteur text,
  adresse text,
  ville text,
  code_postal text,
  stripe_customer_id text unique,
  plan public.pro_plan not null default 'starter',
  billing_status public.pro_billing_status not null default 'active',
  wallet_balance_cents bigint not null default 0
    check (wallet_balance_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pro_accounts_clerk_user_id_idx on public.pro_accounts (clerk_user_id);
create index pro_accounts_stripe_customer_idx on public.pro_accounts (stripe_customer_id);

create trigger pro_accounts_set_updated_at
  before update on public.pro_accounts
  for each row execute function public.tg_set_updated_at();

alter table public.pro_accounts enable row level security;

create policy "pro_accounts_select_own" on public.pro_accounts
  for select to authenticated
  using ((select public.clerk_user_id()) = clerk_user_id);

create policy "pro_accounts_insert_own" on public.pro_accounts
  for insert to authenticated
  with check ((select public.clerk_user_id()) = clerk_user_id);

create policy "pro_accounts_update_own" on public.pro_accounts
  for update to authenticated
  using ((select public.clerk_user_id()) = clerk_user_id)
  with check ((select public.clerk_user_id()) = clerk_user_id);

create policy "pro_accounts_delete_own" on public.pro_accounts
  for delete to authenticated
  using ((select public.clerk_user_id()) = clerk_user_id);

-- ════════════════════════════════════════════════════════════════════
-- 8. CAMPAIGNS — campagnes lancées par les pros
-- ════════════════════════════════════════════════════════════════════
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  pro_account_id uuid not null
    references public.pro_accounts(id) on delete cascade,
  name text not null,
  type public.campaign_type not null,
  status public.campaign_status not null default 'draft',
  targeting jsonb not null default '{}'::jsonb,
  cost_per_contact_cents bigint not null check (cost_per_contact_cents > 0),
  budget_cents bigint not null check (budget_cents > 0),
  spent_cents bigint not null default 0 check (spent_cents >= 0),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_spent_within_budget check (spent_cents <= budget_cents)
);

create index campaigns_pro_account_idx on public.campaigns (pro_account_id);
create index campaigns_status_idx on public.campaigns (status)
  where status = 'active';

create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function public.tg_set_updated_at();

alter table public.campaigns enable row level security;

create policy "campaigns_owner_all" on public.campaigns
  for all to authenticated
  using (
    exists (
      select 1 from public.pro_accounts a
      where a.id = campaigns.pro_account_id
        and a.clerk_user_id = (select public.clerk_user_id())
    )
  )
  with check (
    exists (
      select 1 from public.pro_accounts a
      where a.id = campaigns.pro_account_id
        and a.clerk_user_id = (select public.clerk_user_id())
    )
  );

-- ════════════════════════════════════════════════════════════════════
-- 9. RELATIONS — sollicitations envoyées aux prospects
-- ════════════════════════════════════════════════════════════════════
create table public.relations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  pro_account_id uuid not null references public.pro_accounts(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  motif text not null,
  reward_cents bigint not null check (reward_cents > 0),
  status public.relation_status not null default 'pending',
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null,
  decided_at timestamptz,
  settled_at timestamptz,
  -- Une campagne ne peut solliciter le même prospect qu'une fois.
  unique (campaign_id, prospect_id)
);

create index relations_prospect_idx on public.relations (prospect_id, status);
create index relations_pro_idx on public.relations (pro_account_id, status);
create index relations_campaign_idx on public.relations (campaign_id);
create index relations_expires_idx on public.relations (expires_at)
  where status = 'pending';

alter table public.relations enable row level security;

-- Le prospect peut lire ses propres sollicitations et changer leur état
-- via UPDATE (accepter/refuser). L'INSERT est réservé au backend (service role).
create policy "relations_owner_select" on public.relations
  for select to authenticated
  using (
    exists (
      select 1 from public.prospects p
      where p.id = relations.prospect_id
        and p.clerk_user_id = (select public.clerk_user_id())
    )
    or exists (
      select 1 from public.pro_accounts a
      where a.id = relations.pro_account_id
        and a.clerk_user_id = (select public.clerk_user_id())
    )
  );

create policy "relations_prospect_update" on public.relations
  for update to authenticated
  using (
    exists (
      select 1 from public.prospects p
      where p.id = relations.prospect_id
        and p.clerk_user_id = (select public.clerk_user_id())
    )
  )
  with check (
    exists (
      select 1 from public.prospects p
      where p.id = relations.prospect_id
        and p.clerk_user_id = (select public.clerk_user_id())
    )
  );

-- ════════════════════════════════════════════════════════════════════
-- 10. TRANSACTIONS — historique financier (prospect ET pro)
-- ════════════════════════════════════════════════════════════════════
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  account_kind public.account_kind not null,
  type public.transaction_type not null,
  status public.transaction_status not null default 'pending',
  amount_cents bigint not null,
  relation_id uuid references public.relations(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  stripe_payment_intent_id text,
  description text not null,
  created_at timestamptz not null default now()
);

create index transactions_account_idx
  on public.transactions (account_id, account_kind, created_at desc);
create index transactions_stripe_pi_idx
  on public.transactions (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.transactions enable row level security;

-- Lecture seule pour l'utilisateur — toute écriture passe par le backend
-- (route handlers / webhooks Stripe, en service_role).
create policy "transactions_owner_select" on public.transactions
  for select to authenticated
  using (
    case account_kind
      when 'prospect' then exists (
        select 1 from public.prospects p
        where p.id = transactions.account_id
          and p.clerk_user_id = (select public.clerk_user_id())
      )
      when 'pro' then exists (
        select 1 from public.pro_accounts a
        where a.id = transactions.account_id
          and a.clerk_user_id = (select public.clerk_user_id())
      )
    end
  );
