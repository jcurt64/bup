-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Priorité de traitement d'une fiche prospect (côté pro)
-- ════════════════════════════════════════════════════════════════════
-- Dans la fiche détaillée d'un prospect (popup « Voir détails »), le pro
-- peut classer chaque fiche par priorité de traitement :
--   1 = Haute   ·  2 = Moyenne  ·  3 = Basse  ·  NULL = non définie
--
-- Cela permet au pro de filtrer/trier ses prospects et d'organiser ses
-- actions (relances, appels…) selon l'importance qu'il accorde à chacun.
-- La priorité est PROPRE au pro qui possède la relation (une relation
-- = un pro), donc stockée directement sur `relations`.
-- ════════════════════════════════════════════════════════════════════

alter table public.relations
  add column if not exists pro_priority smallint
    check (pro_priority is null or pro_priority in (1, 2, 3));

-- Index partiel : lookup/tri des fiches priorisées par pro.
create index if not exists relations_pro_priority_idx
  on public.relations (pro_account_id, pro_priority)
  where pro_priority is not null;

comment on column public.relations.pro_priority is
  'Priorité de traitement fixée par le pro : 1=haute, 2=moyenne, 3=basse, NULL=non définie.';
