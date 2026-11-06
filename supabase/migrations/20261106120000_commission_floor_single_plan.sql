-- Tarification BUUPP v2 — commission 10 % avec plancher 0,30 € + formule unique.
--
-- 1. Commission par acceptation = max(0,30 €, 10 % de la rémunération prospect)
--    (base = reward réellement versé, ×2 certifié inclus, bonus parrain EXCLU).
--    Miroir TS : lib/pricing/commission.ts (garder strictement identiques).
-- 2. Le tarif est FIGÉ sur chaque campagne à sa création
--    (commission_rate_bp / commission_floor_cents) → un futur changement de
--    tarif ne touche jamais une campagne en cours.
-- 3. accept_relation_tx DÉBITE la commission (wallet pro + transaction
--    `buupp_commission` liée à la relation + campaigns.commission_settled_cents).
-- 4. refund_relation_tx REMBOURSE aussi la commission (le prospect revient sur
--    son acceptation → refuse/undo).
-- 5. Formule unique : plus de frais d'accès Starter/Pro, campagnes illimitées,
--    5 paliers ouverts. plan_pricing neutralisé (0 €) et tous les pros passés
--    en 'pro' pour que les anciennes versions de l'app mobile n'affichent plus
--    ni frais ni blocage de paliers.

-- ─── 1. Fonction de calcul ─────────────────────────────────────────────
create or replace function public.buupp_commission_cents(
  p_reward_cents bigint,
  p_rate_bp      integer default 1000,
  p_floor_cents  bigint  default 30
)
returns bigint
language sql
immutable
set search_path to 'public'
as $$
  select case
    when coalesce(p_reward_cents, 0) <= 0 then 0::bigint
    else greatest(
      coalesce(p_floor_cents, 30),
      floor((p_reward_cents * coalesce(p_rate_bp, 1000) + 5000) / 10000.0)::bigint
    )
  end;
$$;

grant execute on function public.buupp_commission_cents(bigint, integer, bigint)
  to authenticated, service_role;

-- ─── 2. Colonnes ───────────────────────────────────────────────────────
alter table public.campaigns
  add column if not exists commission_rate_bp     integer not null default 1000,
  add column if not exists commission_floor_cents integer not null default 30;

alter table public.relations
  add column if not exists commission_cents bigint not null default 0;

-- ─── 3. accept_relation_tx : + commission ──────────────────────────────
create or replace function public.accept_relation_tx(p_relation_id uuid)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_pro_id            uuid;
  v_prospect_id       uuid;
  v_campaign_id       uuid;
  v_reward            bigint;
  v_status            relation_status;
  v_camp_status       campaign_status;
  v_camp_ends_at      timestamptz;
  v_wallet            bigint;
  v_bonus_enabled     boolean;
  v_verification      public.verification_level;
  v_reward_final      bigint;
  v_quota             integer;
  v_accepted_count    integer;
  v_referrer_code     text;
  v_parrain_id        uuid;
  v_referral_bonus    bigint := 0;
  v_rate_bp           integer;
  v_floor_cents       integer;
  v_commission        bigint := 0;
  v_total_debit       bigint;
begin
  select r.pro_account_id, r.prospect_id, r.campaign_id, c.cost_per_contact_cents,
         r.status, c.status, c.ends_at, a.wallet_balance_cents,
         c.founder_bonus_enabled, p.verification, c.contact_quota,
         c.commission_rate_bp, c.commission_floor_cents
    into v_pro_id, v_prospect_id, v_campaign_id, v_reward,
         v_status, v_camp_status, v_camp_ends_at, v_wallet,
         v_bonus_enabled, v_verification, v_quota,
         v_rate_bp, v_floor_cents
    from relations r
    join campaigns  c on c.id = r.campaign_id
    join pro_accounts a on a.id = r.pro_account_id
    join prospects  p on p.id = r.prospect_id
   where r.id = p_relation_id
   for update of r, c, a, p;

  if v_status is null then raise exception 'relation_not_found' using errcode = 'P0002'; end if;
  if v_status not in ('pending', 'refused', 'expired') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  if v_camp_status <> 'active' then raise exception 'campaign_inactive' using errcode = 'P0001'; end if;
  if v_camp_ends_at is not null and v_camp_ends_at <= now() then raise exception 'campaign_expired' using errcode = 'P0001'; end if;

  -- Garde-quota : jamais plus d'acceptations que le quota payé.
  if v_quota is not null then
    select count(*) into v_accepted_count
      from relations r2
     where r2.campaign_id = v_campaign_id
       and r2.status in ('accepted', 'settled');
    if v_accepted_count >= v_quota then
      raise exception 'quota_reached' using errcode = 'P0001';
    end if;
  end if;

  -- Récompense (×2 certifié confiance conservé).
  v_reward_final := v_reward;
  if v_verification = 'certifie_confiance' then
    v_reward_final := v_reward_final * 2;
  end if;

  -- Bonus parrain : +50 % de la récompense du filleul au PARRAIN (à vie).
  if v_bonus_enabled then
    select w.referrer_ref_code into v_referrer_code
      from public.prospect_identity pi
      join public.waitlist w on lower(w.email) = lower(pi.email)
     where pi.prospect_id = v_prospect_id
     limit 1;
    if v_referrer_code is not null then
      select pi2.prospect_id into v_parrain_id
        from public.waitlist wp
        join public.prospect_identity pi2 on lower(pi2.email) = lower(wp.email)
       where wp.ref_code = v_referrer_code
       order by pi2.prospect_id
       limit 1;
      if v_parrain_id is not null and v_parrain_id <> v_prospect_id then
        v_referral_bonus := v_reward_final / 2;
      end if;
    end if;
  end if;

  -- Commission BUUPP : tarif figé sur la campagne, base = récompense prospect
  -- (bonus parrain exclu).
  v_commission := public.buupp_commission_cents(v_reward_final, v_rate_bp, v_floor_cents);

  v_total_debit := v_reward_final + v_referral_bonus + v_commission;
  if v_wallet < v_total_debit then
    raise exception 'insufficient_pro_funds' using errcode = 'P0001';
  end if;

  update public.relations
     set status='accepted', decided_at=now(), settled_at=null,
         reward_cents=v_reward_final, referral_bonus_cents=v_referral_bonus,
         commission_cents=v_commission,
         founder_bonus_applied=false, founder_vip_bonus_applied=false
   where id = p_relation_id;

  update public.pro_accounts
     set wallet_balance_cents = wallet_balance_cents - v_total_debit
   where id = v_pro_id;

  update public.campaigns
     set spent_cents = spent_cents + v_reward_final,
         commission_settled_cents = coalesce(commission_settled_cents, 0) + v_commission
   where id = v_campaign_id;

  insert into public.transactions
    (account_id, account_kind, type, status, amount_cents, relation_id, campaign_id, description)
  values
    (v_pro_id, 'pro', 'escrow', 'completed', -v_reward_final, p_relation_id, v_campaign_id, 'Séquestre acceptation campagne'),
    (v_prospect_id, 'prospect', 'escrow', 'pending', v_reward_final, p_relation_id, v_campaign_id, 'Séquestre récompense — en attente de débit');

  if v_commission > 0 then
    insert into public.transactions
      (account_id, account_kind, type, status, amount_cents, relation_id, campaign_id, description)
    values
      (v_pro_id, 'pro', 'buupp_commission', 'completed', -v_commission, p_relation_id, v_campaign_id,
       'Commission BUUPP (10 %, min. 0,30 €)');
  end if;

  if v_referral_bonus > 0 then
    insert into public.transactions
      (account_id, account_kind, type, status, amount_cents, relation_id, campaign_id, description)
    values
      (v_pro_id, 'pro', 'escrow', 'completed', -v_referral_bonus, p_relation_id, v_campaign_id, 'Financement bonus parrain'),
      (v_parrain_id, 'prospect', 'escrow', 'pending', v_referral_bonus, p_relation_id, v_campaign_id, 'Bonus parrain — acceptation d''un filleul');
  end if;
end;
$function$;

revoke execute on function public.accept_relation_tx(uuid) from public, anon;
grant  execute on function public.accept_relation_tx(uuid) to authenticated, service_role;

-- ─── 4. refund_relation_tx : rembourse aussi la commission ─────────────
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
  v_pro_id        uuid;
  v_campaign_id   uuid;
  v_reward        bigint;
  v_bonus         bigint;
  v_commission    bigint;
  v_status        relation_status;
begin
  if p_new_status not in ('pending', 'refused') then
    raise exception 'invalid_target_status' using errcode = 'P0001';
  end if;

  select r.pro_account_id, r.campaign_id, r.reward_cents,
         coalesce(r.referral_bonus_cents, 0), coalesce(r.commission_cents, 0), r.status
    into v_pro_id, v_campaign_id, v_reward, v_bonus, v_commission, v_status
    from relations r
    join pro_accounts a on a.id = r.pro_account_id
   where r.id = p_relation_id
   for update of r, a;

  if v_status is null then raise exception 'relation_not_found' using errcode = 'P0002'; end if;
  if v_status not in ('accepted', 'settled') then
    raise exception 'not_accepted' using errcode = 'P0001';
  end if;

  update relations
     set status     = p_new_status,
         decided_at = case when p_new_status = 'pending' then null else now() end,
         settled_at = null,
         referral_bonus_cents = 0,
         commission_cents = 0
   where id = p_relation_id;

  -- Rembourse au pro récompense + bonus parrain + commission BUUPP.
  update pro_accounts
     set wallet_balance_cents = wallet_balance_cents + v_reward + v_bonus + v_commission
   where id = v_pro_id;

  update campaigns
     set spent_cents = greatest(0, spent_cents - v_reward),
         commission_settled_cents = greatest(0, coalesce(commission_settled_cents, 0) - v_commission)
   where id = v_campaign_id;

  insert into transactions
    (account_id, account_kind, type, status, amount_cents,
     relation_id, campaign_id, description)
  values
    (v_pro_id, 'pro', 'refund', 'completed', v_reward + v_bonus,
     p_relation_id, v_campaign_id, 'Remboursement annulation acceptation');

  -- Contre-passation de la commission : écriture `buupp_commission` POSITIVE,
  -- de sorte que sum(buupp_commission) = revenu BUUPP net (KPI admin).
  if v_commission > 0 then
    insert into transactions
      (account_id, account_kind, type, status, amount_cents,
       relation_id, campaign_id, description)
    values
      (v_pro_id, 'pro', 'buupp_commission', 'completed', v_commission,
       p_relation_id, v_campaign_id, 'Remboursement commission BUUPP (acceptation annulée)');
  end if;

  -- Annule TOUTES les transactions prospect de la relation (filleul + parrain).
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

-- ─── 5. Formule unique ────────────────────────────────────────────────
-- Plus de frais d'accès ni de plafond de campagnes. Les colonnes/table sont
-- conservées (rétro-compatibilité des builds mobiles déjà publiés).
update public.plan_pricing
   set monthly_cents = 0,
       max_campaigns = 9999,
       max_prospects = greatest(max_prospects, 500);

alter table public.pro_accounts alter column plan set default 'pro';
update public.pro_accounts set plan = 'pro', plan_cycle_count = 0 where plan <> 'pro' or plan_cycle_count <> 0;
