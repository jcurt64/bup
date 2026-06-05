-- ============================================================================
-- Harnais de test — Escalade « non-réponse prospect »
-- (cf. lib/prospect/non-response.ts + docs/superpowers/specs/2026-06-05-…)
--
-- But : poser l'état d'escalade d'un compte prospect de TEST pour valider, sur
-- le build DÉPLOYÉ, les comportements lus en direct par le code :
--   • niveau 3 → malus -100 du BUUPP Score (recompute live à l'ouverture du
--     dashboard / GET /api/prospect/score, qui soustrait `score_malus`) ;
--   • niveau 4 → blocage de l'acceptation (POST /api/prospect/relations/[id]/
--     decision action=accept renvoie 403 + message) ;
--   • messages courtois dans « Mes messages » (admin_broadcasts ciblés).
--
-- Les blocs INSERT reproduisent à l'identique les messages de
-- lib/prospect/non-response.ts (tenir synchronisé si le wording évolue).
--
-- ⚠ À n'exécuter QUE sur des comptes de TEST. Remplacez l'email cible partout
--   (find/replace) : par défaut jjlex64+clerk_test2@gmail.com.
--   À lancer via le SQL Editor Supabase (projet buupp) ou le MCP, bloc par bloc.
-- ============================================================================


-- ─── 0. ÉTAT ACTUEL + sollicitation en attente pour tester le blocage ───────
select pi.email, p.id as prospect_id,
       p.non_response_strikes, p.non_response_level, p.score_malus,
       p.accept_restricted_until, p.bupp_score,
       (select count(*) from relations r
         where r.prospect_id = p.id and r.status = 'pending') as pending
from prospects p
join prospect_identity pi on pi.prospect_id = p.id
where pi.email ilike 'jjlex64+clerk_test2@gmail.com';

-- Une relation 'pending' à essayer d'accepter depuis le dashboard prospect
-- (web ou mobile) une fois la restriction posée (bloc 3) :
select r.id as relation_id, r.status, c.code, pa.raison_sociale
from relations r
join prospects p on p.id = r.prospect_id
join prospect_identity pi on pi.prospect_id = p.id
left join campaigns c on c.id = r.campaign_id
left join pro_accounts pa on pa.id = r.pro_account_id
where pi.email ilike 'jjlex64+clerk_test2@gmail.com' and r.status = 'pending'
limit 5;


-- ─── 1. NIVEAU 2 — Signalement (rappel courtois) ────────────────────────────
update prospects p
   set non_response_strikes = 2, non_response_level = 2
  from prospect_identity pi
 where pi.prospect_id = p.id and pi.email ilike 'jjlex64+clerk_test2@gmail.com';

with t as (
  select p.clerk_user_id from prospects p
  join prospect_identity pi on pi.prospect_id = p.id
  where pi.email ilike 'jjlex64+clerk_test2@gmail.com'
)
insert into admin_broadcasts (title, body, audience, created_by_admin_id, target_clerk_user_id)
select
  $t$Oups — un pro n'a pas pu vous joindre$t$,
  $b$Bonjour,

Il semblerait qu'un professionnel n'ait pas réussi à vous contacter après votre acceptation. Pas de souci — un imprévu, ça arrive !

Petit rappel sur le fonctionnement de BUUPP : quand vous acceptez une sollicitation, le professionnel paie pour pouvoir vous joindre, et vous touchez votre rémunération. C'est un échange qui marche dans les deux sens.

À l'avenir, pensez à répondre aux sollicitations que vous avez acceptées (email, SMS ou téléphone) — même un simple « non merci » est mieux qu'un silence. Merci de votre attention,
L'équipe BUUPP$b$,
  'prospects', 'system:test-harness', t.clerk_user_id
from t;


-- ─── 2. NIVEAU 3 — Malus BUUPP Score -100 (+ message) ───────────────────────
-- Le score affiché se met à jour au prochain GET /api/prospect/score (recompute
-- qui soustrait score_malus). Pas besoin de toucher bupp_score à la main.
update prospects p
   set non_response_strikes = 3, non_response_level = 3, score_malus = 100
  from prospect_identity pi
 where pi.prospect_id = p.id and pi.email ilike 'jjlex64+clerk_test2@gmail.com';

with t as (
  select p.clerk_user_id from prospects p
  join prospect_identity pi on pi.prospect_id = p.id
  where pi.email ilike 'jjlex64+clerk_test2@gmail.com'
)
insert into admin_broadcasts (title, body, audience, created_by_admin_id, target_clerk_user_id)
select
  $t$Votre BUUPP Score a été ajusté$t$,
  $b$Bonjour,

Nous avons légèrement ajusté votre BUUPP Score à la suite de plusieurs sollicitations que vous aviez acceptées mais restées sans réponse.

Rien de définitif, et aucun reproche : en répondant aux prochaines sollicitations que vous acceptez, votre score remontera naturellement. Notre objectif est simplement de préserver un service de qualité, autant pour vous que pour les professionnels.

Merci de votre compréhension,
L'équipe BUUPP$b$,
  'prospects', 'system:test-harness', t.clerk_user_id
from t;


-- ─── 3. NIVEAU 4 — Restriction d'acceptation 2 mois (+ message) ─────────────
-- Après ce bloc : tenter d'accepter une sollicitation 'pending' (bloc 0) depuis
-- le dashboard → 403 « Acceptation en pause » avec la date de fin.
update prospects p
   set non_response_strikes = 4, non_response_level = 4,
       accept_restricted_until = now() + interval '2 months'
  from prospect_identity pi
 where pi.prospect_id = p.id and pi.email ilike 'jjlex64+clerk_test2@gmail.com';

with t as (
  select p.clerk_user_id,
         to_char(p.accept_restricted_until, 'DD/MM/YYYY') as until
  from prospects p
  join prospect_identity pi on pi.prospect_id = p.id
  where pi.email ilike 'jjlex64+clerk_test2@gmail.com'
)
insert into admin_broadcasts (title, body, audience, created_by_admin_id, target_clerk_user_id)
select
  $t$Acceptation de sollicitations mise en pause$t$,
  $b$Bonjour,

Pour préserver la qualité du service pour tout le monde, l'acceptation de nouvelles sollicitations est mise en pause sur votre compte pendant 2 mois, jusqu'au $b$ || t.until || $b$.

Cette pause fait suite à plusieurs sollicitations acceptées restées sans réponse. Vous pourrez de nouveau accepter des sollicitations à cette date — et entre-temps, vous restez libre de compléter votre profil et de consulter votre espace.

Merci de votre compréhension,
L'équipe BUUPP$b$,
  'prospects', 'system:test-harness', t.clerk_user_id
from t;


-- ─── 9. RESET — remise à zéro (ardoise propre) + message ───────────────────
-- Simule l'expiration de la restriction (ce que fait liftExpiredNonResponse-
-- Restriction / le balayage cron). Le score remonte au prochain recompute.
update prospects p
   set non_response_strikes = 0, non_response_level = 0, score_malus = 0,
       accept_restricted_until = null
  from prospect_identity pi
 where pi.prospect_id = p.id and pi.email ilike 'jjlex64+clerk_test2@gmail.com';

with t as (
  select p.clerk_user_id from prospects p
  join prospect_identity pi on pi.prospect_id = p.id
  where pi.email ilike 'jjlex64+clerk_test2@gmail.com'
)
insert into admin_broadcasts (title, body, audience, created_by_admin_id, target_clerk_user_id)
select
  $t$Bon retour — vous pouvez de nouveau accepter$t$,
  $b$Bonjour,

Bonne nouvelle : la pause sur votre compte est terminée. Vous pouvez de nouveau accepter des sollicitations, avec une ardoise repartie à zéro.

À très vite sur BUUPP !
L'équipe BUUPP$b$,
  'prospects', 'system:test-harness', t.clerk_user_id
from t;

-- Nettoyage éventuel des messages de test injectés par ce harnais :
-- delete from admin_broadcasts where created_by_admin_id = 'system:test-harness';
