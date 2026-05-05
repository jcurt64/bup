-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Lifecycle email triggers (warnings de fin + feedback refus)
-- ════════════════════════════════════════════════════════════════════
-- Deux infrastructures pour les nouveaux emails du flux campagne :
--
-- 1) campaigns.expiry_warning_sent (boolean default false)
--    Drapeau d'idempotence pour le mail "expire dans 15 min" envoyé aux
--    prospects pending. Le helper Node lit/écrit ce flag pour ne jamais
--    réémettre, même si plusieurs requêtes appellent le check en même
--    temps (UPDATE…WHERE expiry_warning_sent = false sert de garde).
--
-- 2) Table public.relation_feedback
--    Capture la raison de refus communiquée par le prospect via les
--    boutons du mail "Sollicitation refusée" (entreprise-douteuse /
--    faible-remuneration / pas-interesse). Une row par (relation_id,
--    reason). Pas de FK forte sur reason — on garde du texte libre
--    pour pouvoir ajouter d'autres options sans migration.
--    RLS désactivée : la route /feedback est appelée non authentifiée
--    via lien email, l'écriture passe forcément par service_role.
-- ════════════════════════════════════════════════════════════════════

alter table public.campaigns
  add column if not exists expiry_warning_sent boolean not null default false;

create index if not exists campaigns_expiry_warning_idx
  on public.campaigns (status, expiry_warning_sent, ends_at)
  where status = 'active' and expiry_warning_sent = false;

create table if not exists public.relation_feedback (
  id uuid primary key default gen_random_uuid(),
  relation_id uuid not null references public.relations(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists relation_feedback_relation_idx
  on public.relation_feedback (relation_id, created_at desc);

alter table public.relation_feedback enable row level security;
-- Aucune politique : seul service_role (utilisé par la route serveur)
-- peut lire/écrire. Pas d'accès direct depuis authenticated/anon.
