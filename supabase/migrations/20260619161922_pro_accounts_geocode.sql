-- Géocodage de l'adresse de l'établissement pro — ciblage « autour de moi ».
--
-- Le pro peut lancer une campagne ciblée dans un rayon (10/30/50 km) autour
-- de son établissement. Le matching se fait par distance orthodromique
-- (haversine) entre ces coordonnées et `prospect_localisation.latitude/longitude`.
--
-- Alimentées best-effort par /api/pro/info (après PATCH adresse, via l'API
-- Adresse BAN — cf. lib/geo/geocode.ts). Nullable : tant que le pro n'a pas
-- d'adresse géocodable, le ciblage « autour de moi » est refusé côté API.
alter table public.pro_accounts
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;
