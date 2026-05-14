-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Audit des actions du pro sur une relation acceptée
-- ════════════════════════════════════════════════════════════════════
-- Trace chaque "action" effectuée par un pro sur un prospect acquis :
--   - call_clicked : le pro a cliqué sur "Appeler" (tel: natif). On
--     enregistre le clic même si on ne peut pas savoir si l'appel a
--     effectivement abouti — c'est un signal d'usage suffisant pour
--     l'audit (cf. CGU : usage strictement dans le cadre BUUPP).
--   - email_sent : le pro a envoyé un email via BUUPP (transport SMTP
--     BUUPP, Reply-To = email du pro). Sujet + corps du message
--     archivés pour audit anti-spam.
--
-- Sert deux finalités :
--   1. Audit & traçabilité (qui a contacté qui, quand, comment).
--   2. Quota anti-abus : 2 emails max par (pro × prospect × campagne).
--      Compté côté API en SELECT count(*) avec l'index dédié.
--
-- RLS activée sans policy : accès via service_role uniquement, comme
-- pro_contact_reveals et admin_events.
-- ════════════════════════════════════════════════════════════════════

create type public.pro_contact_action_kind as enum (
  'call_clicked',
  'email_sent'
);

create table public.pro_contact_actions (
  id uuid primary key default gen_random_uuid(),
  pro_account_id uuid not null references public.pro_accounts(id) on delete cascade,
  relation_id uuid not null references public.relations(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  kind public.pro_contact_action_kind not null,
  -- Champs spécifiques email_sent — null pour les autres kinds.
  email_subject text check (email_subject is null or length(email_subject) <= 200),
  email_body text check (email_body is null or length(email_body) <= 10000),
  created_at timestamptz not null default now()
);

create index pro_contact_actions_created_idx
  on public.pro_contact_actions (created_at desc);

-- Index principal pour le check quota (count par
-- pro × prospect × campagne × kind). Couvre la requête
-- "combien d'email_sent reste-t-il dans le quota ?".
create index pro_contact_actions_quota_idx
  on public.pro_contact_actions
  (pro_account_id, prospect_id, campaign_id, kind, created_at desc);

alter table public.pro_contact_actions enable row level security;
-- Aucune policy : seul service_role lit / écrit.
