-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Bonus fondateur : conditions de déblocage
-- ════════════════════════════════════════════════════════════════════
-- Le bonus de 5 € n'est plus crédité dès l'ouverture du compte. Il est
-- désormais PROVISIONNÉ en `pending` (visible dans le portefeuille mais
-- verrouillé) et se DÉBLOQUE quand les DEUX conditions sont réunies :
--   1. 3 mois calendaires révolus depuis `prospects.created_at` ;
--   2. au moins une relation `status ∈ ('accepted','settled')`.
-- `app_config.launch_at` reste un plancher : pas de déblocage avant le
-- lancement officiel.
--
-- Aucune reprise rétroactive : les lignes `signup_bonus` déjà `completed`
-- ne sont PAS touchées. Aucune expiration : un bonus dont les conditions
-- ne tombent jamais reste `pending` indéfiniment.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Source de vérité des conditions ───
-- Consommée par la RPC de déblocage ET par /api/prospect/wallet : la règle
-- n'est écrite qu'ici. `greatest` ignore les NULL en Postgres, donc un
-- `launch_at` absent revient simplement à ne pas appliquer de plancher.
create or replace function public.founder_bonus_unlock_state(p_prospect_id uuid)
returns table (
  unlock_at      timestamptz,
  has_acceptance boolean,
  met            boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select s.unlock_at,
         s.has_acceptance,
         (now() >= s.unlock_at and s.has_acceptance) as met
    from public.prospects p
    left join public.app_config c on c.id = true
    cross join lateral (
      select greatest(p.created_at + interval '3 months', c.launch_at) as unlock_at,
             exists (
               select 1
                 from public.relations r
                where r.prospect_id = p.id
                  and r.status in ('accepted', 'settled')
             ) as has_acceptance
    ) s
   where p.id = p_prospect_id;
$$;

-- ─── 2. Provisionnement (statut `pending`) ───
-- `founder_signup_bonus_applied` change de sémantique : il signifiait
-- « crédité », il signifie désormais « PROVISIONNÉ » (la ligne existe,
-- quel que soit son statut). Les lignes existantes à `true` correspondent
-- à des bonus `completed` — provisionnés ET débloqués — donc cohérentes.
create or replace function public.provision_founder_signup_bonus(p_prospect_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_founder boolean;
  v_applied    boolean;
begin
  select is_founder, founder_signup_bonus_applied
    into v_is_founder, v_applied
    from public.prospects
   where id = p_prospect_id
   for update;

  -- Pas trouvé, non fondateur, ou déjà provisionné → no-op.
  if not found or v_is_founder is not true or v_applied is true then
    return false;
  end if;

  insert into public.transactions
    (account_id, account_kind, type, status, amount_cents, description)
  values
    (p_prospect_id, 'prospect', 'signup_bonus', 'pending', 500,
     'Bonus fondateur à l''inscription');

  update public.prospects
     set founder_signup_bonus_applied = true
   where id = p_prospect_id;

  return true;
end;
$$;

-- ─── 3. Wrapper déprécié ───
-- Le code actuellement en production appelle encore
-- `apply_founder_signup_bonus`. On le conserve le temps que le nouveau
-- code soit déployé, sinon la fenêtre entre migration et déploiement
-- casserait le cron. À supprimer lors d'un prochain nettoyage.
create or replace function public.apply_founder_signup_bonus(p_prospect_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.provision_founder_signup_bonus(p_prospect_id);
$$;

-- ─── 4. Déblocage ensembliste ───
-- Calqué sur `settle_ripe_relations`. Ne renvoie QUE les lignes
-- effectivement transitionnées → exactement une notification par bonus.
-- La re-vérification `t.status = 'pending'` dans l'UPDATE est le garde-fou
-- de concurrence : en READ COMMITTED, un appel concurrent bloque sur le
-- verrou de ligne puis réévalue la clause, voit `completed`, et n'obtient
-- aucune ligne en RETURNING.
create or replace function public.unlock_ripe_founder_signup_bonuses()
returns table (
  prospect_id    uuid,
  transaction_id uuid,
  clerk_user_id  text,
  email          text,
  prenom         text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with ripe as (
    select t.id as tid
      from transactions t
     where t.type         = 'signup_bonus'
       and t.status       = 'pending'
       and t.account_kind = 'prospect'
       and (select s.met from public.founder_bonus_unlock_state(t.account_id) s)
  ),
  unlocked as (
    update transactions t
       set status = 'completed'
      from ripe
     where t.id     = ripe.tid
       and t.status = 'pending'
    returning t.id as tid, t.account_id as pid
  )
  select u.pid,
         u.tid,
         p.clerk_user_id,
         pi.email,
         pi.prenom
    from unlocked u
    join prospects p on p.id = u.pid
    left join prospect_identity pi on pi.prospect_id = u.pid;
end;
$$;

-- ─── 5. Index ───
-- Borne le balayage du job de déblocage aux seuls bonus en attente.
create index if not exists transactions_signup_bonus_pending_idx
  on public.transactions (account_id)
  where type = 'signup_bonus'
    and status = 'pending'
    and account_kind = 'prospect';

-- ─── 6. Droits ───
revoke all on function public.founder_bonus_unlock_state(uuid) from public, anon, authenticated;
revoke all on function public.provision_founder_signup_bonus(uuid) from public, anon, authenticated;
revoke all on function public.unlock_ripe_founder_signup_bonuses() from public, anon, authenticated;
grant execute on function public.founder_bonus_unlock_state(uuid) to service_role;
grant execute on function public.provision_founder_signup_bonus(uuid) to service_role;
grant execute on function public.unlock_ripe_founder_signup_bonuses() to service_role;
