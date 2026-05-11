-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Consentement utilisateur pour le tracking des broadcasts email
-- ════════════════════════════════════════════════════════════════════
-- Mise en conformité avec la recommandation CNIL n° 2026-042 du 12 mars
-- 2026 (publiée 14 avril 2026). Les pixels de suivi dans les broadcasts
-- non-transactionnels nécessitent un consentement.
--
-- Default `true` pendant la période de transition (jusqu'au 14 juillet
-- 2026) : on est dans le régime "information + opposition facile", le
-- tracking reste actif tant que l'utilisateur ne s'y oppose pas
-- explicitement. Après l'échéance, prévoir une migration qui passe le
-- default à `false` et qui réinitialise les valeurs des comptes créés
-- pendant la transition n'ayant pas confirmé.
-- ════════════════════════════════════════════════════════════════════

alter table public.prospect_identity
  add column if not exists email_tracking_consent boolean not null default true;

alter table public.pro_accounts
  add column if not exists email_tracking_consent boolean not null default true;
