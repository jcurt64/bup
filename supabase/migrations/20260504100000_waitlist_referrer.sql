-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Parrainage sur la liste d'attente
-- ════════════════════════════════════════════════════════════════════
-- Ajoute le champ `referrer_ref_code` qui mémorise le code de parrainage
-- utilisé par chaque inscrit (cf. lien `buupp.fr/ref/<code>` partagé par
-- son parrain). Plafond strict : 10 filleuls par parrain → au-delà,
-- l'inscription est rejetée par un trigger BEFORE INSERT.
-- ════════════════════════════════════════════════════════════════════

alter table public.waitlist
  add column referrer_ref_code text;

create index waitlist_referrer_ref_code_idx
  on public.waitlist (referrer_ref_code)
  where referrer_ref_code is not null;

-- Trigger : refuse l'INSERT dès qu'un code de parrainage atteint 10
-- filleuls. La levée d'exception annule la transaction proprement.
-- Code SQLSTATE custom (P0001) → l'API peut le détecter sans fragilité.
create or replace function public.waitlist_enforce_referrer_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if new.referrer_ref_code is null then
    return new;
  end if;

  -- Empêche l'auto-parrainage : un email ne peut pas se parrainer lui-même.
  if new.referrer_ref_code = new.ref_code then
    raise exception 'self_referral'
      using errcode = 'P0001',
            hint = 'Vous ne pouvez pas être votre propre parrain.';
  end if;

  -- Comptage des filleuls existants pour ce code de parrainage.
  -- En cas d'inscriptions concurrentes, le trigger est re-évalué dans
  -- chaque transaction : si 11 inscriptions arrivent en parallèle, l'une
  -- d'elles tombera après commit de l'autre et lèvera l'exception.
  select count(*) into v_count
  from public.waitlist
  where referrer_ref_code = new.referrer_ref_code;

  if v_count >= 10 then
    raise exception 'referrer_cap_reached'
      using errcode = 'P0001',
            hint = 'Nombre maximal de filleul déjà atteint (10).';
  end if;

  return new;
end;
$$;

drop trigger if exists waitlist_enforce_referrer_cap on public.waitlist;
create trigger waitlist_enforce_referrer_cap
  before insert on public.waitlist
  for each row execute function public.waitlist_enforce_referrer_cap();
