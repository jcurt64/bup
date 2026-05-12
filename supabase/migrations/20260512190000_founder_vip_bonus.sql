-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Programme Parrain / Fondateur·ice — Palier VIP (10 filleuls)
-- ════════════════════════════════════════════════════════════════════
-- Parrain = Fondateur·ice (fusion conceptuelle). Quand un fondateur
-- atteint le plafond de 10 filleuls (= REFERRER_CAP côté waitlist), il
-- bascule sur un bonus exceptionnel à plat de +5,00 € par acceptation,
-- en lieu et place du bonus ×2 standard, à 3 conditions cumulatives :
--
--   1. il est fondateur (prospects.is_founder = true)
--   2. nous sommes dans la fenêtre 1 mois post-lancement
--   3. la campagne a un budget total > 300,00 €
--      ET le bonus fondateur est activé sur cette campagne
--
-- Si la 3ᵉ condition n'est pas remplie (budget ≤ 300 €), on retombe sur
-- le ×2 standard — c'est explicite dans la spec : "×2 normal s'applique".
-- Le bonus VIP ne se cumule PAS avec le ×2 fondateur : il le remplace.
-- Le bonus certifié confiance (×2 indépendant) reste cumulable.
--
-- Constantes (en cents) :
--   VIP_FILLEUL_THRESHOLD = 10
--   VIP_BUDGET_MIN_CENTS  = 30_000   ( = 300,00 € )
--   VIP_FLAT_BONUS_CENTS  = 500      ( = 5,00 €   )
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Snapshot VIP sur la relation (audit + email) ───────────────
alter table public.relations
  add column if not exists founder_vip_bonus_applied boolean not null default false;

-- ─── 2. Helper : compte les filleuls d'un prospect fondateur ───────
-- Le prospect a une row dans waitlist via son email. Le ref_code de
-- cette row identifie le parrain, et tous les filleuls ont ce code
-- dans waitlist.referrer_ref_code. Si le prospect n'est pas dans la
-- waitlist (= pas inscrit avant lancement), il n'a pas de filleuls.
create or replace function public.count_founder_filleuls(p_prospect_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email    text;
  v_ref_code text;
  v_count    integer;
begin
  select email into v_email
    from public.prospect_identity
   where prospect_id = p_prospect_id;
  if v_email is null then
    return 0;
  end if;

  select ref_code into v_ref_code
    from public.waitlist
   where lower(email) = lower(v_email);
  if v_ref_code is null then
    return 0;
  end if;

  select count(*) into v_count
    from public.waitlist
   where referrer_ref_code = v_ref_code;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.count_founder_filleuls(uuid) from public;
grant execute on function public.count_founder_filleuls(uuid) to authenticated, service_role;

-- ─── 3. RPC accept_relation_tx — palier VIP ────────────────────────
-- Réécriture complète qui étend la version 20260508120100 avec la
-- bascule VIP. Le squelette est identique (verrous, validations, écriture
-- transactions) — seul le calcul de v_reward_final change.
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
  v_budget_cents  bigint;
  -- Founder bonus (×2 standard ou VIP +5€ flat)
  v_is_founder       boolean;
  v_bonus_enabled    boolean;
  v_in_window        boolean;
  v_apply_bonus      boolean := false;
  v_apply_vip        boolean := false;
  v_filleul_count    integer := 0;
  v_reward_final     bigint;
  -- Bonus indépendant : certifié confiance (×2 sur la base)
  v_verification     public.verification_level;
begin
  -- Verrouille r, c, a, p en une seule requête (anti-race avec
  -- sync_founder_status qui peut flipper is_founder).
  select r.pro_account_id, r.prospect_id, r.campaign_id,
         c.cost_per_contact_cents, r.status,
         c.status, c.ends_at, a.wallet_balance_cents,
         c.budget_cents,
         p.is_founder, c.founder_bonus_enabled, p.verification
    into v_pro_id, v_prospect_id, v_campaign_id,
         v_reward, v_status,
         v_camp_status, v_camp_ends_at, v_wallet,
         v_budget_cents,
         v_is_founder, v_bonus_enabled, v_verification
    from relations r
    join campaigns  c on c.id = r.campaign_id
    join pro_accounts a on a.id = r.pro_account_id
    join prospects  p on p.id = r.prospect_id
   where r.id = p_relation_id
   for update of r, c, a, p;

  -- ── Validations (identiques au précédent stage) ────────────────
  if v_status is null then
    raise exception 'relation_not_found' using errcode = 'P0002';
  end if;
  if v_status not in ('pending', 'refused', 'expired') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if v_camp_status <> 'active' then
    raise exception 'campaign_inactive' using errcode = 'P0001';
  end if;
  if v_camp_ends_at is not null and v_camp_ends_at <= now() then
    raise exception 'campaign_expired' using errcode = 'P0001';
  end if;

  -- ── Calcul du bonus fondateur ──────────────────────────────────
  v_in_window := public.is_within_founder_bonus_window();

  if v_is_founder and v_bonus_enabled and v_in_window then
    v_filleul_count := public.count_founder_filleuls(v_prospect_id);
    -- Palier VIP : 10 filleuls ET budget campagne > 300 €.
    -- Le seuil est strict (> 30_000 cents = > 300,00 €).
    if v_filleul_count >= 10 and v_budget_cents > 30000 then
      v_apply_vip := true;
    else
      v_apply_bonus := true;
    end if;
  end if;

  -- ── Calcul du reward final ─────────────────────────────────────
  -- Ordre des bonus :
  --   1. certifie_confiance : ×2 sur la base (bonus de profil prospect)
  --   2. VIP +5€ flat  OU  ×2 fondateur standard  (mutuellement exclusifs)
  -- Le ×2 certifie_confiance s'applique AVANT et reste cumulable.
  v_reward_final := v_reward;
  if v_verification = 'certifie_confiance' then
    v_reward_final := v_reward_final * 2;
  end if;
  if v_apply_vip then
    v_reward_final := v_reward_final + 500;
  elsif v_apply_bonus then
    v_reward_final := v_reward_final * 2;
  end if;

  -- Vérif solde pro contre le montant final.
  if v_wallet < v_reward_final then
    raise exception 'insufficient_pro_funds' using errcode = 'P0001';
  end if;

  -- ── Mise à jour de la relation ─────────────────────────────────
  update public.relations
     set status                    = 'accepted',
         decided_at                = now(),
         settled_at                = null,
         reward_cents              = v_reward_final,
         founder_bonus_applied     = v_apply_bonus,
         founder_vip_bonus_applied = v_apply_vip
   where id = p_relation_id;

  -- ── Débit du wallet pro ────────────────────────────────────────
  update public.pro_accounts
     set wallet_balance_cents = wallet_balance_cents - v_reward_final
   where id = v_pro_id;

  -- ── Mise à jour du budget dépensé de la campagne ───────────────
  update public.campaigns
     set spent_cents = spent_cents + v_reward_final
   where id = v_campaign_id;

  -- ── Transactions d'escrow (pro débit + prospect séquestre) ─────
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
