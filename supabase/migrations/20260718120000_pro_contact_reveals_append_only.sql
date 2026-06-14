-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Verrou « append-only » du journal d'audit des révélations
-- (pro_contact_reveals)
-- ════════════════════════════════════════════════════════════════════
-- Contexte : la page « À propos » affirme « chaque révélation est journalisée
-- conformément au RGPD » et la section Sécurité parle d'un « journal d'audit
-- VERROUILLÉ des révélations ». Pour que ce soit vrai, le journal doit être
-- INVIOLABLE EN MODIFICATION : une entrée écrite ne doit jamais pouvoir être
-- altérée a posteriori (ni par erreur applicative, ni pour masquer un accès).
--
-- État avant cette migration :
--   • RLS activée, AUCUNE policy  → anon/authenticated ne peuvent ni lire ni
--     écrire. Seul le service_role (client admin de l'app) accède à la table.
--   • Colonne `revealed_at timestamptz not null default now()` → horodatage.
--   ⚠️ MAIS le service_role IGNORE la RLS : l'application pourrait techniquement
--      faire un UPDATE/DELETE. Rien ne l'en empêche au niveau base.
--
-- Cette migration ajoute un trigger qui REJETTE tout UPDATE, y compris pour le
-- service_role → les lignes d'audit deviennent immuables (append-only).
--
-- Choix volontaire : on NE bloque PAS le DELETE.
--   Les FK `pro_account_id` / `relation_id` sont `ON DELETE CASCADE`. Lorsqu'un
--   prospect/une relation est effacé (droit à l'effacement RGPD), les lignes
--   d'audit correspondantes doivent pouvoir disparaître avec lui. Bloquer le
--   DELETE casserait l'exercice du droit à l'effacement. Aucun code applicatif
--   ne fait de DELETE direct sur cette table (vérifié) : les seules
--   suppressions possibles sont ces cascades d'effacement légitimes.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.pro_contact_reveals_no_update()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'pro_contact_reveals est un journal append-only : UPDATE interdit (ligne %)', old.id
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists pro_contact_reveals_lock_update on public.pro_contact_reveals;
create trigger pro_contact_reveals_lock_update
  before update on public.pro_contact_reveals
  for each row execute function public.pro_contact_reveals_no_update();
