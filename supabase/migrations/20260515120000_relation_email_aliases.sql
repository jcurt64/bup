-- Watermark cryptographique pour les emails révélés aux pros.
--
-- Au lieu de révéler le vrai email du prospect au pro, on lui montre un
-- alias unique de la forme `prospect+r{alias_short}@buupp.fr`. Les mails
-- envoyés à cet alias sont routés vers le vrai email du prospect par un
-- Cloudflare Email Worker (cf. cloudflare-workers/relation-email-router).
--
-- Si un prospect signale recevoir un mail venant d'une autre source que
-- l'alias BUUPP, on remonte instantanément au pro émetteur via la
-- `relation_id` (pas besoin de fouiller pro_contact_reveals).
--
-- `alias_short` = slug random base32 de 12 chars (~60 bits d'entropie),
-- généré côté API avec `crypto.randomBytes`. PRIMARY KEY pour garantir
-- l'unicité globale et un lookup O(1) côté Worker. UNIQUE également sur
-- relation_id pour garantir un seul alias par relation (idempotence).

create table public.relation_email_aliases (
  alias_short  text primary key check (alias_short ~ '^[a-z0-9]{8,16}$'),
  relation_id  uuid not null unique references public.relations(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index relation_email_aliases_relation_idx
  on public.relation_email_aliases(relation_id);

alter table public.relation_email_aliases enable row level security;
-- Pas de policy : seul le service_role (admin client + Cloudflare Worker
-- via API authentifiée par INBOUND_RELAY_SECRET) peut lire/écrire.
