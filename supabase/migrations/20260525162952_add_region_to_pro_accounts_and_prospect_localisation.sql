-- Autocomplétion ville + code postal + région (côté Mes informations pro
-- et Mes données prospect) — ajoute la colonne `region` aux tables
-- concernées. Persistée comme TEXT nullable : la région est déduite côté
-- UI via geo.api.gouv.fr (fields=...,region) au moment où l'utilisateur
-- sélectionne sa ville dans la liste d'autocomplétion.

ALTER TABLE pro_accounts ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE prospect_localisation ADD COLUMN IF NOT EXISTS region TEXT;
