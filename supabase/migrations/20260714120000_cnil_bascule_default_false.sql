-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Bascule du DEFAULT email_tracking_consent (post 14/07/2026)
-- ════════════════════════════════════════════════════════════════════
-- ⚠ À APPLIQUER MANUELLEMENT LE 14 JUILLET 2026 (ou après) — DANS LE
-- SQL EDITOR SUPABASE.
--
-- Cette migration est volontairement datée du 14 juillet 2026 pour
-- qu'elle apparaisse en bas de la liste `supabase/migrations/` jusqu'à
-- son application. Elle n'est PAS prête à tourner avant cette date.
--
-- ──────────────────────────────────────────────────────────────────────
-- Contexte
-- ──────────────────────────────────────────────────────────────────────
-- Cette migration finalise la mise en conformité CNIL n° 2026-042 (cf.
-- migration 20260511215924 et lib/cnil/bascule.ts). Pendant la transition
-- ouverte par la CNIL (15/04 → 14/07/2026), le default `true` était
-- acceptable au titre du régime "information + opposition facile". Après
-- le 14 juillet, seul le consentement explicite est admis → le default
-- doit passer à `false`.
--
-- La RESET des valeurs existantes (UPDATE WHERE consent_given_at IS NULL)
-- est gérée AUTOMATIQUEMENT par le cron `/api/admin/digest` via
-- `lib/cnil/bascule.ts`. Cette migration ne s'occupe QUE du default —
-- elle affecte uniquement les rows CRÉÉES après son application.
-- ──────────────────────────────────────────────────────────────────────

alter table public.prospect_identity
  alter column email_tracking_consent set default false;

alter table public.pro_accounts
  alter column email_tracking_consent set default false;

-- (Optionnel — décommenter si vous souhaitez forcer le reset des valeurs
-- depuis SQL au lieu de laisser le cron `applyCnilBasculeIfDue` le faire.
-- Sans risque doublon : le cron est idempotent via `admin_events`.)
-- update public.prospect_identity
--   set email_tracking_consent = false
--   where email_tracking_consent = true
--     and email_tracking_consent_given_at is null;
--
-- update public.pro_accounts
--   set email_tracking_consent = false
--   where email_tracking_consent = true
--     and email_tracking_consent_given_at is null;
