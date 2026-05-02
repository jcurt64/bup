-- Verrouille le search_path des fonctions custom pour éviter le détournement
-- via une fonction homonyme placée dans un schéma temporaire (CWE-426).
-- Réf : https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

alter function public.tg_set_updated_at() set search_path = '';

-- Pour `clerk_user_id`, on doit qualifier `auth.jwt()` puisque le search_path
-- ne contient plus le schéma `auth`. CREATE OR REPLACE est idempotent.
create or replace function public.clerk_user_id()
returns text
language sql
stable
set search_path = ''
as $$
  select auth.jwt() ->> 'sub'
$$;
