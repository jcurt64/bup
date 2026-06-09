# FREEBUUPP — Design / Spec

**Date :** 2026-06-09
**Branche :** `feat/freebuupp` (NON mergée sur `main`, NON déployée)
**Statut :** validé en brainstorming, en attente de relecture utilisateur avant implémentation.

> ⚠️ **Ne pas déployer.** Service à garder en réserve, lancé plus tard quand la
> plateforme BUUPP sera mûre et fréquentée. Branche dédiée, migration écrite
> mais **non appliquée** au remote, derrière un flag `app_config.freebuupp_enabled`
> (défaut `false`).

---

## 1. Intention & objectif

FREEBUUPP est une **campagne spéciale de type tirage au sort** lancée par un
professionnel pour faire découvrir un produit ou un service. Le pro met en jeu
un lot (produit/service gratuit) ; des prospects s'inscrivent ; à la clôture, un
**tirage aléatoire vérifiable** désigne les gagnants.

**Double objectif :** attirer du trafic sur l'application (vitrine publique,
viralité, preuve sociale) **et** monétiser (10 € par FREEBUUPP).

**Contraintes produit :** simple à comprendre pour les prospects, zéro friction
à la participation.

---

## 2. Décisions de conception (verrouillées)

| # | Décision | Choix retenu |
|---|----------|--------------|
| 1 | Comment les prospects rejoignent | **Vitrine publique ouverte à l'inscription** (opt-in), plafonnée au panel. Premier arrivé, premier inscrit. |
| 2 | Prix pour le pro | **10 € fixe**, quel que soit le panel (30/50/80) et le nombre de gagnants (2/5/10). |
| 3a | Éligibilité prospect | **Téléphone vérifié uniquement** (pas de paliers, pas de KYC). |
| 3b | Panel non rempli | **Tirage sur les inscrits réels**, `gagnants = min(demandés, participants)`. **0 inscrit → remboursement.** |
| 4a | Paiement des 10 € | **Wallet pro existant** (débit immédiat, transaction `buupp_commission`, auto-recharge). |
| 4b | Critère géographique | **Réutilise le ciblage existant** (ville / dept / région / national). Rayon km reporté. |
| 5a | Tirage | **Vérifiable (provably-fair)** : seed_hash publié à l'ouverture, seed révélé au tirage. |
| 5b | Page publique | **Accessible sans connexion** (SEO / partage / trafic). |

---

## 3. Modèle de données (Supabase)

Nouveau domaine, **séparé** des `campaigns` (mécanique trop différente : pas de
rémunération par contact, pas de `relations`).

### 3.1 Table `freebuupps`

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `pro_account_id` | uuid FK → `pro_accounts(id)` on delete cascade | propriétaire |
| `code` | text unique | slug public, ex. `FB-7K2P` |
| `title` | text not null | titre du tirage |
| `prize_description` | text not null | le lot à gagner |
| `brand_name` | text not null | raison sociale figée à la création |
| `panel_size` | int not null check in (30,50,80) | plafond d'inscriptions |
| `winners_count` | int not null check in (2,5,10) | gagnants demandés |
| `geo` | text not null | `ville` \| `dept` \| `region` \| `national` |
| `geo_target` | jsonb | même format que `campaigns.targeting.geoTarget` |
| `status` | text not null default `open` | `open` \| `closed` \| `drawn` \| `canceled` |
| `opens_at` | timestamptz not null default now() | |
| `closes_at` | timestamptz not null | `opens_at + 24h` |
| `drawn_at` | timestamptz | rempli au tirage |
| `seed_hash` | text not null | `sha256(seed)`, publié dès l'ouverture |
| `seed` | text | révélé au tirage (null avant) |
| `fee_cents` | bigint not null default 1000 | 10 € |
| `refunded` | bool not null default false | true si remboursé (0 inscrit) |
| `created_at` / `updated_at` | timestamptz | trigger `tg_set_updated_at` |

Index : `(pro_account_id)`, `(status)` partiel `where status='open'`, `(closes_at)`.
RLS : policy propriétaire (pattern `campaigns_owner_all`). Lecture publique gérée
côté API via service_role (pas d'exposition directe de la table).

### 3.2 Table `freebuupp_participants`

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `freebuupp_id` | uuid FK → `freebuupps(id)` on delete cascade | |
| `prospect_id` | uuid FK → `prospects(id)` on delete cascade | |
| `participant_number` | int not null | séquentiel 1..N par freebuupp — **le numéro tiré** |
| `is_winner` | bool not null default false | défini au tirage |
| `created_at` | timestamptz not null default now() | |

Contraintes : **unique `(freebuupp_id, prospect_id)`** (une participation par
prospect), **unique `(freebuupp_id, participant_number)`**.
RLS : le prospect lit ses propres participations.

### 3.3 Config

`app_config.freebuupp_enabled` (bool, défaut `false`) — gate d'activation sans
redéploiement, comme `referrals_enabled`.

---

## 4. Cycle de vie

```
open ──(24h écoulées OU panel plein)──> closed ──(pro tire OU cron +48h)──> drawn
  └─(0 inscrit à la clôture)──> canceled + remboursement 10€
```

1. **`open`** — pro a payé ; prospects éligibles s'inscrivent jusqu'à
   `panel_size` **ou** `closes_at`.
2. **`closed`** — inscriptions fermées ; pro alerté (notif + mail) ; bouton
   « Lancer le tirage » visible.
3. **`drawn`** — tirage exécuté, gagnants définis, seed révélée, notifs/mails
   envoyés, téléphones gagnants révélés au pro.
4. **Backstop cron** — si pro n'a pas tiré 48 h après `closed`, tirage
   automatique. Étend le cron quotidien existant.
5. **`canceled`** — 0 inscrit à la clôture → remboursement 10 € (recrédit wallet
   + transaction inverse), `refunded=true`.

La transition `open → closed` est calculée à la lecture (si `now > closes_at` ou
panel plein) et matérialisée par le cron quotidien.

---

## 5. Économie (calculée côté serveur uniquement)

- À la création : solde wallet **disponible** (`balance - reserved`) ≥ 1000
  cents, sinon `402 insufficient_funds`.
- **Débit immédiat** de 10 € (frais forfaitaire, pas de réservation per-contact)
  → `transactions(type='buupp_commission', amount_cents=-1000, freebuupp_id, description="FREEBUUPP — <titre>")`.
- Garde-fou réutilisé : **raison sociale + ville** renseignées obligatoires
  (sinon affichage public anonyme) — même règle que `/api/pro/campaigns`.
- **Auto-recharge** Stripe déclenchée si solde sous seuil (fire-and-forget).
- **Remboursement** (0 inscrit) : recrédit 1000 cents +
  `transactions(type=..., amount_cents=+1000, description="Remboursement FREEBUUPP (aucun inscrit)")`.

---

## 6. Tirage vérifiable (provably-fair)

- **Création** : `seed` = chaîne aléatoire (32 octets hex). On stocke
  `seed_hash = sha256(seed)` et on le **publie** dès l'ouverture. `seed` reste
  secret jusqu'au tirage.
- **Tirage** : on fige la liste des `participant_number`, on révèle `seed`, et on
  ordonne les participants par `sha256(seed + ":" + participant_number)`
  (tri lexicographique du hash). On prend les `min(winners_count, participants)`
  premiers → `is_winner = true`.
- **Vérification publique** : quiconque peut recalculer `sha256(seed) == seed_hash`
  ✓ puis rejouer le tri sur la liste publique des numéros → **mêmes gagnants**.
- Affichage : badge **« Tirage vérifié 🔒 »** + seed + seed_hash.

Déterministe, reproductible, sans dépendance à `Math.random` au moment décisif.
Implémenté dans `lib/freebuupp/draw.ts`, testable isolément.

> Note plateforme : les workflows/harness interdisent `Math.random`, mais le
> **code applicatif** Next.js (runtime nodejs) peut utiliser `crypto.randomBytes`
> pour générer le seed à la création. Le tirage lui-même n'utilise QUE le hash.

---

## 7. Parcours pro

**Entrée dédiée** « Lancer un FREEBUUPP » (distincte du wizard campagne).
Formulaire 1 écran : titre, description du lot, panel (30/50/80), gagnants
(2/5/10), géo (composant existant), récap 10 €.

Garde : `winners_count < panel_size` (combinaison absurde refusée).

À la clôture : notif in-app + mail Brevo « FREEBUUPP clôturé — X participants,
lance le tirage 🎲 ». Détail pro : bouton **« Lancer le tirage »**. Après tirage :
liste des gagnants = **numéro + téléphone uniquement** (appels via Brevo).

---

## 8. Parcours prospect

- Section **« FREEBUUPP 🎁 »** (web + mobile) : feed des tirages `open`
  correspondant à la zone géo du prospect.
- Carte : marque, lot, **compte à rebours 24 h**, places restantes (« 18/30 »),
  nombre de gagnants.
- **« Je participe »** → gardes : compte prospect + **téléphone vérifié**
  (sinon redirige `/api/prospect/phone`), éligibilité géo, panel non plein, pas
  clôturé, pas déjà inscrit. Attribue `participant_number` séquentiel.
- Confirmation **ticket** : « Ton numéro : **#27** » — tangible, partageable.
- **Résultats** : notif gagnant (in-app + mail) « 🎉 Tu as gagné — le pro va te
  contacter par téléphone » ; perdant (in-app seul) « Pas cette fois, tente le
  prochain ».

---

## 9. Page publique (sans connexion)

- `/freebuupp` — **Mur des FREEBUUPP** : tirages en cours (compte à rebours,
  incite à s'inscrire) + tirages passés.
- `/freebuupp/[code]` — détail : marque, lot, **numéros gagnants**, badge tirage
  vérifié + seed/seed_hash. **Aucune donnée perso** (numéros anonymes) → conforme
  RGPD, bon pour SEO / partage social.

---

## 10. API (backend partagé web + mobile)

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/pro/freebuupps` | créer (débit 10 €, seed_hash, code) |
| GET | `/api/pro/freebuupps` | liste du pro + statuts |
| GET | `/api/pro/freebuupps/[id]` | détail pro (+ gagnants & tél si `drawn`) |
| POST | `/api/pro/freebuupps/[id]/draw` | lancer le tirage (idempotent) |
| GET | `/api/prospect/freebuupps` | feed ouverts éligibles + « déjà inscrit » |
| POST | `/api/prospect/freebuupps/[id]/join` | participer (toutes gardes) |
| GET | `/api/prospect/freebuupps/mine` | mes participations + résultats |
| GET | `/api/freebuupps` | **public** — mur |
| GET | `/api/freebuupps/[code]` | **public** — détail vérifiable |
| (cron) | extension du cron quotidien | auto-draw `closed`>48h + remboursement 0-inscrit |

---

## 11. Découpage en unités (lib/freebuupp/)

| Unité | Rôle | Dépend de | Testable seul |
|---|---|---|---|
| `draw.ts` | tirage vérifiable (seed→gagnants), vérification | crypto (sha256) | ✅ |
| `eligibility.ts` | gardes participation (tél, géo, plein, doublon, clôture) | — (entrées pures) | ✅ |
| `pricing.ts` | constante 10 €, remboursement | — | ✅ |
| `mail.ts` | mails gagnant / clôture pro (Brevo) | `lib/brevo` | mock |
| `lifecycle.ts` | transitions open→closed→drawn, cron backstop | admin client | intégration |

---

## 12. Cross-plateforme

**Web** : `app/pro/...` (création + détail/draw), `app/prospect/...` (feed +
ticket + résultats), `app/freebuupp/` (public). Patterns `.jsx` prototype existants.

**Mobile** (worktree `worktree-mobile-app`, **non mergé**) : réplique écrans
prospect (feed, participation, ticket, résultats) + pro (création, bouton tirage)
+ push Expo gagnant. **Même backend `/api/*`.** Synchronisation web→mobile sur
demande explicite ; impacts croisés (API/auth/schéma) signalés.

---

## 13. CGV

Nouvelle section « FREEBUUPP » dans `app/cgv` :
- nature du service : jeu / tirage au sort, **sans obligation d'achat** ;
- 10 € **non remboursables** sauf si aucun inscrit ;
- tirage **aléatoire vérifiable** ;
- données révélées au pro **limitées au téléphone des gagnants** ;
- **lot fourni par le professionnel** ; BUUPP = intermédiaire technique, non
  responsable de la remise du lot ;
- conservation / suppression des données participants (alignée RGPD existant).

---

## 14. Tests (Vitest)

- `draw.test.ts` : déterminisme (même seed → mêmes gagnants), vérifiabilité
  (`sha256(seed)==seed_hash`), plafond `min(winners, participants)`, 0 inscrit,
  unicité des numéros tirés.
- `eligibility.test.ts` : chaque garde (tél manquant, hors géo, panel plein,
  doublon, clôturé).
- `pricing.test.ts` : montant fixe, branche remboursement.

---

## 15. Idées originales retenues

1. **Numéro-ticket « #27 »** — tangible, mémorisable, partageable.
2. **Tirage vérifié 🔒** — transforme la méfiance en argument de confiance.
3. **Compte à rebours 24 h** — urgence, pousse à l'inscription immédiate.
4. **Mur des gagnants public** — preuve sociale + SEO → trafic.

---

## 16. Garde-fous « non-déployé »

- Branche `feat/freebuupp`, **jamais mergée sur `main`**.
- Migration Supabase **écrite mais NON appliquée** au remote (respecte la règle
  projet : SQL Editor + `migration repair`, jamais `db push`) tant que
  l'utilisateur ne le décide pas.
- Flag `app_config.freebuupp_enabled = false` par défaut → activable plus tard
  sans redéploiement.
- Aucun lien d'entrée visible (nav pro/prospect) tant que le flag est off.
