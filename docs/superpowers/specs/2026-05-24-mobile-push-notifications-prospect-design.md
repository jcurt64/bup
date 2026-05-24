# Push notifications prospect — sollicitations classiques & flash deals

**Date :** 2026-05-24
**Branche cible :** `worktree-mobile-app`
**Scope :** prospect uniquement (pas de push pro en v1)

## Contexte

Aujourd'hui, quand un pro lance une campagne (`POST /api/pro/campaigns`), les
relations `pending` sont insérées en base et un e-mail fire-and-forget part
via `sendRelationInvitation` (`app/api/pro/campaigns/route.ts:107`). Le
prospect doit ouvrir l'app pour voir la sollicitation (polling 10 s sur les
flash deals, refetch à l'ouverture pour le reste).

Objectif : pousser une notification système au prospect dès qu'il est
sollicité, avec un design distinct selon que la campagne est une
**sollicitation classique** ou un **flash deal** (`duration_key === "1h"`).

## Décisions cadres (brainstorming)

| # | Décision | Implication |
|---|---|---|
| 1 | Différenciation **riche** demandée, mais build target = Expo Go | Pas de son custom, pas d'image dans le shade iOS. Diff par **emoji + titre + body + Android channel**. À enrichir au passage EAS Build. |
| 2 | Build target = Expo Go uniquement | Pas de Notification Service Extension iOS. Token = `ExponentPushToken[...]` via Expo Push Service. |
| 3 | Tap classique → `/relations` + scroll vers card / tap flash → home + `FlashDealsSheet` ouvert | Deep links via query params, lus par les écrans cibles. |
| 4 | Permission demandée au **4e slide onboarding** (soft prompt) | Nouvelle slide "Restez connecté aux opportunités". |
| 5 | Foreground = bannière in-app slide-down (4 s) | Bannière OS supprimée via `setNotificationHandler({ shouldShowBanner: false })`. |

## Architecture

```
Mobile (Expo Go)                Backend (Next.js)            DB (Supabase)
────────────────                ─────────────────            ─────────────
1. Permission OS  ───────▶  POST /api/me/push-token   ───▶  UPSERT push_tokens
   getExpoPushTokenAsync       (auth Clerk + idempotent)     (user_id, expo_token,
                                                              platform, app_version,
                                                              last_seen_at)

   Sign-out  ─────────────▶  DELETE /api/me/push-token ───▶  DELETE par token

                            POST /api/pro/campaigns
                            ├ INSERT relations(pending)
                            └ void sendCampaignPushes(prospectIds, campaign)
                              ↓ (fire-and-forget, ne bloque pas la réponse au pro)
                              ├─ SELECT push_tokens WHERE user_id IN (...)
                              ├─ Construit payload selon
                              │  campaign.duration_key === "1h" ? flash : classic
                              └─ Expo Push API (batch 100)
                                 └─ Receipts → DELETE tokens DeviceNotRegistered

2. Réception ◀────── push (background OU foreground)
   ├ background → OS shade native → tap → addNotificationResponseReceivedListener
   │            → router.push("/relations?focusRelation=…")
   │              ou "/portefeuille?openFlash=…"
   └ foreground → addNotificationReceivedListener
                → bannière in-app + queryClient.invalidateQueries
```

## Schéma DB

Nouvelle migration : `supabase/migrations/20260524120000_push_tokens.sql`
(à appliquer via SQL Editor Supabase + `migration repair`, cf. mémoire
projet — pas de `db push`).

```sql
CREATE TABLE push_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text NOT NULL,                 -- Clerk user_id
  expo_token    text NOT NULL UNIQUE,          -- "ExponentPushToken[xxx]"
  platform      text NOT NULL CHECK (platform IN ('ios','android')),
  app_version   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX push_tokens_user_id_idx ON push_tokens(user_id);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
-- Aucune policy : seul le service role écrit/lit. Le client n'a aucun accès direct.
```

Un même `user_id` peut avoir N rows (multi-device toléré).

## Endpoints backend

### `POST /api/me/push-token`

```
Headers : Clerk session
Body    : { token: string, platform: "ios"|"android", appVersion?: string }
200     : { ok: true }
401     : pas de session
400     : token mal formé
```

Logique : `UPSERT ON CONFLICT (expo_token)` sur `expo_token`. Met aussi à
jour `last_seen_at = now()` à chaque appel (mêmes credentials → simple
touche). Si `user_id` du token change (cas rare : appareil partagé), on
écrase l'ancien `user_id` — le nouvel owner reçoit les notifs.

### `DELETE /api/me/push-token`

```
Headers : Clerk session
Body    : { token: string }
200     : { ok: true }
```

Logique : `DELETE WHERE expo_token = $1 AND user_id = $clerk_user_id`. Le
filtre `user_id` empêche un user de supprimer le token d'un autre.

### `POST /api/pro/campaigns` (modifié)

Insertion fire-and-forget après `for (const row of inserted ?? [])`
(`app/api/pro/campaigns/route.ts:462`) :

```ts
void sendCampaignPushes(admin, {
  relations: inserted,           // contient prospect_id, id
  pro: { name: proName },
  campaign: {
    durationKey,                 // "1h" → flash
    motif,
    rewardCents,
  },
});
```

Aucun await — l'INSERT terminée suffit à matérialiser la sollicitation.
Le pro reçoit sa réponse 200 immédiatement.

## Helper backend `lib/push/expo.ts`

```ts
type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound?: "default";
  badge?: number;
  channelId?: string;
  priority?: "default" | "high";
  ttl?: number;
};

/** Batch send via Expo Push API, gère les receipts et le cleanup. */
sendBatch(admin, messages: ExpoPushMessage[]): Promise<void>
   ├ chunk(messages, 100)
   ├ pour chaque chunk :
   │   ├ POST https://exp.host/--/api/v2/push/send (avec EXPO_ACCESS_TOKEN si présent)
   │   ├ lire tickets, garder les "ok" ticketIds + map token→ticketId
   │   └ logger les "error" immédiats (ex. InvalidCredentials)
   ├ wait 2 s
   ├ GET /push/getReceipts pour chaque ticketId
   └ pour chaque receipt "error" code DeviceNotRegistered → DELETE token de push_tokens

/** Build des payloads à partir d'une campagne. */
buildPayloads(relations, pro, campaign, tokens): ExpoPushMessage[]
   ├ isFlash = campaign.durationKey === "1h"
   ├ par relation × tokens du prospect :
   │   └ message classique OU flash (cf. ci-dessous)
   └ retourne le tableau aplati
```

`EXPO_ACCESS_TOKEN` env var optionnelle. Sans elle, on tape l'API en
anonyme (quota plus bas). À ajouter sur Vercel quand on aura généré le
token côté Expo dashboard.

## Payloads exacts

### Sollicitation classique

```json
{
  "to": "ExponentPushToken[xxx]",
  "title": "👋 Une nouvelle sollicitation",
  "body": "Coiffure Lola · +3,40 € · expire dans 24h",
  "data": {
    "type": "classic",
    "relationId": "abc-123",
    "screen": "relations"
  },
  "sound": "default",
  "badge": 1,
  "channelId": "solicitations-classic"
}
```

### Flash deal

```json
{
  "to": "ExponentPushToken[xxx]",
  "title": "⚡ Flash deal — 1h pour saisir",
  "body": "Garage Marc · +5,20 € · prime ×2 jusqu'à la fin du flash",
  "data": {
    "type": "flash",
    "relationId": "def-456",
    "campaignId": "camp-789",
    "screen": "flash-deals"
  },
  "sound": "default",
  "badge": 1,
  "channelId": "solicitations-flash",
  "priority": "high",
  "ttl": 3600
}
```

Notes :
- `priority: "high"` (Android) = wake-up immédiat, sort de Doze.
- `ttl: 3600` (flash) = drop si offline plus d'1 h (pas de notif d'un
  flash périmé).
- Titre flash fixe ("1h pour saisir") — le push est envoyé une seule
  fois à l'INSERT, donc la fenêtre restante = `durationKey` complet.
  Pas de timer dynamique dans le titre (qui se périmerait avant
  livraison).
- Le `body` et le `title` sont générés côté serveur — pas de logique
  fragile côté mobile.

## Composants mobile

### `mobile/lib/push.ts`

```ts
registerForPushNotifications(): Promise<{ status: "granted" | "denied" | "undetermined", token?: string }>
   ├ Notifications.getPermissionsAsync() — si déjà denied → return early
   ├ Notifications.requestPermissionsAsync() (avec iOS opts : alert/sound/badge)
   ├ if granted :
   │   ├ Notifications.getExpoPushTokenAsync({ projectId: Constants.expoConfig.extra.eas.projectId })
   │   └ POST /api/me/push-token { token, platform, appVersion: Constants.expoConfig.version }
   └ return { status, token? }

unregisterPushToken(): Promise<void>
   ├ token = await getStoredToken()  ← SecureStore "buupp.push.token"
   └ DELETE /api/me/push-token { token }

ensurePushChannelsAndroid(): Promise<void>
   ├ Notifications.setNotificationChannelAsync("solicitations-classic", {
   │     importance: DEFAULT, sound: "default", vibrationPattern: [0, 250]
   │   })
   └ Notifications.setNotificationChannelAsync("solicitations-flash", {
        importance: HIGH, sound: "default", vibrationPattern: [0, 300, 200, 300]
      })
```

Le token est stocké localement dans SecureStore après registration pour
pouvoir appeler DELETE au sign-out sans re-demander la permission.

### `mobile/app/_layout.tsx` (modifié)

Au mount du root :

1. `setNotificationHandler` → supprime la bannière OS en foreground.
2. `ensurePushChannelsAndroid()` (no-op iOS).
3. Si la permission est déjà `granted` et qu'on a un token stocké, on
   re-poste silencieusement à `/api/me/push-token` pour rafraîchir
   `last_seen_at` (one shot par cold start).
4. `addNotificationReceivedListener` (foreground) :
   - `pushBanner.show({ type, title, body, data })`
   - `queryClient.invalidateQueries(["prospect","relations"])`
   - `queryClient.invalidateQueries(["flash-deals"])`
5. `addNotificationResponseReceivedListener` (tap) :
   - `data.screen === "relations"` → `router.push("/(prospect)/relations?focusRelation=" + data.relationId)`
   - `data.screen === "flash-deals"` → `router.push("/(prospect)/portefeuille?openFlash=" + data.campaignId)`
6. `Notifications.getLastNotificationResponseAsync()` au mount (cold
   start via tap depuis app killed).

Listeners nettoyés en cleanup. Provider `PushBannerProvider` enveloppe
les enfants pour exposer `useBanner()` aux écrans.

### `mobile/components/in-app-push-banner.tsx`

Composant + Context :

- `PushBannerProvider` : maintient state `{ visible, type, title, body, data }`. Expose `useBanner()` avec `show()`/`hide()`.
- `<InAppPushBanner />` rendu via portail virtuel (absolute top). `Animated.View` Reanimated : `translateY` -120 → 0 (280 ms `Easing.out(Easing.cubic)`), `opacity` 0 → 1. Auto-dismiss 4 s + swipe-up via `Gesture.Pan()` (react-native-gesture-handler).
- Style :
  - **Classique** : `bg-paper`, border-l `border-l-4` violet (#7C5CFC), icône 👋 dans pastille violet pâle.
  - **Flash** : bg `#0F1629` (navy), border-l coral (#FF7A6B), icône ⚡ dans pastille coral, titre paper, body ink-3 lighter.
- Tap → `router.push` selon `data.screen` + `hide()`.
- File d'attente = 1 (un nouveau remplace l'ancien avec crossfade 120 ms).

### `mobile/app/(onboarding)/index.tsx` (modifié)

Ajout d'un 4e slide en fin du tableau `SLIDES` :

```ts
{
  key: "notifications",
  eyebrow: "Une dernière chose",
  title: <>Restez connecté aux <Accent>opportunités.</Accent></>,
  subtitle: "On vous prévient dès qu'un pro accepte de vous payer. Pas de spam — uniquement les sollicitations qui rapportent.",
  art: <PhonePushPreview />,
}
```

`PhonePushPreview` = mockup statique d'un iPhone lockscreen avec une
notif visible (logo BUUPP + titre + body). Composant local au fichier
(SVG-free, View + Image + Text).

Comportement bouton primaire :
- Sur slides 1-3 : label `"Suivant"`, action `next()`.
- Sur slide 4 (notifications) : label `"Activer les notifications"`,
  action → `registerForPushNotifications()` → quoi qu'il arrive (granted
  ou denied) → `finish()` (markOnboardingSeen + signin).
- Le lien "Passer" du header reste fonctionnel : `finish()` sans demande
  de permission.

Indicator dots passe de 3 à 4 points.

## Deep link réception côté écrans

### `/(prospect)/relations`

`useLocalSearchParams<{ focusRelation?: string }>()`. Au mount (et au
focus revenu de background) :
1. Si `focusRelation` et que la query `useProspectRelations` est `success`,
   scroll vers la card matching `r.id === focusRelation` via `flatListRef.scrollToIndex` ou layout measurement.
2. Animer la border de la card en violet pulsé (280 ms aller-retour ×2).
3. `router.setParams({ focusRelation: undefined })` pour permettre un nouveau deep link plus tard.

### `/(prospect)/portefeuille`

`useLocalSearchParams<{ openFlash?: string }>()`. Au mount :
1. Si `openFlash`, on passe ce `campaignId` au composant `AppHeader`
   via une prop ou un context. `AppHeader` ouvre `FlashDealsSheet` avec
   `initialDealId` pour pré-scroller.
2. `router.setParams({ openFlash: undefined })`.

Pattern préféré : un nouveau context `OpenFlashSheetContext` exposé par
`(prospect)/_layout.tsx`. AppHeader le consomme. C'est plus propre qu'un
prop drilling à travers ScrollScreen.

## Drawer — DELETE token au sign-out

`mobile/components/drawer-panel.tsx` :

```ts
async function doSignOut() {
  setBusy(true);
  try {
    await unregisterPushToken();    // ← ajout, swallow erreurs
    await signOut();
    router.replace("/(auth)/sign-in");
  } catch { ... }
}
```

Et idem pour `doDelete()`. Sans cet appel, le user resterait dans
`push_tokens` et recevrait des notifs après déconnexion (jusqu'à
DeviceNotRegistered au cleanup serveur).

## Edge cases

| Cas | Comportement |
|---|---|
| Permission denied | Aucun token enregistré → aucun push envoyé. L'user peut réactiver dans iOS/Android Settings. Pas de bouton in-app v1. |
| Token expiré (changement d'appareil) | Receipt `DeviceNotRegistered` → DELETE auto serveur côté `sendBatch`. |
| Multi-device (téléphone + tablette) | N tokens par user_id, on push à tous. |
| Cold start via tap | `getLastNotificationResponseAsync()` au mount → router.push approprié. |
| Sign-out | `unregisterPushToken()` enlève le token courant. |
| Pro lance une campagne ciblant 500 prospects | Batch 5×100. Fire-and-forget, n'allonge pas la latence du POST campaign. |
| Flash deal envoyé mais user offline 1 h+ | TTL 3600 → push dropé par Expo. Pas de notif "déjà périmée". |
| User a coupé les notifs dans iOS Settings après les avoir activées | iOS retourne le token mais le shade reste vide. Côté serveur, rien à faire — le user les rallumera ou pas. |

## Hors scope v1 — itérations futures

- Préférences fines (quiet hours, mute par type) — l'user a iOS Settings.
- Action buttons lockscreen (Accepter/Refuser sans ouvrir l'app) —
  rejetée Q1 brainstorming.
- Push pour les pros (relation acceptée, contact révélé, etc.) — non
  demandé.
- Push pour les autres events prospect (gain crédité, message admin,
  campagne expire bientôt) — itération suivante, même infra.
- Push riche (image attachment, son custom, badge color) — bloqué tant
  qu'on est sur Expo Go. À ressortir au passage EAS Build / TestFlight.

## Critères d'acceptation

- [ ] Migration `push_tokens` appliquée en local + remote (via SQL Editor
      Supabase per mémoire).
- [ ] `POST /api/pro/campaigns` non régressé : le pro reçoit sa réponse
      sous 1 s même si l'envoi push prend du temps.
- [ ] Permission demandée à la slide 4 onboarding ; granted → token
      visible dans `push_tokens` row.
- [ ] Lancement campagne classique → push reçu en background avec
      emoji 👋 et channel default ; tap → `/relations` avec card scrollée + highlight.
- [ ] Lancement campagne flash (`duration_key="1h"`) → push avec emoji
      ⚡ et channel high importance ; tap → home + `FlashDealsSheet`
      ouvert sur le deal.
- [ ] Foreground : bannière in-app apparaît, refresh des queries, tap →
      même deep link. La bannière OS native ne s'affiche pas.
- [ ] Sign-out : token retiré de `push_tokens`, plus de notif après.
- [ ] Token invalide : receipt `DeviceNotRegistered` → DELETE serveur,
      pas d'erreur logguée bruyante.
