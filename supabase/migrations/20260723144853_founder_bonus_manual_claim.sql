-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Bonus fondateur : déblocage MANUEL par le prospect
-- ════════════════════════════════════════════════════════════════════
-- Le déblocage n'est plus automatique. Quand les deux conditions sont
-- réunies, le bonus devient « débloquable » et c'est au prospect de le
-- récupérer depuis son portefeuille.
--
-- Conséquences :
--   - `unlock_ripe_founder_signup_bonuses()` disparaît (elle basculait
--     d'office les bonus mûrs) ;
--   - `claim_founder_signup_bonus()` la remplace : appelée à la demande,
--     elle revérifie les conditions côté serveur avant de créditer ;
--   - `flag_ripe_founder_bonuses_for_notice()` sert au cron à prévenir
--     UNE SEULE FOIS le prospect que son bonus est devenu débloquable.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Marqueur de notification (une seule alerte par compte) ───
alter table public.prospects
  add column if not exists founder_bonus_unlockable_notified_at timestamptz;

-- ─── 2. Déblocage à la demande ───
-- Revérifie `met` côté serveur : le bouton de l'interface n'est jamais la
-- source de vérité. Renvoie true uniquement si une ligne a réellement été
-- créditée, donc rejouer l'appel ne double-crédite pas.
create or replace function public.claim_founder_signup_bonus(p_prospect_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_met boolean;
  v_id  uuid;
begin
  select s.met into v_met
    from public.founder_bonus_unlock_state(p_prospect_id) s;

  if v_met is not true then
    return false;
  end if;

  update public.transactions
     set status = 'completed'
   where id = (
     select t.id
       from public.transactions t
      where t.account_id   = p_prospect_id
        and t.account_kind = 'prospect'
        and t.type         = 'signup_bonus'
        and t.status       = 'pending'
      order by t.created_at
      limit 1
      for update skip locked
   )
     and status = 'pending'
  returning id into v_id;

  return v_id is not null;
end;
$$;

-- ─── 3. Signalement « devenu débloquable » (cron) ───
-- Ne renvoie que les prospects nouvellement éligibles et pose le marqueur
-- dans la même requête → exactement une notification par compte.
create or replace function public.flag_ripe_founder_bonuses_for_notice()
returns table (
  prospect_id   uuid,
  clerk_user_id text,
  email         text,
  prenom        text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with ripe as (
    select distinct t.account_id as pid
      from transactions t
      join prospects p on p.id = t.account_id
     where t.type         = 'signup_bonus'
       and t.status       = 'pending'
       and t.account_kind = 'prospect'
       and p.founder_bonus_unlockable_notified_at is null
       and (select s.met from public.founder_bonus_unlock_state(t.account_id) s)
  ),
  flagged as (
    update prospects p
       set founder_bonus_unlockable_notified_at = now()
      from ripe
     where p.id = ripe.pid
       and p.founder_bonus_unlockable_notified_at is null
    returning p.id as pid, p.clerk_user_id as cuid
  )
  select f.pid,
         f.cuid,
         pi.email,
         pi.prenom
    from flagged f
    left join prospect_identity pi on pi.prospect_id = f.pid;
end;
$$;

-- ─── 4. Retrait du déblocage automatique ───
drop function if exists public.unlock_ripe_founder_signup_bonuses();

-- ─── 5. Droits ───
revoke all on function public.claim_founder_signup_bonus(uuid) from public, anon, authenticated;
revoke all on function public.flag_ripe_founder_bonuses_for_notice() from public, anon, authenticated;
grant execute on function public.claim_founder_signup_bonus(uuid) to service_role;
grant execute on function public.flag_ripe_founder_bonuses_for_notice() to service_role;
