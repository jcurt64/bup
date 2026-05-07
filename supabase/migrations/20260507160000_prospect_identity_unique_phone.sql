-- Garde-fou anti-fraude : un numéro de téléphone ne peut être associé qu'à
-- un seul prospect dans toute l'application. Empêche un même utilisateur
-- de créer plusieurs comptes en réutilisant son téléphone.
--
-- Index UNIQUE PARTIEL : ne contraint que les numéros non-NULL — un
-- prospect qui n'a pas encore renseigné son téléphone ne bloque rien.
-- Les numéros stockés sont déjà normalisés en E.164 par /api/prospect/
-- phone/start (`normalizePhone`), donc pas besoin de normalisation
-- supplémentaire dans l'index.
--
-- Toute tentative d'INSERT/UPDATE qui dupliquerait un numéro existant
-- déclenche une violation Postgres `23505` que les routes API
-- traduisent en 409 `phone_already_used`.

create unique index if not exists prospect_identity_telephone_unique
  on public.prospect_identity (telephone)
  where telephone is not null;
