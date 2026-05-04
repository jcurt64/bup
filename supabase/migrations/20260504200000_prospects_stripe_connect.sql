-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Stripe Connect Express pour les retraits prospects
-- ════════════════════════════════════════════════════════════════════
-- Ajoute les 3 colonnes nécessaires au flow de paiement vers les
-- particuliers via Stripe Connect Express. Le `stripe_connect_account_id`
-- est créé au 1er retrait (cf. /api/prospect/payout/onboarding) et
-- mis à jour par le webhook `account.updated` (payouts_enabled,
-- details_submitted) au fur et à mesure que l'utilisateur complète
-- son onboarding KYC chez Stripe.
-- ════════════════════════════════════════════════════════════════════

alter table public.prospects
  add column stripe_connect_account_id text unique,
  add column stripe_payouts_enabled boolean not null default false,
  add column stripe_details_submitted boolean not null default false;

create index prospects_stripe_connect_account_idx
  on public.prospects (stripe_connect_account_id)
  where stripe_connect_account_id is not null;
