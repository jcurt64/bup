-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Broadcasts admin → utilisateurs (prospects, pros, all)
-- ════════════════════════════════════════════════════════════════════
-- Message en lecture libre pour les utilisateurs de l'audience visée.
-- L'admin compose un message (titre + corps + pièce jointe optionnelle) et
-- choisit l'audience. Les destinataires reçoivent un email + voient le
-- message dans la cloche de leur dashboard. La table `admin_broadcast_reads`
-- trace le marquage lu, par clerk_user_id.
--
-- Aucune policy RLS user-facing : toutes les routes API passent par
-- service_role (Admin client) et filtrent l'audience côté serveur. La RLS
-- reste activée comme garde-fou — aucune policy ⇒ aucun accès anonyme.
-- ════════════════════════════════════════════════════════════════════

create type public.admin_broadcast_audience as enum ('prospects', 'pros', 'all');

create table public.admin_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 10000),
  -- Path Supabase Storage : `broadcasts/<id>/<filename>`. Nullable car
  -- la pièce jointe est optionnelle. Le nom d'origine est conservé pour
  -- proposer un download propre depuis le popup utilisateur.
  attachment_path text,
  attachment_filename text,
  audience public.admin_broadcast_audience not null,
  -- clerk_user_id de l'admin émetteur (pas de FK : Clerk est externe).
  created_by_admin_id text not null,
  created_at timestamptz not null default now(),
  -- Rempli après la boucle d'envoi best-effort. Null = jamais envoyé,
  -- non-null = envoi tenté (les bounces individuels sont loggés via
  -- system.email_failed côté admin_events).
  sent_email_at timestamptz
);

-- Index principal : listing utilisateur (filtre audience + ordre desc).
create index admin_broadcasts_audience_created_at_idx
  on public.admin_broadcasts (audience, created_at desc);

alter table public.admin_broadcasts enable row level security;
-- Aucune policy : seul service_role accède directement.

create table public.admin_broadcast_reads (
  broadcast_id uuid not null references public.admin_broadcasts(id) on delete cascade,
  clerk_user_id text not null,
  read_at timestamptz not null default now(),
  primary key (broadcast_id, clerk_user_id)
);

create index admin_broadcast_reads_user_idx
  on public.admin_broadcast_reads (clerk_user_id);

alter table public.admin_broadcast_reads enable row level security;
-- Aucune policy : seul service_role accède directement.

-- ════════════════════════════════════════════════════════════════════
-- Storage bucket `admin-broadcasts`
-- ════════════════════════════════════════════════════════════════════
-- Bucket privé. Pas de policy : seul service_role upload/download. Les
-- utilisateurs accèdent via signed URL générée par l'API après vérif
-- d'audience (`/api/me/notifications/[id]/attachment`).

insert into storage.buckets (id, name, public)
values ('admin-broadcasts', 'admin-broadcasts', false)
on conflict (id) do nothing;
