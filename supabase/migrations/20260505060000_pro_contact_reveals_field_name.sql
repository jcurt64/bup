-- Étend les valeurs autorisées dans pro_contact_reveals.field pour
-- inclure 'name' (utilisé par les boutons Facebook / LinkedIn qui
-- révèlent le nom complet du prospect avant d'ouvrir une recherche).
alter table public.pro_contact_reveals
  drop constraint if exists pro_contact_reveals_field_check;
alter table public.pro_contact_reveals
  add constraint pro_contact_reveals_field_check
  check (field in ('email','telephone','name'));
