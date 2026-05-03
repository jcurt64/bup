-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Liste d'attente publique (pré-lancement)
-- ════════════════════════════════════════════════════════════════════
-- Pas d'auth requise pour s'inscrire (POST anonyme côté serveur, en
-- service_role). En lecture, seuls les compteurs agrégés sont exposés
-- via la fonction `waitlist_stats()` ; la table elle-même reste fermée.
-- ════════════════════════════════════════════════════════════════════

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  prenom text not null check (length(prenom) between 1 and 80),
  nom text not null check (length(nom) between 1 and 80),
  ville text not null check (length(ville) between 1 and 80),
  interests text[] not null default '{}',
  ref_code text,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Unicité de l'email insensible à la casse.
create unique index waitlist_email_lower_uidx on public.waitlist (lower(email));
create index waitlist_created_at_idx on public.waitlist (created_at desc);
create index waitlist_ville_idx on public.waitlist (ville);

alter table public.waitlist enable row level security;

-- Aucune policy → personne n'accède à la table directement (même pas
-- en lecture). Les inscriptions passent par le backend en service_role
-- (POST /api/waitlist) et les compteurs publics passent par la RPC
-- ci-dessous, qui est SECURITY DEFINER.

-- ─── Fonction publique : compteurs agrégés ─────────────────────────
-- Retourne le nombre d'inscrits + le nombre de villes distinctes.
-- SECURITY DEFINER → s'exécute avec les droits du créateur (postgres),
-- ce qui contourne RLS pour cette agrégation précise sans exposer la
-- moindre donnée personnelle.
create or replace function public.waitlist_stats()
returns table (total bigint, villes bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*)::bigint as total,
    count(distinct ville)::bigint as villes
  from public.waitlist;
$$;

-- Autorise les rôles `anon` (visiteurs non connectés) et `authenticated`
-- à appeler la fonction. Pas d'accès direct à la table sous-jacente.
revoke all on function public.waitlist_stats() from public;
grant execute on function public.waitlist_stats() to anon, authenticated;
