-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Date de naissance : format strict JJ/MM/AAAA
-- ════════════════════════════════════════════════════════════════════
-- L'UI applique désormais un masque côté front (auto-formatage des
-- slashs après 2 et 4 chiffres) et l'API /api/prospect/donnees revalide
-- le format avant tout PATCH. On verrouille la base avec un CHECK pour
-- empêcher toute insertion hors format.
--
-- Étapes :
--   1. Nettoyer les valeurs existantes non-conformes (NULL pour tout ce
--      qui ne matche pas `^\d{2}/\d{2}/\d{4}$`). C'est volontaire :
--      l'ancien champ acceptait "Juin 1988", "1988", etc. — ces
--      valeurs ne sont plus exploitables côté UI.
--   2. Ajouter la contrainte CHECK (autorise NULL = champ effacé).
-- ════════════════════════════════════════════════════════════════════

update public.prospect_identity
set naissance = null
where naissance is not null
  and naissance !~ '^\d{2}/\d{2}/\d{4}$';

alter table public.prospect_identity
  add constraint prospect_identity_naissance_format_chk
  check (
    naissance is null
    or naissance ~ '^\d{2}/\d{2}/\d{4}$'
  );
