-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Suggestions/feedback utilisateurs (onglet « Vos suggestions »)
-- ════════════════════════════════════════════════════════════════════
-- Append-only. Insérée par POST /api/me/suggestions après tentative
-- d'envoi e-mail (réussie ou non). Lue par /buupp-admin/suggestions.
-- RLS activé, AUCUNE policy → accès service_role uniquement (pattern
-- relation_reports).
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  from_email text,
  from_name  text,
  from_role  text check (from_role is null or from_role in ('prospect','pro')),
  subject    text check (subject is null or length(subject) <= 120),
  message    text not null check (length(message) <= 4000),
  email_sent_at    timestamptz,
  email_message_id text,
  read_at          timestamptz,
  read_by_clerk_id text,
  resolved_at          timestamptz,
  resolved_by_clerk_id text,
  resolved_note text check (resolved_note is null or length(resolved_note) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists suggestions_created_at_idx
  on public.suggestions (created_at desc);
create index if not exists suggestions_unread_idx
  on public.suggestions (created_at desc) where read_at is null;

alter table public.suggestions enable row level security;
-- aucune policy : service_role only
