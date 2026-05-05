-- ════════════════════════════════════════════════════════════════════
-- BUUPP — refund_relation_tx élargi : refund depuis accepted OU settled
-- ════════════════════════════════════════════════════════════════════
-- Permet au prospect de revenir sur sa décision pour une campagne
-- toujours en cours, même après le délai de validation (settle).
--
-- Transitions autorisées :
--   - accepted → refused / pending  (escrow prospect en `pending` → canceled)
--   - settled  → refused / pending  (credit prospect `completed` → canceled,
--                                    settled_at remis à null sur la relation)
--
-- Effets de bord identiques pour le pro : refund du wallet + decrement
-- de campaigns.spent_cents + insert d'une transaction `refund completed`
-- côté pro. Côté prospect, on annule la transaction qui matérialise le
-- crédit (qu'elle soit en escrow pending ou en credit completed).
-- ════════════════════════════════════════════════════════════════════

create or replace function public.refund_relation_tx(
  p_relation_id uuid,
  p_new_status public.relation_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pro_id uuid;
  v_campaign_id uuid;
  v_reward bigint;
  v_status relation_status;
begin
  if p_new_status not in ('pending', 'refused') then
    raise exception 'invalid_target_status' using errcode = 'P0001';
  end if;

  select r.pro_account_id, r.campaign_id, r.reward_cents, r.status
    into v_pro_id, v_campaign_id, v_reward, v_status
    from relations r
    join pro_accounts a on a.id = r.pro_account_id
   where r.id = p_relation_id
   for update of r, a;

  if v_status is null then raise exception 'relation_not_found' using errcode = 'P0002'; end if;
  -- Permissif : on autorise refund depuis accepted (escrow encore détenu)
  -- ET depuis settled (crédit déjà passé sur le portefeuille).
  if v_status not in ('accepted', 'settled') then
    raise exception 'not_accepted' using errcode = 'P0001';
  end if;

  update relations
     set status     = p_new_status,
         decided_at = case when p_new_status = 'pending' then null else now() end,
         settled_at = null
   where id = p_relation_id;

  update pro_accounts
     set wallet_balance_cents = wallet_balance_cents + v_reward
   where id = v_pro_id;

  update campaigns
     set spent_cents = greatest(0, spent_cents - v_reward)
   where id = v_campaign_id;

  insert into transactions
    (account_id, account_kind, type, status, amount_cents,
     relation_id, campaign_id, description)
  values
    (v_pro_id, 'pro', 'refund', 'completed', v_reward,
     p_relation_id, v_campaign_id, 'Remboursement annulation acceptation');

  -- Annule la transaction prospect quel que soit son état actuel :
  --   - escrow pending  (relation accepted, settle pas encore passé)
  --   - credit completed (relation settled, déjà créditée au portefeuille)
  update transactions
     set status = 'canceled'
   where relation_id = p_relation_id
     and account_kind = 'prospect'
     and (
       (type = 'escrow' and status = 'pending')
       or (type = 'credit' and status = 'completed')
     );
end;
$$;

revoke execute on function public.refund_relation_tx(uuid, public.relation_status) from public, anon;
grant  execute on function public.refund_relation_tx(uuid, public.relation_status) to authenticated, service_role;
