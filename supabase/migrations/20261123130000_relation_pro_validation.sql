-- ════════════════════════════════════════════════════════════════════
-- BUUPP — « Certifié confiance » = mise en relation validée par un pro
-- ════════════════════════════════════════════════════════════════════
-- Ancienne règle : ≥ 1 rendez-vous physique accepté (campagne
-- `prise_de_rendez_vous`). Nouvelle règle (lib/prospect/verification-tier) :
--   ≥ 1 mise en relation dont le pro a confirmé qu'elle a été EFFECTIVE
--   (bouton sur la fiche prospect, après clôture de la campagne)
--   OU ≥ 1 participation Tests & Études approuvée par le pro.
-- Additif. Application : SQL Editor puis
--   insert into supabase_migrations.schema_migrations (version, name)
--   values ('20261123130000', 'relation_pro_validation') on conflict do nothing;
-- ════════════════════════════════════════════════════════════════════

alter table public.relations
  add column if not exists pro_validated_at timestamptz;

comment on column public.relations.pro_validated_at is
  'Le pro a confirmé que la mise en relation a été effective (appel, e-mail, étude…). Débloque le niveau certifie_confiance du prospect.';

create index if not exists relations_pro_validated_idx
  on public.relations (prospect_id)
  where pro_validated_at is not null;
