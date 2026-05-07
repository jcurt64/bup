-- Garde-fou anti-fraude : un IBAN ne peut être enregistré que par un seul
-- prospect dans toute l'application. Empêche un même utilisateur de créer
-- plusieurs comptes pour cumuler des récompenses sur la même banque.
--
-- L'index est UNIQUE et porte directement sur `iban` (déjà nettoyé/normalisé
-- côté API : pas d'espaces ni tirets, en majuscules), donc aucune
-- normalisation supplémentaire n'est nécessaire ici. La contrainte est
-- enforced au niveau base — toute tentative d'insert d'un IBAN existant
-- déclenche une violation `23505` que l'API traduit en 409.

create unique index if not exists prospect_rib_iban_unique
  on public.prospect_rib (iban);
