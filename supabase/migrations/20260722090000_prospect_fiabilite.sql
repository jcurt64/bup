-- Fiabilité du prospect : note agrégée donnée par les pros (sur les prospects
-- ayant accepté une mise en relation). Remplace le « taux d'acceptation » dans
-- l'indice de désirabilité, et alimente le filtre de ciblage (étape 4).
--
-- Valeur 0-100 = moyenne des notes pros (Haute=100 / Moyenne=60 / Basse=20),
-- une note par pro distinct. NULL = jamais notée. La note brute par pro reste
-- stockée dans relations.pro_priority (1=Haute, 2=Moyenne, 3=Basse), recalculée
-- en agrégat par computeAndPersistProspectScore().

alter table public.prospects
  add column if not exists fiabilite_pct smallint;

comment on column public.prospects.fiabilite_pct is
  'Fiabilité agrégée 0-100 (moyenne des notes pros Haute=100/Moyenne=60/Basse=20). NULL si jamais notée. Alimente l''indice de désirabilité et le filtre de ciblage.';

-- Index partiel pour le filtre de ciblage « fiabilité minimum » (étape 4).
create index if not exists prospects_fiabilite_pct_idx
  on public.prospects (fiabilite_pct)
  where fiabilite_pct is not null;

-- Snapshot quotidien : on suit la fiabilité comme les autres critères de
-- l'indice de désirabilité.
alter table public.prospect_score_history
  add column if not exists fiabilite_pct smallint;
