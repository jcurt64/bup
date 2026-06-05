-- Escalade « non-réponse prospect » : compteur de strikes + paliers appliqués,
-- malus de score persistant, fenêtre de restriction d'acceptation.
--
-- Strike = une évaluation pro « non atteint » (tous pros confondus). Un contact
-- ne compte qu'une fois via relations.non_atteint_counted.
--
-- ⚠ Migrations BUUPP : appliquer via MCP/SQL Editor (jamais db push).

alter table public.prospects
  add column if not exists non_response_strikes int not null default 0,
  add column if not exists non_response_level smallint not null default 0,
  add column if not exists score_malus int not null default 0,
  add column if not exists accept_restricted_until timestamptz;

alter table public.relations
  add column if not exists non_atteint_counted boolean not null default false;

-- Accélère le balayage cron des restrictions expirées.
create index if not exists prospects_accept_restricted_until_idx
  on public.prospects (accept_restricted_until)
  where accept_restricted_until is not null;
