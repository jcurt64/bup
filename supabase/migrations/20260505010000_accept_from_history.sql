-- ════════════════════════════════════════════════════════════════════
-- BUUPP — accept_relation_tx élargi : accept depuis refused / expired
-- ════════════════════════════════════════════════════════════════════
-- Permet au prospect de revenir sur une relation passée (refused ou
-- expired) tant que la campagne est toujours active et dans sa fenêtre
-- de diffusion (campaigns.ends_at > now()). La fenêtre de réponse n'est
-- plus contrainte par relation.expires_at — c'est la fin de campagne
-- qui fait foi.
--
-- Transitions autorisées (status_avant → accepted) :
--   - pending  → accepted   (flux nominal)
--   - refused  → accepted   (changement d'avis)
--   - expired  → accepted   (campagne encore ouverte)
--
-- Garde-fous inchangés :
--   - campaign.status = 'active'
--   - pro_accounts.wallet_balance_cents >= reward
--   - FOR UPDATE sur (r, c, a) pour bloquer les transitions concurrentes
--
-- L'écriture des transactions d'escrow est identique (un débit pro
-- complété, un séquestre prospect en pending). Si la relation avait
-- déjà été acceptée puis refusée, refund_relation_tx a annulé la
-- transaction d'escrow précédente — on en insère une nouvelle ici.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.accept_relation_tx(p_relation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pro_id uuid;
  v_prospect_id uuid;
  v_campaign_id uuid;
  v_reward bigint;
  v_status relation_status;
  v_camp_status campaign_status;
  v_camp_ends_at timestamptz;
  v_wallet bigint;
begin
  select r.pro_account_id, r.prospect_id, r.campaign_id,
         r.reward_cents, r.status,
         c.status, c.ends_at, a.wallet_balance_cents
    into v_pro_id, v_prospect_id, v_campaign_id,
         v_reward, v_status,
         v_camp_status, v_camp_ends_at, v_wallet
    from relations r
    join campaigns c on c.id = r.campaign_id
    join pro_accounts a on a.id = r.pro_account_id
   where r.id = p_relation_id
   for update of r, c, a;

  if v_status is null then raise exception 'relation_not_found' using errcode = 'P0002'; end if;
  -- Permissif : accept depuis pending OU refused OU expired.
  if v_status not in ('pending', 'refused', 'expired') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if v_camp_status <> 'active' then
    raise exception 'campaign_inactive' using errcode = 'P0001';
  end if;
  if v_camp_ends_at is not null and v_camp_ends_at <= now() then
    raise exception 'campaign_expired' using errcode = 'P0001';
  end if;
  if v_wallet < v_reward then
    raise exception 'insufficient_pro_funds' using errcode = 'P0001';
  end if;

  update relations
     set status     = 'accepted',
         decided_at = now(),
         settled_at = null
   where id = p_relation_id;

  update pro_accounts
     set wallet_balance_cents = wallet_balance_cents - v_reward
   where id = v_pro_id;

  update campaigns
     set spent_cents = spent_cents + v_reward
   where id = v_campaign_id;

  insert into transactions
    (account_id, account_kind, type, status, amount_cents,
     relation_id, campaign_id, description)
  values
    (v_pro_id, 'pro', 'escrow', 'completed', -v_reward,
     p_relation_id, v_campaign_id, 'Séquestre acceptation campagne'),
    (v_prospect_id, 'prospect', 'escrow', 'pending', v_reward,
     p_relation_id, v_campaign_id, 'Séquestre récompense — en attente de débit');
end;
$$;

-- Grants : on garde le scope authenticated + service_role.
revoke execute on function public.accept_relation_tx(uuid) from public, anon;
grant  execute on function public.accept_relation_tx(uuid) to authenticated, service_role;
