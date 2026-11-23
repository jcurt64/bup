-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Comptes de test cloisonnés (pro / prospect fictifs)
-- ════════════════════════════════════════════════════════════════════
-- `is_test` = compte fictif. Le code (lib/test-accounts) garantit :
--   pro de test  → ne sollicite / notifie que des prospects de test ;
--   vrai pro     → ne sollicite jamais un prospect de test ;
--   annonces publiques d'un pro de test → invisibles des vrais comptes.
-- Additif, sans risque. Application : SQL Editor puis
--   insert into supabase_migrations.schema_migrations (version, name)
--   values ('20261123120000', 'test_accounts_flag') on conflict do nothing;
-- ════════════════════════════════════════════════════════════════════

alter table public.prospects
  add column if not exists is_test boolean not null default false;
alter table public.pro_accounts
  add column if not exists is_test boolean not null default false;

create index if not exists prospects_is_test_idx
  on public.prospects (is_test) where is_test;
create index if not exists pro_accounts_is_test_idx
  on public.pro_accounts (is_test) where is_test;

-- Rattrapage : prospects existants inscrits avec une adresse de test
-- (ex. le compte démo App Store `demoprospect+clerk_test@…`).
update public.prospects p
   set is_test = true
  from public.prospect_identity i
 where i.prospect_id = p.id
   and i.email ~* '\+(clerk_)?test[0-9]*@';

-- Pro démo App Store (son e-mail n'est pas stocké en base).
update public.pro_accounts
   set is_test = true
 where raison_sociale = 'BUUPP Démo';
