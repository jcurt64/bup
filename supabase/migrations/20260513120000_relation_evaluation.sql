-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Évaluation post-contact des relations + alerte non joignable
-- ════════════════════════════════════════════════════════════════════
-- Le pro évalue chaque relation acceptée/réglée après tentative de
-- contact :
--   - 'atteint'     : le pro a joint le prospect, échange constructif
--   - 'non_atteint' : aucune réponse du prospect aux sollicitations
--                     (email, SMS, appel, push, …)
--
-- Logique anti-freeloader : si un prospect reçoit 2 ou plus
-- 'non_atteint' (cumul tous pros confondus), une alerte est créée pour
-- l'équipe admin et un message gentil est envoyé au prospect via les
-- broadcasts ciblés (admin_broadcasts.target_clerk_user_id, ajouté ici).
-- La logique anti-spam (un seul alert par prospect dans une fenêtre
-- glissante) est gérée côté Route Handler.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Enum + colonne sur relations ────────────────────────────────
do $$ begin
  create type public.relation_evaluation as enum ('atteint', 'non_atteint');
exception
  when duplicate_object then null;
end $$;

alter table public.relations
  add column if not exists evaluation public.relation_evaluation,
  add column if not exists evaluated_at timestamptz,
  add column if not exists evaluated_by_pro_id uuid references public.pro_accounts(id) on delete set null;

-- Index partiel pour les counts par prospect (lookup déclencheur d'alerte).
create index if not exists relations_evaluation_prospect_idx
  on public.relations (prospect_id, evaluation)
  where evaluation is not null;

-- ─── 2. Broadcasts ciblés (un seul user) ────────────────────────────
-- Champ ajouté pour pouvoir envoyer un message à un user spécifique
-- (vs. broadcast à toute l'audience prospects/pros/all). Quand non-null,
-- la row n'est visible QUE pour ce clerk_user_id. Quand null, audience
-- classique inchangée (comportement rétrocompatible).
alter table public.admin_broadcasts
  add column if not exists target_clerk_user_id text;

create index if not exists admin_broadcasts_target_user_idx
  on public.admin_broadcasts (target_clerk_user_id, created_at desc)
  where target_clerk_user_id is not null;
