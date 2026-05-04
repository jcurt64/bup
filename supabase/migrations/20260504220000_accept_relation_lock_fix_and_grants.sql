-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Correctifs accept_relation_tx : verrous élargis + grants RPC
-- ════════════════════════════════════════════════════════════════════
-- Cette migration corrige :
--   1. Race condition dans accept_relation_tx : le FOR UPDATE ne portait
--      que sur `relations` (r). Deux appels concurrents pour des relations
--      différentes du même pro pouvaient tous deux passer la vérification
--      du solde wallet et décrémenter en double. Le verrou est élargi à
--      `r, c, a` (relations, campaigns, pro_accounts).
--   2. Droits d'exécution trop larges : les deux RPCs étaient exécutables
--      par PUBLIC/anon sans contrôle d'identité côté fonction. On révoque
--      ces droits et on n'accorde l'accès qu'à authenticated et service_role.
-- ════════════════════════════════════════════════════════════════════

-- ─── RPC : accepter une relation (atomique) — verrous élargis ────────
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
   for update of r, c, a;

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

-- ─── Droits d'exécution : révoquer PUBLIC/anon, accorder authenticated ─
revoke execute on function public.accept_relation_tx(uuid) from public, anon;
revoke execute on function public.refund_relation_tx(uuid, public.relation_status) from public, anon;
grant  execute on function public.accept_relation_tx(uuid) to authenticated, service_role;
grant  execute on function public.refund_relation_tx(uuid, public.relation_status) to authenticated, service_role;

-- ─── Caveat : backfill de starts_at ──────────────────────────────────
-- Toutes les lignes `campaigns` existantes avant cette migration ont
-- `starts_at` égal à l'heure d'exécution de la migration précédente
-- (20260504210000), et non à leur vraie date de lancement.
-- En production, aucune campagne live n'existait à ce moment, donc aucun
-- backfill de données n'est nécessaire pour cette itération.
-- Si des campagnes réelles sont importées ultérieurement, mettre à jour
-- manuellement `starts_at` avec la date de lancement effective.
