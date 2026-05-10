create or replace function public.admin_campaigns_kpis(
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_by_status jsonb;
  v_created int;
  v_budget_eur numeric;
  v_spent_eur numeric;
  v_consumption_avg_pct numeric;
  v_cpc_avg_eur numeric;
  v_cpc_median_eur numeric;
  v_by_type jsonb;
  v_top_geo jsonb;
  v_top_categories jsonb;
  v_top_perf jsonb;
  v_flop_perf jsonb;
  v_auto_completed int;
  v_expiring_warned int;
begin
  select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) into v_by_status
    from (select status, count(*) as n from public.campaigns
           where created_at >= p_start and created_at < p_end group by 1) t;

  select count(*), coalesce(sum(budget_cents)::numeric / 100, 0),
         coalesce(sum(spent_cents)::numeric / 100, 0),
         coalesce(round(avg(case when budget_cents > 0 then 100.0 * spent_cents / budget_cents else 0 end)::numeric, 1), 0),
         coalesce(round(avg(cost_per_contact_cents)::numeric / 100, 2), 0),
         coalesce(round(percentile_cont(0.5) within group (order by cost_per_contact_cents)::numeric / 100, 2), 0)
    into v_created, v_budget_eur, v_spent_eur, v_consumption_avg_pct, v_cpc_avg_eur, v_cpc_median_eur
    from public.campaigns where created_at >= p_start and created_at < p_end;

  select coalesce(jsonb_object_agg(type, n), '{}'::jsonb) into v_by_type
    from (select type, count(*) as n from public.campaigns
           where created_at >= p_start and created_at < p_end group by 1) t;

  select coalesce(jsonb_agg(jsonb_build_object('geo', geo, 'n', n) order by n desc), '[]'::jsonb)
    into v_top_geo
    from (
      select g as geo, count(*) as n
        from public.campaigns c, jsonb_array_elements_text(coalesce(c.targeting->'geo','[]'::jsonb)) g
        where c.created_at >= p_start and c.created_at < p_end
        group by g order by n desc limit 10
    ) t;

  select coalesce(jsonb_agg(jsonb_build_object('cat', cat, 'n', n) order by n desc), '[]'::jsonb)
    into v_top_categories
    from (
      select g as cat, count(*) as n
        from public.campaigns c, jsonb_array_elements_text(coalesce(c.targeting->'categories','[]'::jsonb)) g
        where c.created_at >= p_start and c.created_at < p_end
        group by g order by n desc limit 10
    ) t;

  -- Top/Flop perf : taux d'acceptation par campagne (sur relations finales)
  with rel_stats as (
    select c.id, c.name,
           count(r.*) filter (where r.status in ('accepted','settled','refused','expired')) as finals,
           count(r.*) filter (where r.status in ('accepted','settled')) as wins
      from public.campaigns c
      left join public.relations r on r.campaign_id = c.id
      where c.created_at >= p_start and c.created_at < p_end
      group by c.id, c.name
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'pct', round(100.0 * wins / nullif(finals,0), 1)) order by wins::numeric / nullif(finals,0) desc nulls last), '[]'::jsonb)
    into v_top_perf
    from (select * from rel_stats where finals >= 5 order by wins::numeric / nullif(finals,0) desc nulls last limit 10) t;

  with rel_stats as (
    select c.id, c.name,
           count(r.*) filter (where r.status in ('accepted','settled','refused','expired')) as finals,
           count(r.*) filter (where r.status in ('accepted','settled')) as wins
      from public.campaigns c
      left join public.relations r on r.campaign_id = c.id
      where c.created_at >= p_start and c.created_at < p_end
      group by c.id, c.name
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'pct', round(100.0 * wins / nullif(finals,0), 1)) order by wins::numeric / nullif(finals,0) asc nulls last), '[]'::jsonb)
    into v_flop_perf
    from (select * from rel_stats where finals >= 5 order by wins::numeric / nullif(finals,0) asc nulls last limit 10) t;

  select count(*) into v_auto_completed from public.campaigns
   where status='completed' and ends_at >= p_start and ends_at < p_end;

  select count(*) into v_expiring_warned from public.campaigns
   where expiry_warning_sent = true and updated_at >= p_start and updated_at < p_end;

  return jsonb_build_object(
    'byStatus', v_by_status,
    'created', v_created,
    'budgetEur', v_budget_eur,
    'spentEur', v_spent_eur,
    'consumptionAvgPct', v_consumption_avg_pct,
    'cpcAvgEur', v_cpc_avg_eur,
    'cpcMedianEur', v_cpc_median_eur,
    'byType', v_by_type,
    'topGeo', v_top_geo,
    'topCategories', v_top_categories,
    'topPerf', v_top_perf,
    'flopPerf', v_flop_perf,
    'autoCompleted', v_auto_completed,
    'expiringWarned', v_expiring_warned
  );
end;
$$;

revoke all on function public.admin_campaigns_kpis(timestamptz, timestamptz) from public;
grant execute on function public.admin_campaigns_kpis(timestamptz, timestamptz) to service_role;
