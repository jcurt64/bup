-- ════════════════════════════════════════════════════════════════════
-- FREEBUUPP — tirage au sort lancé par un pro (NON déployé)
-- ════════════════════════════════════════════════════════════════════
-- Domaine isolé des campagnes : un pro paie 10 € pour ouvrir un panel
-- (30/50/80), des prospects s'inscrivent pendant 24 h, puis un tirage
-- vérifiable désigne 2/5/10 gagnants. Le pro ne récupère que le
-- téléphone des gagnants.
-- ⚠️ Migration à appliquer plus tard via SQL Editor + `migration repair`.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.freebuupps (
  id                 uuid primary key default gen_random_uuid(),
  pro_account_id     uuid not null references public.pro_accounts(id) on delete cascade,
  code               text not null unique,
  title              text not null,
  prize_description  text not null,
  brand_name         text not null,
  panel_size         int  not null check (panel_size in (30, 50, 80)),
  winners_count      int  not null check (winners_count in (2, 5, 10)),
  geo                text not null default 'national',
  geo_target         jsonb,
  status             text not null default 'open'
                       check (status in ('open','closed','drawn','canceled')),
  opens_at           timestamptz not null default now(),
  closes_at          timestamptz not null,
  drawn_at           timestamptz,
  seed_hash          text not null,
  seed               text,
  fee_cents          bigint not null default 1000,
  refunded           boolean not null default false,
  -- Mail groupé de consolation aux non-gagnants : envoyé UNE SEULE FOIS.
  -- NULL = pas encore envoyé ; horodaté au premier (et unique) envoi.
  consolation_sent_at timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint freebuupps_winners_lt_panel check (winners_count < panel_size)
);

create index if not exists freebuupps_pro_idx on public.freebuupps (pro_account_id);
create index if not exists freebuupps_open_idx on public.freebuupps (status) where status = 'open';
create index if not exists freebuupps_closes_idx on public.freebuupps (closes_at);

create trigger freebuupps_set_updated_at
  before update on public.freebuupps
  for each row execute function public.tg_set_updated_at();

alter table public.freebuupps enable row level security;

-- Le pro propriétaire gère ses freebuupps ; la lecture publique passe par
-- l'API en service_role (pas d'exposition directe).
create policy "freebuupps_owner_all" on public.freebuupps
  for all to authenticated
  using (exists (
    select 1 from public.pro_accounts a
    where a.id = freebuupps.pro_account_id
      and a.clerk_user_id = (select public.clerk_user_id())))
  with check (exists (
    select 1 from public.pro_accounts a
    where a.id = freebuupps.pro_account_id
      and a.clerk_user_id = (select public.clerk_user_id())));

create table if not exists public.freebuupp_participants (
  id                  uuid primary key default gen_random_uuid(),
  freebuupp_id        uuid not null references public.freebuupps(id) on delete cascade,
  prospect_id         uuid not null references public.prospects(id) on delete cascade,
  participant_number  int  not null,
  is_winner           boolean not null default false,
  -- Signalement par un GAGNANT de la non-réception de son lot.
  -- NULL = pas de signalement ; horodaté + motif optionnel sinon.
  prize_reported_at   timestamptz,
  prize_report_reason text,
  created_at          timestamptz not null default now(),
  constraint freebuupp_participants_unique_prospect unique (freebuupp_id, prospect_id),
  constraint freebuupp_participants_unique_number   unique (freebuupp_id, participant_number)
);

create index if not exists freebuupp_participants_fb_idx
  on public.freebuupp_participants (freebuupp_id);
create index if not exists freebuupp_participants_prospect_idx
  on public.freebuupp_participants (prospect_id);

alter table public.freebuupp_participants enable row level security;

create policy "freebuupp_participants_select_own" on public.freebuupp_participants
  for select to authenticated
  using (exists (
    select 1 from public.prospects p
    where p.id = freebuupp_participants.prospect_id
      and p.clerk_user_id = (select public.clerk_user_id())));

-- Traçabilité wallet : on relie les transactions au freebuupp (miroir de campaign_id).
alter table public.transactions
  add column if not exists freebuupp_id uuid
    references public.freebuupps(id) on delete set null;

-- Flag d'activation (défaut false) — activable plus tard sans redéploiement.
alter table public.app_config
  add column if not exists freebuupp_enabled boolean not null default false;
