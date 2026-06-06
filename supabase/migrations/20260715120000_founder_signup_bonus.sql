-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Bonus fondateur 5 € à l'inscription
-- ════════════════════════════════════════════════════════════════════
-- Crédite 5,00 € (500 cents) sur le portefeuille des prospects fondateurs
-- (is_founder = true, càd email présent en waitlist). Versement fictif :
-- pas de mouvement Stripe réel. Idempotent via prospects.founder_signup_bonus_applied.
--
-- NB : le timestamp du fichier (2026-07-15) ne sert qu'au TRI des migrations
-- (placé après la migration CNIL différée du 2026-07-14). Cette migration est
-- à appliquer IMMÉDIATEMENT, ce n'est PAS une migration différée.
-- ════════════════════════════════════════════════════════════════════

-- 1. Nouvelle valeur d'enum. `add value` ne peut pas être utilisée dans la
--    même transaction que son premier usage : on l'isole ici (à exécuter
--    en premier dans le SQL Editor).
alter type public.transaction_type add value if not exists 'signup_bonus';

-- 2. Drapeau d'idempotence sur le prospect.
alter table public.prospects
  add column if not exists founder_signup_bonus_applied boolean not null default false;

-- 3. RPC idempotente. SECURITY DEFINER : appelée depuis le backend
--    service_role, écrit la transaction + pose le flag de façon atomique.
create or replace function public.apply_founder_signup_bonus(p_prospect_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_founder boolean;
  v_applied boolean;
begin
  select is_founder, founder_signup_bonus_applied
    into v_is_founder, v_applied
    from public.prospects
   where id = p_prospect_id
   for update;

  -- Pas trouvé, non fondateur, ou déjà crédité → no-op.
  if not found or v_is_founder is not true or v_applied is true then
    return false;
  end if;

  insert into public.transactions
    (account_id, account_kind, type, status, amount_cents, description)
  values
    (p_prospect_id, 'prospect', 'signup_bonus', 'completed', 500,
     'Bonus fondateur à l''inscription');

  update public.prospects
     set founder_signup_bonus_applied = true
   where id = p_prospect_id;

  return true;
end;
$$;

revoke all on function public.apply_founder_signup_bonus(uuid) from public, anon, authenticated;
-- Appelée exclusivement depuis le backend (service_role). Grant explicite par
-- cohérence avec les autres RPC backend du projet (service_role bypass RLS).
grant execute on function public.apply_founder_signup_bonus(uuid) to service_role;
