-- Module « Tests & Études » (spec docs/superpowers/specs/2026-11-06-tests-etudes-design.md)
--
-- Campagnes tout-ou-rien : le pro publie (budget max RÉSERVÉ, pas débité),
-- les prospects s'inscrivent ; seuil atteint → validée (codes individuels),
-- sinon annulée (tout libéré). Chaque participation approuvée débite le pro
-- (rémunération + commission 10 % min 0,30 €) et crédite le prospect.
-- Tout mouvement d'argent passe par les RPC ci-dessous (verrou + statut).

-- ── Tables ────────────────────────────────────────────────────────────
create table if not exists public.study_campaigns (
  id                       uuid primary key default gen_random_uuid(),
  pro_account_id           uuid not null references public.pro_accounts(id) on delete cascade,
  type                     text not null check (type in ('survey','product_test','visit')),
  title                    text not null,
  description              text not null,
  estimated_minutes        integer not null check (estimated_minutes between 1 and 600),
  external_url             text,
  address                  text,
  reward_cents             bigint not null check (reward_cents >= 100),
  commission_cents         bigint not null check (commission_cents >= 0),
  min_participants         integer not null check (min_participants >= 5),
  max_participants         integer not null check (max_participants <= 500 and max_participants >= min_participants),
  scope                    text not null check (scope in ('department','national')),
  department               text,
  signup_deadline          timestamptz not null,
  completion_deadline      timestamptz not null,
  status                   text not null default 'draft'
                             check (status in ('draft','published','validated','canceled','closed')),
  cancel_reason            text,
  budget_reserved_cents    bigint not null default 0,
  fraud_terms_accepted_at  timestamptz,
  published_at             timestamptz,
  validated_at             timestamptz,
  canceled_at              timestamptz,
  closed_at                timestamptz,
  purged_at                timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (scope = 'national' or department is not null),
  check (type <> 'visit' or scope = 'department')
);
create index if not exists study_campaigns_status_idx on public.study_campaigns (status, signup_deadline);
create index if not exists study_campaigns_pro_idx on public.study_campaigns (pro_account_id, created_at desc);

create table if not exists public.study_participations (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references public.study_campaigns(id) on delete cascade,
  prospect_id     uuid not null references public.prospects(id) on delete cascade,
  status          text not null default 'joined'
                    check (status in ('joined','confirmed','done','approved','rejected','disputed','rejected_final','not_done')),
  code            text unique,
  consent_at      timestamptz not null default now(),
  done_at         timestamptz,
  done_comment    text,
  review_due_at   timestamptz,
  approved_at     timestamptz,
  approved_by     text check (approved_by in ('pro','auto','admin')),
  rejected_at     timestamptz,
  reject_reason   text,
  reject_note     text,
  disputed_at     timestamptz,
  dispute_note    text,
  resolved_at     timestamptz,
  reminder_sent_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (campaign_id, prospect_id)
);
create index if not exists study_participations_prospect_idx on public.study_participations (prospect_id, created_at desc);
create index if not exists study_participations_campaign_idx on public.study_participations (campaign_id, status);

create table if not exists public.study_reports (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.study_campaigns(id) on delete cascade,
  prospect_id  uuid not null references public.prospects(id) on delete cascade,
  reason       text not null check (reason in ('scam','payment','personal_data','forbidden_product','misleading','other')),
  note         text,
  created_at   timestamptz not null default now(),
  unique (campaign_id, prospect_id)
);

create table if not exists public.study_notifications (
  id           uuid primary key default gen_random_uuid(),
  prospect_id  uuid not null references public.prospects(id) on delete cascade,
  campaign_id  uuid not null references public.study_campaigns(id) on delete cascade,
  kind         text not null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  emailed_at   timestamptz,
  unique (prospect_id, campaign_id, kind)
);
create index if not exists study_notifications_prospect_idx on public.study_notifications (prospect_id, created_at desc);

alter table public.study_campaigns      enable row level security;
alter table public.study_participations enable row level security;
alter table public.study_reports        enable row level security;
alter table public.study_notifications  enable row level security;
-- Pas de policy : accès service_role uniquement (routes API).

-- ── Colonnes sur l'existant ───────────────────────────────────────────
alter table public.prospects  add column if not exists studies_email_digest boolean not null default false;
alter table public.prospects  add column if not exists studies_digest_sent_at timestamptz;
alter table public.app_config add column if not exists studies_enabled boolean not null default false;
alter table public.transactions add column if not exists study_participation_id uuid
  references public.study_participations(id) on delete set null;
create index if not exists transactions_study_participation_idx
  on public.transactions (study_participation_id) where study_participation_id is not null;

alter table public.relation_email_aliases alter column relation_id drop not null;
alter table public.relation_email_aliases add column if not exists study_participation_id uuid unique
  references public.study_participations(id) on delete cascade;
alter table public.relation_email_aliases add column if not exists revoked_at timestamptz;
do $$ begin
  alter table public.relation_email_aliases
    add constraint relation_email_aliases_one_target
    check (num_nonnulls(relation_id, study_participation_id) = 1);
exception when duplicate_object then null; end $$;

-- ── Helpers ───────────────────────────────────────────────────────────
create or replace function public.study_unit_cost_cents(p_reward bigint)
returns bigint language sql immutable set search_path to 'public' as $$
  select p_reward + public.buupp_commission_cents(p_reward, 1000, 30);
$$;

create or replace function public.study_random_code()
returns text language plpgsql volatile set search_path to 'public' as $$
declare
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_out text := 'BU-';
begin
  for i in 1..4 loop
    v_out := v_out || substr(v_alpha, 1 + floor(random() * 32)::int, 1);
  end loop;
  return v_out;
end $$;

-- ── Publication : réserve le budget max ──────────────────────────────
create or replace function public.publish_study_tx(p_id uuid)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare
  c public.study_campaigns%rowtype;
  v_budget bigint;
  v_balance bigint;
  v_reserved bigint;
begin
  select * into c from public.study_campaigns where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if c.status <> 'draft' then raise exception 'not_draft'; end if;
  if c.fraud_terms_accepted_at is null then raise exception 'fraud_terms_required'; end if;
  if c.signup_deadline <= now() then raise exception 'signup_deadline_past'; end if;

  v_budget := c.max_participants * public.study_unit_cost_cents(c.reward_cents);
  select wallet_balance_cents, wallet_reserved_cents into v_balance, v_reserved
    from public.pro_accounts where id = c.pro_account_id for update;
  if v_balance - v_reserved < v_budget then
    raise exception 'insufficient_funds:%', v_budget - (v_balance - v_reserved);
  end if;

  update public.pro_accounts set wallet_reserved_cents = wallet_reserved_cents + v_budget
    where id = c.pro_account_id;
  update public.study_campaigns
     set status = 'published', budget_reserved_cents = v_budget,
         commission_cents = public.buupp_commission_cents(c.reward_cents, 1000, 30),
         published_at = now(), updated_at = now()
   where id = p_id;
  return v_budget;
end $$;

-- ── Validation : seuil atteint → codes individuels ───────────────────
create or replace function public.validate_study_tx(p_id uuid)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare
  c public.study_campaigns%rowtype;
  r record;
  v_code text;
begin
  select * into c from public.study_campaigns where id = p_id for update;
  if not found or c.status <> 'published' then return false; end if;

  for r in select id from public.study_participations where campaign_id = p_id and status = 'joined' loop
    loop
      v_code := public.study_random_code();
      begin
        update public.study_participations set status = 'confirmed', code = v_code where id = r.id;
        exit;
      exception when unique_violation then
        -- collision de code : on retente
      end;
    end loop;
  end loop;

  update public.study_campaigns set status = 'validated', validated_at = now(), updated_at = now()
   where id = p_id;
  return true;
end $$;

-- ── Inscription (compte sous verrou → jamais au-delà du max) ─────────
create or replace function public.join_study_tx(p_campaign uuid, p_prospect uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  c public.study_campaigns%rowtype;
  v_count int;
begin
  select * into c from public.study_campaigns where id = p_campaign for update;
  if not found then raise exception 'not_found'; end if;
  if c.status <> 'published' or c.signup_deadline <= now() then raise exception 'not_open'; end if;
  if exists (select 1 from public.study_participations where campaign_id = p_campaign and prospect_id = p_prospect) then
    return 'already_joined';
  end if;
  select count(*) into v_count from public.study_participations where campaign_id = p_campaign;
  if v_count >= c.max_participants then raise exception 'full'; end if;

  insert into public.study_participations (campaign_id, prospect_id) values (p_campaign, p_prospect);
  if v_count + 1 >= c.max_participants then
    perform public.validate_study_tx(p_campaign);
    return 'joined_validated';
  end if;
  return 'joined';
end $$;

-- ── Annulation : tout ou partie de la réservation libérée ────────────
-- p_reason : 'threshold_not_met' | 'pro_canceled' | 'admin_suspended'.
-- Sur suspension d'une campagne validée, les participations déclarées
-- faites (done/rejected/disputed) sont conservées pour arbitrage admin et
-- leur coût reste réservé ; le reste est libéré.
create or replace function public.cancel_study_tx(p_id uuid, p_reason text)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare
  c public.study_campaigns%rowtype;
  v_keep int := 0;
  v_keep_reserved bigint := 0;
  v_release bigint;
begin
  select * into c from public.study_campaigns where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if c.status in ('canceled','closed') then return 0; end if;
  if c.status = 'validated' and p_reason <> 'admin_suspended' then raise exception 'already_validated'; end if;

  if c.status = 'validated' then
    delete from public.study_participations
     where campaign_id = p_id and status in ('joined','confirmed','not_done');
    select count(*) into v_keep from public.study_participations
     where campaign_id = p_id and status in ('done','rejected','disputed');
    v_keep_reserved := v_keep * public.study_unit_cost_cents(c.reward_cents);
  else
    delete from public.study_participations where campaign_id = p_id;
  end if;

  v_release := greatest(0, c.budget_reserved_cents - v_keep_reserved);
  if v_release > 0 then
    update public.pro_accounts
       set wallet_reserved_cents = greatest(0, wallet_reserved_cents - v_release)
     where id = c.pro_account_id;
  end if;

  update public.study_campaigns
     set status = 'canceled', cancel_reason = p_reason, canceled_at = now(),
         budget_reserved_cents = v_keep_reserved, updated_at = now()
   where id = p_id;
  return v_release;
end $$;

-- ── Approbation : débit pro + crédit prospect (idempotent) ───────────
create or replace function public.approve_study_participation_tx(p_participation uuid, p_by text)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare
  p public.study_participations%rowtype;
  c public.study_campaigns%rowtype;
  v_commission bigint;
  v_cost bigint;
begin
  select * into p from public.study_participations where id = p_participation for update;
  if not found then return false; end if;
  if p.status not in ('confirmed','done','rejected','disputed','not_done') then return false; end if;
  select * into c from public.study_campaigns where id = p.campaign_id for update;
  if c.status not in ('validated','canceled') then return false; end if;

  v_commission := public.buupp_commission_cents(c.reward_cents, 1000, 30);
  v_cost := c.reward_cents + v_commission;

  update public.pro_accounts
     set wallet_balance_cents = wallet_balance_cents - v_cost,
         wallet_reserved_cents = greatest(0, wallet_reserved_cents - v_cost)
   where id = c.pro_account_id;
  update public.study_campaigns
     set budget_reserved_cents = greatest(0, budget_reserved_cents - v_cost), updated_at = now()
   where id = c.id;

  insert into public.transactions
    (account_id, account_kind, type, status, amount_cents, study_participation_id, description)
  values
    (c.pro_account_id, 'pro', 'campaign_charge', 'completed', -c.reward_cents, p.id,
     'Tests & Études — ' || c.title),
    (p.prospect_id, 'prospect', 'credit', 'completed', c.reward_cents, p.id,
     'Tests & Études — ' || c.title);
  if v_commission > 0 then
    insert into public.transactions
      (account_id, account_kind, type, status, amount_cents, study_participation_id, description)
    values
      (c.pro_account_id, 'pro', 'buupp_commission', 'completed', -v_commission, p.id,
       'Commission BUUPP Tests & Études (10 %, min. 0,30 €)');
  end if;

  update public.study_participations
     set status = 'approved', approved_at = now(), approved_by = p_by,
         resolved_at = case when p.status = 'disputed' then now() else resolved_at end
   where id = p.id;
  return true;
end $$;

-- ── Clôture : libère le résiduel quand plus rien n'est en attente ────
create or replace function public.close_study_tx(p_id uuid)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare
  c public.study_campaigns%rowtype;
  v_release bigint;
begin
  select * into c from public.study_campaigns where id = p_id for update;
  if not found or c.status not in ('validated','canceled') then return 0; end if;
  if exists (select 1 from public.study_participations
              where campaign_id = p_id and status in ('confirmed','done','rejected','disputed')) then
    return 0;
  end if;
  v_release := c.budget_reserved_cents;
  if v_release > 0 then
    update public.pro_accounts
       set wallet_reserved_cents = greatest(0, wallet_reserved_cents - v_release)
     where id = c.pro_account_id;
  end if;
  update public.study_campaigns
     set status = case when c.status = 'validated' then 'closed' else 'canceled' end,
         closed_at = case when c.status = 'validated' then now() else closed_at end,
         budget_reserved_cents = 0, updated_at = now()
   where id = p_id;
  return v_release;
end $$;

revoke all on function public.publish_study_tx(uuid) from public, anon, authenticated;
revoke all on function public.validate_study_tx(uuid) from public, anon, authenticated;
revoke all on function public.join_study_tx(uuid, uuid) from public, anon, authenticated;
revoke all on function public.cancel_study_tx(uuid, text) from public, anon, authenticated;
revoke all on function public.approve_study_participation_tx(uuid, text) from public, anon, authenticated;
revoke all on function public.close_study_tx(uuid) from public, anon, authenticated;
