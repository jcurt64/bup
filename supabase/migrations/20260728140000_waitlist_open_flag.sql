-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Interrupteur « inscriptions liste d'attente »
-- ════════════════════════════════════════════════════════════════════
-- Distinct de `access_buttons_enabled` (migration 20260728120000) : les
-- deux bascules n'ont pas lieu au même moment.
--
--   1. Ouverture de la pré-inscription officielle → `waitlist_open = true`
--   2. Lancement complet du service, plus tard    → `access_buttons_enabled = true`
--
-- Tant que `waitlist_open` est à false, le bouton « Estimer mes gains »
-- (soumission du formulaire de pré-inscription) est inerte avec une
-- infobulle « Actif au lancement », ET la route POST /api/waitlist refuse
-- les inscriptions — sans quoi le gel serait purement cosmétique, le HTML
-- statique étant accessible en direct hors de son iframe.
--
-- Valeur par défaut `true` = inscriptions ouvertes, pour qu'un nouvel
-- environnement soit fonctionnel sans intervention.
-- ════════════════════════════════════════════════════════════════════

alter table public.app_config
  add column if not exists waitlist_open boolean not null default true;

comment on column public.app_config.waitlist_open is
  'false = pré-inscription fermée : bouton « Estimer mes gains » gelé et POST /api/waitlist refusé. Repasser à true pour ouvrir, sans redéploiement.';
