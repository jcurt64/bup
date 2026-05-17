-- Date de lancement officiel fictive : pose le jalon de fin de la phase
-- de pré-inscription à 1 semaine (15/05/2026 → 22/05/2026 10:00 UTC).
--
-- Le seed initial de `app_config` (migration 20260508120000) était une
-- date placeholder 1970-01-01 (fail-safe : aucune fenêtre bonus active).
-- On la remplace ici par une échéance proche : le dashboard prospect en
-- dérive le compte à rebours du lien de parrainage, qui n'est valable
-- que pendant la pré-inscription.
--
-- Idempotent : un simple UPDATE du singleton (id = true).
update public.app_config
   set launch_at  = '2026-05-22T10:00:00Z',
       updated_at = now()
 where id = true;
