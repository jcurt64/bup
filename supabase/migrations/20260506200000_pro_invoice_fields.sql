-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Champs facturation obligatoires sur pro_accounts
-- ════════════════════════════════════════════════════════════════════
-- Le PDF de facture (lib/invoices/pdf.ts) doit pouvoir mentionner les
-- informations légales obligatoires : forme juridique, capital social,
-- SIRET (en plus du SIREN existant), RCS / RM. On les stocke côté
-- pro_accounts (mêmes Mes informations) pour que la saisie soit
-- réutilisée à chaque génération.
-- ════════════════════════════════════════════════════════════════════

alter table public.pro_accounts
  add column if not exists forme_juridique text,        -- SARL, SAS, EI, Auto-entrepreneur, …
  add column if not exists capital_social_cents bigint, -- nullable (EI / micro = pas de capital)
  add column if not exists siret text,                  -- 14 chiffres (SIREN + NIC)
  add column if not exists rcs_ville text,              -- ville d'immatriculation au RCS
  add column if not exists rm_number text;              -- numéro RM (artisans)
