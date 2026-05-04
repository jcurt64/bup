-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Date de naissance en texte libre
-- ════════════════════════════════════════════════════════════════════
-- L'UI de l'onglet "Mes données" (page prospect) capture la date de
-- naissance comme une chaîne libre (ex. "14/06/1988", "Juin 1988"…).
-- Plutôt que d'imposer une parse côté API, on stocke en `text`. Le
-- contrôle de format pourra être réintroduit via une CHECK quand le
-- formulaire UI aura un date picker dédié.
-- ════════════════════════════════════════════════════════════════════

alter table public.prospect_identity
  alter column naissance type text using naissance::text;
