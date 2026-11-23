-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Pivot « mise en relation pure » — PHASE 2 (DESTRUCTIVE / PURGE)
-- ════════════════════════════════════════════════════════════════════
-- ⚠ IRRÉVERSIBLE. Supprime définitivement toutes les données prospect hors
--   prénom / initiale du nom / ville / sexe / tranche d'âge / téléphone /
--   e-mail.
--
-- PRÉREQUIS (dans cet ordre) :
--   1. Phase 1 appliquée (20261122120000_contact_only_phase1.sql) :
--      campaigns.contact_channels + admin_prospects_kpis réécrite +
--      colonnes prospect_identity.ville / tranche_age.
--   2. Nouveau code web DÉPLOYÉ en production et vérifié (plus aucune lecture
--      des tables / colonnes ci-dessous). Les builds mobiles publiés ne lisent
--      que l'API (shape GET /api/prospect/donnees conservée) → non bloquant.
--   3. Sauvegarde / export de la base faite (point de restauration).
-- Application : SQL Editor puis
--   supabase migration repair --status applied 20261122130000
--
-- RÉCUPÉRÉ AVANT SUPPRESSION (backfill, seulement là où la cible est NULL)
--   • prospect_identity.ville  ← prospect_localisation.ville (nom seul, ≤ 120).
--   • prospect_identity.tranche_age ← prospect_identity.naissance
--     (MM/AAAA, ou ancien JJ/MM/AAAA / AAAA-MM-JJ) : âge ≤ 35 → '18-35',
--     > 35 → '35+'. Âge < 0 ou > 130 / format inconnu → laissé NULL.
--   • prospect_identity.genre est CONSERVÉ (rien à faire).
--
-- CE QUE LE SCRIPT SUPPRIME
--   • prospect_identity.nom → réduit à son initiale majuscule (UPDATE).
--   • prospect_identity.naissance (+ CHECK prospect_identity_naissance_format_chk,
--     emporté avec la colonne) — APRÈS le backfill de tranche_age.
--   • Tables prospect_localisation, prospect_vie, prospect_pro,
--     prospect_patrimoine. Ce que CASCADE emporte (vérifié dans
--     supabase/migrations/) : leurs RLS policies (*_owner_all), leurs triggers
--     updated_at, leurs index et contraintes (FK → prospects, CHECK code postal,
--     targeting_radius_km, geo_extension…). AUCUNE vue, AUCUNE FK entrante,
--     AUCUNE vue matérialisée ne dépend de ces tables. Les seules fonctions qui
--     les lisaient (admin_prospects_kpis) ont été réécrites en phase 1 ; le
--     reste des fonctions SQL (accept_relation_tx, settle_*, close_campaign_*)
--     ne les référence pas.
--   • prospects.hidden_tiers / prospects.removed_tiers (visibilité des paliers)
--     puis le type enum public.tier_key devenu inutilisé.
--   • Autres copies de ces données :
--       - pro_segments.filters : clés de facettes basées sur les données
--         supprimées (region, distance, logement, statutPro, foyer, vehicule,
--         animaux) retirées du JSON.
--       - campaigns.targeting : clés de ciblage géo/âge/paliers normalisées
--         (requiredTiers=[1], national, tous âges, geoTarget/radiusKm null).
--   (pro_contact_reveals ne stocke que le NOM du champ révélé, jamais la
--    valeur ; admin_events ne contient pas ces données → rien à purger.)
--
-- NON TOUCHÉ (à décider par le propriétaire) : table `waitlist` (prenom, nom
-- complet, ville) — NE JAMAIS la purger (sync_founder_status s'en sert) ;
-- pro_accounts.latitude/longitude (donnée du pro, pas du prospect).
-- ════════════════════════════════════════════════════════════════════

begin;

-- ─── 1. Nom → initiale ──────────────────────────────────────────────
update public.prospect_identity
   set nom = upper(left(btrim(nom), 1))
 where nom is not null;

update public.prospect_identity
   set nom = null
 where nom = '';

-- ─── 2. Backfill ville + tranche d'âge (avant suppression des sources) ─
update public.prospect_identity i
   set ville = left(btrim(l.ville), 120)
  from public.prospect_localisation l
 where l.prospect_id = i.prospect_id
   and i.ville is null
   and nullif(btrim(l.ville), '') is not null;

-- Extraction par `substring(... from regex)` (NULL si pas de correspondance) :
-- aucun cast n'est tenté sur une valeur non numérique ; make_date protégé
-- par un CASE (ordre d'évaluation garanti).
with parts as (
  select prospect_id,
         coalesce(
           substring(btrim(naissance) from '^(\d{1,2})/\d{4}$'),
           substring(btrim(naissance) from '^\d{1,2}/(\d{1,2})/\d{4}$'),
           substring(btrim(naissance) from '^\d{4}-(\d{2})-\d{2}$')
         )::int as m,
         coalesce(
           substring(btrim(naissance) from '^\d{1,2}/(\d{4})$'),
           substring(btrim(naissance) from '^\d{1,2}/\d{1,2}/(\d{4})$'),
           substring(btrim(naissance) from '^(\d{4})-\d{2}-\d{2}$')
         )::int as y
    from public.prospect_identity
   where tranche_age is null
     and naissance is not null
), aged as (
  select prospect_id,
         case
           when m between 1 and 12 and y between 1880 and 2100 then
             extract(year from age(current_date, make_date(y, m, 1)))::int
         end as age_years
    from parts
)
update public.prospect_identity i
   set tranche_age = case when a.age_years <= 35 then '18-35' else '35+' end
  from aged a
 where a.prospect_id = i.prospect_id
   and i.tranche_age is null
   and a.age_years between 0 and 130;

-- ─── 3. Colonnes identité hors périmètre ────────────────────────────
-- (`genre` est CONSERVÉ : ciblage campagnes.)
alter table public.prospect_identity
  drop constraint if exists prospect_identity_naissance_format_chk;
alter table public.prospect_identity drop column if exists naissance;

-- Garde-fou : le nom n'est plus jamais qu'une lettre.
alter table public.prospect_identity
  drop constraint if exists prospect_identity_nom_initial_chk;
alter table public.prospect_identity
  add constraint prospect_identity_nom_initial_chk
  check (nom is null or char_length(nom) = 1);

-- ─── 4. Tables des paliers supprimés ────────────────────────────────
drop table if exists public.prospect_localisation cascade;
drop table if exists public.prospect_vie cascade;
drop table if exists public.prospect_pro cascade;
drop table if exists public.prospect_patrimoine cascade;

-- ─── 5. Visibilité des paliers + enum ───────────────────────────────
alter table public.prospects drop column if exists hidden_tiers;
alter table public.prospects drop column if exists removed_tiers;
drop type if exists public.tier_key;

-- ─── 6. Copies JSON des données / ciblages supprimés ────────────────
update public.pro_segments
   set filters = filters
     - 'region' - 'distance' - 'logement' - 'statutPro'
     - 'foyer' - 'vehicule' - 'animaux'
 where filters ?| array['region','distance','logement','statutPro','foyer','vehicule','animaux'];

update public.campaigns
   set targeting = coalesce(targeting, '{}'::jsonb) || jsonb_build_object(
         'requiredTiers', jsonb_build_array(1),
         'requiredTierKeys', jsonb_build_array('identity'),
         'geo', 'national',
         'geoTarget', null,
         'radiusKm', null,
         'ages', jsonb_build_array('Tous')
       );

commit;
