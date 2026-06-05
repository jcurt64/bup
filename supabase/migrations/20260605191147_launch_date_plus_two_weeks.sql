-- Décale la date de lancement à ~2 semaines (05/06/2026 → 20/06/2026 10:00 UTC).
--
-- Le précédent jalon (20260515130000_launch_date_fictive → 22/05, puis ajusté
-- manuellement au 04/06) était échu : le compte à rebours de la liste d'attente
-- affichait « ouvert ». On repose une échéance à deux semaines pour relancer le
-- décompte de pré-inscription (dérivé de `app_config.launch_at` côté
-- waitlist.html via /api/waitlist/stats).
--
-- NB : l'ouverture du parrainage ne dépend PLUS de cette date (découplée vers
-- `app_config.referrals_enabled` — migration 20260605190304). Ce changement
-- n'affecte donc que l'affichage du décompte et la fenêtre bonus fondateur
-- (is_within_founder_bonus_window = now() <= launch_at + 1 mois → ~20/07/2026).
--
-- Idempotent : simple UPDATE du singleton (id = true).
update public.app_config
   set launch_at  = '2026-06-20T10:00:00Z',
       updated_at = now()
 where id = true;
