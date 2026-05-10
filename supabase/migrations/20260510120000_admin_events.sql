-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Table d'évènements pour le dashboard admin (back-office)
-- ════════════════════════════════════════════════════════════════════
-- Append-only. Alimentée fire-and-forget par `lib/admin/events/record.ts`
-- depuis les chemins métier (signups, campagnes, relations, transactions,
-- erreurs SMTP/Stripe). Lue uniquement par les Route Handlers admin en
-- service_role + relayée au navigateur via SSE (cf. spec §4.2).
--
-- Aucune policy RLS : toute lecture/écriture passe par service_role.
-- Le live-feed UI passe par /api/admin/events/stream (SSE) qui souscrit
-- côté serveur à Realtime — donc pas besoin d'ouvrir la table aux
-- clients authentifiés.
-- ════════════════════════════════════════════════════════════════════

create type public.admin_event_severity as enum ('info', 'warning', 'critical');

create table public.admin_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  severity public.admin_event_severity not null default 'info',
  payload jsonb not null default '{}'::jsonb,
  prospect_id uuid references public.prospects(id) on delete set null,
  pro_account_id uuid references public.pro_accounts(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  relation_id uuid references public.relations(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  -- { "<clerkUserId>": "<iso ts>" } — read-state par admin.
  read_by jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_events_created_at_idx on public.admin_events (created_at desc);
create index admin_events_type_idx on public.admin_events (type);
create index admin_events_severity_unread_idx
  on public.admin_events (severity, created_at desc)
  where (read_by = '{}'::jsonb);

alter table public.admin_events enable row level security;
-- Aucune policy : seul service_role accède directement.

-- Activation Realtime pour permettre la souscription côté serveur dans
-- le SSE handler. La publication `supabase_realtime` est créée par
-- défaut par Supabase ; on lui ajoute la table.
alter publication supabase_realtime add table public.admin_events;
