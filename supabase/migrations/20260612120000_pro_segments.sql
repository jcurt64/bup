-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Segments enregistrés (atelier de segmentation pro)
-- ════════════════════════════════════════════════════════════════════
-- Un segment = un jeu de critères de filtre (JSON) nommé, attaché à une
-- campagne. Réévalué à l'ouverture (pas une liste figée d'IDs).
-- RLS activée sans policy : accès via service_role uniquement (comme
-- pro_contact_clicks / pro_contact_reveals).
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.pro_segments (
  id uuid primary key default gen_random_uuid(),
  pro_account_id uuid not null references public.pro_accounts(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pro_segments_pro_campaign_idx
  on public.pro_segments (pro_account_id, campaign_id, created_at desc);

alter table public.pro_segments enable row level security;
-- Aucune policy : seul service_role lit / écrit (ownership vérifié côté route).
