# Taux de lecture des messages pro→prospect (open-rate) — Design

Date : 2026-06-15
Statut : validé (brainstorming)

## Objectif

Permettre à un professionnel de voir **combien des prospects ayant accepté
sa campagne ont ouvert les messages qu'il leur a envoyés**, via un **taux de
lecture** affiché dans l'onglet Analytics du dashboard pro.

## Décision technique : pixel traceur (existant), pas de cookie

Un cookie est techniquement illisible dans un e-mail. Le suivi d'ouverture
repose sur un **pixel 1×1 transparent**, mécanisme **déjà en place** :

- `GET /api/email-pixel/[token]` écrit `pro_contact_actions.email_opened_at`
  à la première ouverture.
- Les deux routes d'envoi pro→prospect (individuel
  `POST /api/pro/contacts/[relationId]/email` et diffusion segment
  `POST /api/pro/segments/broadcast`) créent déjà une ligne
  `pro_contact_actions` (`kind='email_sent'`) avec un `tracking_token` unique.
- **Conformité CNIL inchangée** : le pixel n'est inséré dans le HTML que si le
  prospect a explicitement consenti (`hasExplicitEmailTrackingConsent`).

Cette feature **n'introduit aucun nouveau mécanisme de tracking ni nouveau
consentement** : elle expose au pro un agrégat sur des données déjà collectées.

## Périmètre « prospects acceptés » (automatique)

Les deux routes d'envoi imposent déjà : campagne `completed` (clôturée) +
relation `accepted`/`settled`. Toutes les lignes `email_sent` concernent donc
des prospects ayant accepté. Aucune logique de filtrage supplémentaire requise.

## Honnêteté du dénominateur

Le pixel n'est posé **que** chez les prospects ayant consenti. Mettre *tous*
les envois au dénominateur ferait artificiellement chuter le taux (les envois
sans consentement ne peuvent jamais être comptés « ouverts »). Le taux se
calcule donc sur les **envois réellement traçables**.

Un envoi est « traçable » s'il portait un pixel. On le détermine par une
nouvelle colonne `pro_contact_actions.tracking_pixel_embedded` (booléen, posée
à l'envoi selon le consentement réel). Robustesse côté calcul : un envoi est
aussi traçable si `email_opened_at IS NOT NULL` (une ouverture prouve la
présence d'un pixel) — garantit `opened ⊆ trackable` indépendamment du backfill.

Affichage transparent : **taux + « X ouvertures / Y messages suivis »** et, en
secondaire, **« Z envoyés au total »**.

## Architecture

### 1. Migration (additive)
`supabase/migrations/<ts>_pro_contact_actions_pixel_embedded.sql`
- `add column if not exists tracking_pixel_embedded boolean` (nullable ; null =
  inconnu pour l'historique).
- Backfill : `update ... set tracking_pixel_embedded = true where kind =
  'email_sent' and email_opened_at is not null` (ces envois portaient un pixel).
- Application : SQL Editor remote + `migration repair` (les migrations
  local/remote sont divergées — pas de `db push`).

### 2. Fonction pure testable
`lib/pro/message-opens.ts` :
```ts
type MessageActionRow = { emailOpenedAt: string | null; trackingPixelEmbedded: boolean | null };
computeMessageOpenStats(rows): { sent: number; trackable: number; opened: number; rate: number | null }
```
- `sent` = nombre de lignes
- `opened` = lignes avec `emailOpenedAt != null`
- `trackable` = lignes avec `trackingPixelEmbedded === true` **ou** `emailOpenedAt != null`
- `rate` = `trackable > 0 ? round(opened / trackable * 100) : null`

Tests : `tests/lib/pro/message-opens.test.ts` (zéro envoi, aucun traçable,
mélange consentis/non-consentis, historique sans flag mais ouvert, arrondi).

### 3. Pose du flag à l'envoi
- `POST /api/pro/contacts/[relationId]/email` : `tracking_pixel_embedded: trackingConsent`.
- `POST /api/pro/segments/broadcast` : `tracking_pixel_embedded: r.trackingConsent` par destinataire.

### 4. Agrégat dans `/api/pro/analytics`
Lit `pro_contact_actions` du pro (`kind='email_sent'`), filtre `campaign_id` si
`campaignFilter`, filtre `created_at >= sinceIso` si période. Calcule via
`computeMessageOpenStats`. Ajoute au JSON :
```ts
messageOpens: { sent, trackable, opened, rate }
```

### 5. UI — carte dans `Analytics()` (`public/prototype/components/Pro.jsx`)
Nouvelle carte « Lecture des messages » sous le sous-titre de périmètre :
- Grand `rate %` (ou état vide explicite si `rate === null`).
- Ligne « {opened} ouverture(s) sur {trackable} message(s) suivi(s) ».
- Secondaire « {sent} envoyé(s) au total ».
- État vide (`sent === 0` ou `rate === null`) : note expliquant que le suivi
  nécessite le consentement du prospect.
Respecte les filtres campagne/période existants (déjà passés à l'API).
Pas de bump `PROTOTYPE_VERSION` (auto-busté au déploiement / restart dev).

## Hors périmètre (YAGNI)
- Pas de détail par prospect (qui a ouvert) — agrégat seul.
- Pas de suivi des clics, ni des re-ouvertures (1re ouverture seulement, déjà ainsi).
- Pas de modification du flux de consentement CNIL.
- Pas de réplication mobile (web only ; à synchroniser sur demande explicite).

## Tests / vérification
- `npm test` (fonction pure), `tsc`, `eslint`.
- Vérif navigateur : onglet Analytics affiche la carte avec données réelles.
