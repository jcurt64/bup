-- ════════════════════════════════════════════════════════════════════
-- BUUPP — SMS de préavis d'appel « BUUPP + code buupp »
-- ════════════════════════════════════════════════════════════════════
-- Au clic « Appeler maintenant » (canal appel uniquement), un SMS est
-- envoyé au prospect depuis l'expéditeur « BUUPP » avec le code buupp de
-- la campagne (4 derniers caractères de campaigns.code) pour contextualiser
-- l'appel entrant et l'authentifier.
--
-- Dédup : UNE SEULE FOIS par relation. On horodate l'envoi ici ; l'API
-- « réclame » l'envoi via un UPDATE conditionnel atomique
-- (SET ... WHERE call_notice_sms_sent_at IS NULL RETURNING) pour éviter
-- tout double envoi si le pro rouvre le popup ou double-clique.
-- ════════════════════════════════════════════════════════════════════
alter table public.relations
  add column if not exists call_notice_sms_sent_at timestamptz;

comment on column public.relations.call_notice_sms_sent_at is
  'Horodatage du SMS de préavis d''appel « BUUPP + code buupp » envoyé au prospect (dédup : une seule fois par relation).';
