-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Programme Fondateur (Phase 2 : RPC d'acceptation)
-- ════════════════════════════════════════════════════════════════════
-- Modifie `accept_relation_tx` pour appliquer un bonus ×2 quand :
--   prospects.is_founder = true
--   AND campaigns.founder_bonus_enabled = true
--   AND public.is_within_founder_bonus_window() = true
-- Le débit pro et le reward prospect sont doublés, et
-- `relations.founder_bonus_applied` est positionné à true (snapshot).
-- En cas de solde pro insuffisant pour 2×, on raise comme pour le
-- débit standard : `insufficient_pro_funds`.
--
-- Invariants préservés depuis 20260505010000_accept_from_history :
--   - FOR UPDATE sur (r, c, a) — verrou anti-concurrent
--   - Transitions autorisées : pending / refused / expired → accepted
--   - Garde-fous : campaign_inactive, campaign_expired, insufficient_pro_funds
--   - settled_at = null sur la mise à jour de la relation
--   - Deux lignes transactions (débit pro + séquestre prospect)
-- ════════════════════════════════════════════════════════════════════

create or replace function public.accept_relation_tx(p_relation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pro_id        uuid;
  v_prospect_id   uuid;
  v_campaign_id   uuid;
  v_reward        bigint;
  v_status        relation_status;
  v_camp_status   campaign_status;
  v_camp_ends_at  timestamptz;
  v_wallet        bigint;
  -- Founder bonus
  v_is_founder       boolean;
  v_bonus_enabled    boolean;
  v_in_window        boolean;
  v_apply_bonus      boolean := false;
  v_reward_final     bigint;
begin
  -- Verrouille r, c, a + lit les colonnes fondateur en une seule requête.
  select r.pro_account_id, r.prospect_id, r.campaign_id,
         r.reward_cents, r.status,
         c.status, c.ends_at, a.wallet_balance_cents,
         p.is_founder, c.founder_bonus_enabled
    into v_pro_id, v_prospect_id, v_campaign_id,
         v_reward, v_status,
         v_camp_status, v_camp_ends_at, v_wallet,
         v_is_founder, v_bonus_enabled
    from relations r
    join campaigns  c on c.id = r.campaign_id
    join pro_accounts a on a.id = r.pro_account_id
    join prospects  p on p.id = r.prospect_id
   where r.id = p_relation_id
   for update of r, c, a;

  -- ── Validations (identiques à 20260505010000) ───────────────────────
  if v_status is null then
    raise exception 'relation_not_found' using errcode = 'P0002';
  end if;
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

  -- ── Calcul du montant final (avec bonus éventuel) ───────────────────
  v_in_window   := public.is_within_founder_bonus_window();
  v_apply_bonus := v_is_founder and v_bonus_enabled and v_in_window;

  v_reward_final := v_reward;
  if v_apply_bonus then
    v_reward_final := v_reward_final * 2;
  end if;

  -- Vérification du solde pro contre le montant final (standard ou ×2).
  if v_wallet < v_reward_final then
    raise exception 'insufficient_pro_funds' using errcode = 'P0001';
  end if;

  -- ── Mise à jour de la relation ──────────────────────────────────────
  update public.relations
     set status                = 'accepted',
         decided_at            = now(),
         settled_at            = null,
         reward_cents          = v_reward_final,
         founder_bonus_applied = v_apply_bonus
   where id = p_relation_id;

  -- ── Débit du wallet pro ─────────────────────────────────────────────
  update public.pro_accounts
     set wallet_balance_cents = wallet_balance_cents - v_reward_final
   where id = v_pro_id;

  -- ── Mise à jour du budget dépensé de la campagne ───────────────────
  update public.campaigns
     set spent_cents = spent_cents + v_reward_final
   where id = v_campaign_id;

  -- ── Transactions d'escrow ───────────────────────────────────────────
  -- Débit pro (complété immédiatement) + séquestre prospect (en attente).
  insert into public.transactions
    (account_id, account_kind, type, status, amount_cents,
     relation_id, campaign_id, description)
  values
    (v_pro_id, 'pro', 'escrow', 'completed', -v_reward_final,
     p_relation_id, v_campaign_id, 'Séquestre acceptation campagne'),
    (v_prospect_id, 'prospect', 'escrow', 'pending', v_reward_final,
     p_relation_id, v_campaign_id, 'Séquestre récompense — en attente de débit');
end;
$$;

-- ── Droits d'exécution (alignés sur les migrations précédentes) ─────
revoke all on function public.accept_relation_tx(uuid) from public;
revoke execute on function public.accept_relation_tx(uuid) from anon;
grant  execute on function public.accept_relation_tx(uuid) to authenticated, service_role;
