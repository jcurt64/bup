-- Trigger commun qui refuse une INSERT sur prospects ou pro_accounts
-- si l'utilisateur Clerk existe déjà dans l'autre table de rôle.
-- Code SQL 23505 (unique_violation) → catché côté app pour 409.

create or replace function public.assert_role_exclusivity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other_table text;
  v_exists boolean;
begin
  if tg_table_name = 'prospects' then
    other_table := 'pro_accounts';
  elsif tg_table_name = 'pro_accounts' then
    other_table := 'prospects';
  else
    return new;
  end if;

  execute format(
    'select exists (select 1 from public.%I where clerk_user_id = $1)',
    other_table
  ) into v_exists using new.clerk_user_id;

  if v_exists then
    raise exception 'role_conflict: user % already has a % profile',
      new.clerk_user_id, other_table
      using errcode = '23505';
  end if;

  return new;
end;
$$;

create trigger prospects_role_exclusivity
  before insert on public.prospects
  for each row execute function public.assert_role_exclusivity();

create trigger pro_accounts_role_exclusivity
  before insert on public.pro_accounts
  for each row execute function public.assert_role_exclusivity();
