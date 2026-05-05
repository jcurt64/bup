-- Audit log: chaque révélation (clic) d'un email/téléphone par un pro.
-- Cf. docs/superpowers/specs/2026-05-05-pro-contact-reveal-design.md.
create table public.pro_contact_reveals (
  id              uuid primary key default gen_random_uuid(),
  pro_account_id  uuid not null references public.pro_accounts(id) on delete cascade,
  relation_id     uuid not null references public.relations(id)    on delete cascade,
  field           text not null check (field in ('email','telephone')),
  revealed_at     timestamptz not null default now()
);

create index pro_contact_reveals_pro_idx
  on public.pro_contact_reveals(pro_account_id, revealed_at desc);
create index pro_contact_reveals_relation_idx
  on public.pro_contact_reveals(relation_id, revealed_at desc);

alter table public.pro_contact_reveals enable row level security;
-- Pas de policy: seul le service_role (admin client) peut écrire/lire,
-- comme pour les autres tables d'audit/sensibles existantes.
