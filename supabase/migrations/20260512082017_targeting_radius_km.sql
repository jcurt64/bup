-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Rayon de ciblage préféré par le prospect (zone géographique)
-- ════════════════════════════════════════════════════════════════════
-- Ajoute le rayon (en km, autour de la ville renseignée par le prospect)
-- au-delà duquel il refuse les sollicitations. Utilisé par
-- `lib/campaigns/matching.ts` pour filtrer le pool quand un pro lance
-- une campagne : un pro qui cible département (rayon ~50 km) ne touche
-- pas un prospect qui a configuré un rayon de 25 km.
--
-- Default 25 km = rayon ville/agglomération raisonnable, cohérent avec
-- la borne haute du slider UI dans Préférences (5-100 km step 5).
-- ════════════════════════════════════════════════════════════════════

alter table public.prospect_localisation
  add column if not exists targeting_radius_km int not null default 25
  check (targeting_radius_km between 5 and 100);
