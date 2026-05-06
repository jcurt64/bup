-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Mes données : "logement" et "mobilité" rejoignent "Style de vie"
-- ════════════════════════════════════════════════════════════════════
-- Réorganisation de l'onglet "Mes données" :
--   - `logement` et `mobilite` sont rapatriés du palier "Localisation"
--     vers "Style de vie" (UX : ces champs décrivent un mode de vie,
--     pas une adresse).
--   - Ajout de deux colonnes "détail" pour les champs composites :
--     * `animaux_detail`   → précision libre (ex. "Chat") quand
--                            `animaux = 'Oui'`
--     * `vehicule_marque`  → marque libre (ex. "Renault") quand
--                            l'utilisateur a choisi un type de véhicule
-- ════════════════════════════════════════════════════════════════════

-- 1. Nouvelles colonnes sur prospect_vie
alter table public.prospect_vie
  add column if not exists mobilite text,
  add column if not exists logement text,
  add column if not exists animaux_detail text,
  add column if not exists vehicule_marque text;

-- 2. Backfill : copie des valeurs existantes de prospect_localisation
--    vers prospect_vie. INSERT … ON CONFLICT pour gérer les deux cas
--    (le prospect a déjà une row vie ou non).
insert into public.prospect_vie (prospect_id, mobilite, logement)
select prospect_id, mobilite, logement
from public.prospect_localisation
where mobilite is not null or logement is not null
on conflict (prospect_id) do update set
  mobilite = coalesce(public.prospect_vie.mobilite, excluded.mobilite),
  logement = coalesce(public.prospect_vie.logement, excluded.logement);

-- 3. Suppression des colonnes de prospect_localisation
alter table public.prospect_localisation
  drop column if exists mobilite,
  drop column if exists logement;
