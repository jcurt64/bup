-- Préférence prospect « Zone géographique » : niveau d'extension géographique.
-- Remplace le simple booléen `national_opt_in` (conservé en synchro pour
-- compat) par un niveau gradué :
--   local         : ciblage par rayon uniquement (comportement par défaut)
--   departemental : accepte les campagnes couvrant son département (bypass
--                   du plancher de rayon pour les portées ville/dept)
--   regional      : accepte jusqu'au niveau région (ville/dept/region)
--   national      : accepte partout (équivaut à national_opt_in = true)
--
-- Le matching (lib/campaigns/matching.ts) lit `geo_extension` ; `national_opt_in`
-- reste maintenu en synchro par l'API (true ⟺ geo_extension='national').

alter table public.prospect_localisation
  add column if not exists geo_extension text not null default 'national';

alter table public.prospect_localisation
  drop constraint if exists prospect_localisation_geo_extension_check;

alter table public.prospect_localisation
  add constraint prospect_localisation_geo_extension_check
  check (geo_extension in ('local', 'departemental', 'regional', 'national'));

-- Backfill depuis l'opt-in national existant.
update public.prospect_localisation
  set geo_extension = case when national_opt_in then 'national' else 'local' end;
