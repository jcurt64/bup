-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Code postal : format 5 chiffres
-- ════════════════════════════════════════════════════════════════════
-- L'UI utilise désormais l'autocomplétion `geo.api.gouv.fr` qui ne
-- renvoie que des codes valides (5 chiffres). On verrouille la base
-- avec un CHECK pour empêcher toute insertion hors format.
--
-- Étapes :
--   1. Nettoyer les valeurs existantes non-conformes (NULL).
--   2. Ajouter la contrainte CHECK (NULL = champ effacé, autorisé).
-- ════════════════════════════════════════════════════════════════════

update public.prospect_localisation
set code_postal = null
where code_postal is not null
  and code_postal !~ '^\d{5}$';

alter table public.prospect_localisation
  add constraint prospect_localisation_code_postal_format_chk
  check (
    code_postal is null
    or code_postal ~ '^\d{5}$'
  );
