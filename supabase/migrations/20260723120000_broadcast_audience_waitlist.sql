-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Audience broadcast « Liste d'attente »
-- ════════════════════════════════════════════════════════════════════
-- Ajoute la valeur `waitlist` à l'enum des audiences de broadcast admin.
-- Cible : tous les inscrits de la table `public.waitlist` (pré-lancement,
-- sans compte BUUPP). Envoi par email simple (pas de cloche in-app ni de
-- pixel de mesure, faute de compte rattaché). Ex. d'usage : annoncer le
-- lancement officiel de la plateforme.
-- Additif et idempotent.
--
-- ⚠️ `ALTER TYPE ... ADD VALUE` ne peut PAS s'exécuter dans un bloc
-- transactionnel et la nouvelle valeur n'est pas utilisable dans la même
-- transaction. Exécuter cette instruction SEULE dans le SQL Editor
-- Supabase (remote), puis marquer la migration appliquée localement via
-- `supabase migration repair --status applied 20260723120000`.
-- ════════════════════════════════════════════════════════════════════

alter type public.admin_broadcast_audience add value if not exists 'waitlist';
