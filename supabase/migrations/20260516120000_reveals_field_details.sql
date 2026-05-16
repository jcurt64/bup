-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Audit "fiche détaillée prospect" (pro_contact_reveals)
-- ════════════════════════════════════════════════════════════════════
-- L'ouverture par un pro de la fiche détaillée d'un prospect ayant
-- accepté (catégories de données payées dans la campagne) est une
-- révélation de données personnelles → on la journalise dans la même
-- table que les révélations email/téléphone/nom, avec field='details'.
--
-- On élargit donc la CHECK existante pour autoriser cette 4e valeur.
-- ════════════════════════════════════════════════════════════════════

alter table public.pro_contact_reveals
  drop constraint if exists pro_contact_reveals_field_check;

alter table public.pro_contact_reveals
  add constraint pro_contact_reveals_field_check
  check (field = any (array['email'::text, 'telephone'::text, 'name'::text, 'details'::text]));
