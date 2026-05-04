-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Acceptation campagnes : colonnes + genre + RPCs atomiques
-- ════════════════════════════════════════════════════════════════════
-- Cette migration ajoute :
--   1. Colonnes `brief`, `starts_at`, `matched_count` sur `campaigns`
--      (utilisées par le wizard de création + l'agrégat matched_count).
--   2. Colonne `genre` sur `prospect_identity` pour le breakdown Analytics.
--   3. RPC `accept_relation_tx` : transition pending → accepted +
--      débit wallet pro + 2 transactions escrow (atomique).
--   4. RPC `refund_relation_tx` : rollback de l'accept (refund pro,
--      cancel escrow prospect).
-- Toutes les RPCs sont `security definer` — elles s'exécutent avec les
-- privilèges du créateur (postgres) et bypassent la RLS.
-- ════════════════════════════════════════════════════════════════════

alter table public.campaigns
  add column brief text,
  add column starts_at timestamptz not null default now(),
  add column matched_count integer not null default 0
    check (matched_count >= 0);

alter table public.prospect_identity
  add column genre text
  check (genre is null or genre in ('femme', 'homme', 'autre'));

-- ─── RPC : accepter une relation (atomique) ─────────────────────────
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
  v_expires timestamptz;
  v_camp_status campaign_status;
  v_wallet bigint;
begin
  select r.pro_account_id, r.prospect_id, r.campaign_id,
         r.reward_cents, r.status, r.expires_at,
         c.status, a.wallet_balance_cents
    into v_pro_id, v_prospect_id, v_campaign_id,
         v_reward, v_status, v_expires,
         v_camp_status, v_wallet
    from relations r
    join campaigns c on c.id = r.campaign_id
    join pro_accounts a on a.id = r.pro_account_id
   where r.id = p_relation_id
   for update of r;

  if v_status is null then raise exception 'relation_not_found' using errcode = 'P0002'; end if;
  if v_status <> 'pending' then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  if v_camp_status <> 'active' then raise exception 'campaign_inactive' using errcode = 'P0001'; end if;
  if v_expires <= now() then raise exception 'relation_expired' using errcode = 'P0001'; end if;
  if v_wallet < v_reward then raise exception 'insufficient_pro_funds' using errcode = 'P0001'; end if;

  update relations
     set status = 'accepted', decided_at = now()
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

-- ─── RPC : annuler une acceptation (refund pro) ─────────────────────
create or replace function public.refund_relation_tx(
  p_relation_id uuid,
  p_new_status relation_status
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

  select pro_account_id, campaign_id, reward_cents, status
    into v_pro_id, v_campaign_id, v_reward, v_status
    from relations
   where id = p_relation_id
   for update;

  if v_status is null then raise exception 'relation_not_found' using errcode = 'P0002'; end if;
  if v_status <> 'accepted' then raise exception 'not_accepted' using errcode = 'P0001'; end if;

  update relations
     set status = p_new_status,
         decided_at = case when p_new_status = 'pending' then null else now() end
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

  -- Annule la transaction d'escrow prospect (pending → canceled).
  update transactions
     set status = 'canceled'
   where relation_id = p_relation_id
     and account_kind = 'prospect'
     and type = 'escrow'
     and status = 'pending';
end;
$$;
