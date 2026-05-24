-- Fix Postgres 42702 « column reference "campaign_id" is ambiguous » dans
-- la fonction `close_campaign_settle`. La signature
--   RETURNS TABLE(campaign_id uuid, ...)
-- introduit `campaign_id` comme OUT-param visible dans le scope du body.
-- Le SELECT sur `transactions` ne qualifiait pas la colonne, d'où le
-- conflit OUT-param ↔ colonne (durci sous Postgres 17). Toutes les autres
-- références étaient déjà préfixées `c.`.
--
-- Fix : alias `t` + qualification de toutes les colonnes de `transactions`.

CREATE OR REPLACE FUNCTION public.close_campaign_settle(p_campaign_id uuid)
 RETURNS TABLE(campaign_id uuid, pro_account_id uuid, rewards_cents bigint, commission_cents bigint, released_reserve bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pro_id            uuid;
  v_status            campaign_status;
  v_ends_at           timestamptz;
  v_residual          bigint;
  v_commission_total  bigint;
  v_rewards_total     bigint;
begin
  select c.pro_account_id, c.status, c.ends_at,
         c.budget_reserved_cents, c.commission_settled_cents
    into v_pro_id, v_status, v_ends_at, v_residual, v_commission_total
    from campaigns c
   where c.id = p_campaign_id
   for update;

  if v_pro_id is null then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;
  if v_status <> 'active' then
    return;
  end if;
  if v_ends_at is null or v_ends_at > now() then
    raise exception 'campaign_not_yet_expired' using errcode = 'P0001';
  end if;

  perform settle_ripe_relations();

  select c.budget_reserved_cents, c.commission_settled_cents
    into v_residual, v_commission_total
    from campaigns c
   where c.id = p_campaign_id;

  if coalesce(v_residual, 0) > 0 then
    update pro_accounts
       set wallet_reserved_cents = greatest(0, wallet_reserved_cents - v_residual)
     where id = v_pro_id;
    update campaigns
       set budget_reserved_cents = 0
     where id = p_campaign_id;
  end if;

  select coalesce(sum(-t.amount_cents), 0)::bigint
    into v_rewards_total
    from transactions t
   where t.campaign_id = p_campaign_id
     and t.account_kind = 'pro'
     and t.type = 'campaign_charge'
     and t.status = 'completed';

  update campaigns
     set status     = 'completed',
         settled_at = now()
   where id = p_campaign_id;

  return query
    select p_campaign_id,
           v_pro_id,
           v_rewards_total,
           coalesce(v_commission_total, 0)::bigint,
           coalesce(v_residual, 0)::bigint;
end;
$function$;
