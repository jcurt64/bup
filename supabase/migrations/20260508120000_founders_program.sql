-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Programme Fondateur (Phase 1 : schéma)
-- ════════════════════════════════════════════════════════════════════
-- Singleton `app_config` (date de lancement), flag `is_founder` sur
-- `prospects`, toggle `founder_bonus_enabled` sur `campaigns`, snapshot
-- `founder_bonus_applied` sur `relations`. Trigger sur
-- `prospect_identity` qui synchronise `prospects.is_founder` depuis la
-- waitlist (matching email + date). Helper SQL pour la fenêtre 1 mois.
-- La RPC `accept_relation_tx` est mise à jour dans une migration
-- séparée pour isoler l'évolution financière.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Table de configuration globale (singleton) ─────────────────
create table public.app_config (
  id boolean primary key default true check (id),
  launch_at timestamptz not null,
  updated_at timestamptz default now()
);

-- RLS : la table reste fermée à toute lecture/écriture côté client.
-- Seuls les fonctions SECURITY DEFINER (ex: is_within_founder_bonus_window)
-- ou le service_role (admin) y accèdent. Pas de policy → aucun rôle
-- authentifié n'a de droit direct sur la table.
alter table public.app_config enable row level security;

-- Seed initial : date placeholder très éloignée → fenêtre 1 mois
-- déjà expirée, donc aucun bonus n'est appliqué tant qu'un admin
-- n'a pas explicitement UPDATE la valeur (fail-safe).
insert into public.app_config (id, launch_at)
values (true, '1970-01-01T00:00:00Z')
on conflict (id) do nothing;

-- ─── 2. Flag fondateur sur le prospect ─────────────────────────────
alter table public.prospects
  add column is_founder boolean not null default false;

create index prospects_is_founder_idx on public.prospects (is_founder)
  where is_founder = true;

-- ─── 3. Toggle pro par campagne (default ON) ───────────────────────
alter table public.campaigns
  add column founder_bonus_enabled boolean not null default true;

-- ─── 4. Snapshot bonus appliqué (audit + email) ────────────────────
alter table public.relations
  add column founder_bonus_applied boolean not null default false;

-- ─── 5. Trigger : sync is_founder depuis prospect_identity.email ───
create or replace function public.sync_founder_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_launch_at timestamptz;
  v_email_in_waitlist boolean;
begin
  if new.email is null then
    update public.prospects
       set is_founder = false
     where id = new.prospect_id;
    return new;
  end if;

  select launch_at into v_launch_at from public.app_config where id = true;
  if v_launch_at is null then
    return new;
  end if;

  select exists (
    select 1 from public.waitlist w
     where lower(w.email) = lower(new.email)
       and w.created_at <= v_launch_at
  ) into v_email_in_waitlist;

  update public.prospects
     set is_founder = v_email_in_waitlist
   where id = new.prospect_id;

  return new;
end;
$$;

drop trigger if exists prospect_identity_sync_founder_status on public.prospect_identity;
create trigger prospect_identity_sync_founder_status
  after insert or update of email on public.prospect_identity
  for each row execute function public.sync_founder_status();

-- ─── 6. Helper : fenêtre 1 mois post-lancement ─────────────────────
create or replace function public.is_within_founder_bonus_window()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_config
     where now() <= launch_at + interval '1 month'
  );
$$;

revoke all on function public.is_within_founder_bonus_window() from public;
grant execute on function public.is_within_founder_bonus_window() to anon, authenticated;
