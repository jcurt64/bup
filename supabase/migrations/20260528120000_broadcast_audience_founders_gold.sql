-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Audience broadcast « Fondateurs Or » (palier de parrainage Or)
-- ════════════════════════════════════════════════════════════════════
-- Ajoute la valeur `founders_gold` à l'enum des audiences de broadcast
-- admin. Cible : prospects ayant atteint le palier Or (>= 10 filleuls).
-- Additif et idempotent.
--
-- ⚠️ `ALTER TYPE ... ADD VALUE` ne peut PAS s'exécuter dans un bloc
-- transactionnel et la nouvelle valeur n'est pas utilisable dans la même
-- transaction. Exécuter cette instruction SEULE dans le SQL Editor
-- Supabase (remote), puis marquer la migration appliquée localement via
-- `supabase migration repair --status applied 20260528120000`.
-- ════════════════════════════════════════════════════════════════════

alter type public.admin_broadcast_audience add value if not exists 'founders_gold';
