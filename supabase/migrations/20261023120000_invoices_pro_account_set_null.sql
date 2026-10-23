-- Facturation — une facture survit à la suppression du compte pro.
--
-- `invoices.pro_account_id` référençait `pro_accounts(id)` sans ON DELETE
-- (= NO ACTION) : DELETE /api/me échouerait pour un pro ayant au moins une
-- facture (violation de FK sur la suppression de la ligne pro_accounts).
-- Les factures doivent être conservées 10 ans (art. L123-22 C. com.) : on
-- ne cascade PAS. La FK passe en ON DELETE SET NULL, la facture restant
-- juridiquement complète grâce au snapshot figé `buyer` (jsonb) pris à
-- l'émission.
--
-- Idempotent : rejouable sans effet de bord.

alter table public.invoices
  alter column pro_account_id drop not null;

-- Nom par défaut de la contrainte posée inline par 20260721130000 :
-- invoices_pro_account_id_fkey. On supprime aussi toute autre FK éventuelle
-- sur cette colonne vers pro_accounts (nom non standard), par sécurité.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
    where con.conrelid = 'public.invoices'::regclass
      and con.contype = 'f'
      and con.confrelid = 'public.pro_accounts'::regclass
      and att.attname = 'pro_account_id'
  loop
    execute format('alter table public.invoices drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.invoices
  add constraint invoices_pro_account_id_fkey
  foreign key (pro_account_id) references public.pro_accounts(id)
  on delete set null;
