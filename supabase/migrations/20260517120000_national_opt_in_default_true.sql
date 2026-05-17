-- ════════════════════════════════════════════════════════════════════
-- BUUPP — « National » coché par défaut dans la zone géographique
-- ════════════════════════════════════════════════════════════════════
-- Décision produit : par défaut un prospect accepte d'être contacté
-- partout en France (opt-out). On bascule donc le DEFAULT de la colonne
-- prospect_localisation.national_opt_in de false → true.
--
-- IMPORTANT : on ne fait PAS d'UPDATE des rows existantes — un prospect
-- ayant explicitement décoché « National » garde son choix. Le nouveau
-- DEFAULT ne s'applique qu'aux rows créées après cette migration
-- (ex. première saisie de ville → upsert prospect_localisation).
-- ════════════════════════════════════════════════════════════════════

alter table public.prospect_localisation
  alter column national_opt_in set default true;
