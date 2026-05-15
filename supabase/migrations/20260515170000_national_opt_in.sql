-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Opt-in « niveau national » dans la zone géographique prospect
-- ════════════════════════════════════════════════════════════════════
-- Ajoute un flag boolean sur prospect_localisation : quand un prospect
-- coche « Étendre au niveau national » dans Préférences → Zone, le pool
-- de matching cesse de filtrer par préfixe CP (et par plancher de rayon
-- imposé par la portée de la campagne — ville/dept/region/national).
--
-- Le prospect reste matchable indépendamment du département du pro qui
-- lance la campagne. Le rayon `targeting_radius_km` est ignoré tant que
-- ce flag est on (sémantique « j'accepte n'importe où en France »).
--
-- Default `false` = comportement actuel préservé : un prospect doit avoir
-- explicitement coché la case pour être inclus dans les pools cross-dept.
-- ════════════════════════════════════════════════════════════════════

alter table public.prospect_localisation
  add column if not exists national_opt_in boolean not null default false;
