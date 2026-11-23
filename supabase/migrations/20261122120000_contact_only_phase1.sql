-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Pivot « mise en relation pure » — PHASE 1 (ADDITIVE)
-- ════════════════════════════════════════════════════════════════════
-- Données prospect conservées (7) : prénom, INITIALE du nom, ville, sexe
-- (genre), tranche d'âge, téléphone, e-mail. Ville / sexe / tranche d'âge
-- servent UNIQUEMENT au ciblage des campagnes (matching) et ne sont jamais
-- transmis aux pros. Les 4 paliers (localisation, vie, pro, patrimoine) et la
-- date de naissance disparaissent (remplacée par la tranche d'âge).
--
-- Cette phase est SANS RISQUE et doit être appliquée AVANT le déploiement
-- du nouveau code (le code lit/écrit `campaigns.contact_channels`) :
--   1. Ajoute `campaigns.contact_channels text[]` (⊆ {phone,email}, non vide,
--      défaut {phone,email} → toutes les campagnes existantes = 2 canaux).
--   2. Réécrit `admin_prospects_kpis` pour ne plus lire les tables qui seront
--      supprimées en phase 2 (les fonctions plpgsql ne sont PAS emportées par
--      un DROP TABLE … CASCADE : elles casseraient silencieusement à l'appel).
--   3. Ajoute `prospect_identity.ville` (nom de commune seul, ≤ 120 car.) et
--      `prospect_identity.tranche_age` ('18-35' | '35+'). `genre` existe déjà
--      (CHECK femme/homme/autre, migration 20260504210000) et est CONSERVÉ.
--      Le backfill depuis prospect_localisation.ville / naissance est fait en
--      phase 2, juste avant la suppression des sources.
--
-- Application : SQL Editor (prod) puis
--   supabase migration repair --status applied 20261122120000
-- (jamais `db push` — local et remote divergés).
-- Ordre global : phase 1 → déploiement du code → phase 2 (20261122130000).
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Modes de contact des campagnes ──────────────────────────────
alter table public.campaigns
  add column if not exists contact_channels text[] not null default '{phone,email}';

alter table public.campaigns
  drop constraint if exists campaigns_contact_channels_chk;
alter table public.campaigns
  add constraint campaigns_contact_channels_chk
  check (
    cardinality(contact_channels) between 1 and 2
    and contact_channels <@ array['phone', 'email']::text[]
  );

comment on column public.campaigns.contact_channels is
  'Modes de contact choisis par le pro (phone et/ou email). Le contact passe toujours par le relais BUUPP.';

-- ─── 2. Nouvelles colonnes du profil prospect ───────────────────────
alter table public.prospect_identity
  add column if not exists ville text;
alter table public.prospect_identity
  drop constraint if exists prospect_identity_ville_len_chk;
alter table public.prospect_identity
  add constraint prospect_identity_ville_len_chk
  check (ville is null or char_length(ville) <= 120);

alter table public.prospect_identity
  add column if not exists tranche_age text;
alter table public.prospect_identity
  drop constraint if exists prospect_identity_tranche_age_chk;
alter table public.prospect_identity
  add constraint prospect_identity_tranche_age_chk
  check (tranche_age is null or tranche_age in ('18-35', '35+'));

comment on column public.prospect_identity.ville is
  'Ville du prospect (nom de commune seul, sans code postal ni adresse). Ciblage campagnes uniquement, jamais transmise au pro.';
comment on column public.prospect_identity.tranche_age is
  'Tranche d''âge déclarée (18-35 | 35+). Ciblage campagnes uniquement, jamais transmise au pro.';
comment on column public.prospect_identity.genre is
  'Sexe déclaré (femme | homme | autre). Ciblage campagnes uniquement, jamais transmis au pro.';

-- ─── 3. KPIs admin prospects sans les paliers supprimés ─────────────
-- `paliers` = distribution du nombre de champs du profil renseignés
-- (0..7 : prénom, nom/initiale, ville, sexe, tranche d'âge, e-mail,
-- téléphone). `topVilles` lit désormais prospect_identity.ville ;
-- `topSecteurs` est renvoyé vide (donnée supprimée, clé conservée).
create or replace function public.admin_prospects_kpis(
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funnel jsonb;
  v_paliers jsonb;
  v_score_buckets jsonb;
  v_verification jsonb;
  v_phone_verified_pct numeric;
  v_refusal_reasons jsonb;
  v_founders int;
  v_founders_bonus_count int;
  v_founders_bonus_eur numeric;
  v_credited_eur numeric;
  v_withdrawals_count int;
  v_withdrawals_eur numeric;
  v_top_referrers jsonb;
  v_top_villes jsonb;
begin
  select jsonb_build_object(
    'waitlist', (select count(*) from public.waitlist where created_at >= p_start and created_at < p_end),
    'signup', (select count(*) from public.prospects where created_at >= p_start and created_at < p_end),
    'tier1', (select count(*) from public.prospect_identity pi
              join public.prospects p on p.id = pi.prospect_id
              where p.created_at >= p_start and p.created_at < p_end and pi.email is not null),
    'phone', (select count(*) from public.prospect_identity pi
              join public.prospects p on p.id = pi.prospect_id
              where p.created_at >= p_start and p.created_at < p_end and pi.phone_verified_at is not null),
    'firstAccept', (select count(distinct r.prospect_id) from public.relations r
                    join public.prospects p on p.id = r.prospect_id
                    where p.created_at >= p_start and p.created_at < p_end and r.status in ('accepted','settled')),
    'firstWithdrawal', (select count(distinct t.account_id) from public.transactions t
                        join public.prospects p on p.id = t.account_id
                        where t.account_kind='prospect' and t.type='withdrawal' and t.status='completed'
                          and p.created_at >= p_start and p.created_at < p_end)
  ) into v_funnel;

  with field_counts as (
    select p.id,
           (case when nullif(btrim(pi.prenom), '') is not null then 1 else 0 end) +
           (case when nullif(btrim(pi.nom), '') is not null then 1 else 0 end) +
           (case when nullif(btrim(pi.ville), '') is not null then 1 else 0 end) +
           (case when pi.genre is not null then 1 else 0 end) +
           (case when pi.tranche_age is not null then 1 else 0 end) +
           (case when nullif(btrim(pi.email), '') is not null then 1 else 0 end) +
           (case when nullif(btrim(pi.telephone), '') is not null then 1 else 0 end) as filled
      from public.prospects p
      left join public.prospect_identity pi on pi.prospect_id = p.id
  )
  select jsonb_object_agg(filled, n)
    into v_paliers
    from (select filled, count(*) as n from field_counts group by filled) t;

  select jsonb_object_agg(bucket, n) into v_score_buckets
    from (
      select width_bucket(bupp_score, 0, 1000, 5) as bucket, count(*) as n
        from public.prospects group by 1 order by 1
    ) t;

  select jsonb_object_agg(verification, n) into v_verification
    from (select verification, count(*) as n from public.prospects group by 1) t;

  select round(
    100.0 * count(*) filter (where phone_verified_at is not null) / nullif(count(*),0),
    1
  )::numeric into v_phone_verified_pct
  from public.prospect_identity;

  select coalesce(jsonb_agg(jsonb_build_object('reason', reason, 'n', n) order by n desc), '[]'::jsonb)
    into v_refusal_reasons
    from (select reason, count(*) as n from public.relation_feedback
           where created_at >= p_start and created_at < p_end group by 1 order by n desc limit 10) t;

  select coalesce(jsonb_agg(jsonb_build_object('ville', ville, 'n', n) order by n desc), '[]'::jsonb)
    into v_top_villes
    from (select btrim(ville) as ville, count(*) as n from public.prospect_identity
           where nullif(btrim(ville), '') is not null
           group by 1 order by n desc limit 10) t;

  select count(*) into v_founders from public.prospects where is_founder = true;
  select count(*), coalesce(sum(reward_cents)::numeric / 100, 0)
    into v_founders_bonus_count, v_founders_bonus_eur
    from public.relations
    where founder_bonus_applied = true and decided_at >= p_start and decided_at < p_end;

  select coalesce(sum(amount_cents)::numeric / 100, 0)
    into v_credited_eur
    from public.transactions
    where type='credit' and account_kind='prospect' and status='completed'
      and created_at >= p_start and created_at < p_end;

  select count(*), coalesce(sum(abs(amount_cents))::numeric / 100, 0)
    into v_withdrawals_count, v_withdrawals_eur
    from public.transactions
    where type='withdrawal' and account_kind='prospect' and status='completed'
      and created_at >= p_start and created_at < p_end;

  select coalesce(jsonb_agg(jsonb_build_object('refCode', ref_code, 'n', n) order by n desc), '[]'::jsonb)
    into v_top_referrers
    from (
      select w.ref_code, count(*) as n
        from public.waitlist w
        join public.prospect_identity pi on lower(pi.email) = lower(w.email)
       where w.ref_code is not null
       group by 1 order by n desc limit 10
    ) t;

  return jsonb_build_object(
    'funnel', v_funnel,
    'paliers', coalesce(v_paliers, '{}'::jsonb),
    'scoreBuckets', coalesce(v_score_buckets, '{}'::jsonb),
    'verification', coalesce(v_verification, '{}'::jsonb),
    'phoneVerifiedPct', coalesce(v_phone_verified_pct, 0),
    'topVilles', v_top_villes,
    'topSecteurs', '[]'::jsonb,
    'refusalReasons', v_refusal_reasons,
    'founders', v_founders,
    'foundersBonusCount', v_founders_bonus_count,
    'foundersBonusEur', v_founders_bonus_eur,
    'creditedEur', v_credited_eur,
    'withdrawalsCount', v_withdrawals_count,
    'withdrawalsEur', v_withdrawals_eur,
    'topReferrers', v_top_referrers
  );
end;
$$;

revoke all on function public.admin_prospects_kpis(timestamptz, timestamptz) from public;
grant execute on function public.admin_prospects_kpis(timestamptz, timestamptz) to service_role;
