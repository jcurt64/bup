-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Timeseries pour la vue d'ensemble admin
-- ════════════════════════════════════════════════════════════════════
-- Renvoie 3 séries quotidiennes pour [p_start, p_end[ :
--   - prospects, pros (count par jour de création)
--   - relations_sent / relations_accepted / relations_refused / relations_expired
--   - budget_cents, spent_cents, credited_cents (sum par jour)
-- Le bucket par semaine/mois est fait en TS (lib/admin/periods).
-- ════════════════════════════════════════════════════════════════════

create or replace function public.admin_overview_timeseries(
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  d date,
  prospects int,
  pros int,
  relations_sent int,
  relations_accepted int,
  relations_refused int,
  relations_expired int,
  budget_cents bigint,
  spent_cents bigint,
  credited_cents bigint
)
language sql
security definer
set search_path = public
as $$
  with days as (
    select generate_series(date_trunc('day', p_start), date_trunc('day', p_end), '1 day')::date as d
  ),
  pros_d as (
    select date_trunc('day', created_at)::date as d, count(*) as n
      from public.prospects where created_at >= p_start and created_at < p_end group by 1
  ),
  pa_d as (
    select date_trunc('day', created_at)::date as d, count(*) as n
      from public.pro_accounts where created_at >= p_start and created_at < p_end group by 1
  ),
  rel_d as (
    select date_trunc('day', sent_at)::date as d,
           count(*) as sent,
           count(*) filter (where status in ('accepted','settled')) as accepted,
           count(*) filter (where status = 'refused') as refused,
           count(*) filter (where status = 'expired') as expired
      from public.relations where sent_at >= p_start and sent_at < p_end group by 1
  ),
  camp_d as (
    select date_trunc('day', created_at)::date as d,
           coalesce(sum(budget_cents),0) as b,
           coalesce(sum(spent_cents),0) as s
      from public.campaigns where created_at >= p_start and created_at < p_end group by 1
  ),
  credit_d as (
    select date_trunc('day', created_at)::date as d,
           coalesce(sum(amount_cents),0) as c
      from public.transactions
      where type='credit' and account_kind='prospect' and status='completed'
        and created_at >= p_start and created_at < p_end
      group by 1
  )
  select
    days.d,
    coalesce(pros_d.n, 0)::int,
    coalesce(pa_d.n, 0)::int,
    coalesce(rel_d.sent, 0)::int,
    coalesce(rel_d.accepted, 0)::int,
    coalesce(rel_d.refused, 0)::int,
    coalesce(rel_d.expired, 0)::int,
    coalesce(camp_d.b, 0)::bigint,
    coalesce(camp_d.s, 0)::bigint,
    coalesce(credit_d.c, 0)::bigint
  from days
  left join pros_d on pros_d.d = days.d
  left join pa_d on pa_d.d = days.d
  left join rel_d on rel_d.d = days.d
  left join camp_d on camp_d.d = days.d
  left join credit_d on credit_d.d = days.d
  order by days.d;
$$;

revoke all on function public.admin_overview_timeseries(timestamptz, timestamptz) from public;
grant execute on function public.admin_overview_timeseries(timestamptz, timestamptz) to service_role;
