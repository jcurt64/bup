-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Interrupteur « boutons d'accès » (gel avant ouverture)
-- ════════════════════════════════════════════════════════════════════
-- Pendant la période de pré-inscription officielle, les entrées vers la
-- création de compte et la connexion sont gelées sur les pages publiques
-- (header + CTA du hero) : seule la pré-inscription reste active. Les
-- boutons restent visibles mais inertes, avec une infobulle « Actif au
-- lancement ».
--
-- Le pilotage passe par ce drapeau plutôt que par le code afin de pouvoir
-- rouvrir l'accès À LA FIN de la période SANS redéploiement : il suffit de
-- repasser la colonne à `true` (la lecture est mise en cache 60 s côté
-- Next, cf. lib/app-config/access.ts).
--
-- Valeur par défaut `true` = accès ouvert, pour que tout nouvel
-- environnement soit fonctionnel sans intervention. Le gel est un acte
-- explicite (UPDATE ci-dessous, à jouer au moment voulu).
-- ════════════════════════════════════════════════════════════════════

alter table public.app_config
  add column if not exists access_buttons_enabled boolean not null default true;

comment on column public.app_config.access_buttons_enabled is
  'false = boutons d''inscription/connexion gelés sur les pages publiques (période de pré-inscription). Repasser à true pour rouvrir l''accès, sans redéploiement.';
