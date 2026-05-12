-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Horodatage du consentement explicite au tracking email
-- ════════════════════════════════════════════════════════════════════
-- Préparation de la bascule CNIL post-14 juillet 2026.
--
-- Pendant la période de transition (default `email_tracking_consent = true`),
-- on ne peut pas distinguer un utilisateur qui a EXPLICITEMENT consenti d'un
-- utilisateur qui n'a juste jamais touché à ses préférences. Au moment de la
-- bascule (15 juillet 2026), il faudra réinitialiser à `false` ceux qui n'ont
-- pas explicitement consenti — d'où ce timestamp d'audit.
--
-- Convention :
--   - `null` ............... pas d'acte explicite (default acquis en transition)
--   - timestamp non-null ... consentement explicite donné à cette date
--     (toggle UI ou clic "Réactiver le suivi" sur la page d'opposition)
--
-- La bascule du 15 juillet (cron /api/admin/digest piggyback, cf.
-- lib/cnil/bascule.ts) fera : UPDATE ... SET consent = false WHERE
-- consent_given_at IS NULL.
-- ════════════════════════════════════════════════════════════════════

alter table public.prospect_identity
  add column if not exists email_tracking_consent_given_at timestamptz;

alter table public.pro_accounts
  add column if not exists email_tracking_consent_given_at timestamptz;
