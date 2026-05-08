-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Waitlist : flag d'envoi du mail de lancement
-- ════════════════════════════════════════════════════════════════════
-- Permet à l'endpoint admin POST /api/admin/waitlist/launch-email
-- d'être idempotent : on ne renvoie pas le mail aux inscrits déjà
-- notifiés. NULL = pas encore envoyé. Indexé partiellement pour que la
-- requête "qui reste à notifier ?" reste O(unsent) même quand la
-- waitlist grossit.
-- ════════════════════════════════════════════════════════════════════

alter table public.waitlist
  add column launch_email_sent_at timestamptz;

create index waitlist_launch_email_unsent_idx
  on public.waitlist (created_at)
  where launch_email_sent_at is null;
