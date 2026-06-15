-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Traçabilité réelle du pixel d'ouverture (taux de lecture pro)
-- ════════════════════════════════════════════════════════════════════
-- Le pixel d'ouverture n'est inséré dans l'e-mail pro→prospect QUE si le
-- prospect a explicitement consenti (CNIL). Pour calculer un taux de
-- lecture honnête côté Analytics pro, il faut connaître, à l'envoi, si un
-- pixel a réellement été posé — le consentement pouvant changer ensuite
-- (opt-out), on ne peut pas le redériver fidèlement après coup.
--
-- `tracking_pixel_embedded` est posée à l'envoi selon le consentement réel
-- (cf. routes /api/pro/contacts/[id]/email et /api/pro/segments/broadcast).
-- Nullable : null = historique antérieur à la colonne (traçabilité inconnue).
-- ════════════════════════════════════════════════════════════════════

alter table public.pro_contact_actions
  add column if not exists tracking_pixel_embedded boolean;

-- Backfill : un envoi déjà ouvert portait forcément un pixel → traçable.
-- (Les envois historiques jamais ouverts restent à null = inconnu ; le
-- calcul du taux les exclut du dénominateur.)
update public.pro_contact_actions
  set tracking_pixel_embedded = true
  where kind = 'email_sent'
    and email_opened_at is not null
    and tracking_pixel_embedded is null;
