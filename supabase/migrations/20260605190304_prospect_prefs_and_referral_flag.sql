-- Préférences prospect persistantes + découplage du parrainage.
--
-- 1) prospects.campaign_objectives — la sélection « Types de campagne » de
--    l'onglet Préférences est à la granularité OBJECTIF (6 libellés UI :
--    Prise de contact / Prise de rendez-vous / Événement / Téléchargement /
--    Enquête & avis / Promotion), plus fine que l'enum DB campaign_type
--    (4 valeurs). On stocke donc les libellés bruts ici pour restituer
--    fidèlement les puces au reload ; la colonne enum `campaign_types`
--    reste la projection utilisée par le matching (cf. lib/prospect/preferences.ts).
--
-- 2) prospects.all_categories — pendant booléen de all_campaign_types pour le
--    toggle « Toutes catégories » (les catégories sont en text[] libre).
--
-- 3) app_config.referrals_enabled — découple l'ouverture du parrainage de la
--    date de lancement fictive (launch_at) : tant que ce flag est true, les
--    liens de parrainage restent actifs, indépendamment du compte à rebours.
--
-- ⚠ Migrations BUUPP : local et remote ont divergé. NE PAS `db push`.
--   Appliquer ce DDL via le SQL Editor Supabase (remote), puis
--   `supabase migration repair --status applied 20260605140000`.

alter table public.prospects
  add column if not exists campaign_objectives text[] not null default '{}',
  add column if not exists all_categories boolean not null default true;

alter table public.app_config
  add column if not exists referrals_enabled boolean not null default true;
