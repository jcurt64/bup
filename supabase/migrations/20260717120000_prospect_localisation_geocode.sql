-- Géocodage de l'adresse prospect (pour la pseudonymisation « distance au
-- centre » côté pro, et de futurs ciblages de proximité).
--
-- Renseignées en tâche `after()` à l'enregistrement de la localisation
-- (/api/prospect/donnees PATCH) via l'API Adresse data.gouv.fr (BAN) :
--   - latitude / longitude  : coordonnées PRÉCISES de l'adresse (jamais
--     exposées au pro — données personnelles protégées au même titre que
--     l'adresse texte).
--   - center_distance_m     : distance en mètres entre l'adresse et le
--     centre de la commune. Seule cette distance, bornée en tranche
--     (« < 2 km du centre »), est transmise au pro après pseudonymisation.

alter table public.prospect_localisation
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists center_distance_m integer;

comment on column public.prospect_localisation.latitude is
  'Latitude précise de l''adresse (géocodage BAN). Jamais exposée au pro.';
comment on column public.prospect_localisation.longitude is
  'Longitude précise de l''adresse (géocodage BAN). Jamais exposée au pro.';
comment on column public.prospect_localisation.center_distance_m is
  'Distance (m) adresse → centre commune. Transmise au pro bornée en tranche (pseudonymisation).';
