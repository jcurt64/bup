create or replace function public.admin_pros_kpis(
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signups int;
  v_by_plan jsonb;
  v_by_billing jsonb;
  v_top_secteurs jsonb;
  v_top_villes jsonb;
  v_topup_count int;
  v_topup_eur numeric;
  v_topup_avg_eur numeric;
  v_wallet_balance_eur numeric;
  v_reveals int;
  v_reveals_per_day jsonb;
begin
  select count(*) into v_signups from public.pro_accounts
   where created_at >= p_start and created_at < p_end;

  select coalesce(jsonb_object_agg(plan, n), '{}'::jsonb) into v_by_plan
    from (select plan, count(*) as n from public.pro_accounts group by 1) t;
  select coalesce(jsonb_object_agg(billing_status, n), '{}'::jsonb) into v_by_billing
    from (select billing_status, count(*) as n from public.pro_accounts group by 1) t;

  select coalesce(jsonb_agg(jsonb_build_object('secteur', secteur, 'n', n) order by n desc), '[]'::jsonb)
    into v_top_secteurs
    from (select secteur, count(*) as n from public.pro_accounts where secteur is not null group by 1 order by n desc limit 10) t;
  select coalesce(jsonb_agg(jsonb_build_object('ville', ville, 'n', n) order by n desc), '[]'::jsonb)
    into v_top_villes
    from (select ville, count(*) as n from public.pro_accounts where ville is not null group by 1 order by n desc limit 10) t;

  select count(*), coalesce(sum(amount_cents)::numeric / 100, 0),
         coalesce(avg(amount_cents)::numeric / 100, 0)
    into v_topup_count, v_topup_eur, v_topup_avg_eur
    from public.transactions
    where type='topup' and account_kind='pro' and status='completed'
      and created_at >= p_start and created_at < p_end;

  select coalesce(sum(wallet_balance_cents)::numeric / 100, 0) into v_wallet_balance_eur
    from public.pro_accounts;

  select count(*) into v_reveals from public.pro_contact_reveals
    where revealed_at >= p_start and revealed_at < p_end;

  select coalesce(jsonb_object_agg(d, n order by d), '{}'::jsonb)
    into v_reveals_per_day
    from (
      select date_trunc('day', revealed_at)::date::text as d, count(*) as n
        from public.pro_contact_reveals
        where revealed_at >= p_start and revealed_at < p_end
        group by 1
    ) t;

  return jsonb_build_object(
    'signups', v_signups,
    'byPlan', v_by_plan,
    'byBilling', v_by_billing,
    'topSecteurs', v_top_secteurs,
    'topVilles', v_top_villes,
    'topupCount', v_topup_count,
    'topupEur', v_topup_eur,
    'topupAvgEur', v_topup_avg_eur,
    'walletBalanceEur', v_wallet_balance_eur,
    'revealsCount', v_reveals,
    'revealsPerDay', v_reveals_per_day
  );
end;
$$;

revoke all on function public.admin_pros_kpis(timestamptz, timestamptz) from public;
grant execute on function public.admin_pros_kpis(timestamptz, timestamptz) to service_role;
