-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Suppression d'un message par l'utilisateur (per-user dismissal)
-- ════════════════════════════════════════════════════════════════════
-- Permet à un prospect ou un pro de retirer un broadcast de son inbox
-- (onglet « Mes messages »). On NE supprime PAS la row admin_broadcasts
-- elle-même puisqu'elle est partagée (audience prospects/pros/all). On
-- enregistre simplement une marque "dismissed" par utilisateur, qui sert
-- de filtre dans GET /api/me/notifications.
--
-- Schéma calqué sur admin_broadcast_reads (même clé composite, même
-- pattern d'upsert). Différence : ici l'absence de row = visible, la
-- présence = masquée. Inverse exact du flag unread.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.admin_broadcast_dismissals (
  broadcast_id  uuid        not null references public.admin_broadcasts(id) on delete cascade,
  clerk_user_id text        not null,
  dismissed_at  timestamptz not null default now(),
  primary key (broadcast_id, clerk_user_id)
);

create index if not exists admin_broadcast_dismissals_user_idx
  on public.admin_broadcast_dismissals(clerk_user_id);

comment on table public.admin_broadcast_dismissals is
  'Marques per-user de suppression d''un broadcast depuis l''inbox utilisateur. La présence d''une row masque le broadcast pour ce clerk_user_id côté GET /api/me/notifications. Le broadcast lui-même reste intact (audience partagée).';
