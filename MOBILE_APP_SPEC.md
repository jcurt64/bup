# BUUPP — Spécification de l'application mobile (React Native / Expo)

> Document de référence pour développer l'app mobile **synchronisée en temps réel
> avec le web**. Généré le 2026-05-18 à partir du contexte réel du projet
> (Next.js 16, Supabase, Clerk, Stripe, Brevo).

---

## 0. Principe directeur (à lire en premier)

**L'app mobile n'a PAS de backend propre.** Le web (`bup`, déployé sur Vercel,
`https://www.buupp.com` / `bup-rouge.vercel.app`) expose déjà ~90 routes REST
sous `app/api/*`. Ces routes **sont le contrat**. La logique métier, les
invariants RGPD/anti-fraude, le pont Clerk↔Supabase, le calcul du BUUPP Score,
la facturation Stripe, etc. vivent **côté serveur**.

```
            ┌─────────────────────────┐
  Web  ───► │                         │
            │  Next.js API (Vercel)   │ ──► Supabase (Postgres + Storage, UE)
  Mobile ─► │  /api/*  =  contrat     │ ──► Clerk (auth)
            │  source unique de vérité│ ──► Stripe / Brevo (SMS+e-mail)
            └─────────────────────────┘
```

**Règle d'or de synchronisation : mobile et web consomment EXACTEMENT les mêmes
endpoints `/api/*` avec la MÊME identité Clerk.** Aucune logique métier n'est
réimplémentée dans l'app mobile. Conséquence directe : les données sont
*intrinsèquement* identiques et synchronisées, parce qu'il n'y a qu'une seule
base et un seul backend. La « synchro » se réduit alors à un problème de
**fraîcheur du cache client** (résolu §6), pas de réconciliation de données.

❌ Ne JAMAIS faire écrire l'app mobile directement dans Supabase : les écritures
passent par des routes serveur qui appliquent RLS via le pont
`ensureRole`/`ensureProspect`/`ensureProAccount` + `service_role`. Court-circuiter
casserait les invariants (rôle exclusif, audit des révélations, watermark
e-mail, etc.).

---

## 1. Stack mobile cible

| Brique | Choix | Version cible (2026) | Pourquoi |
|---|---|---|---|
| Runtime | **Expo** (managed) | SDK 54+ | EAS Build, OTA, modules natifs sans éjection |
| UI | **React Native** | 0.81+ (aligné React 19) | cohérent avec le web (React 19.2) |
| Navigation | **expo-router** | v4+ | routing fichier identique au mental model Next.js App Router |
| CSS | **NativeWind** | v4 | Tailwind sur RN (demandé) |
| Auth | **@clerk/clerk-expo** | aligné Clerk 7.x du web | MÊME projet Clerk que le web |
| Stockage sécurisé tokens | **expo-secure-store** | SDK | tokenCache Clerk |
| Data/cache/synchro | **@tanstack/react-query** v5 | — | cache, invalidation, refetch (cf. §6) |
| HTTP | `fetch` natif + wrapper | — | appelle `/api/*` |
| Paiement | **expo-web-browser** (Checkout) ou `@stripe/stripe-react-native` | — | cf. §7 |
| Realtime (option) | **@supabase/supabase-js** v2.105+ | aligné web | abonnements lecture seule (cf. §6.3) |
| Notifications | **expo-notifications** | SDK | mappées sur `/api/me/notifications` |
| Build/Release | **EAS Build** + **expo-updates** (OTA) | — | livraison |

### Dépendances `package.json` (mobile) — bloc recommandé

```jsonc
{
  "dependencies": {
    "expo": "^54.0.0",
    "expo-router": "^4.0.0",
    "expo-secure-store": "*",
    "expo-web-browser": "*",
    "expo-linking": "*",
    "expo-constants": "*",
    "expo-notifications": "*",
    "expo-updates": "*",
    "react": "19.2.4",
    "react-native": "0.81.x",
    "react-native-safe-area-context": "*",
    "react-native-screens": "*",
    "react-native-gesture-handler": "*",
    "react-native-reanimated": "*",
    "nativewind": "^4.0.0",
    "tailwindcss": "^3.4.0",
    "@clerk/clerk-expo": "*",          // MÊME tenant Clerk que le web
    "@tanstack/react-query": "^5.0.0",
    "@supabase/supabase-js": "^2.105.1", // UNIQUEMENT pour Realtime lecture (optionnel)
    "@stripe/stripe-react-native": "*"   // optionnel (voir §7)
  }
}
```

> Les versions exactes Expo/RN doivent être verrouillées par `npx expo install`
> (Expo gère la matrice de compat). Aligner `react` sur **19.2.4** comme le web.

---

## 2. Authentification (Clerk) — le cœur de la synchro d'identité

Le web utilise `@clerk/nextjs` (v7.3). Le mobile utilise **le même projet Clerk**
(même `CLERK_PUBLISHABLE_KEY` côté front, même backend Clerk). Un utilisateur =
la même identité Clerk sur web et mobile → le serveur le résout au même
`userId`, donc au même prospect/pro Supabase.

### 2.1 Setup

```tsx
// app/_layout.tsx
import { ClerkProvider } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";

const tokenCache = {
  getToken: (k: string) => SecureStore.getItemAsync(k),
  saveToken: (k: string, v: string) => SecureStore.setItemAsync(k, v),
};

<ClerkProvider
  publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
  tokenCache={tokenCache}
>
  {/* ... */}
</ClerkProvider>
```

### 2.2 Appeler les routes protégées `/api/*`

Le web s'authentifie par **cookie de session Clerk**. Le mobile n'a pas de
cookie → il envoie le **token de session Clerk en `Authorization: Bearer`**.
`auth()` de `@clerk/nextjs` (côté Next.js) accepte nativement le header
`Authorization` (vérification networkless). Wrapper unique :

```ts
// lib/api.ts
import { useAuth } from "@clerk/clerk-expo";

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL!; // https://www.buupp.com

export function useApi() {
  const { getToken } = useAuth();
  return async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await getToken();           // token de session Clerk
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json() as Promise<T>;
  };
}
```

### 2.3 ⚠️ Pré-requis serveur à vérifier/ajuster (action web)

1. **Le middleware Clerk / `proxy.ts` doit, pour les routes `/api/*`,
   renvoyer `401 JSON` et NON une redirection 307 vers la page de connexion.**
   (Constaté en audit : `/api/status` non authentifié renvoie un `307`.
   Pour un client mobile il faut un `401` exploitable.) → vérifier la config
   `clerkMiddleware`/matcher pour exclure `/api/*` de la redirection HTML.
2. **CORS** : un binaire natif (iOS/Android) n'a pas d'origine → pas de
   préflight CORS. En revanche le build **web** d'Expo en aura besoin :
   prévoir des en-têtes CORS sur `/api/*` (origines autorisées) si une PWA
   est visée. Natif pur : rien à faire.
3. Le pont Clerk↔Supabase (`ensureRole`, `ensureProspect`, `ensureProAccount`)
   est déclenché par les routes serveur (ex. `/api/me/role`, `/prospect`,
   `/pro`). Le mobile **n'a rien à faire** : appeler les mêmes routes
   provisionne le rôle de la même manière. Garder l'**exclusivité de rôle
   prospect XOR pro** (le serveur lève `RoleConflictError` — l'app mobile
   doit gérer la même UX de conflit que le web).

### 2.4 Flux d'auth mobile

- Sign-in / Sign-up : composants Clerk Expo (email + OAuth), ou flow custom.
- OAuth : configurer un **deep link** (`expo-linking`, scheme `buupp://`) comme
  URL de redirection Clerk (à ajouter dans les Allowed redirect du dashboard
  Clerk, en plus des domaines web).
- Sélection de rôle (prospect/pro) post-inscription : appeler la même logique
  que le web (`/api/me/role`, redirection conditionnelle). Réutiliser le
  wording des modales de conflit de rôle.

---

## 3. Base de données & données

- **Supabase** (Postgres + Storage, hébergé **UE/Francfort**). Project ref
  connu : `yalgztstdmytviiyvixz`.
- L'app mobile **ne parle pas à Supabase pour lire/écrire le métier** : tout
  passe par `/api/*` (qui applique RLS + logique). Le client `@supabase/
  supabase-js` côté mobile sert **uniquement** au Realtime lecture seule
  optionnel (§6.3).
- Aucune migration ni schéma à dupliquer côté mobile : le schéma est unique,
  géré par les migrations du repo web (`supabase/migrations/`).
- **Secrets jamais embarqués** : `SUPABASE_SERVICE_ROLE_KEY`,
  `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `BREVO_API_KEY`, secrets BUUPP →
  restent côté serveur. Le mobile ne connaît que des clés *publiques*
  (`EXPO_PUBLIC_*`).

---

## 4. Variables d'environnement mobile

`.env` Expo (préfixe obligatoire `EXPO_PUBLIC_` pour être exposé au bundle) :

```
EXPO_PUBLIC_API_BASE_URL=https://www.buupp.com      # ou https://bup-rouge.vercel.app
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...        # MÊME projet Clerk que le web
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...       # si Stripe RN (sinon inutile)
# Optionnel — Realtime lecture seule uniquement :
EXPO_PUBLIC_SUPABASE_URL=https://yalgztstdmytviiyvixz.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

> Aligner `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` sur la clé Clerk **du même
> environnement** que `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` du web (test ⇄ test,
> live ⇄ live) sinon les utilisateurs ne seront pas les mêmes.

---

## 5. Catalogue des endpoints (le contrat mobile)

Toutes les routes sont relatives à `EXPO_PUBLIC_API_BASE_URL`. Auth = header
`Authorization: Bearer <clerk-token>` sauf routes publiques.

### Communs / session
| Endpoint | Méthode | Usage mobile |
|---|---|---|
| `/api/me` | GET | profil de session courant |
| `/api/me/role` | GET | rôle (prospect/pro) — gère le provisioning + conflit |
| `/api/me/is-pro` | GET | garde de navigation |
| `/api/me/notifications` | GET | liste notifications (→ badge + écran Messages) |
| `/api/me/notifications/[id]/read` | POST | marquer lu |
| `/api/me/notifications/[id]/attachment` | GET | pièce jointe notif |
| `/api/me/suggestions` | POST | envoyer une suggestion |
| `/api/me/email-tracking` , `/opt-out` | GET/POST | préférences tracking e-mail (RGPD/CNIL) |
| `/api/status` | GET | état des services **DÉTAILLÉ — authentifié** (messages/latence/diagnostics, ne pas exposer publiquement) |
| `/api/status/public` | GET | état des services **ASSAINI — public** (`{overall, components:[{id,name,status}]}`, aucun détail interne) — à utiliser pour un indicateur de statut sans login |
| `/api/plan-pricing` | GET | grille tarifaire (public) |

### Espace Prospect (mirroir des onglets du dashboard prospect)
| Endpoint | Usage |
|---|---|
| `/api/prospect/wallet` , `/movements` | Portefeuille + historique |
| `/api/prospect/donnees` (GET/PATCH) | onglet « Mes données » (paliers) |
| `/api/prospect/tier` (POST) | masquer/restaurer un palier |
| `/api/prospect/relations` | mises en relation (pending + historique) |
| `/api/prospect/relations/[id]/decision` (POST) | accepter / refuser |
| `/api/prospect/relations/[id]/report` (POST) | signaler |
| `/api/prospect/verification` | paliers de vérification |
| `/api/prospect/phone/start` + `/verify` (POST) | vérif SMS (Brevo, serveur) |
| `/api/prospect/score` , `/score/history` | BUUPP Score |
| `/api/prospect/parrainage` | onglet Parrainage (lien + filleuls + compte à rebours `launchAt`) |
| `/api/prospect/rib` (GET/POST) | IBAN |
| `/api/prospect/payout/onboarding` , `/status` , `/withdraw` | retraits Stripe Connect |
| `/api/prospect/fiscal` , `/fiscal/[year]/recap` , `/dgfip-receipt` | infos fiscales (DAC7) |

### Espace Pro
| Endpoint | Usage |
|---|---|
| `/api/pro/overview` | Vue d'ensemble (KPI) |
| `/api/pro/acceptances?page=&size=` | « Voir tout » des acceptations (≤ 50) |
| `/api/pro/timeseries` , `/analytics` | graphiques |
| `/api/pro/campaigns` (GET/POST) , `/[id]` , `/[id]/extend` | campagnes |
| `/api/pro/contacts` | contacts acquis |
| `/api/pro/contacts/[relationId]/reveal` , `/group-reveal` | révélation coordonnées (audité) |
| `/api/pro/contacts/[relationId]/details` , `/email` , `/call-log` , `/evaluation` | fiche détaillée, actions intégrées |
| `/api/pro/wallet` , `/wallet/auto-recharge` | crédit + recharge auto |
| `/api/pro/topup/reconcile` | réconciliation post-paiement |
| `/api/pro/plan` , `/info` , `/info/verify-company` | plan, SIREN |
| `/api/pro/invoices` , `/invoices/[id]/pdf` | factures (PDF → ouvrir/partager) |

### Waitlist & paiement
| Endpoint | Usage |
|---|---|
| `/api/waitlist` (POST) , `/waitlist/stats` | inscription liste d'attente (public) |
| `/api/stripe/checkout` (POST) | crée une session Checkout → renvoie une URL (cf. §7) |
| `/api/stripe/webhook` | **serveur uniquement** — le mobile n'y touche pas |

### Hors périmètre mobile (sauf app admin dédiée)
`/api/admin/*` — back-office. Ne pas exposer dans l'app grand public.

> Inventaire complet figé au 2026-05-18 ; si une route évolue côté web, le
> mobile en bénéficie automatiquement (même contrat).

---

## 6. Stratégie de synchronisation web ⇄ mobile (le point clé)

Comme il n'y a qu'**une** base + **un** backend, deux clients qui tapent les
mêmes endpoints avec la même identité voient les mêmes données. Le travail
restant = garantir la **fraîcheur** côté mobile.

### 6.1 React Query comme couche de synchro

Le web invalide son cache via des **events DOM** (`prospect:profile-changed`,
`pro:overview-changed`). Le mobile reproduit ce comportement avec React Query :

- 1 `queryKey` par endpoint (ex. `["prospect","wallet"]`).
- Après toute **mutation** (accepter une relation, modifier ses données,
  recharger le crédit…) → `queryClient.invalidateQueries` des clés impactées
  (équivalent mobile des events web).
- **Optimistic updates** sur les actions critiques (accept/refuse relation)
  avec rollback sur erreur — même UX réactive que le web.

### 6.2 Fraîcheur passive

- `refetchOnReconnect: true`, `refetchOnAppFocus` (via `AppState` →
  `focusManager`) : au retour dans l'app, on refetch (donc on récupère ce qui
  a changé sur le web entre-temps).
- **Pull-to-refresh** sur chaque écran liste.
- `staleTime` court (ex. 15–30 s) sur les écrans « vivants » (relations,
  wallet, notifications), plus long sur les données statiques.

### 6.3 Temps réel (optionnel mais recommandé pour relations/notifs)

Pour une vraie synchro *push* (une action faite sur le web apparaît
instantanément sur le mobile sans refetch) : **Supabase Realtime en lecture
seule**.

- Créer un **JWT template Clerk pour Supabase** (dashboard Clerk → JWT
  Templates → « supabase ») afin que le client `@supabase/supabase-js` mobile
  s'authentifie avec l'identité Clerk et respecte les **RLS** existantes.
- S'abonner aux tables clés (`relations`, notifications/`admin_events` côté
  user, `prospects`/`pro_accounts` du user) en `postgres_changes`.
- À chaque event reçu → `queryClient.invalidateQueries(...)` (on ne lit pas la
  donnée du payload, on relance le fetch via l'API pour rester sur la logique
  serveur). Realtime ne sert que de **signal**, l'API reste la source.

> Si Realtime n'est pas mis en place tout de suite : la combinaison
> §6.1 + §6.2 suffit à garantir que mobile et web convergent (latence =
> intervalle de refetch / retour au premier plan). Le push est une
> amélioration de latence, pas une condition de cohérence.

### 6.4 Invariants à NE PAS casser côté mobile

- Ne jamais afficher le **vrai e-mail d'un prospect** à un pro : l'API renvoie
  déjà un **alias watermarqué** `prospect+rXXX@buupp.com` — le mobile affiche
  ce que l'API renvoie, point.
- Respecter l'**exclusivité de rôle** (un compte = prospect *ou* pro).
- Toute révélation de contact passe par l'endpoint dédié (audité serveur) —
  pas de contournement.
- Tracking e-mail / CNIL : respecter l'état renvoyé par
  `/api/me/email-tracking` (consentement).

---

## 7. Paiement Stripe sur mobile

Le backend utilise des **Stripe Checkout Sessions** (`/api/stripe/checkout`)
+ webhook (`/api/stripe/webhook`) qui crédite le wallet. Stripe est
actuellement en **mode test** (bascule live au lancement, cf. mémoire projet).

**Option A — recommandée (zéro backend nouveau) :**
1. POST `/api/stripe/checkout` → l'API renvoie l'URL de la session.
2. Ouvrir cette URL avec `expo-web-browser` (`openAuthSessionAsync`).
3. `success_url` / `cancel_url` = un **deep link** `buupp://stripe-return`
   (à ajouter aux URLs autorisées). Au retour, appeler
   `/api/pro/topup/reconcile` + invalider `["pro","wallet"]`.
4. Le crédit est appliqué par le **webhook serveur** (inchangé) — la synchro
   est donc automatique avec le web.

**Option B — `@stripe/stripe-react-native` (PaymentSheet natif) :**
nécessite un endpoint qui renvoie un *PaymentIntent client secret* (le backend
fait du Checkout, pas du PaymentIntent direct → demanderait une route serveur
supplémentaire). À ne faire que si l'UX in-app native est jugée indispensable.

> Démarrer en **Option A** : aucune modif backend, parité totale avec le web.

---

## 8. SMS & e-mail

Rien à implémenter côté mobile : 100 % serveur.
- Vérif téléphone : `/api/prospect/phone/start` puis `/verify` (Brevo SMS,
  ~5 crédits/SMS FR). L'app affiche juste les écrans saisie numéro / saisie
  code et les états (`devCode` n'apparaît qu'en mode dev).
- E-mails transactionnels : envoyés par le serveur via **API Brevo** (domaine
  `buupp.com` authentifié DKIM/DMARC). Le mobile ne fait qu'en déclencher
  l'envoi indirectement (inscription, décision, etc.).

---

## 9. Cartographie des écrans (expo-router)

Reproduire les onglets du prototype (`public/prototype/components/Prospect.jsx`
et `Pro.jsx`) :

```
app/
  _layout.tsx                 # ClerkProvider + QueryClientProvider + NativeWind
  index.tsx                   # splash / routing rôle
  (auth)/
    sign-in.tsx  sign-up.tsx  role-select.tsx
  (public)/
    waitlist.tsx  status.tsx  bareme.tsx  aide.tsx
  (prospect)/
    _layout.tsx               # tab bar prospect
    portefeuille.tsx  donnees.tsx  relations.tsx
    verification.tsx  score.tsx  preferences.tsx
    parrainage.tsx  fiscal.tsx  messages.tsx
  (pro)/
    _layout.tsx               # tab bar pro
    overview.tsx  campagnes.tsx  contacts.tsx
    facturation.tsx  messages.tsx
  legal/[slug].tsx            # CGU/CGV/RGPD/cookies/contact-dpo (texte = web)
lib/
  api.ts        # wrapper fetch + Bearer Clerk
  queries/      # hooks React Query par domaine (useWallet, useRelations…)
  realtime.ts   # (option) abonnements Supabase → invalidation
  stripe.ts     # ouverture Checkout via WebBrowser
components/     # UI NativeWind partagée
```

Les **pages légales** (CGU/CGV/RGPD/cookies/contact-dpo) doivent afficher le
**même contenu et le même versioning** que le web. Recommandation : exposer le
contenu légal + le registre `page-versions.ts` via un petit endpoint
(`/api/legal/[slug]`) plutôt que de dupliquer le texte dans l'app (sinon
divergence garantie). À défaut, afficher au moins le badge version récupéré
côté serveur.

---

## 10. NativeWind — config

```js
// tailwind.config.js
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: { extend: {
    // Reprendre les tokens du web (var(--ink), var(--accent)…) en couleurs RN
    colors: { ink: "#0F1629", accent: "#4F46E5", paper: "#FFFFFF", /* … */ },
  }},
};
```
- `babel.config.js` : preset `nativewind/babel`.
- `metro.config.js` : `withNativeWind(config, { input: "./global.css" })`.
- Réutiliser la **charte du prototype** (`public/prototype/styles.css`) pour
  mapper les variables CSS en tokens Tailwind → cohérence visuelle web/mobile.

---

## 11. Setup pas à pas

```bash
npx create-expo-app@latest buupp-mobile -t expo-router
cd buupp-mobile
npx expo install nativewind tailwindcss react-native-reanimated \
  react-native-safe-area-context react-native-screens
npm i @clerk/clerk-expo @tanstack/react-query
npx expo install expo-secure-store expo-web-browser expo-linking \
  expo-constants expo-notifications expo-updates
# Optionnel Realtime :
npm i @supabase/supabase-js
npx tailwindcss init   # puis preset nativewind (cf. §10)
# .env : EXPO_PUBLIC_* (cf. §4)
npx expo start
```

Côté **Clerk dashboard** (mêmes réglages que le web) :
- Ajouter le scheme deep link `buupp://` aux *Allowed redirect URLs*.
- (Option Realtime) créer le *JWT template* « supabase ».

Côté **Vercel / Next.js** (action web, cf. §2.3) : s'assurer que `/api/*`
renvoie `401 JSON` (pas de redirection 307) pour un client sans cookie.

---

## 12. Build, release, OTA

- **EAS Build** : `eas build -p ios|android`. Configurer `eas.json`
  (profils `development`, `preview`, `production`).
- **OTA** : `expo-updates` → corrections JS sans repasser par les stores.
- **Deep links** : `app.json` → `scheme: "buupp"`, `ios.associatedDomains` /
  `android.intentFilters` pour les universal/app links (retours Stripe & OAuth
  Clerk).
- **Push** : `expo-notifications` → enregistrer le token device via une route
  serveur (à créer : `/api/me/push-token`) et router les `admin_events`/notifs
  existantes vers du push (réutilise la logique `/api/me/notifications`).

---

## 13. Checklist de parité (Definition of Done synchro)

- [ ] Même projet Clerk (publishable key même environnement que le web).
- [ ] Toutes les écritures passent par `/api/*` (zéro write Supabase direct).
- [ ] `/api/*` renvoie 401 JSON au mobile non authentifié (pas de 307).
- [ ] React Query : invalidation après chaque mutation + refetch on focus +
      pull-to-refresh.
- [ ] (Option) Realtime Supabase via JWT Clerk → invalidation, RLS respectées.
- [ ] Stripe : Checkout via WebBrowser + reconcile + crédit par webhook
      serveur (parité totale avec le web).
- [ ] Pages légales : contenu + versioning servis par le serveur (pas de
      duplication).
- [ ] Invariants RGPD préservés (alias e-mail watermarqué, rôle exclusif,
      audit des révélations, consentement tracking).
- [ ] Aucun secret serveur dans le bundle (`EXPO_PUBLIC_*` uniquement).
- [ ] Test bout-en-bout : une action sur le web (ex. accepter une relation)
      est reflétée sur le mobile après refetch/realtime, et inversement.

---

## 14. Risques & points d'attention

| Risque | Mitigation |
|---|---|
| `/api/*` redirige (307) au lieu de 401 pour le mobile | Ajuster le matcher Clerk middleware côté web (pré-requis bloquant) |
| Divergence du texte légal web/mobile | Servir le contenu + `page-versions.ts` via API, ne pas recopier |
| Écriture directe Supabase tentée côté mobile | Interdit par convention + RLS ; tout via `/api/*` |
| Token Clerk mobile non accepté en Bearer par une route | `auth()` Clerk le supporte ; tester chaque domaine d'endpoint |
| Stripe en mode test pris pour du live | Aligner les clés test/live web ⇄ mobile ; bascule live au lancement (cf. mémoire `stripe-prod-gap-pending`) |
| Quotas Brevo (SMS ~5 crédits/FR, e-mail plan) | Côté serveur — surveiller le solde, sans impact code mobile |
| Clerk : domaines/redirects | Ajouter le scheme `buupp://` aux Allowed URLs |

---

### Résumé en une phrase

**Construire un client Expo « mince » qui partage l'identité Clerk et consomme
exclusivement les ~90 endpoints `/api/*` déjà déployés ; la synchronisation
web⇄mobile est alors garantie par construction (un seul backend, une seule
base) et se réduit à du cache React Query + (optionnellement) du Realtime
Supabase comme signal d'invalidation.**
