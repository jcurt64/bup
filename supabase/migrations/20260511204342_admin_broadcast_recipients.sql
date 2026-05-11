-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Tracking per-destinataire des broadcasts admin (taux d'ouverture)
-- ════════════════════════════════════════════════════════════════════
-- Une row par couple (broadcast, destinataire) insérée AU MOMENT de l'envoi
-- email. Permet de calculer le taux d'ouverture via un pixel de tracking
-- inclus dans le HTML — chaque ouverture déclenche un GET sur l'URL pixel
-- avec le recipient_id, ce qui pose `opened_at` + incrémente `open_count`.
--
-- Caveat connu : Apple Mail Privacy Protection pré-charge toutes les images
-- côté serveur Apple → marque le mail comme "ouvert" même si l'utilisateur
-- n'a pas regardé. À l'inverse, Gmail web et Outlook bloquent les images
-- par défaut → sous-évaluation. Métrique utile en RELATIF entre broadcasts,
-- pas en absolu.
--
-- Aucune policy RLS user-facing : seul service_role écrit. Le pixel route
-- handler utilise un Admin client pour incrémenter le compteur, et expose
-- une URL publique (l'authentification Clerk n'est pas envisageable depuis
-- un email client tiers).
-- ════════════════════════════════════════════════════════════════════

create table public.admin_broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.admin_broadcasts(id) on delete cascade,
  -- Email destinataire (snapshot au moment de l'envoi). Pas de FK vers
  -- prospect_identity / Clerk : on veut conserver la trace même si la
  -- row source est supprimée plus tard.
  email text not null,
  -- Rôle au moment de l'envoi — utile pour ventiler les stats par audience.
  role text not null check (role in ('prospect', 'pro')),
  sent_at timestamptz not null default now(),
  -- Première ouverture détectée via pixel. Null = jamais ouvert (ou bloqué
  -- côté client mail). On garde la première date (pas la dernière) pour
  -- les rapports.
  opened_at timestamptz,
  -- Compteur incrémenté à chaque fetch du pixel (un user qui rouvre 3 fois
  -- depuis 3 devices = open_count = 3, mais opened_at reste la 1re).
  open_count int not null default 0
);

-- Stats agrégées par broadcast (taux d'ouverture).
create index admin_broadcast_recipients_broadcast_idx
  on public.admin_broadcast_recipients (broadcast_id);
-- Lookups d'ouvertures (filtre "ouvert ou non").
create index admin_broadcast_recipients_open_idx
  on public.admin_broadcast_recipients (broadcast_id, opened_at);

alter table public.admin_broadcast_recipients enable row level security;
-- Aucune policy : service_role uniquement.

-- Denormalisation : compteur total de destinataires snapshoté sur la
-- table parent au moment de l'envoi. Évite un COUNT() coûteux pour
-- chaque ligne d'historique côté admin.
alter table public.admin_broadcasts
  add column if not exists total_recipients int not null default 0;
