-- Facturation électronique — Phase 0 : fondation données.
-- Cf. docs/facturation-electronique.md. N'enclenche AUCUNE transmission :
-- pose seulement le modèle (n° TVA, entité facture persistée, numérotation
-- légale séquentielle). La transmission via PDP arrive en Phase 1/2.

-- 1. N° TVA intracommunautaire du pro (acheteur). Null = non assujetti / inconnu.
alter table public.pro_accounts
  add column if not exists numero_tva text;

-- 2. Entité facture persistée. Les `seller`/`buyer`/`lines` sont des snapshots
--    JSONB FIGÉS au moment de l'émission (immuables même si la fiche société
--    change ensuite — exigence légale d'intégrité de la facture).
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  pro_account_id uuid not null references public.pro_accounts(id),
  transaction_id uuid references public.transactions(id),
  type text not null default 'commission',     -- commission | service | ...
  status text not null default 'issued',        -- draft | issued | canceled
  issued_at timestamptz not null default now(),
  currency text not null default 'EUR',
  amount_ht_cents integer not null default 0,
  tva_rate numeric(5,2) not null default 0,     -- ex 20.00 ; 0 si franchise en base
  amount_tva_cents integer not null default 0,
  amount_ttc_cents integer not null default 0,
  seller jsonb not null default '{}'::jsonb,
  buyer jsonb not null default '{}'::jsonb,
  lines jsonb not null default '[]'::jsonb,
  -- Réservé facturation électronique (réforme 2026/2027) — rempli en Phase 2.
  pdp_provider text,
  pdp_invoice_id text,
  lifecycle_status text,                         -- déposée | reçue | encaissée | refusée ...
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invoices_pro_account_id_idx on public.invoices(pro_account_id);
create index if not exists invoices_transaction_id_idx on public.invoices(transaction_id);

-- Accès exclusivement via service_role (comme le reste du métier facturation).
-- RLS activée sans policy = verrouillé pour anon/authenticated, service_role bypass.
alter table public.invoices enable row level security;

-- 3. Numérotation séquentielle légale : chronologique, sans trou, par année.
--    Un compteur dédié (verrou de ligne via UPDATE ... RETURNING) plutôt
--    qu'une SEQUENCE Postgres (qui laisse des trous en cas de rollback).
create table if not exists public.invoice_counters (
  year integer primary key,
  last_number integer not null default 0
);
alter table public.invoice_counters enable row level security;

create or replace function public.next_invoice_number(p_prefix text default 'BUUPP')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from now())::int;
  v_next integer;
begin
  insert into public.invoice_counters(year, last_number)
    values (v_year, 0)
    on conflict (year) do nothing;
  update public.invoice_counters
    set last_number = last_number + 1
    where year = v_year
    returning last_number into v_next;
  return p_prefix || '-' || v_year::text || '-' || lpad(v_next::text, 6, '0');
end;
$$;
