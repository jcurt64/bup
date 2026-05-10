# BUUPP Admin Dashboard — Design

**Date** 2026-05-10
**Statut** Design (à valider avant `writing-plans`)
**Périmètre** V1 : back-office interne, lecture seule, accessible uniquement par lien direct, alimenté par les données déjà collectées en base + nouvelle table d'événements pour le live-feed et les mails admin.

---

## 1. Objectif & non-objectifs

### Objectif
Donner à l'admin (toi) une vue unique et temps-réel de la santé de la plateforme BUUPP : acquisition, monétisation, qualité de la base prospects, performance des pros, événements en direct, alertes par mail. La V1 doit permettre de répondre en moins d'une minute aux questions :

- Combien de prospects/pros nouveaux aujourd'hui / ce mois / ce trimestre ?
- Combien de campagnes actives, pour quel budget total, dépensé à hauteur de combien ?
- Quels pros et quelles campagnes performent (et lesquels brûlent du budget pour rien) ?
- Quels prospects refusent en masse, pour quels motifs ?
- Y a-t-il un incident technique en cours (Stripe, SMTP, cron) ?

### Non-objectifs (V1)
- **Aucune action destructive depuis l'UI** (pas de suspendre/rembourser/forcer). Tout est read-only.
- Pas de modification du schéma métier existant (prospects/pros/campagnes/relations/transactions). Une seule table neuve : `admin_events`.
- Pas de configuration de notifications par admin et par type d'event (la politique stratifiée par sévérité est codée en dur, ajustable plus tard).
- Pas d'export CSV/PDF en V1 (à voir si besoin).
- Pas d'observabilité externe (Sentry, Datadog) — on se contente des logs serveur Next.js et des events `system.*`.

---

## 2. Décisions de conception (cadrage validé)

| Sujet | Décision | Raison |
|---|---|---|
| URL | `/buupp-admin` (root segment, non lié depuis le site, `robots: noindex`, jamais dans `RouteNav` ni `sitemap.xml`) | Lisible pour toi, mais invisible publiquement. La sécurité ne repose **pas** sur l'obscurité de l'URL, elle repose sur l'auth Clerk + allowlist. |
| Auth UI | Clerk + allowlist d'emails (env `ADMIN_EMAILS`, séparée par virgules) | Audit "qui a fait quoi" via le `userId` Clerk, 2FA possible, survit aux changements d'IP. |
| Auth machine (cron, scripts) | Header `x-admin-secret` (env `BUUPP_ADMIN_SECRET`) inchangé | Déjà en place pour `/api/admin/waitlist/launch-email`. |
| Comportement non-admin | `notFound()` (404) | Ne pas révéler l'existence du dashboard. |
| Lecture DB | `createSupabaseAdminClient()` (service_role) côté server | Bypass RLS pour agréger sur toute la base sans casser les policies des comptes utilisateurs. |
| Live-feed | SSE serveur adossé à Supabase Realtime côté serveur (cf. §4.2) | Push natif, latence minimale ; SSE permet de garder la table `admin_events` totalement fermée (pas de policy à maintenir). |
| Politique mails admin | Stratifiée par sévérité (cf. §6.3) | Évite la noyade au-delà de la phase founders. |
| Revenu BUUPP affiché | Take-rate configurable via env `BUUPP_TAKE_RATE` (défaut `0.20`) | Simple, ajustable sans redéploiement, transparent. |
| Périodes | Sélecteur global Aujourd'hui / 7 j / 30 j / Trimestre courant / 12 mois / Tout, avec comparaison vs période précédente | Cohérent avec ce qu'on demande à l'admin (suivi quotidien/mensuel/trimestriel). |
| Granularité timeseries | Auto : jour si ≤30 j, semaine si ≤90 j, mois si ≤12 mois | Réutilise le pattern de `/api/pro/timeseries`. |

---

## 3. Architecture

### 3.1 Arborescence Next.js (App Router, Next 16)

```
app/
  buupp-admin/
    layout.tsx                  # garde admin (Server Component) + chrome (sidebar/topbar)
    page.tsx                    # vue d'ensemble (KPI bandeau + 3 graphes + feed)
    prospects/
      page.tsx                  # section Prospects
      [id]/page.tsx             # fiche prospect read-only
    pros/
      page.tsx                  # section Pros
      [id]/page.tsx             # fiche pro read-only
    campagnes/
      page.tsx                  # section Campagnes (cross-pro)
      [id]/page.tsx             # fiche campagne
    transactions/
      page.tsx                  # journal financier (filtrable)
    waitlist/
      page.tsx                  # waitlist + bouton "envoyer mail de lancement"
    sante/
      page.tsx                  # statut webhooks Stripe, cron, SMTP, OTP
    _components/
      AdminGuard.tsx            # client boundary pour erreurs gracieuses
      KpiCard.tsx
      Sparkline.tsx
      PeriodPicker.tsx
      LiveFeed.tsx              # subscribe Realtime + render
      NotificationBell.tsx
  api/
    admin/
      waitlist/launch-email/    # existant, inchangé
      stats/
        overview/route.ts       # KPIs globaux (bandeau + 3 timeseries)
        prospects/route.ts      # KPIs section prospects
        pros/route.ts           # KPIs section pros
        campaigns/route.ts      # KPIs section campagnes
        transactions/route.ts   # journal + filtres
        health/route.ts         # statut webhooks/cron/SMTP
      events/
        route.ts                # GET liste paginée filtrée (?since=<iso> pour fallback)
        stream/route.ts         # GET SSE adossé à Supabase Realtime (live-feed)
        [id]/read/route.ts      # POST marquer comme lu (par admin)
      digest/route.ts           # POST déclenché par cron (8h, 18h) → mail digest
```

### 3.2 Garde admin (centralisée dans `proxy.ts`)

Ajout dans `proxy.ts` (le middleware Next 16 du projet) :

1. Si `req.nextUrl.pathname.startsWith("/buupp-admin")` ou `/api/admin/` (hors `/api/admin/waitlist/launch-email` qui garde son `x-admin-secret`) :
   - Récupérer `userId` Clerk via `clerkMiddleware`.
   - Si pas de `userId` → `NextResponse.rewrite("/404")`.
   - Sinon, récupérer l'email primaire du user (via `clerkClient.users.getUser(userId)` — caché 60 s pour éviter de payer un call Clerk par requête).
   - Si l'email n'est pas dans `ADMIN_EMAILS.split(",")` → `NextResponse.rewrite("/404")`.
2. Le helper `isAdminEmail(email)` est extrait dans `lib/admin/access.ts` pour être réutilisé côté Server Components et Route Handlers (ceinture + bretelles).

> Note Next 16 : `proxy.ts` remplace `middleware.ts` dans cette version. Cf. `node_modules/next/dist/docs/` avant d'ajouter du code.

### 3.3 Lecture des données

- **Tous les Route Handlers** sous `/api/admin/stats/**` utilisent `createSupabaseAdminClient()` (service_role) pour bypass RLS et calculer les agrégats.
- Les pages serveur consomment ces handlers via `fetch` côté serveur (cache `no-store`) ou directement leurs helpers (`lib/admin/queries/*.ts`) pour éviter le rond-trip HTTP. Choix par défaut : helpers directs, plus rapides et plus simples à tester.
- Les graphes/listes côté client lisent les handlers en `fetch` classique (avec révalidation au changement de période).

### 3.4 Helpers partagés (`lib/admin/`)

```
lib/admin/
  access.ts            # isAdminEmail(email), getAdminUser() (currentUser + check)
  queries/
    overview.ts        # KPIs bandeau + timeseries globales
    prospects.ts       # funnel, paliers, scores, vérifications, motifs refus
    pros.ts            # plans, MRR, churn, top secteurs
    campaigns.ts       # status counts, budget vs spent, perf, ciblage
    transactions.ts    # journal + filtres (par account/type/status)
    health.ts          # last cron, last webhook, SMTP failures
  events/
    record.ts          # recordEvent(type, severity, payload)
    digest.ts          # buildDigest(periodStart, periodEnd, severity)
    mail.ts            # sendCriticalAlert / sendDigest (utilise lib/email/transport.ts)
  periods.ts           # PeriodKey type + currentRange / previousRange / bucketize
```

---

## 4. Modèle de données (ajouts)

### 4.1 Table `admin_events`

```sql
create type public.admin_event_severity as enum ('info', 'warning', 'critical');

create table public.admin_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,                          -- ex: 'prospect.signup', 'campaign.created'
  severity public.admin_event_severity not null default 'info',
  payload jsonb not null default '{}'::jsonb,
  -- Références molles (set null à la suppression).
  prospect_id uuid references public.prospects(id) on delete set null,
  pro_account_id uuid references public.pro_accounts(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  relation_id uuid references public.relations(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  -- État lu / non-lu (par admin).
  read_by jsonb not null default '{}'::jsonb,  -- { "<userId clerk>": "<iso ts>" }
  created_at timestamptz not null default now()
);

create index admin_events_created_at_idx on public.admin_events (created_at desc);
create index admin_events_type_idx on public.admin_events (type);
create index admin_events_severity_unread_idx
  on public.admin_events (severity, created_at desc)
  where (read_by = '{}'::jsonb);

alter table public.admin_events enable row level security;
-- Aucune policy → seul service_role lit/écrit. Le client UI navigateur ne
-- peut PAS s'abonner directement à la table en Realtime (les souscriptions
-- Realtime respectent RLS). On expose donc le live-feed via un endpoint
-- SSE serveur (cf. §4.2) qui se branche sur Realtime côté serveur avec
-- service_role, puis stream au navigateur. Cela évite d'ouvrir une policy
-- "admin only" qui complexifierait le modèle (il faudrait persister la
-- liste des admins en DB pour la check dans la policy).
```

> Le champ `read_by` est un dictionnaire JSON `{ clerkUserId: timestamp }` pour permettre à plusieurs admins de marquer indépendamment "lu/non-lu". On évite une table `admin_event_reads` séparée tant qu'on a < 5 admins (YAGNI).

### 4.2 Live-feed via SSE adossé à Realtime

- Endpoint `GET /api/admin/events/stream` (Route Handler `runtime: nodejs`, `dynamic: force-dynamic`).
- Côté serveur : `createSupabaseAdminClient().channel('admin_events').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_events' }, ...)`.
- Chaque INSERT reçu est ré-émis sur le `ReadableStream` du SSE vers le client (format `data: <json>\n\n`).
- Le client (`LiveFeed.tsx`) ouvre une `EventSource('/api/admin/events/stream')` et injecte les events en tête de la liste.
- Activation Realtime à faire en migration : `alter publication supabase_realtime add table public.admin_events;`.
- Reconnexion auto gérée par `EventSource`. Côté serveur, on envoie un keepalive `: ping\n\n` toutes les 25 s pour traverser les proxies.
- Si le SSE est coupé (timeout long, suspend), le client retombe sur un poll `GET /api/admin/events?since=<lastTs>` toutes les 30 s.

### 4.3 Pas d'autres ajouts en V1

- Pas de table `admin_notification_prefs` (la politique est globale, codée en dur).
- Pas de table d'audit "qui a vu quelle page" (YAGNI).

---

## 5. Sections du dashboard (contenu détaillé)

### 5.1 Vue d'ensemble (`/buupp-admin`)

**Bandeau KPI** (chaque carte : valeur · delta % vs période précédente · sparkline 30 j cliquable) :

- Inscrits waitlist · Inscrits prospects · Inscrits pros · Conversion waitlist → prospect (%)
- Campagnes actives · Campagnes lancées (période) · Sollicitations envoyées · Taux d'acceptation global
- **Budget total des campagnes lancées** · Dépensé réel · Crédité prospects · Recharges Stripe pros
- Revenu BUUPP estimé (`take_rate × campaign_charge` somme)
- Taux d'expiration 72 h · Taux de refus · Délai médian d'acceptation · Erreurs SMTP/Stripe sur 24 h

**3 timeseries** (granularité auto selon période) :

1. Inscriptions cumulées prospects vs pros.
2. Sollicitations envoyées / acceptées / refusées / expirées (stacked bars).
3. Money flow : budget engagé vs dépensé vs crédité prospects (multi-line).

**Live-feed** (panneau droit, sticky) : 30 derniers events + filtre par sévérité, mise à jour Realtime.

### 5.2 Section Prospects (`/buupp-admin/prospects`)

**Acquisition & funnel**
- Inscrits par jour/semaine/mois/trimestre, segmentés `is_founder` vs non.
- Funnel : waitlist → compte créé → palier 1 → téléphone vérifié → 1ʳᵉ relation acceptée → 1ᵉʳ retrait.
- Cohortes hebdo : rétention J+7 / J+30 / J+90.

**Profilage & qualité**
- Histogramme paliers complétés (1 à 5).
- Distribution BUUPP score (buckets de 200).
- Donut niveaux de vérification (`basique` / `verifie` / `certifie` / `confiance`).
- Taux téléphone vérifié.
- Top 10 villes, top 10 secteurs, distribution âge, distribution genre (réutilise la logique de `/api/pro/analytics`).
- Préférences : % "tous types", types les plus exclus.
- Signaux RGPD : nombre de prospects avec `removed_tiers` ou `hidden_tiers` non vide (par palier).

**Engagement & monétisation**
- Sollicitations reçues / acceptées / refusées / expirées (taux + médiane temps de réponse).
- Top motifs de refus (depuis `relation_feedback`) — **tableau cliquable, indispensable pour l'orientation produit**.
- € crédités par jour/mois/trimestre.
- Retraits : nombre, montant total, montant moyen, échecs Stripe Connect.
- Solde cumulé en attente (séquestre `escrow` non `settled`).
- Fondateurs : count `is_founder`, bonus appliqués (`founder_bonus_applied` count + €).
- Parrainage : top parrains (`ref_code` agrégé), nombre de filleuls convertis (jointure `waitlist.ref_code` → `prospect_identity.email`).

**Liste prospects** (paginée, filtres : score, vérif, paliers, founder, date)
Colonnes : email · ville · score · vérification · paliers complétés · €cumulés · dernière activité · founder?
→ Lien vers fiche prospect read-only (`/buupp-admin/prospects/[id]`).

### 5.3 Section Pros (`/buupp-admin/pros`)

**Acquisition & plans**
- Inscrits pros par jour/mois/trimestre.
- Répartition par `plan` (`starter` / `pro`) et par `billing_status`.
- MRR estimé (depuis `pro_accounts.plan` × tarif Stripe configuré côté code) + churn mensuel (passages `active → canceled` détectés via `transactions` ou via webhook).
- Top secteurs, top villes.

**Wallet & paiements**
- Recharges Stripe (`topup`) : count, montant total, panier moyen.
- Échecs `past_due`, webhooks Stripe en erreur sur 24 h.
- Solde cumulé wallets (`pro_accounts.wallet_balance_cents` somme).
- **Révélations contact** (`pro_contact_reveals`) par jour, ratio reveal/relation acceptée.
- Factures émises (count via `lib/invoices/pdf.ts`).

**Liste pros** (paginée, filtres : plan, billing_status, secteur, ville, dépense min)
Colonnes : raison sociale · SIREN · plan · billing_status · solde · #campagnes actives · €dépensés total · dernière activité.
→ Fiche pro read-only.

### 5.4 Section Campagnes (`/buupp-admin/campagnes`)

- Counts par `status` (draft / active / paused / completed / canceled) sur la période.
- Budget total des campagnes lancées (`sum(budget_cents)`) + dépensé réel + taux de consommation moyen.
- Coût moyen et médian par contact (`cost_per_contact_cents`).
- Répartition par `type` (`prise_de_contact` / `prise_de_rendez_vous` / `information_sondage` / `devis_chiffrage`).
- Ciblage : top paliers requis, top zones géo, top catégories sectorielles, score min médian.
- Performance : top 10 et flop 10 campagnes par taux d'acceptation, par CPA réel.
- Auto-clôtures : combien de campagnes auto-`completed` par `lib/lifecycle/campaign.ts`, mails "expiring soon" envoyés.

### 5.5 Transactions (`/buupp-admin/transactions`)

Journal paginé avec filtres : `account_kind`, `type`, `status`, `created_at` range, montant min/max, présence d'un `stripe_payment_intent_id`.

### 5.6 Waitlist (`/buupp-admin/waitlist`)

- Total inscrits, inscrits par jour, top villes, top intérêts.
- % notifiés (`launch_email_sent_at not null`).
- Bouton **Envoyer le mail de lancement aux non-notifiés** → POST `/api/admin/waitlist/launch-email` (route existante, déclenchée avec confirmation modale).

### 5.7 Santé (`/buupp-admin/sante`)

- Dernière exécution réussie de `processCampaignLifecycle()` (timestamp + count).
- Dernière exécution réussie de `settle/ripe.ts` (timestamp + count).
- Webhooks Stripe : count succès / échec sur 24 h, dernier event reçu.
- SMTP : count envois OK / KO sur 24 h (depuis events `system.email_failed`).
- OTP téléphone : count envoyés, vérifiés, expirés sur 24 h.

---

## 6. Événements & notifications

### 6.1 Catalogue d'events V1

| Type | Sévérité | Source d'écriture |
|---|---|---|
| `prospect.signup` | info | `lib/sync/prospects.ts` (à la création) |
| `pro.signup` | info | `lib/sync/pro-accounts.ts` |
| `waitlist.signup` | info | `POST /api/waitlist` |
| `prospect.tier_completed` | info | `/api/prospect/tier` (1 par palier) |
| `prospect.phone_verified` | info | `/api/prospect/phone` (succès) |
| `campaign.created` | info | route campagnes |
| `campaign.activated` | info | route campagnes |
| `campaign.completed` | info | `lib/lifecycle/campaign.ts` |
| `relation.accepted` | info | RPC `accept_relation_tx` (wrapper Node après succès) |
| `relation.refused` | info | route refus |
| `relation.expired` | warning | helper settle |
| `relation.settled` | info | helper settle |
| `transaction.topup` | info | webhook Stripe |
| `transaction.withdrawal` | info | route payout |
| `transaction.refund` | warning | route refund |
| `pro.billing.past_due` | critical | webhook Stripe |
| `pro.billing.canceled` | warning | webhook Stripe |
| `system.email_failed` | warning | catch dans `lib/email/*.ts` |
| `system.stripe_webhook_failed` | critical | catch global webhook |
| `system.cron_failed` | critical | catch dans helpers lifecycle/settle |

### 6.2 Écriture des events

- Helper unique `recordEvent({ type, severity, payload, prospectId?, proAccountId?, campaignId?, relationId?, transactionId? })` dans `lib/admin/events/record.ts`.
- Appels **fire-and-forget** (`void recordEvent(...)`) pour ne jamais ralentir le chemin métier. Si l'INSERT échoue, on log et on n'alerte pas (sinon boucle).
- Toutes les sources tournent en `runtime: nodejs` (pas Edge), pour avoir accès au service_role.

### 6.3 Politique mails admin

Envoi via `lib/email/transport.ts` (SMTP Gmail déjà configuré) à `ADMIN_EMAILS.split(",")`.

| Sévérité | Délivrance |
|---|---|
| `critical` | **Mail immédiat** par event, sujet `[BUUPP CRITICAL] <type>` |
| `warning` | **Digest horaire** (cron à `:55`) si au moins 1 warning non traité dans l'heure écoulée |
| `info` | **Digest 2× par jour** (cron à 08:00 et 18:00) avec compteurs par type + tops (top campagnes créées, top motifs refus, etc.) |

Les digests utilisent `buildDigest(periodStart, periodEnd, severity)` qui groupe par `type` et joint les références utiles (nom de campagne, prénom prospect, raison sociale pro).

**Cron** : on n'a pas de cron externe en place — on s'aligne sur le pattern existant (lazy invocation depuis les endpoints prospect, cf. `lib/settle/ripe.ts`). Pour le dashboard, on ajoute un cron Vercel (`vercel.json`) ou un appel CRON externe (Cron-job.org / Supabase pg_cron) qui frappe `POST /api/admin/digest?severity=warning` toutes les heures et `POST /api/admin/digest?severity=info` deux fois par jour. Choix par défaut : **Vercel Cron** (zéro infra externe). À valider à la phase plan.

### 6.4 UI notifications

- Bandeau cloche en topbar avec compteur de non-lus (event où `read_by` ne contient pas le `userId` courant).
- Drawer latéral : liste paginée filtrable par sévérité.
- Action "Marquer comme lu" → `POST /api/admin/events/[id]/read` qui PATCH `read_by` avec `jsonb_set(read_by, '{<userId>}', to_jsonb(now()))`.
- Action "Tout marquer comme lu" → batch sur les 100 derniers visibles.
- Le live-feed Realtime injecte les nouveaux events en tête de la liste sans rechargement.

---

## 7. RGPD, sécurité, performance

### 7.1 RGPD
- Aucune donnée brute supplémentaire collectée (le dashboard agrège ce qui existe).
- L'admin voit les données identifiantes des prospects/pros : c'est un usage légitime de back-office, à mentionner dans la **politique de confidentialité** existante (section "Personnels habilités à accéder aux données").
- Les payloads `admin_events` ne contiennent **pas** de données identifiantes superflues — uniquement les IDs (jointure faite à la lecture). Exemple : `prospect.signup` payload = `{}`, on rejoint `prospects` à l'affichage. Cela permet aux deletes en cascade RGPD de "vider" le contexte d'un event sans avoir à purger la table d'events.
- `read_by` ne stocke que des `userId` Clerk (pseudonymes côté DB), pas d'email.

### 7.2 Sécurité
- Auth en couches : middleware `proxy.ts` + re-check dans chaque Route Handler `/api/admin/**` (`getAdminUser()` qui throw 404 si non admin) + re-check dans les Server Components (idem).
- `ADMIN_EMAILS` jamais exposée au navigateur (env serveur uniquement).
- `SUPABASE_SERVICE_ROLE_KEY` jamais exposée au navigateur (déjà respecté par le code existant).
- `BUUPP_ADMIN_SECRET` reste pour les jobs machine (cron digest, webhook → `recordEvent`, etc.).
- Rate-limit basique sur `/api/admin/**` (max 60 req/min/IP) pour éviter qu'un admin connecté avec un token volé ne puisse scrap toute la base en quelques secondes.
- `noindex, nofollow` dans la métadonnée de `app/buupp-admin/layout.tsx`.

### 7.3 Performance
- Toutes les pages admin sont en `runtime: nodejs` (besoin de service_role).
- Les agrégations volumineuses passent par des **fonctions SQL** (RPC) côté Supabase quand un `select … group by …` simple ne suffit plus (ex: cohortes, funnel). Définies en migration, `security definer`, granted to `service_role` uniquement.
- Cache léger (`unstable_cache` Next, TTL 30 s) sur les KPIs de la vue d'ensemble pour éviter de recompter à chaque navigation rapide entre pages.
- Pagination obligatoire (50 lignes par page) sur toutes les listes (prospects/pros/transactions).

---

## 8. Composants frontend (V1)

- **Style** Tailwind 4 + tokens existants. Pas de nouvelle dépendance UI lourde (pas de Recharts/Chart.js si possible) ; on commence avec des SVG simples maison (sparkline, bar, line) — `lib/admin/charts/` — et on basculera sur une lib si on en sent le besoin réel. Décision : **on tente sans lib**, on ajoute Recharts seulement si le code maison dépasse ~400 lignes.
- **Pas de WebSocket maison** : `EventSource` sur l'endpoint SSE `/api/admin/events/stream` (cf. §4.2).
- **Aucun state global custom** (pas de Zustand/Redux). Les filtres de période vivent dans l'URL (`?period=30d`), les graphes lisent leur état depuis l'URL.

---

## 9. Tests & vérification

- Tests d'intégration sur les Route Handlers `/api/admin/stats/**` : seed Supabase, hit endpoint, vérifier la forme + valeurs des agrégats.
- Tests unitaires sur `lib/admin/periods.ts` (bucketize / currentRange / previousRange — c'est de l'arithmétique de dates, source classique de bugs).
- Test de garde admin : non-admin → 404 ; admin → 200.
- Test fumant `recordEvent` → ligne en base + emit Realtime.
- Test du digest : N events warning sur 1 h → mail contenant les N regroupés par type.

---

## 10. Découpage en lots (pour le plan d'implémentation à suivre)

Pour information seulement (sera détaillé dans `writing-plans`) :

1. **Lot infra** : table `admin_events`, helper `recordEvent`, garde admin (middleware + helper).
2. **Lot KPI overview** : Route Handler `stats/overview` + page `/buupp-admin` avec bandeau + 3 graphes + period picker.
3. **Lot Prospects** + **Lot Pros** + **Lot Campagnes** (en parallèle possible).
4. **Lot Transactions / Waitlist / Santé**.
5. **Lot Notifications** : LiveFeed Realtime, NotificationBell, mark-as-read.
6. **Lot Mails** : helpers `sendCriticalAlert` + `sendDigest` + cron Vercel.
7. **Lot polish** : noindex, rate-limit, cache, doc README admin.

---

## 11. Risques & mitigations

| Risque | Mitigation |
|---|---|
| Boucle infinie : event → mail → erreur SMTP → event `system.email_failed` → mail | `system.email_failed` ne déclenche **jamais** d'envoi, seulement un log + insertion en DB. |
| Volume `admin_events` qui explose | Politique de rétention : `delete from admin_events where created_at < now() - interval '180 days'` via cron mensuel. |
| Lecture lourde sur prospects/relations | Indexes existants suffisent en V1 (≤10k prospects attendus la 1ʳᵉ année). Si la latence dépasse 1 s sur une page → bascule vers RPC SQL. |
| Allowlist `ADMIN_EMAILS` mal configurée → personne ne peut entrer | Si l'env est vide, le middleware **refuse tout le monde** (fail-closed). Documentation explicite dans `.env.example`. |
| Cron Vercel non déployé → digests jamais envoyés | Le critical reste immédiat (pas dépendant du cron). On ajoute une carte "Dernier digest envoyé : il y a Xh" dans `/buupp-admin/sante` pour visualiser l'absence. |

---

## 12. Open questions (non-bloquantes)

- Faut-il un mode "impersonate" (voir le dashboard prospect/pro tel qu'il le voit) ? → **Reportée V2**.
- Export CSV des listes ? → **Reportée V2**.
- Multi-admin avec rôles fins (lecteur vs opérateur) ? → **Reportée V2** ; on aura tout au plus 2-3 admins en V1.
