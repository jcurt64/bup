-- Bonus parrain v2 — « reach étendu ».
--
-- Modèle :
--   • À l'activation du bonus parrain sur une campagne, lorsqu'un PARRAIN est
--     ciblé, ses FILLEULS sont aussi sollicités (relations `referral_extra`),
--     même hors cible, avec mail + message dédiés.
--   • À CHAQUE acceptation d'un FILLEUL (qui a un parrain via la waitlist), son
--     parrain touche un bonus de +50 % de la récompense du filleul (à la charge
--     du pro). À vie (aucune fenêtre), à chaque acceptation (pas seulement la 1re).
--   • Les filleuls touchent la récompense normale (1×).
--   • Les acceptations (ciblés + filleuls) ne dépassent JAMAIS le quota payé de
--     la campagne (`contact_quota`).

-- relations : marqueur des sollicitations « extra » (filleuls ajoutés via le
-- reach parrain). `referral_parrain_bonus` est conservé (réservé / non lu par la
-- RPC : le bonus est calculé à l'acceptation du filleul via la waitlist).
alter table public.relations
  add column if not exists referral_extra boolean not null default false,
  add column if not exists referral_parrain_bonus boolean not null default false;

-- campaigns : quota d'acceptations = nombre de contacts payés (budget/cpc).
-- Plafonne les acceptations (ciblés + filleuls). Null = pas de plafond (campagnes
-- antérieures à la réforme du bonus → comportement inchangé).
alter table public.campaigns
  add column if not exists contact_quota integer;

-- RPC d'acceptation : garde-quota + bonus parrain +50 % versé au PARRAIN à
-- chaque acceptation d'un de ses filleuls (à vie). Reprend la dérivation
-- parrain d'origine (waitlist ref_code) sans la fenêtre ni la condition « 1re
-- acceptation ».
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
  v_total_debit       bigint;
begin
  select r.pro_account_id, r.prospect_id, r.campaign_id, c.cost_per_contact_cents,
         r.status, c.status, c.ends_at, a.wallet_balance_cents,
         c.founder_bonus_enabled, p.verification, c.contact_quota
    into v_pro_id, v_prospect_id, v_campaign_id, v_reward,
         v_status, v_camp_status, v_camp_ends_at, v_wallet,
         v_bonus_enabled, v_verification, v_quota
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

  -- Garde-quota : jamais plus d'acceptations que le quota payé. Le verrou
  -- `for update of c` sérialise les acceptations d'une même campagne.
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

  -- Bonus parrain : campagne avec bonus actif ET prospect qui accepte = FILLEUL
  -- (a un parrain via la waitlist) → le parrain touche +50 % de la récompense du
  -- filleul. À CHAQUE acceptation d'un filleul, à vie.
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

  v_total_debit := v_reward_final + v_referral_bonus;
  if v_wallet < v_total_debit then
    raise exception 'insufficient_pro_funds' using errcode = 'P0001';
  end if;

  update public.relations
     set status='accepted', decided_at=now(), settled_at=null,
         reward_cents=v_reward_final, referral_bonus_cents=v_referral_bonus,
         founder_bonus_applied=false, founder_vip_bonus_applied=false
   where id = p_relation_id;

  update public.pro_accounts
     set wallet_balance_cents = wallet_balance_cents - v_total_debit
   where id = v_pro_id;

  update public.campaigns
     set spent_cents = spent_cents + v_reward_final
   where id = v_campaign_id;

  insert into public.transactions
    (account_id, account_kind, type, status, amount_cents, relation_id, campaign_id, description)
  values
    (v_pro_id, 'pro', 'escrow', 'completed', -v_reward_final, p_relation_id, v_campaign_id, 'Séquestre acceptation campagne'),
    (v_prospect_id, 'prospect', 'escrow', 'pending', v_reward_final, p_relation_id, v_campaign_id, 'Séquestre récompense — en attente de débit');

  if v_referral_bonus > 0 then
    insert into public.transactions
      (account_id, account_kind, type, status, amount_cents, relation_id, campaign_id, description)
    values
      (v_pro_id, 'pro', 'escrow', 'completed', -v_referral_bonus, p_relation_id, v_campaign_id, 'Financement bonus parrain'),
      (v_parrain_id, 'prospect', 'escrow', 'pending', v_referral_bonus, p_relation_id, v_campaign_id, 'Bonus parrain — acceptation d''un filleul');
  end if;
end;
$function$;
