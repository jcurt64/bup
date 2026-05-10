-- ════════════════════════════════════════════════════════════════════
-- BUUPP — RPC d'agrégation pour la vue d'ensemble admin
-- ════════════════════════════════════════════════════════════════════
-- Compte en une seule passe les agrégats utilisés par
-- /api/admin/stats/overview. Accepte la fenêtre [p_start, p_end[.
-- SECURITY DEFINER → ne lit que les compteurs, jamais de PII.
-- Réservée à service_role.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.admin_overview_kpis(
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_waitlist int;
  v_prospects int;
  v_pros int;
  v_active_campaigns int;
  v_campaigns_created int;
  v_relations_sent int;
  v_relations_accepted int;
  v_budget_cents bigint;
  v_spent_cents bigint;
  v_credited_cents bigint;
  v_topup_cents bigint;
  v_campaign_charge_cents bigint;
begin
  select count(*) into v_waitlist from public.waitlist
   where created_at >= p_start and created_at < p_end;

  select count(*) into v_prospects from public.prospects
   where created_at >= p_start and created_at < p_end;

  select count(*) into v_pros from public.pro_accounts
   where created_at >= p_start and created_at < p_end;

  select count(*) into v_active_campaigns from public.campaigns
   where status = 'active';

  select count(*) into v_campaigns_created from public.campaigns
   where created_at >= p_start and created_at < p_end;

  select count(*) into v_relations_sent from public.relations
   where sent_at >= p_start and sent_at < p_end;

  select count(*) into v_relations_accepted from public.relations
   where sent_at >= p_start and sent_at < p_end
     and status in ('accepted', 'settled');

  select coalesce(sum(budget_cents), 0) into v_budget_cents from public.campaigns
   where created_at >= p_start and created_at < p_end;

  select coalesce(sum(spent_cents), 0) into v_spent_cents from public.campaigns
   where created_at >= p_start and created_at < p_end;

  select coalesce(sum(amount_cents), 0) into v_credited_cents from public.transactions
   where type = 'credit' and account_kind = 'prospect'
     and created_at >= p_start and created_at < p_end
     and status = 'completed';

  select coalesce(sum(amount_cents), 0) into v_topup_cents from public.transactions
   where type = 'topup' and account_kind = 'pro'
     and created_at >= p_start and created_at < p_end
     and status = 'completed';

  select coalesce(sum(abs(amount_cents)), 0) into v_campaign_charge_cents from public.transactions
   where type = 'campaign_charge' and account_kind = 'pro'
     and created_at >= p_start and created_at < p_end
     and status = 'completed';

  return jsonb_build_object(
    'waitlist', v_waitlist,
    'prospects', v_prospects,
    'pros', v_pros,
    'activeCampaigns', v_active_campaigns,
    'campaignsCreated', v_campaigns_created,
    'relationsSent', v_relations_sent,
    'relationsAccepted', v_relations_accepted,
    'budgetCents', v_budget_cents,
    'spentCents', v_spent_cents,
    'creditedCents', v_credited_cents,
    'topupCents', v_topup_cents,
    'campaignChargeCents', v_campaign_charge_cents
  );
end;
$$;

revoke all on function public.admin_overview_kpis(timestamptz, timestamptz) from public;
grant execute on function public.admin_overview_kpis(timestamptz, timestamptz) to service_role;
