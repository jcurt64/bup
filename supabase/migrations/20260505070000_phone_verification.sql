-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Vérification du numéro de téléphone par SMS (palier "Vérifié")
-- ════════════════════════════════════════════════════════════════════
-- Le palier `verifie` ne dépend plus du RIB mais de la vérification
-- du téléphone via un code SMS (4-6 chiffres) envoyé au prospect.
--
--  prospect_identity.phone_verified_at : horodatage de la dernière
--    vérification réussie. NULL = téléphone non vérifié. Réinitialisé
--    à NULL si le prospect change son numéro (côté API).
--
--  prospect_phone_otp : table de travail pour la session de vérif en
--    cours. 1 row par prospect (PK = prospect_id). Le code est stocké
--    hashé (SHA-256 hex) pour qu'aucune fuite de la table ne révèle
--    de codes en clair. TTL de 10 minutes piloté par `expires_at`.
-- ════════════════════════════════════════════════════════════════════

alter table public.prospect_identity
  add column if not exists phone_verified_at timestamptz;

create table if not exists public.prospect_phone_otp (
  prospect_id  uuid primary key
    references public.prospects(id) on delete cascade,
  phone        text not null check (length(phone) between 4 and 32),
  code_hash    text not null,
  expires_at   timestamptz not null,
  attempts     int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger prospect_phone_otp_set_updated_at
  before update on public.prospect_phone_otp
  for each row execute function public.tg_set_updated_at();

create index if not exists prospect_phone_otp_expires_idx
  on public.prospect_phone_otp (expires_at);

-- RLS — accès uniquement via le clerk_user_id du JWT (cohérent avec
-- les autres tables `prospect_*`). Toutes les écritures réelles passent
-- de toute façon par l'admin client côté API.
alter table public.prospect_phone_otp enable row level security;

create policy prospect_phone_otp_owner_all
  on public.prospect_phone_otp
  for all to authenticated
  using (
    exists (
      select 1 from public.prospects p
      where p.id = prospect_phone_otp.prospect_id
        and p.clerk_user_id = public.clerk_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.prospects p
      where p.id = prospect_phone_otp.prospect_id
        and p.clerk_user_id = public.clerk_user_id()
    )
  );
