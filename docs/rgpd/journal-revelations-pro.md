# Journal d'audit des révélations de données aux professionnels

**Document technique & conformité RGPD** — à présenter en cas de contrôle (CNIL).
Dernière mise à jour : **14/06/2026**.

Ce document décrit comment BUUPP tient la promesse affichée publiquement
(page « À propos ») :

> « L'identité réelle reste réversible par buupp seul, et **chaque révélation
> est journalisée conformément au RGPD**. »

---

## 1. Principe : pseudonymisation à la lecture (réversible par BUUPP seul)

Les données des prospects sont **stockées en clair** dans la base, mais ne sont
**jamais transmises telles quelles** au professionnel. La transformation
(masquage, généralisation, catégorisation) est appliquée **au moment de la
lecture**, côté serveur :

- Code : `lib/pro/pseudonymize.ts` (`applyKind`, `pseudonymizeTierItems`,
  `ageRange`, `postalToDept`, `maskToken`, `animalCategory`…).
- Point d'application : `app/api/pro/contacts/[relationId]/details/route.ts`.

Conséquence : seul BUUPP (serveur) peut relier un profil pseudonymisé à la
personne réelle → la ré-identification est **réversible par BUUPP seul**.

L'e-mail n'est jamais révélé en clair : il est remplacé par un **alias
watermarqué** unique par relation (`prospect+rXXX@buupp.com`, routé via
Cloudflare), ce qui permet de tracer toute fuite jusqu'au professionnel
émetteur. Voir `lib/aliases/relation-email.ts`.

---

## 2. Le journal des révélations

### 2.1 Qu'est-ce qu'une « révélation » ?

Toute action d'un professionnel qui accède à une donnée personnelle d'un
prospect au-delà de l'affichage pseudonymisé courant. Trois points d'entrée,
tous journalisés :

| Endpoint | Action du pro | `field` journalisé |
|---|---|---|
| `POST /api/pro/contacts/[relationId]/reveal` | Révèle e-mail / téléphone / nom complet d'un prospect | `email` \| `telephone` \| `name` |
| `POST /api/pro/contacts/[relationId]/details` | Ouvre la fiche détaillée (catégories payées dans la campagne) | `details` |
| `POST /api/pro/contacts/group-reveal` | Récupère en lot les alias e-mail d'un segment | `email` (1 ligne par prospect) |

### 2.2 Table d'audit `pro_contact_reveals`

Migration d'origine : `supabase/migrations/20260505040000_pro_contact_reveals.sql`
(+ extensions du champ `field` : `…_field_name.sql`, `…_reveals_field_details.sql`).

| Colonne | Type | Rôle |
|---|---|---|
| `id` | `uuid` (PK) | identifiant de l'entrée |
| `pro_account_id` | `uuid` → `pro_accounts(id)` | **QUI** a accédé |
| `relation_id` | `uuid` → `relations(id)` | **À QUEL** prospect (via la relation) |
| `field` | `text` (`email`/`telephone`/`name`/`details`) | **QUOI** a été révélé |
| `revealed_at` | `timestamptz` (`default now()`) | **QUAND** |

Index : par pro (`pro_account_id, revealed_at desc`) et par relation
(`relation_id, revealed_at desc`).

---

## 3. Garanties techniques (mesures de sécurité)

### 3.1 « Chaque révélation est journalisée » — écriture FAIL-CLOSED

> Modifié le 14/06/2026.

Avant : l'écriture du journal était « best-effort » — en cas d'échec de
l'insert, la donnée était **quand même** renvoyée au pro (la révélation
pouvait avoir lieu sans trace).

Désormais : les trois endpoints sont **fail-closed**. Si l'écriture du journal
échoue, l'API renvoie **HTTP 500 `audit_failed`** et **n'expose PAS** la donnée.
**Aucune révélation ne peut donc avoir lieu sans être journalisée.**

Fichiers :
- `app/api/pro/contacts/[relationId]/reveal/route.ts`
- `app/api/pro/contacts/[relationId]/details/route.ts`
- `app/api/pro/contacts/group-reveal/route.ts`

### 3.2 Journal verrouillé (inviolable en modification) — append-only

> Migration ajoutée le 14/06/2026 :
> `supabase/migrations/20260718120000_pro_contact_reveals_append_only.sql`

Un **trigger PostgreSQL** rejette tout `UPDATE` sur `pro_contact_reveals`, **y
compris pour le `service_role`** (le compte technique de l'application, qui
ignore la RLS). Une entrée écrite est donc **immuable** : impossible d'altérer
a posteriori qui a accédé à quoi et quand.

Le `DELETE` n'est **volontairement pas bloqué** : les clés étrangères sont
`ON DELETE CASCADE`, afin que l'effacement d'un prospect (droit à l'effacement,
art. 17 RGPD) emporte aussi ses lignes d'audit. Aucun code applicatif ne fait
de `DELETE` direct (vérifié) ; les seules suppressions possibles sont ces
cascades d'effacement légitimes.

### 3.3 Cloisonnement des accès (RLS)

`pro_contact_reveals` a la **Row Level Security activée sans aucune policy** :
les rôles `anon` et `authenticated` ne peuvent **ni lire ni écrire**. Seul le
`service_role` (client admin serveur) y accède. Aucun professionnel, aucun
visiteur ne peut consulter ou modifier le journal.

### 3.4 Minimisation du contenu du journal

Le journal ne stocke **que** les métadonnées d'accès (qui / quoi / quand), pas
la valeur révélée elle-même. La preuve de l'accès n'introduit donc pas de
copie supplémentaire de la donnée personnelle.

---

## 4. Flux résumé (exemple : révélation d'un e-mail)

1. Le pro authentifié (Clerk) appelle `POST /api/pro/contacts/{id}/reveal`.
2. Vérification des droits : relation `accepted`/`settled`, campagne autorisée
   (`proCanSeeContacts`), donnée présente.
3. Génération de l'**alias watermarqué** (pas l'e-mail réel).
4. **Écriture du journal** `pro_contact_reveals` (fail-closed).
5. Si l'écriture échoue → `500`, **rien n'est révélé**.
6. Sinon → l'alias est renvoyé au pro.

---

## 5. Conservation & droits des personnes

- **Effacement (art. 17)** : l'effacement d'un prospect/d'une relation supprime
  ses entrées d'audit par cascade.
- **Accès (art. 15)** : le journal permet de répondre à une demande d'un
  prospect « qui a accédé à mes données et quand » (requête par `relation_id`).

- **Conservation limitée (art. 5.1.e)** : **24 mois** (durée de politique à
  valider avec le DPO), au-delà desquels les entrées sont **purgées
  quotidiennement**. Implémenté le 14/06/2026 : `lib/pro/reveals-retention.ts`
  (`purgeOldContactReveals`, constante `REVEALS_RETENTION_MONTHS`), appelé en
  piggyback du cron quotidien `/api/admin/digest` (Vercel Hobby = 1 cron/jour).
  Le verrou append-only n'interdit que l'`UPDATE`, donc la purge `DELETE` reste
  possible.

---

## 6. Récapitulatif des modifications du 14/06/2026

| # | Changement | Fichier |
|---|---|---|
| a | Audit **fail-closed** (pas de journal → pas de révélation) sur les 3 endpoints | `…/reveal/route.ts`, `…/details/route.ts`, `…/group-reveal/route.ts` |
| b | **Verrou append-only** (trigger anti-`UPDATE`) sur le journal — **appliqué en prod le 14/06/2026** | `supabase/migrations/20260718120000_pro_contact_reveals_append_only.sql` |
| c | **Rétention 24 mois + purge quotidienne** | `lib/pro/reveals-retention.ts`, intégré à `app/api/admin/digest/route.ts` |

La migration (b) a été appliquée à la base de production `buupp`
(`yalgztstdmytviiyvixz`) — trigger `pro_contact_reveals_lock_update` actif.
