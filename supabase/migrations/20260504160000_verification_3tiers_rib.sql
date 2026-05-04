-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Modèle de vérification à 3 paliers + table RIB
-- ════════════════════════════════════════════════════════════════════
-- Le PO a remplacé le modèle 4 paliers (basique/vérifié/certifié/confiance)
-- par un modèle 3 paliers où "certifié" et "confiance" fusionnent en
-- "certifie_confiance". Les anciennes valeurs sont conservées comme alias
-- (l'enum garde 5 valeurs en mémoire) ; toute donnée existante est
-- migrée vers la nouvelle valeur cible avant figement.
--
-- Règles métier (recalculées côté API à chaque GET) :
--   - basique          : par défaut à la création de compte (Clerk →
--                        ensureProspect).
--   - verifie          : un RIB validé est attaché au prospect.
--   - certifie_confiance : le prospect a accepté au moins 1 mise en
--                          relation issue d'une campagne de type
--                          `prise_de_rendez_vous` (= rendez-vous physique).
-- ════════════════════════════════════════════════════════════════════

-- 1. Ajout de la nouvelle valeur d'enum (Postgres ne permet pas de
--    supprimer un label existant en place, on conserve donc les anciens).
alter type public.verification_level add value if not exists 'certifie_confiance';

-- 2. Normalise les rows existantes : tout ce qui était `certifie` ou
--    `confiance` devient `certifie_confiance`. La nouvelle UI ne
--    référencera plus jamais les deux anciennes valeurs.
update public.prospects
set verification = 'certifie_confiance'::public.verification_level
where verification in (
  'certifie'::public.verification_level,
  'confiance'::public.verification_level
);

-- 3. Table RIB — 1 row par prospect (clé = prospect_id).
create table public.prospect_rib (
  prospect_id uuid primary key
    references public.prospects(id) on delete cascade,
  iban text not null check (length(iban) between 14 and 34),
  bic text check (bic is null or length(bic) between 8 and 11),
  holder_name text not null check (length(holder_name) between 1 and 120),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prospect_rib_validated_idx
  on public.prospect_rib (validated_at)
  where validated_at is not null;

-- 4. RLS — accès uniquement via le clerk_user_id du JWT.
alter table public.prospect_rib enable row level security;

create policy prospect_rib_owner_all
  on public.prospect_rib
  for all to authenticated
  using (
    exists (
      select 1 from public.prospects p
      where p.id = prospect_rib.prospect_id
        and p.clerk_user_id = public.clerk_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.prospects p
      where p.id = prospect_rib.prospect_id
        and p.clerk_user_id = public.clerk_user_id()
    )
  );
