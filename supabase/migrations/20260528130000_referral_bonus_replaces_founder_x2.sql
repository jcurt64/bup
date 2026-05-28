-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Bonus parrain (remplace le ×2 fondateur + le palier VIP +5 €)
-- ════════════════════════════════════════════════════════════════════
-- Quand un FILLEUL accepte une campagne pour sa **1ʳᵉ acceptation**, son
-- PARRAIN touche **50 % de la récompense du filleul** (BUUPP coins).
-- Conditions cumulatives :
--   - le pro a activé le bonus fondateur sur la campagne (founder_bonus_enabled) ;
--   - fenêtre 1 mois post-lancement (is_within_founder_bonus_window) ;
--   - 1ʳᵉ acceptation du filleul (aucune relation accepted/settled) ;
--   - le parrain a un compte prospect.
-- Le PRO finance le bonus (débit wallet supplémentaire).
-- Remplace le ×2 fondateur + VIP +5 € (supprimés). Conserve le ×2
-- « certifié confiance » (indépendant).
--
-- Cette migration touche 3 RPC + 1 colonne, pour rester cohérente sur tout
-- le cycle de vie financier (revue opus) :
--   1. relations.referral_bonus_cents : mémorise le bonus versé sur la
--      relation, pour que le refund puisse le rembourser symétriquement.
--   2. accept_relation_tx : calcule/verse le bonus. `spent_cents` ne compte
--      QUE la récompense (le bonus ne doit pas violer la contrainte
--      spent_cents <= budget_cents). Le wallet pro est débité du total.
--   3. refund_relation_tx : rembourse au pro récompense **+ bonus** et
--      annule les escrows prospect de la relation (filleul + parrain, déjà
--      annulés par relation_id).
--   4. settle_ripe_relations : libère TOUT l'escrow prospect de la relation
--      (récompense filleul + bonus parrain).
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Colonne de mémorisation du bonus sur la relation ───────────
alter table public.relations
  add column if not exists referral_bonus_cents bigint not null default 0;

-- ─── 2. accept_relation_tx ─────────────────────────────────────────
create or replace function public.accept_relation_tx(p_relation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pro_id         uuid;
  v_prospect_id    uuid;
  v_campaign_id    uuid;
  v_reward         bigint;
  v_status         relation_status;
  v_camp_status    campaign_status;
  v_camp_ends_at   timestamptz;
  v_wallet         bigint;
  v_bonus_enabled  boolean;
  v_in_window      boolean;
  v_verification   public.verification_level;
  v_reward_final   bigint;
  v_referrer_code  text;
  v_parrain_id     uuid;
  v_is_first       boolean := false;
  v_referral_bonus bigint := 0;
  v_total_debit    bigint;
begin
  select r.pro_account_id, r.prospect_id, r.campaign_id,
         c.cost_per_contact_cents, r.status,
         c.status, c.ends_at, a.wallet_balance_cents,
         c.founder_bonus_enabled, p.verification
    into v_pro_id, v_prospect_id, v_campaign_id,
         v_reward, v_status,
         v_camp_status, v_camp_ends_at, v_wallet,
         v_bonus_enabled, v_verification
    from relations r
    join campaigns  c on c.id = r.campaign_id
    join pro_accounts a on a.id = r.pro_account_id
    join prospects  p on p.id = r.prospect_id
   where r.id = p_relation_id
   for update of r, c, a, p;

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

  -- Récompense du filleul (×2 certifié confiance conservé).
  v_reward_final := v_reward;
  if v_verification = 'certifie_confiance' then
    v_reward_final := v_reward_final * 2;
  end if;

  -- Bonus parrain (remplace ×2 fondateur + VIP).
  v_in_window := public.is_within_founder_bonus_window();
  if v_bonus_enabled and v_in_window then
    select not exists (
      select 1 from public.relations r2
       where r2.prospect_id = v_prospect_id
         and r2.id <> p_relation_id
         and r2.status in ('accepted', 'settled')
    ) into v_is_first;

    if v_is_first then
      select w.referrer_ref_code into v_referrer_code
        from public.prospect_identity pi
        join public.waitlist w on lower(w.email) = lower(pi.email)
       where pi.prospect_id = v_prospect_id
       limit 1;

      if v_referrer_code is not null then
        -- prospect_id du parrain (propriétaire du ref_code). Doit avoir un
        -- compte prospect. `order by` déterministe au cas (improbable) où
        -- prospect_identity.email ne serait pas unique.
        select pi2.prospect_id into v_parrain_id
          from public.waitlist wp
          join public.prospect_identity pi2 on lower(pi2.email) = lower(wp.email)
         where wp.ref_code = v_referrer_code
         order by pi2.prospect_id
         limit 1;

        if v_parrain_id is not null and v_parrain_id <> v_prospect_id then
          v_referral_bonus := v_reward_final / 2;  -- 50 % (division entière)
        end if;
      end if;
    end if;
  end if;

  -- Solde pro : doit couvrir récompense + bonus.
  v_total_debit := v_reward_final + v_referral_bonus;
  if v_wallet < v_total_debit then
    raise exception 'insufficient_pro_funds' using errcode = 'P0001';
  end if;

  update public.relations
     set status                    = 'accepted',
         decided_at                = now(),
         settled_at                = null,
         reward_cents              = v_reward_final,
         referral_bonus_cents      = v_referral_bonus,
         -- Le filleul ne touche AUCUN bonus fondateur sur sa propre
         -- récompense (le bonus va au parrain, tracé par
         -- referral_bonus_cents). On laisse donc ces deux flags à false
         -- pour ne pas afficher un badge "bonus fondateur" trompeur au
         -- filleul.
         founder_bonus_applied     = false,
         founder_vip_bonus_applied = false
   where id = p_relation_id;

  -- Débit wallet pro = récompense + bonus.
  update public.pro_accounts
     set wallet_balance_cents = wallet_balance_cents - v_total_debit
   where id = v_pro_id;

  -- `spent_cents` ne compte QUE la récompense (budget contacts) — pas le
  -- bonus (sinon violation possible de spent_cents <= budget_cents).
  update public.campaigns
     set spent_cents = spent_cents + v_reward_final
   where id = v_campaign_id;

  -- Transactions : récompense filleul.
  insert into public.transactions
    (account_id, account_kind, type, status, amount_cents,
     relation_id, campaign_id, description)
  values
    (v_pro_id, 'pro', 'escrow', 'completed', -v_reward_final,
     p_relation_id, v_campaign_id, 'Séquestre acceptation campagne'),
    (v_prospect_id, 'prospect', 'escrow', 'pending', v_reward_final,
     p_relation_id, v_campaign_id, 'Séquestre récompense — en attente de débit');

  -- Transactions : bonus parrain (si applicable).
  if v_referral_bonus > 0 then
    insert into public.transactions
      (account_id, account_kind, type, status, amount_cents,
       relation_id, campaign_id, description)
    values
      (v_pro_id, 'pro', 'escrow', 'completed', -v_referral_bonus,
       p_relation_id, v_campaign_id, 'Financement bonus parrain'),
      (v_parrain_id, 'prospect', 'escrow', 'pending', v_referral_bonus,
       p_relation_id, v_campaign_id, 'Bonus parrain — 50% 1ère acceptation filleul');
  end if;
end;
$$;

revoke all on function public.accept_relation_tx(uuid) from public;
revoke execute on function public.accept_relation_tx(uuid) from anon;
grant  execute on function public.accept_relation_tx(uuid) to authenticated, service_role;

-- ─── 3. refund_relation_tx (rembourse récompense + bonus) ──────────
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
  v_status        relation_status;
begin
  if p_new_status not in ('pending', 'refused') then
    raise exception 'invalid_target_status' using errcode = 'P0001';
  end if;

  select r.pro_account_id, r.campaign_id, r.reward_cents,
         coalesce(r.referral_bonus_cents, 0), r.status
    into v_pro_id, v_campaign_id, v_reward, v_bonus, v_status
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
         referral_bonus_cents = 0
   where id = p_relation_id;

  -- Rembourse au pro la récompense + le bonus parrain qu'il a financé.
  update pro_accounts
     set wallet_balance_cents = wallet_balance_cents + v_reward + v_bonus
   where id = v_pro_id;

  -- `spent_cents` ne contenait que la récompense (cf. accept) → on ne
  -- décrémente que la récompense.
  update campaigns
     set spent_cents = greatest(0, spent_cents - v_reward)
   where id = v_campaign_id;

  insert into transactions
    (account_id, account_kind, type, status, amount_cents,
     relation_id, campaign_id, description)
  values
    (v_pro_id, 'pro', 'refund', 'completed', v_reward + v_bonus,
     p_relation_id, v_campaign_id, 'Remboursement annulation acceptation');

  -- Annule TOUTES les transactions prospect de la relation (filleul +
  -- parrain), qu'elles soient en escrow pending ou credit completed.
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

-- ─── 4. settle_ripe_relations (libère filleul + parrain) ───────────
create or replace function public.settle_ripe_relations()
returns table (
  relation_id     uuid,
  campaign_id     uuid,
  prospect_id     uuid,
  prospect_email  text,
  prospect_prenom text,
  pro_name        text,
  reward_cents    bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with ripe as (
    select r.id            as rid,
           r.pro_account_id,
           r.prospect_id,
           r.campaign_id,
           r.reward_cents
      from relations r
      join campaigns c on c.id = r.campaign_id
     where r.status = 'accepted'
       and c.created_at <= now() - interval '3 minutes'
     for update of r
  ),
  settled as (
    update relations r
       set status      = 'settled',
           settled_at  = now()
      from ripe
     where r.id = ripe.rid
    returning r.id              as rid,
             r.pro_account_id,
             r.prospect_id,
             r.campaign_id,
             r.reward_cents
  ),
  -- Convertit TOUT l'escrow prospect (pending) de la relation en credit
  -- completed : récompense du filleul + bonus du parrain (account_id ≠
  -- prospect de la relation). On ne filtre donc plus par account_id.
  tx_update as (
    update transactions t
       set type        = 'credit',
           status      = 'completed',
           description = case
                           when t.description like 'Bonus parrain%'
                             then 'Bonus parrain crédité — délai de validation écoulé'
                           else 'Crédité — délai de validation écoulé'
                         end
      from settled s
     where t.relation_id  = s.rid
       and t.account_kind = 'prospect'
       and t.type         = 'escrow'
       and t.status       = 'pending'
    returning t.id
  )
  select s.rid,
         s.campaign_id,
         s.prospect_id,
         pi.email,
         pi.prenom,
         a.raison_sociale,
         s.reward_cents
    from settled s
    left join prospect_identity pi on pi.prospect_id = s.prospect_id
    left join pro_accounts      a  on a.id           = s.pro_account_id;
end;
$$;

revoke execute on function public.settle_ripe_relations() from public, anon;
grant  execute on function public.settle_ripe_relations() to authenticated, service_role;
