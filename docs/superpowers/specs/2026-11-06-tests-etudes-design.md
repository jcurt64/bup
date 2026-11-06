# Module « Tests & Études » — conception (web d'abord)

> Nom provisoire. Statut : à valider par l'utilisateur avant plan d'implémentation.
> Livraison : **site web uniquement** dans un premier temps ; l'app mobile
> (worktree `worktree-mobile-app`) répliquera ensuite, sur le même backend `/api/*`.

## 1. Intention

BUUPP met aujourd'hui en relation un pro et un prospect pour un **contact**. Ce
module ajoute un second usage : un pro (n'importe quel pro inscrit, tout secteur)
veut des **retours** — avis sur son produit actuel, réaction à un produit qu'il
prépare, expérience sur son site/appli/magasin.

BUUPP **ne réalise pas l'étude** : pas d'éditeur de questionnaire, pas de
collecte des réponses. BUUPP fait la **mise en relation rémunérée** :
publication, inscriptions, seuil tout-ou-rien, réservation du budget, preuve de
réalisation, validation, paiement, contestation. La tâche se fait **chez le pro**
(son questionnaire en ligne via un lien, son site/appli, son magasin, un rendez-vous).

Le prospect est payé pour un travail fait, pas pour une inscription.

## 2. Objectifs / non-objectifs / anti-objectifs

**Objectifs**
- Le pro publie une campagne avec min/max de participants ; tout ou rien.
- Le prospect parcourt une rubrique publique, s'inscrit, réalise, est payé dans son portefeuille habituel.
- Commission BUUPP 10 % par participant rémunéré, minimum 0,30 € (réutiliser `lib/pricing/commission.ts`).
- Preuve par **code individuel** généré par BUUPP.
- Signalement de campagnes frauduleuses par les prospects + engagement explicite du pro.

**Non-objectifs (v1)**
- Éditeur de questionnaire, agrégation de réponses, statistiques d'étude.
- Tests avec livraison de produit ; produits de santé, cosmétiques, compléments (interdits).
- App mobile (phase 2).
- Messagerie interne pro↔participant (le pro écrit à l'alias e-mail).

**Anti-objectifs (échec même si « ça marche »)**
- Le pro obtient des données au-delà du prénom + alias (nom, e-mail réel, téléphone, département…).
- Le pro est débité pour une campagne annulée ou une participation non validée.
- Un prospect est payé sans validation (explicite ou automatique à 7 jours).
- Les campagnes existantes (prise de contact) changent de comportement.

## 3. Les trois types de campagne

| Type (clé) | Libellé | Périmètre autorisé | Ce que fait le participant |
|---|---|---|---|
| `survey` | Sondage en ligne | département ou national | répond au questionnaire du pro via le lien fourni, y saisit son code |
| `product_test` | Test et avis sur un site ou une appli | département ou national | teste le site/l'appli (lien), donne son avis chez le pro, y saisit son code |
| `visit` | Visite en magasin ou rendez-vous d'échange | **département uniquement** | se rend sur place / au rendez-vous, montre son code |

Le type ne change que : le périmètre autorisé et les textes d'aide affichés.
Le lien (`external_url`) est facultatif pour `visit`, recommandé pour les deux autres
(non bloquant). Pour `visit`, le pro renseigne une adresse ou « rendez-vous à convenir ».

## 4. Statuts d'une campagne

`draft` → `published` → (`validated` | `canceled`) → `closed`

- `published` : inscriptions ouvertes. Badges dérivés : « Inscriptions ouvertes »,
  « Plus que X participants » (X = min − inscrits, si > 0), « Complète » (inscrits = max).
- `validated` : seuil atteint à la date limite d'inscription **ou** max atteint
  (validation anticipée dès que max atteint). Codes générés, identités révélées au pro.
  Phase de réalisation jusqu'à `completion_deadline`.
- `canceled` : seuil non atteint à la date limite d'inscription, ou annulation par le pro
  **avant validation** (autorisée, sans frais), ou suspension par l'admin.
- `closed` : toutes les participations sont soldées (validées/refusées définitivement/non réalisées)
  et la période de contestation est écoulée ; budget résiduel libéré.

Le spec initial listait « Complète » et « En réalisation » comme statuts : ce sont
des **badges dérivés** (Complète = max atteint ; En réalisation = `validated` avant
`completion_deadline`), pas des statuts stockés. *(appel du concepteur)*

## 5. Statuts d'une participation

`joined` → (`withdrawn` | `confirmed`) ; `confirmed` → `done` → (`approved` | `rejected`) ;
`rejected` → `disputed` → (`approved` | `rejected_final`) ; `confirmed` sans « terminé »
à `completion_deadline` → `not_done`.

- `joined` : inscrit, campagne encore `published`. Retrait libre (`withdrawn`, ligne supprimée — *appel : suppression plutôt que statut, minimisation*).
- `confirmed` : campagne validée ; code individuel attribué.
- `done` : le prospect a cliqué « J'ai terminé » (commentaire facultatif ≤ 500 car.) avant `completion_deadline`. Démarre le délai pro de 7 jours (`review_due_at = done_at + 7 j`).
- `approved` : validée par le pro, ou automatiquement à `review_due_at`, ou par l'admin après contestation. → paiement.
- `rejected` : refus pro avec motif obligatoire (liste). Le prospect peut contester sous 7 jours.
- `disputed` / `rejected_final` : arbitrage admin.
- `not_done` : pas de « terminé » avant `completion_deadline`. Pas de paiement.

Motifs de refus (liste fermée) : « Code non reçu », « Code invalide ou déjà utilisé »,
« Tâche incomplète », « Participation en double / frauduleuse », « Autre (précisez) »
(texte ≤ 300 car. obligatoire pour Autre).

Le pro peut valider **avant** le « J'ai terminé » du prospect (ex. code reçu en magasin) :
la participation passe directement `approved`. Il peut aussi valider une participation
`confirmed`/`not_done` jusqu'à `completion_deadline + 7 j` (cas du prospect qui a fait la
visite mais oublié de cliquer). Le prospect ne peut pas contester un `not_done`. *(appel du concepteur)*

## 6. Argent

Réutiliser les mécanismes existants : `pro_accounts.wallet_balance_cents` /
`wallet_reserved_cents`, table `transactions`, `commissionCents()`.

- **Publication** : `budget_max = max_participants × (reward + commissionCents(reward))`.
  Exige `wallet_balance_cents − wallet_reserved_cents ≥ budget_max` (sinon 402 → recharge,
  même parcours que les campagnes actuelles). `wallet_reserved_cents += budget_max`. Rien n'est débité.
- **Annulation** : `wallet_reserved_cents −= budget_reserved` restant. Aucune transaction de débit.
- **Approbation d'une participation** (RPC SQL atomique `approve_study_participation_tx`) :
  débit pro `reward` (type `campaign_charge`) + `commission` (type `buupp_commission`),
  `wallet_balance −= reward+commission`, `wallet_reserved −= reward+commission`,
  crédit prospect transaction `credit` `completed` de `reward`. Idempotent (verrou ligne,
  statut vérifié).
- **Clôture** : réservation résiduelle libérée.
- Pas de multiplicateur (certifié ×2, durée, parrainage) sur ce module. *(appel : la rémunération affichée est celle versée)*
- `transactions` reçoit une colonne nullable `study_participation_id` (FK) ; `relation_id`/`campaign_id` restent nuls.
- Facturation : même circuit que les campagnes de contact existantes (la liste des factures pro est construite depuis `transactions`), libellé « Tests & Études — <titre> ». Pas de remplissage de la table `invoices` dans ce module (chantier facturation électronique séparé). *(appel du concepteur)*
- Contestation tranchée en faveur du prospect après `closed` : impossible par construction — la campagne ne se clôt qu'après la fin des contestations, donc la réservation couvre toujours le paiement.

Exemple : sondage national 50–200 participants, 2 € → 2,30 € par validé ;
réservé 460 € ; 120 validés → pro paie 276 €, prospects 240 €, BUUPP 36 €, 184 € libérés.

## 7. Données et confidentialité

- **Révélé au pro** (seulement une fois `validated`) : prénom, alias e-mail, code, statut, commentaire « terminé ».
- **Jamais révélé** : nom, e-mail réel, téléphone, département, adresse, données de paliers 2+.
- **Alias** : étendre `relation_email_aliases` (colonne nullable `study_participation_id`, `relation_id` nullable, contrainte « exactement un des deux ») ; `resolveAlias` et `app/api/inbound/brevo/route.ts` gèrent les deux cas. Alias révoqué à la clôture + 30 j.
- **Département** : filtre uniquement (inscription refusée hors département ciblé). Source : code postal du prospect (`prospect_localisation`), département dérivé des 2–3 premiers caractères (gérer Corse 2A/2B et DOM 97x). Prospect sans code postal : peut s'inscrire aux campagnes nationales uniquement.
- **Palier 1 uniquement** : pour s'inscrire, le prospect doit avoir prénom + e-mail (palier 1 complet). Pas d'exigence de paliers supérieurs.
- **Rétention** : participations d'une campagne annulée supprimées sous 24 h (au passage `canceled`, dans la même opération) ; codes + commentaires effacés à `closed` + 30 j ; signalements conservés 1 an.
- **RGPD** : nouveau traitement au registre ; mise à jour de la politique de confidentialité (`/rgpd`) : finalité, base légale (contrat / consentement explicite à l'inscription), destinataires (le pro : prénom + alias), durées ci-dessus.

## 8. Fraude et signalements

- Côté pro, avant publication : encadré + case obligatoire. Texte : toute campagne frauduleuse ou trompeuse, ou demandant au participant un paiement, des données personnelles (au-delà de ce qu'exige la tâche), ou portant sur un produit interdit (santé, cosmétique, compléments, livraison de produit) entraîne suspension, libération du budget et fermeture du compte. Horodatage de l'acceptation stocké (`fraud_terms_accepted_at`).
- Côté prospect : bouton « Signaler cette campagne » sur chaque fiche (connecté requis), motifs : arnaque / demande de paiement / demande de données personnelles / produit interdit / description trompeuse / autre (texte). 1 signalement par prospect et par campagne.
- Admin : les signalements apparaissent dans `/buupp-admin/signalements` (onglet ou filtre « Tests & Études ») ; action « Suspendre » = passage `canceled` (motif `admin_suspended`). Les participations `joined`/`confirmed` sont supprimées ; les `approved` restent payées ; les `done`/`rejected`/`disputed` (travail déclaré fait) sont conservées et passent à l'arbitrage admin, la réservation correspondante restant bloquée jusqu'à leur règlement, puis le reste est libéré. *(appel du concepteur)*
- Alerte admin (mail `admin-alert`) dès 3 signalements sur une campagne.

## 9. Échéances automatiques

Vercel Hobby = 1 cron/jour (déjà pris par le digest à 18 h). Donc :
- **Transitions paresseuses** : une fonction `sweepStudies(admin, { campaignId? })` applique toutes les transitions échues (validation/annulation à `signup_deadline`, `not_done` à `completion_deadline`, approbation auto à `review_due_at`, rejet définitif si pas de contestation après 7 j, clôture). Appelée sur chaque lecture d'une campagne (fiche, liste pro, liste prospect) pour la campagne concernée, et
- **balayage global quotidien** : appelé depuis le cron existant `/api/admin/digest?severity=daily` (avant le digest).
- Rappel prospect « date limite de réalisation dans 48 h » : envoyé par le balayage quotidien (dédup par colonne `reminder_sent_at`).

Les transitions sont idempotentes et faites en SQL transactionnel (RPC) pour éviter les doubles paiements si deux lectures concurrentes balaient.

## 10. Notifications (e-mail Brevo + notifications in-app existantes)

**Publication d'une campagne (décision utilisateur)** : notification **in-app** à tous les
prospects éligibles (département ciblé, ou tous pour une campagne nationale ; palier 1
complet). En plus, **un e-mail récapitulatif au plus 1×/jour** (« N nouvelles campagnes
Tests & Études près de chez vous ») envoyé par le balayage quotidien, uniquement aux
prospects ayant accepté cette option (préférence `studies_email_digest`, défaut : non,
activable dans l'espace prospect et depuis la notification) ; lien de désabonnement en
un clic dans chaque e-mail.

Prospect : campagne validée (avec son code et le lien/adresse du pro) ; campagne annulée (avec 3 autres campagnes ouvertes proposées) ; rappel J-2 réalisation ; participation validée/payée ; refusée (motif + lien contester) ; issue d'une contestation.
Pro : campagne validée / annulée ; nouvelle participation « terminée » à examiner (digest, pas 1 mail par participation — *appel*) ; contestation ouverte/tranchée ; campagne suspendue.
Admin : 3 signalements ; nouvelle contestation.

Prospects utilisant uniquement l'app mobile (v1 web) : tous les e-mails pointent vers l'espace prospect **web** (`/prospect` onglet Tests & Études) où ils se connectent avec le même compte ; l'app affichera la rubrique en phase 2. *(appel du concepteur)*

## 11. Écrans (web)

**Public** — `/tests-etudes` (liste) et `/tests-etudes/[id]` (fiche), visibles sans compte, ajoutés au menu principal et au footer, indexables. Liste : filtres département, type, rémunération min, date limite ; tri par date limite. Fiche : nom du pro (raison sociale), type, titre, description, rémunération, zone (« Département 64 » ou « France entière »), jauge (inscrits / seuil / max), places restantes, compte à rebours (inscription puis réalisation), badge de statut, mention **« Participation rémunérée via BUUPP »**, durée estimée de la tâche, boutons Participer (→ connexion/inscription si anonyme), Partager (Web Share API, repli copier le lien ; texte « Plus que X participants »), Signaler. Le lien externe du pro n'est montré qu'aux participants confirmés.

**Espace prospect** (prototype `Prospect.jsx`) — nouvel onglet « Tests & Études » : mes participations (statut, code, lien/adresse du pro, échéance, boutons Se retirer / J'ai terminé / Contester) + accès à la rubrique publique. Les gains apparaissent dans le portefeuille existant (libellé « Tests & Études — <titre> »).

**Espace pro** (prototype `Pro.jsx`) — nouvel onglet « Tests & Études » : liste de ses campagnes avec jauge et statut ; création (formulaire une page : type, titre, description, durée estimée, lien, adresse si visite, rémunération ≥ 1 €, min ≥ 5, max ≤ 500, min ≤ max, périmètre, date limite d'inscription [J+2 à J+60], date limite de réalisation [≥ inscription + 3 j, ≤ inscription + 60 j], récap coût max, case anti-fraude, Enregistrer brouillon / Publier) ; détail : jauge temps réel (rafraîchissement à l'ouverture + toutes les 30 s), puis après validation la table des participants (prénom, alias copiable, code, statut, commentaire, échéance de revue, Valider / Refuser + motif, validation groupée), récap coûts engagés / réservés. Annuler (avant validation).

**Admin** — onglet « Tests & Études » : campagnes, signalements, contestations à trancher (voir code, commentaire, motif de refus ; boutons Valider la participation / Confirmer le refus).

## 12. Textes légaux

- **CGV** (pro) : article Tests & Études — fonctionnement tout-ou-rien, réservation, débit à la validation, commission, délai de revue 7 j et validation tacite, arbitrage BUUPP, engagements anti-fraude et produits interdits, obligation de reprendre la mention « Participation rémunérée via BUUPP » en cas de publication des retours.
- **CGU** (prospect) : inscription, retrait, preuve par code, paiement, contestation, signalement, interdiction de fausse déclaration (sanction : exclusion du module).
- **Politique de confidentialité** : §7.

## 13. Indicateur d'activation

Flag `app_config.studies_enabled` (défaut `false`) : masque menu, pages publiques (404) et onglets tant qu'il est faux. Permet de déployer le code puis d'ouvrir le module à la date voulue.

## 14. Laissé au constructeur

Nom exact des tables/colonnes/RPC, découpage des composants, styles (reprendre le design existant, 4 thèmes non concernés côté web), formulation finale des e-mails, pagination. Migration via SQL Editor + `migration repair` (jamais `db push`). Tests unitaires sur : calcul du budget, machine à états, transitions du balayage, paiement idempotent, filtre département, masquage des données pro.
