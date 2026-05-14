-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Suivi des notifications envoyées aux pros suite à signalement
-- ════════════════════════════════════════════════════════════════════
-- Ajoute 2 colonnes à `relation_reports` pour matérialiser l'envoi du
-- mail d'avertissement (action admin "Avertir ce pro" sur /buupp-admin
-- /signalements). Permet de :
--   - afficher "Notification envoyée le … par …" sur la carte admin
--   - empêcher l'admin d'envoyer plusieurs fois la même alerte par
--     mégarde (le bouton se désactive si notified_at non null)
-- ════════════════════════════════════════════════════════════════════

alter table public.relation_reports
  add column if not exists notified_at timestamptz,
  add column if not exists notified_by_clerk_id text;

-- Pas d'index dédié : la lecture se fait toujours par id (ou via la
-- liste filtrée déjà indexée sur created_at / resolved_at).
