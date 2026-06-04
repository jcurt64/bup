-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Clics sur les icônes de contact (audit + déclencheur anti-abus)
-- ════════════════════════════════════════════════════════════════════
-- Trace chaque clic du pro sur l'une des icônes de contact d'un prospect
-- acquis : téléphone, e-mail, SMS, WhatsApp.
--
-- Différent de pro_contact_actions (call_clicked/email_sent, qui sert au
-- quota e-mail + à l'audit du corps des mails) : ici on capture le CLIC de
-- n'importe quel canal, y compris SMS/WhatsApp qui n'étaient pas
-- tracés. Sert :
--   1. À l'admin « Contacts (clics) ».
--   2. De déclencheur au mail de rappel au pro : ≥ 3 clics sur un même
--      prospect en 24 h (tous canaux confondus).
--
-- RLS activée sans policy : accès via service_role uniquement, comme
-- pro_contact_actions / pro_contact_reveals.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.pro_contact_clicks (
  id uuid primary key default gen_random_uuid(),
  pro_account_id uuid not null references public.pro_accounts(id) on delete cascade,
  relation_id uuid not null references public.relations(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  channel text not null check (channel in ('call','email','sms','whatsapp')),
  created_at timestamptz not null default now()
);

-- Index principal : compteur "clics par (pro × prospect) sur 24 h".
create index if not exists pro_contact_clicks_pro_prospect_time_idx
  on public.pro_contact_clicks (pro_account_id, prospect_id, created_at desc);

-- Index liste admin triée par date.
create index if not exists pro_contact_clicks_created_idx
  on public.pro_contact_clicks (created_at desc);

alter table public.pro_contact_clicks enable row level security;
-- Aucune policy : seul service_role lit / écrit.
