-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Agrégats section Prospects (admin dashboard)
-- ════════════════════════════════════════════════════════════════════
-- Renvoie en un seul appel : funnel, distribution paliers, distribution
-- score, distribution vérification, top motifs refus, totaux retraits +
-- crédits + founders + parrainage. p_start/p_end pour fenêtrer ce qui
-- est "périodique" (signups, crédits, etc.) — les distributions sont
-- toujours globales (tous les prospects existants).
-- ════════════════════════════════════════════════════════════════════

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
  v_top_villes jsonb;
  v_top_secteurs jsonb;
  v_refusal_reasons jsonb;
  v_founders int;
  v_founders_bonus_count int;
  v_founders_bonus_eur numeric;
  v_credited_eur numeric;
  v_withdrawals_count int;
  v_withdrawals_eur numeric;
  v_top_referrers jsonb;
begin
  -- Funnel : waitlist → prospects → palier1 → tel verif → 1ère acceptation → 1er retrait
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

  -- Distribution paliers complétés (1..5) — global.
  with tier_counts as (
    select p.id,
           (case when pi.email is not null then 1 else 0 end) +
           (case when pl.adresse is not null then 1 else 0 end) +
           (case when pv.foyer is not null then 1 else 0 end) +
           (case when pp.poste is not null then 1 else 0 end) +
           (case when ppat.residence is not null then 1 else 0 end) as filled
      from public.prospects p
      left join public.prospect_identity pi on pi.prospect_id = p.id
      left join public.prospect_localisation pl on pl.prospect_id = p.id
      left join public.prospect_vie pv on pv.prospect_id = p.id
      left join public.prospect_pro pp on pp.prospect_id = p.id
      left join public.prospect_patrimoine ppat on ppat.prospect_id = p.id
  )
  select jsonb_object_agg(filled, n)
    into v_paliers
    from (select filled, count(*) as n from tier_counts group by filled) t;

  -- Score buckets
  select jsonb_object_agg(bucket, n) into v_score_buckets
    from (
      select width_bucket(bupp_score, 0, 1000, 5) as bucket, count(*) as n
        from public.prospects group by 1 order by 1
    ) t;

  -- Niveaux de vérification
  select jsonb_object_agg(verification, n) into v_verification
    from (select verification, count(*) as n from public.prospects group by 1) t;

  -- % téléphones vérifiés
  select round(
    100.0 * count(*) filter (where phone_verified_at is not null) / nullif(count(*),0),
    1
  )::numeric into v_phone_verified_pct
  from public.prospect_identity;

  -- Top 10 villes
  select coalesce(jsonb_agg(jsonb_build_object('ville', ville, 'n', n) order by n desc), '[]'::jsonb)
    into v_top_villes
    from (select ville, count(*) as n from public.prospect_localisation
           where ville is not null group by 1 order by n desc limit 10) t;

  -- Top 10 secteurs déclarés
  select coalesce(jsonb_agg(jsonb_build_object('secteur', secteur, 'n', n) order by n desc), '[]'::jsonb)
    into v_top_secteurs
    from (select secteur, count(*) as n from public.prospect_pro
           where secteur is not null group by 1 order by n desc limit 10) t;

  -- Top motifs de refus sur la période
  select coalesce(jsonb_agg(jsonb_build_object('reason', reason, 'n', n) order by n desc), '[]'::jsonb)
    into v_refusal_reasons
    from (select reason, count(*) as n from public.relation_feedback
           where created_at >= p_start and created_at < p_end group by 1 order by n desc limit 10) t;

  -- Founders + bonus appliqués
  select count(*) into v_founders from public.prospects where is_founder = true;
  select count(*), coalesce(sum(reward_cents)::numeric / 100, 0)
    into v_founders_bonus_count, v_founders_bonus_eur
    from public.relations
    where founder_bonus_applied = true and decided_at >= p_start and decided_at < p_end;

  -- € crédités prospects sur la période
  select coalesce(sum(amount_cents)::numeric / 100, 0)
    into v_credited_eur
    from public.transactions
    where type='credit' and account_kind='prospect' and status='completed'
      and created_at >= p_start and created_at < p_end;

  -- Retraits
  select count(*), coalesce(sum(abs(amount_cents))::numeric / 100, 0)
    into v_withdrawals_count, v_withdrawals_eur
    from public.transactions
    where type='withdrawal' and account_kind='prospect' and status='completed'
      and created_at >= p_start and created_at < p_end;

  -- Top parrains : count distinct emails côté prospects qui ont un ref_code en waitlist
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
    'topSecteurs', v_top_secteurs,
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
