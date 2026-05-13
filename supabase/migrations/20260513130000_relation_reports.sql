-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Signalements de pros par les prospects
-- ════════════════════════════════════════════════════════════════════
-- Append-only. Alimentée par POST /api/prospect/relations/[id]/report
-- (un prospect signale un comportement non conforme d'un pro sur une
-- relation précise) et lue par /buupp-admin/signalements (service_role).
--
-- Règles métier :
--   - 1 signalement max par relation (`unique (relation_id)`)
--   - 3 motifs fixes (enum `relation_report_reason`)
--   - commentaire optionnel ≤ 1000 chars
--   - admin peut marquer "traité" (resolved_at / resolved_by_clerk_id
--     / resolved_note) ou rouvrir (reset des 3 colonnes à NULL)
--
-- RLS activée sans policy : tout passe par service_role, comme
-- `admin_events`.
-- ════════════════════════════════════════════════════════════════════

create type public.relation_report_reason as enum (
  'sollicitation_multiple',
  'faux_compte',
  'echange_abusif'
);

create table public.relation_reports (
  id uuid primary key default gen_random_uuid(),
  relation_id uuid not null references public.relations(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  pro_account_id uuid not null references public.pro_accounts(id) on delete cascade,
  reason public.relation_report_reason not null,
  comment text check (comment is null or length(comment) <= 1000),
  resolved_at timestamptz,
  resolved_by_clerk_id text,
  resolved_note text check (resolved_note is null or length(resolved_note) <= 1000),
  created_at timestamptz not null default now(),
  unique (relation_id)
);

create index relation_reports_created_at_idx
  on public.relation_reports (created_at desc);

create index relation_reports_open_idx
  on public.relation_reports (created_at desc)
  where resolved_at is null;

create index relation_reports_pro_idx
  on public.relation_reports (pro_account_id, created_at desc);

alter table public.relation_reports enable row level security;
-- Aucune policy : seul service_role accède directement.
