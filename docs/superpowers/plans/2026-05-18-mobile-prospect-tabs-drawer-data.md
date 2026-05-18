# Mobile Prospect — Tab Bar + Drawer + Données Réelles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réduire la tab bar prospect à 5 onglets, déplacer le reste dans un drawer ouvert depuis le header de Portefeuille, et brancher chaque écran sur les données réelles `/api/*` avec parité fonctionnelle web (lecture + actions), fraîcheur = refetch au focus.

**Architecture:** Client mince Expo Router. Couche données centralisée dans `lib/queries.ts` (React Query, 1 queryKey/endpoint, refetch au focus via helper `useRefetchOnFocus`, invalidation après mutation). Navigation : `(prospect)` reste un `Tabs` à 5 écrans ; les écrans drawer sont des routes empilées dans le même groupe ; le drawer lui-même est une route modale transparente custom, ouverte uniquement depuis le `headerLeft` de Portefeuille. Source de vérité des champs/format : `public/prototype/components/Prospect.jsx` (repo web `main`).

**Tech Stack:** Expo SDK 54, expo-router, @tanstack/react-query, @clerk/clerk-expo, NativeWind, expo-linking, expo-web-browser, react-native `Share`.

**Conventions de vérification (pas de runner de tests dans ce repo) :** ce projet n'a ni Jest ni RTL et la spec définit l'acceptation par `tsc` + `expo export` + test manuel. Chaque tâche se vérifie donc par :
- `cd <WT>/mobile && npx tsc --noEmit` → 0 erreur
- `cd <WT>/mobile && npm run lint` → 0 erreur
- Smoke manuel décrit dans la tâche (via `npx expo start`).

où `<WT>` = `/Users/mjlk_blockchain/Desktop/buupp/.claude/worktrees/mobile-app`. Toutes les commandes/chemins ci-dessous sont relatifs à `<WT>/mobile` sauf mention contraire. Travailler sur la branche `worktree-mobile-app`. Ne PAS toucher `app/(pro)/*` ni le backend web.

---

## File Structure

**Modifiés :**
- `lib/api.ts` — ajouter helper `apiUrl()` + passage du token pour téléchargements.
- `lib/queries.ts` — ajouter tous les hooks de lecture + mutations + types.
- `app/_layout.tsx` — ajouter `refetchOnWindowFocus: true` au QueryClient.
- `app/(prospect)/_layout.tsx` — réécrire : 5 onglets, `score` retiré, `preferences` ajouté, `headerLeft` drawer sur Portefeuille, déclaration des routes empilées + modale drawer.
- `app/(prospect)/portefeuille.tsx` — ajouter mouvements + carte retrait.
- `app/(prospect)/donnees.tsx` — édition par palier (PATCH) + hide/remove (tier).
- `app/(prospect)/relations.tsx` — aligner champs sur web (motif/brief/timer/historique).
- `app/(prospect)/score.tsx` — ajouter historique + `perTier`.
- `components/notifications-screen.tsx` — marquage lu + pièce jointe.

**Créés :**
- `lib/use-refetch-on-focus.ts` — refetch au focus d'écran.
- `app/(prospect)/preferences.tsx` — onglet Préférences (miroir web `Prefs`).
- `app/(prospect)/verification.tsx` — écran drawer Paliers de vérification.
- `app/(prospect)/parrainage.tsx` — écran drawer Parrainage.
- `app/(prospect)/fiscal.tsx` — écran drawer Informations fiscales.
- `app/(prospect)/suggestions.tsx` — écran drawer Vos suggestions.
- `app/drawer.tsx` — route modale **au niveau du Stack racine** (panneau latéral, 8 entrées). NB : `presentation: "transparentModal"` n'est PAS une option valide sur `Tabs.Screen` en expo-router SDK 54 (option Stack uniquement) → la modale drawer est enregistrée dans le Stack racine `app/_layout.tsx`, pas dans les Tabs `(prospect)`.
- `components/drawer-panel.tsx` — UI du panneau + modales Déconnexion / Supprimer le compte.

**Modifié (ajout) :** `app/_layout.tsx` — déclarer `<Stack.Screen name="drawer" options={{ presentation: "transparentModal", headerShown: false }} />` dans le Stack racine.

---

## Phase 0 — Couche données

### Task 1: Script typecheck + refetch-au-focus global

**Files:**
- Modify: `package.json` (scripts)
- Modify: `app/_layout.tsx:22-26`

- [ ] **Step 1: Ajouter le script `typecheck`**

Dans `package.json`, bloc `"scripts"`, ajouter après `"lint": "expo lint"` :

```json
    "lint": "expo lint",
    "typecheck": "tsc --noEmit"
```

- [ ] **Step 2: Activer le refetch au focus côté QueryClient**

Dans `app/_layout.tsx`, remplacer le bloc `queries:` (lignes 23-25) par :

```ts
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
  },
```

Le câblage `AppState → focusManager.setFocused(true)` (lignes 28-40) reste inchangé : il fournit le « window focus » que RN n'a pas. **Ne PAS** ajouter de `refetchInterval` (choix produit : pas de polling).

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add package.json app/_layout.tsx
git commit -m "chore(mobile): script typecheck + refetchOnWindowFocus"
```

---

### Task 2: Helper `useRefetchOnFocus`

`AppState` ne couvre que le retour de l'app au premier plan. Pour rafraîchir aussi quand on **navigue** vers un écran déjà monté (ex. revenir sur Portefeuille depuis le drawer), il faut un refetch au focus d'écran.

**Files:**
- Create: `lib/use-refetch-on-focus.ts`

- [ ] **Step 1: Créer le helper**

Créer `lib/use-refetch-on-focus.ts` :

```ts
// Refetch au focus d'écran (expo-router/react-navigation). Complète le
// câblage AppState→focusManager de app/_layout.tsx : ici on couvre la
// navigation interne (revenir sur un onglet/écran déjà monté). Choix
// produit : fraîcheur = focus uniquement, pas de polling.
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

type Refetchable = { refetch: () => unknown };

export function useRefetchOnFocus(...queries: Refetchable[]) {
  useFocusEffect(
    useCallback(() => {
      for (const q of queries) q.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
}
```

- [ ] **Step 2: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add lib/use-refetch-on-focus.ts
git commit -m "feat(mobile): hook useRefetchOnFocus (refetch au focus écran)"
```

---

### Task 3: Helper de téléchargement authentifié

Reçu DGFiP / récap fiscal sont des fichiers servis par des routes protégées (token Clerk requis).

**Files:**
- Modify: `lib/api.ts:9` (after `const BASE`)

- [ ] **Step 1: Exposer la base URL**

Dans `lib/api.ts`, juste après `const BASE = process.env.EXPO_PUBLIC_API_BASE_URL;` (ligne 9), ajouter :

```ts
export function apiBase(): string {
  if (!BASE) throw new Error("EXPO_PUBLIC_API_BASE_URL manquant");
  return BASE;
}
```

- [ ] **Step 2: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add lib/api.ts
git commit -m "feat(mobile): apiBase() exporté pour téléchargements fiscaux"
```

---

### Task 4: Types + hooks de lecture (tous les endpoints prospect)

Shapes **exactes** des routes web (relevées dans `app/api/...` sur `main`).

**Files:**
- Modify: `lib/queries.ts` (après le bloc `useDecideRelation`, avant `// ───────── Pro ─────────` ligne 116)

- [ ] **Step 1: Ajouter types + hooks de lecture**

Insérer dans `lib/queries.ts` avant la section Pro :

```ts
// — Mouvements financiers — GET /api/prospect/movements
export type Movement = {
  id: string;
  date: string;
  origin: string;
  tier: number | null;
  statusLabel: string;
  statusChip: string;
  amountCents: number;
  amountEur: number;
  sign: "+" | "−";
  relation: Record<string, unknown> | null;
};
export const useProspectMovements = () =>
  useGet<{ movements: Movement[] }>(
    ["prospect", "movements"],
    "/api/prospect/movements",
    15_000,
  );

// — Mes données — GET /api/prospect/donnees
export type TierKey = "identity" | "localisation" | "vie" | "pro" | "patrimoine";
export type DonneesResp = {
  identity: Record<string, unknown> | null;
  localisation: Record<string, unknown> | null;
  vie: Record<string, unknown> | null;
  pro: Record<string, unknown> | null;
  patrimoine: Record<string, unknown> | null;
  identityMeta: { phoneVerifiedAt: string | null };
  hiddenTiers: TierKey[];
  removedTiers: TierKey[];
  isFounder: boolean;
};
export const useProspectDonnees = () =>
  useGet<DonneesResp>(["prospect", "donnees"], "/api/prospect/donnees", 15_000);

// — Vérification — GET /api/prospect/verification
export type Verification = {
  tier: "basique" | "verifie" | "certifie" | string;
  rib: {
    ibanMasked: string;
    bic: string;
    holderName: string;
    validated: boolean;
    validatedAt: string | null;
  } | null;
  physicalAcceptances: number;
  progress: number;
};
export const useProspectVerification = () =>
  useGet<Verification>(
    ["prospect", "verification"],
    "/api/prospect/verification",
    30_000,
  );

// — Score history — GET /api/prospect/score/history?range=1M|3M|6M|12M
export type ScoreHistory = {
  range: string;
  since: string;
  points: {
    date: string;
    score: number;
    completenessPct: number;
    freshnessPct: number;
    acceptancePct: number;
  }[];
};
export const useProspectScoreHistory = (range: "1M" | "3M" | "6M" | "12M" = "3M") =>
  useGet<ScoreHistory>(
    ["prospect", "score", "history", range],
    `/api/prospect/score/history?range=${range}`,
    60_000,
  );

// — Fiscal — GET /api/prospect/fiscal
export type Fiscal = {
  thresholdEur: number;
  thresholdTransactions: number;
  currentYear: {
    year: number;
    totalCents: number;
    totalEur: number;
    transactionCount: number;
    thresholdReached: boolean;
  };
  previousYear: {
    year: number;
    totalCents: number;
    totalEur: number;
    transactionCount: number;
    reportedToDgfip: boolean;
  };
};
export const useProspectFiscal = () =>
  useGet<Fiscal>(["prospect", "fiscal"], "/api/prospect/fiscal", 60_000);

// — Statut payout (Stripe Connect) — GET /api/prospect/payout/status
export type PayoutStatus = {
  hasAccount: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
};
export const usePayoutStatus = () =>
  useGet<PayoutStatus>(
    ["prospect", "payout", "status"],
    "/api/prospect/payout/status",
    30_000,
  );

// — Consentement tracking e-mail — GET /api/me/email-tracking
export type EmailTracking = { consent: boolean; role: string };
export const useEmailTracking = () =>
  useGet<EmailTracking>(
    ["me", "email-tracking"],
    "/api/me/email-tracking",
    60_000,
  );

// — Identité (prénom/nom/email) — GET /api/me
export type Me = {
  prenom: string | null;
  nom: string | null;
  email: string | null;
  initials: string;
  role: "prospect" | "pro" | null;
  displayName: string;
};
// `useMe` existe déjà (ligne ~25) typé Record<string,unknown> ; on ajoute
// une variante typée pour les écrans qui en ont besoin.
export const useMeTyped = () => useGet<Me>(["me"], "/api/me", 60_000);
```

- [ ] **Step 2: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add lib/queries.ts
git commit -m "feat(mobile): types+hooks lecture (movements/donnees/verif/score-history/fiscal/payout/email-tracking/me)"
```

---

### Task 5: Hooks de mutation

Bodies/réponses **exacts** des routes web :
`POST /api/prospect/donnees` `{ tier, fields }` → `{ ok, tier, fields }` ·
`POST /api/prospect/tier` `{ tier, action }` → `{ ok, hiddenTiers, removedTiers }` (actions exactes : voir les appels `fetch('/api/prospect/tier'…)` dans `Prospect.jsx` fn `MesDonnees` L2565+) ·
`POST /api/prospect/phone/start` `{ phone }` ·
`POST /api/prospect/phone/verify` `{ code }` ·
`POST /api/prospect/rib` `{ iban, bic, holderName }` → `{ ok }` ; `DELETE /api/prospect/rib` → `{ ok }` ·
`POST /api/prospect/payout/onboarding` → `{ url, accountId }` ·
`POST /api/prospect/payout/withdraw` `{ amountCents, method:"iban" }` ·
`POST /api/me/email-tracking` `{ consent: boolean }` ·
`POST /api/me/suggestions` `{ subject, message }` → `{ ok: true }` ·
`DELETE /api/me` → 200.

**Files:**
- Modify: `lib/queries.ts` (à la suite des hooks de lecture de la Task 4)

- [ ] **Step 1: Ajouter les hooks de mutation**

```ts
// ── Mutations prospect/me ──────────────────────────────────────────
export function usePatchDonnees() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { tier: TierKey; fields: Record<string, unknown> }) =>
      api("/api/prospect/donnees", {
        method: "POST",
        body: JSON.stringify(v),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospect", "donnees"] });
      qc.invalidateQueries({ queryKey: ["prospect", "score"] });
      qc.invalidateQueries({ queryKey: ["prospect", "verification"] });
    },
  });
}

export function useTierAction() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { tier: TierKey; action: string }) =>
      api("/api/prospect/tier", { method: "POST", body: JSON.stringify(v) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospect", "donnees"] });
      qc.invalidateQueries({ queryKey: ["prospect", "score"] });
    },
  });
}

export function usePhoneStart() {
  const api = useApi();
  return useMutation({
    mutationFn: (v: { phone: string }) =>
      api("/api/prospect/phone/start", {
        method: "POST",
        body: JSON.stringify(v),
      }),
  });
}

export function usePhoneVerify() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { code: string }) =>
      api("/api/prospect/phone/verify", {
        method: "POST",
        body: JSON.stringify(v),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospect", "donnees"] });
      qc.invalidateQueries({ queryKey: ["prospect", "verification"] });
    },
  });
}

export function useSaveRib() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { iban: string; bic: string; holderName: string }) =>
      api("/api/prospect/rib", { method: "POST", body: JSON.stringify(v) }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["prospect", "verification"] }),
  });
}

export function useDeleteRib() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("/api/prospect/rib", { method: "DELETE" }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["prospect", "verification"] }),
  });
}

export function usePayoutOnboarding() {
  const api = useApi();
  return useMutation({
    mutationFn: () =>
      api<{ url: string; accountId: string }>(
        "/api/prospect/payout/onboarding",
        { method: "POST" },
      ),
  });
}

export function usePayoutWithdraw() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { amountCents: number }) =>
      api("/api/prospect/payout/withdraw", {
        method: "POST",
        body: JSON.stringify({ amountCents: v.amountCents, method: "iban" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospect", "wallet"] });
      qc.invalidateQueries({ queryKey: ["prospect", "movements"] });
    },
  });
}

export function useSetEmailTracking() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { consent: boolean }) =>
      api("/api/me/email-tracking", {
        method: "POST",
        body: JSON.stringify(v),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["me", "email-tracking"] }),
  });
}

export function useSendSuggestion() {
  const api = useApi();
  return useMutation({
    mutationFn: (v: { subject: string | null; message: string }) =>
      api<{ ok: true }>("/api/me/suggestions", {
        method: "POST",
        body: JSON.stringify(v),
      }),
  });
}

export function useDeleteAccount() {
  const api = useApi();
  return useMutation({
    mutationFn: () => api("/api/me", { method: "DELETE" }),
  });
}

export function useMarkNotificationRead() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string }) =>
      api(`/api/me/notifications/${v.id}/read`, { method: "POST" }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["me", "notifications"] }),
  });
}
```

- [ ] **Step 2: Vérifier les valeurs d'`action` du tier**

Ouvrir (repo web) `/Users/mjlk_blockchain/Desktop/buupp/public/prototype/components/Prospect.jsx` fn `MesDonnees` (L2565+) ; relever les `action:` exactes passées à `fetch('/api/prospect/tier')` (ex. masquer/réafficher/supprimer/restaurer). Elles seront utilisées telles quelles en Task 9 — aucun changement de code ici (le hook prend `action: string`).

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add lib/queries.ts
git commit -m "feat(mobile): hooks mutations prospect/me (donnees/tier/phone/rib/payout/email-tracking/suggestions/delete/notif-read)"
```

---

## Phase 1 — Navigation (tabs + drawer)

### Task 6: Tab bar à 5 onglets + routes empilées

**Files:**
- Modify: `app/(prospect)/_layout.tsx` (réécriture complète)

- [ ] **Step 1: Réécrire le layout**

Remplacer **tout** `app/(prospect)/_layout.tsx` par :

```tsx
// Espace prospect — Tabs à 5 onglets (Portefeuille, Mes données, Mise en
// relation, Messages, Préférences). Les écrans secondaires (verif, score,
// parrainage, fiscal, suggestions) sont des routes empilées, accessibles
// via le drawer ouvert depuis le header de Portefeuille uniquement.
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, router, Tabs } from "expo-router";
import { Pressable } from "react-native";

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  portefeuille: "wallet-outline",
  donnees: "albums-outline",
  relations: "swap-horizontal",
  messages: "chatbubble-ellipses-outline",
  preferences: "options-outline",
};

export default function ProspectLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && !isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: "#7C5CFC",
        tabBarInactiveTintColor: "#8A91A1",
      }}
    >
      <Tabs.Screen
        name="portefeuille"
        options={{
          title: "Portefeuille",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.portefeuille} color={color} size={size} />
          ),
          headerLeft: () => (
            <Pressable
              onPress={() => router.push("/(prospect)/drawer")}
              hitSlop={12}
              style={{ paddingHorizontal: 16 }}
              accessibilityLabel="Ouvrir le menu"
            >
              <Ionicons name="menu" size={24} color="#13235B" />
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="donnees"
        options={{
          title: "Mes données",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.donnees} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="relations"
        options={{
          title: "Mise en relation",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.relations} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.messages} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="preferences"
        options={{
          title: "Préférences",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.preferences} color={color} size={size} />
          ),
        }}
      />

      {/* Écrans drawer — masqués de la tab bar (href: null) */}
      <Tabs.Screen name="verification" options={{ href: null, title: "Paliers de vérification" }} />
      <Tabs.Screen name="score" options={{ href: null, title: "BUUPP Score" }} />
      <Tabs.Screen name="parrainage" options={{ href: null, title: "Parrainage" }} />
      <Tabs.Screen name="fiscal" options={{ href: null, title: "Informations fiscales" }} />
      <Tabs.Screen name="suggestions" options={{ href: null, title: "Vos suggestions" }} />
      <Tabs.Screen
        name="drawer"
        options={{ href: null, presentation: "transparentModal", headerShown: false }}
      />
    </Tabs>
  );
}
```

> Note expo-router : `href: null` retire l'écran de la tab bar tout en le gardant routable via `router.push`. `preferences.tsx`, `verification.tsx`, `parrainage.tsx`, `fiscal.tsx`, `suggestions.tsx`, `drawer.tsx` sont créés dans les tâches suivantes ; tant qu'ils n'existent pas le bundler échoue — exécuter les Tasks 7→14 avant le smoke complet, mais `tsc`/`lint` passent dès cette tâche.

- [ ] **Step 2: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add app/(prospect)/_layout.tsx
git commit -m "feat(mobile): tab bar prospect 5 onglets + routes drawer (href:null) + bouton menu"
```

---

### Task 7: Panneau drawer + modales (Déconnexion / Supprimer le compte)

**Files:**
- Create: `components/drawer-panel.tsx`
- Create: `app/(prospect)/drawer.tsx`

- [ ] **Step 1: Créer le composant panneau**

Créer `components/drawer-panel.tsx`. Entrées exactes (libellés = web `Prospect.jsx` sidebar L600-700). Liens « Suivez-nous » repris du web : Facebook `https://www.facebook.com/buupp`, Instagram `https://www.instagram.com/buupp`, TikTok `https://www.tiktok.com/@buupp`.

```tsx
// Panneau du drawer prospect : navigation vers les écrans secondaires +
// Suivez-nous (liens externes) + Déconnexion / Supprimer le compte
// (modales de confirmation, parité web Prospect.jsx L729-924).
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";

import { useDeleteAccount } from "../lib/queries";

const SOCIAL = [
  { icon: "logo-facebook" as const, url: "https://www.facebook.com/buupp" },
  { icon: "logo-instagram" as const, url: "https://www.instagram.com/buupp" },
  { icon: "logo-tiktok" as const, url: "https://www.tiktok.com/@buupp" },
];

const NAV: { label: string; route: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "Paliers de vérification", route: "/(prospect)/verification", icon: "shield-checkmark-outline" },
  { label: "BUUPP Score", route: "/(prospect)/score", icon: "speedometer-outline" },
  { label: "Parrainage", route: "/(prospect)/parrainage", icon: "gift-outline" },
  { label: "Informations fiscales", route: "/(prospect)/fiscal", icon: "document-text-outline" },
  { label: "Vos suggestions", route: "/(prospect)/suggestions", icon: "bulb-outline" },
];

function Row({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl px-4 py-3.5 active:bg-ivory-2"
    >
      <Ionicons name={icon} size={20} color={danger ? "#C0392B" : "#13235B"} />
      <Text className={`text-base ${danger ? "text-bad" : "text-ink"}`}>{label}</Text>
    </Pressable>
  );
}

export default function DrawerPanel() {
  const { signOut } = useAuth();
  const del = useDeleteAccount();
  const [confirm, setConfirm] = useState<null | "signout" | "delete">(null);

  const close = () => router.back();
  const go = (route: string) => {
    router.back();
    router.push(route as never);
  };

  async function doSignOut() {
    await signOut();
    router.replace("/(auth)/sign-in");
  }
  async function doDelete() {
    await del.mutateAsync();
    await signOut();
    router.replace("/(auth)/sign-in");
  }

  return (
    <View className="flex-1 flex-row">
      <View className="w-[82%] max-w-[360px] bg-paper" style={{ elevation: 8 }}>
        <ScrollView contentContainerClassName="gap-1 px-4 pb-10 pt-14">
          <Text className="px-4 pb-2 font-serif text-2xl text-ink">Menu</Text>
          {NAV.map((n) => (
            <Row key={n.route} icon={n.icon} label={n.label} onPress={() => go(n.route)} />
          ))}

          <Text
            className="mt-4 px-4 text-[11px] font-bold uppercase text-ink-4"
            style={{ letterSpacing: 1.2 }}
          >
            Suivez-nous
          </Text>
          <View className="flex-row gap-3 px-4 py-2">
            {SOCIAL.map((s) => (
              <Pressable
                key={s.url}
                onPress={() => Linking.openURL(s.url)}
                className="h-11 w-11 items-center justify-center rounded-full border border-line active:opacity-70"
              >
                <Ionicons name={s.icon} size={18} color="#13235B" />
              </Pressable>
            ))}
          </View>

          <View className="my-3 h-px bg-line" />
          <Row icon="log-out-outline" label="Déconnexion" onPress={() => setConfirm("signout")} />
          <Row
            icon="trash-outline"
            label="Supprimer mon compte"
            danger
            onPress={() => setConfirm("delete")}
          />
        </ScrollView>
      </View>

      {/* Scrim : ferme le drawer */}
      <Pressable className="flex-1 bg-black/40" onPress={close} />

      <Modal transparent visible={confirm !== null} animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/50 px-8">
          <View className="w-full gap-4 rounded-2xl bg-paper p-6">
            <Text className="font-serif text-xl text-ink">
              {confirm === "delete" ? "Supprimer définitivement ?" : "Se déconnecter ?"}
            </Text>
            <Text className="text-sm leading-5 text-ink-3">
              {confirm === "delete"
                ? "Cette action efface définitivement votre compte et toutes vos données (RGPD). Irréversible."
                : "Vous devrez vous reconnecter pour accéder à votre espace."}
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                className="flex-1 items-center rounded-full border border-line py-3"
                onPress={() => setConfirm(null)}
              >
                <Text className="text-sm text-ink-3">Annuler</Text>
              </Pressable>
              <Pressable
                disabled={del.isPending}
                className={`flex-1 items-center rounded-full py-3 ${
                  confirm === "delete" ? "bg-bad" : "bg-ink"
                }`}
                onPress={confirm === "delete" ? doDelete : doSignOut}
              >
                <Text className="text-sm font-semibold text-paper">
                  {del.isPending
                    ? "…"
                    : confirm === "delete"
                      ? "Supprimer"
                      : "Se déconnecter"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
```

> Si `logo-tiktok` n'existe pas dans la version d'`@expo/vector-icons` installée (`npx tsc --noEmit` le signalera comme erreur de type sur `Ionicons.glyphMap`), remplacer par `"logo-tiktok"` → `"musical-notes-outline"` et garder l'URL TikTok.

- [ ] **Step 2: Créer la route modale**

Créer `app/(prospect)/drawer.tsx` :

```tsx
import DrawerPanel from "../../components/drawer-panel";

export default function ProspectDrawer() {
  return <DrawerPanel />;
}
```

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur (si erreur sur `logo-tiktok`, appliquer la note du Step 1 puis relancer).

- [ ] **Step 4: Commit**

```bash
git add components/drawer-panel.tsx app/(prospect)/drawer.tsx
git commit -m "feat(mobile): drawer prospect (nav + suivez-nous + déconnexion/suppression compte)"
```

---

## Phase 2 — Écrans onglets (données réelles, parité web)

> Pour chaque écran : la **shape de réponse** est fournie (types Task 4) ; les **champs et formats exacts** doivent reproduire la fonction correspondante de `public/prototype/components/Prospect.jsx` (repo web). Utiliser les helpers `eur` / `dateFr` de `components/screen.tsx` (formats fr-FR identiques au web). Ajouter `useRefetchOnFocus(...)` sur chaque écran.

### Task 8: Portefeuille — wallet + mouvements + retrait

**Référence web :** `Prospect.jsx` fn `Portefeuille` L1858-2564.

**Files:**
- Modify: `app/(prospect)/portefeuille.tsx` (réécriture)

- [ ] **Step 1: Réécrire l'écran**

```tsx
// Portefeuille prospect — /api/prospect/wallet + /api/prospect/movements.
// Champs & formats alignés sur Prospect.jsx fn Portefeuille (web).
import { Text, View } from "react-native";

import { Card, dateFr, eur, QueryGate, ScrollScreen, Stat } from "../../components/screen";
import {
  useProspectMovements,
  useProspectWallet,
} from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

export default function Portefeuille() {
  const w = useProspectWallet();
  const m = useProspectMovements();
  useRefetchOnFocus(w, m);

  return (
    <ScrollScreen onRefresh={() => Promise.all([w.refetch(), m.refetch()])}>
      <QueryGate query={w}>
        {(d) => (
          <>
            <Card dark>
              <Text className="font-mono text-[11px] uppercase text-ink-5">
                Disponible au retrait
              </Text>
              <Text className="mt-1 font-serif text-4xl text-paper">
                {eur(d.availableEur)}
              </Text>
              <Text className="mt-1 text-xs text-ink-5">
                {d.canWithdraw
                  ? "Retrait possible"
                  : `Seuil de retrait : ${eur(d.withdrawThresholdEur)}`}
              </Text>
            </Card>

            <View className="flex-row gap-3">
              <Stat label="Ce mois" value={eur(d.monthGainsEur)} />
              <Stat label="Total cumulé" value={eur(d.lifetimeGainsEur)} />
            </View>
            <View className="flex-row gap-3">
              <Stat label="En séquestre" value={eur(d.escrowEur)} hint="campagnes en cours" />
              <Stat label="Mises en relation" value={String(d.relationsCount)} />
            </View>
          </>
        )}
      </QueryGate>

      <Text
        className="mt-2 text-[11px] font-bold uppercase text-ink-4"
        style={{ letterSpacing: 1.2 }}
      >
        Mouvements
      </Text>
      <QueryGate
        query={m}
        isEmpty={(d) => (d.movements?.length ?? 0) === 0}
        emptyLabel="Aucun mouvement pour le moment."
      >
        {(d) => (
          <View className="gap-2">
            {d.movements.map((mv) => (
              <View
                key={mv.id}
                className="flex-row items-center justify-between rounded-2xl border border-line bg-paper p-3"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-sm text-ink-2" numberOfLines={1}>
                    {mv.origin}
                  </Text>
                  <Text className="font-mono text-[10px] text-ink-4">
                    {dateFr(mv.date)} · {mv.statusLabel}
                  </Text>
                </View>
                <Text
                  className={`font-serif text-base ${
                    mv.amountCents >= 0 ? "text-violet" : "text-ink-3"
                  }`}
                >
                  {mv.sign}
                  {eur(Math.abs(mv.amountEur))}
                </Text>
              </View>
            ))}
          </View>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
```

> Le déclenchement du **retrait** (bouton + saisie montant → `usePayoutWithdraw`/`usePayoutOnboarding`) est implémenté côté **Préférences** (Task 12), comme sur le web où le RIB/retrait vit dans la section paramètres. Ici Portefeuille reste lecture (wallet + mouvements), conforme à `Prospect.jsx`.

- [ ] **Step 2: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 3: Smoke**

`npx expo start` → onglet Portefeuille : solde, 4 stats, liste mouvements avec signe/montant/date/statut. Comparer 1 mouvement avec le web (`/prospect?tab=portefeuille`) → mêmes libellé, date (jj/mm/aaaa), montant (x,xx €).

- [ ] **Step 4: Commit**

```bash
git add app/(prospect)/portefeuille.tsx
git commit -m "feat(mobile): Portefeuille = wallet + mouvements réels (parité web)"
```

---

### Task 9: Mes données — affichage + édition + masquer/supprimer palier

**Référence web :** `Prospect.jsx` fn `MesDonnees` L2565-3938 (libellés de champs par palier, ordre, et appels `fetch('/api/prospect/donnees')` POST + `fetch('/api/prospect/tier')`).

**Files:**
- Modify: `app/(prospect)/donnees.tsx` (réécriture)

- [ ] **Step 1: Relever le mapping champs UI ↔ clés**

Dans `Prospect.jsx` fn `MesDonnees`, relever pour chaque palier (identity/localisation/vie/pro/patrimoine) la liste ordonnée `{ clé API, libellé FR, type d'input }` et les `action:` exactes des appels `/api/prospect/tier` (masquer/réafficher/supprimer/restaurer). Ces constantes alimentent le code du Step 2.

- [ ] **Step 2: Réécrire l'écran**

Structure (les listes de champs par palier proviennent du Step 1, à transcrire dans `FIELDS`) :

```tsx
// Mes données — /api/prospect/donnees (lecture + édition par palier via
// POST /api/prospect/donnees) + masquer/supprimer (POST /api/prospect/tier).
// Champs/libellés/ordre = Prospect.jsx fn MesDonnees (web).
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Card, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import {
  useProspectDonnees,
  usePatchDonnees,
  useTierAction,
  type TierKey,
} from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

// Transcrire ICI depuis Prospect.jsx fn MesDonnees (Step 1) : pour chaque
// palier, la liste ordonnée { key, label } des champs éditables.
const FIELDS: Record<TierKey, { key: string; label: string }[]> = {
  identity: [/* … depuis Prospect.jsx … */],
  localisation: [/* … */],
  vie: [/* … */],
  pro: [/* … */],
  patrimoine: [/* … */],
};

const TIERS: { key: TierKey; n: number; label: string }[] = [
  { key: "identity", n: 1, label: "Identification" },
  { key: "localisation", n: 2, label: "Localisation" },
  { key: "vie", n: 3, label: "Style de vie" },
  { key: "pro", n: 4, label: "Professionnel" },
  { key: "patrimoine", n: 5, label: "Patrimoine" },
];

export default function Donnees() {
  const q = useProspectDonnees();
  const patch = usePatchDonnees();
  const tierAction = useTierAction();
  useRefetchOnFocus(q);
  const [editing, setEditing] = useState<TierKey | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  return (
    <ScrollScreen onRefresh={q.refetch}>
      <SectionTitle
        eyebrow="Mes données — RGPD art. 15 à 22"
        title="Vos paliers"
        desc="Plus vous renseignez de données, plus votre BUUPP Score et vos gains augmentent. Vous restez maître de ce que vous partagez."
      />
      <QueryGate query={q}>
        {(d) => (
          <View className="gap-3">
            {TIERS.map((t) => {
              const row = (d[t.key] ?? {}) as Record<string, unknown>;
              const hidden = d.hiddenTiers.includes(t.key);
              const removed = d.removedTiers.includes(t.key);
              const isEditing = editing === t.key;
              return (
                <Card key={t.n} className={removed ? "opacity-60" : ""}>
                  <View className="flex-row items-center justify-between">
                    <Text className="font-serif text-lg text-ink">
                      P{t.n} · {t.label}
                    </Text>
                    <Text className="font-mono text-xs text-ink-4">
                      {removed ? "supprimé" : hidden ? "masqué" : ""}
                    </Text>
                  </View>

                  {isEditing ? (
                    <View className="mt-2 gap-2">
                      {FIELDS[t.key].map((f) => (
                        <View key={f.key} className="gap-1">
                          <Text className="text-[11px] uppercase text-ink-4">
                            {f.label}
                          </Text>
                          <TextInput
                            defaultValue={String(row[f.key] ?? "")}
                            onChangeText={(v) =>
                              setDraft((s) => ({ ...s, [f.key]: v }))
                            }
                            className="rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink"
                          />
                        </View>
                      ))}
                      <View className="mt-1 flex-row gap-2">
                        <Pressable
                          className="flex-1 items-center rounded-full border border-line py-2.5"
                          onPress={() => {
                            setEditing(null);
                            setDraft({});
                          }}
                        >
                          <Text className="text-sm text-ink-3">Annuler</Text>
                        </Pressable>
                        <Pressable
                          disabled={patch.isPending}
                          className="flex-1 items-center rounded-full bg-ink py-2.5"
                          onPress={async () => {
                            await patch.mutateAsync({ tier: t.key, fields: draft });
                            setEditing(null);
                            setDraft({});
                          }}
                        >
                          <Text className="text-sm font-semibold text-paper">
                            {patch.isPending ? "…" : "Enregistrer"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View className="mt-2 gap-1">
                      {FIELDS[t.key].map((f) => (
                        <View key={f.key} className="flex-row justify-between">
                          <Text className="text-xs text-ink-4">{f.label}</Text>
                          <Text
                            className="max-w-[55%] text-right text-xs text-ink-2"
                            numberOfLines={1}
                          >
                            {row[f.key] != null && String(row[f.key]).trim() !== ""
                              ? String(row[f.key])
                              : "—"}
                          </Text>
                        </View>
                      ))}
                      <View className="mt-2 flex-row gap-2">
                        {!removed && (
                          <Pressable
                            className="rounded-full border border-line px-4 py-2"
                            onPress={() => setEditing(t.key)}
                          >
                            <Text className="text-xs text-ink-2">Modifier</Text>
                          </Pressable>
                        )}
                        <Pressable
                          className="rounded-full border border-line px-4 py-2"
                          onPress={() =>
                            tierAction.mutate({
                              tier: t.key,
                              // action exacte selon Prospect.jsx (Step 1) :
                              action: hidden ? "show" : "hide",
                            })
                          }
                        >
                          <Text className="text-xs text-ink-2">
                            {hidden ? "Réafficher" : "Masquer"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
```

> Remplacer les `action:` (`"show"`/`"hide"`) et le contenu de `FIELDS` par les valeurs **exactes** relevées au Step 1 dans `Prospect.jsx`. Ne pas inventer de clés : utiliser les clés réellement présentes dans la réponse `/api/prospect/donnees` (mêmes que le web).

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur (si `FIELDS` vide, `tsc` passe ; le Step 1 doit l'avoir rempli).

- [ ] **Step 4: Smoke**

Onglet Mes données : 5 paliers, champs affichés = ceux du web ; Modifier → Enregistrer un champ → la valeur persiste après refetch ; Masquer/Réafficher reflète l'état web.

- [ ] **Step 5: Commit**

```bash
git add app/(prospect)/donnees.tsx
git commit -m "feat(mobile): Mes données = lecture + édition palier + masquer/supprimer (parité web)"
```

---

### Task 10: Mise en relation — champs alignés sur le web

**Référence web :** `Prospect.jsx` fn `Relations` L3939-4683.

**Files:**
- Modify: `lib/queries.ts` (étendre le type `Relation`)
- Modify: `app/(prospect)/relations.tsx`

- [ ] **Step 1: Étendre le type `Relation`**

Dans `lib/queries.ts`, remplacer le type `Relation` (lignes ~59-67) par les champs réellement renvoyés par `/api/prospect/relations` (cf. `app/api/prospect/relations/route.ts` sur le repo web — relever la shape exacte de `pending[]` et `history[]`) :

```ts
export type Relation = {
  id: string;
  pro: string;
  sector: string;
  motif: string;
  brief: string | null;
  reward: number;
  tier: number;
  timer: string;
  decision?: string;
  status?: string;
  date?: string;
};
```

> Relever la shape exacte dans `/Users/mjlk_blockchain/Desktop/buupp/app/api/prospect/relations/route.ts` et n'ajouter que les champs réellement présents (ne pas sur-typer).

- [ ] **Step 2: Aligner l'affichage**

Dans `app/(prospect)/relations.tsx` : ajouter `useRefetchOnFocus(q)` (importer le helper) après `const decide = …`. Dans la carte `pending`, sous `r.motif`, afficher `r.brief` s'il est présent :

```tsx
                {r.brief ? (
                  <Text className="mt-1 text-xs text-ink-4">{r.brief}</Text>
                ) : null}
```

Dans le bloc `history`, ajouter la date et le statut comme le web :

```tsx
              <Text className="text-sm text-ink-2">{r.pro}</Text>
              <View className="items-end">
                <Text className="font-mono text-xs text-ink-4">{eur(r.reward)}</Text>
                <Text className="font-mono text-[10px] text-ink-4">
                  {r.status ?? ""}
                </Text>
              </View>
```

(remplacer le seul `<Text>` du montant historique par ce bloc `View`).

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 4: Smoke**

Onglet Mise en relation : demandes en attente avec pro/secteur/motif/brief/récompense/palier/timer ; accepter/refuser → la liste se met à jour (invalidation) ; historique avec montant + statut, identique au web.

- [ ] **Step 5: Commit**

```bash
git add lib/queries.ts app/(prospect)/relations.tsx
git commit -m "feat(mobile): Relations alignées sur la shape web (brief/status/historique) + refetch focus"
```

---

### Task 11: Messages — marquage lu + pièce jointe

**Référence web :** cloche notifications + `/api/me/notifications` ; `POST /api/me/notifications/:id/read` ; pièce jointe `GET /api/me/notifications/:id/attachment`.

**Files:**
- Modify: `lib/queries.ts` (type `Notif`)
- Modify: `components/notifications-screen.tsx`

- [ ] **Step 1: Étendre le type `Notif`**

Remplacer le type `Notif` (lignes ~31-37 de `lib/queries.ts`) par la shape exacte renvoyée :

```ts
export type Notif = {
  id: string;
  title: string;
  body: string | null;
  audience: string;
  hasAttachment: boolean;
  attachmentFilename: string | null;
  createdAt: string;
  unread: boolean;
};
```

- [ ] **Step 2: Marquage lu au tap + ouverture pièce jointe**

Réécrire `components/notifications-screen.tsx` : envelopper chaque `Card` dans un `Pressable` qui appelle `useMarkNotificationRead().mutate({ id })` si `n.unread`, et si `n.hasAttachment` afficher un bouton « Pièce jointe » qui ouvre `apiBase() + "/api/me/notifications/" + n.id + "/attachment"` via `WebBrowser.openBrowserAsync` avec le token :

```tsx
import * as WebBrowser from "expo-web-browser";
import { Pressable, Text, View } from "react-native";

import { apiBase } from "../lib/api";
import { useMarkNotificationRead, useNotifications } from "../lib/queries";
import { useRefetchOnFocus } from "../lib/use-refetch-on-focus";
import { Card, dateFr, QueryGate, ScrollScreen, SectionTitle } from "./screen";
```

Dans le composant : `const read = useMarkNotificationRead();`, `useRefetchOnFocus(q);`, et pour chaque notif :

```tsx
<Pressable
  key={n.id}
  onPress={() => {
    if (n.unread) read.mutate({ id: n.id });
  }}
>
  <Card>
    {/* … contenu existant (puce unread, titre, date, body) … */}
    {n.hasAttachment ? (
      <Pressable
        className="mt-3 self-start rounded-full border border-line px-4 py-2"
        onPress={() =>
          WebBrowser.openBrowserAsync(
            `${apiBase()}/api/me/notifications/${n.id}/attachment`,
          )
        }
      >
        <Text className="text-xs text-ink-2">
          📎 {n.attachmentFilename ?? "Pièce jointe"}
        </Text>
      </Pressable>
    ) : null}
  </Card>
</Pressable>
```

> Conserver le rendu existant (puce unread/lu, titre gras si unread, date `dateFr`, body). La pièce jointe étant sur une route protégée, si `WebBrowser` n'envoie pas le cookie/token, ouvrir plutôt via `Linking` ne suffira pas → garder `WebBrowser.openBrowserAsync`; si la route exige le Bearer, suivre Task 13 (téléchargement authentifié) en repli.

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 4: Smoke**

Onglet Messages : liste = web ; taper une notif non lue → puce passe « lu » et `unreadCount` baisse au refetch ; pièce jointe ouvrable.

- [ ] **Step 5: Commit**

```bash
git add lib/queries.ts components/notifications-screen.tsx
git commit -m "feat(mobile): Messages = notifications + marquage lu + pièce jointe (parité web)"
```

---

### Task 12: Préférences — miroir de la section web `Prefs`

**Référence web :** `Prospect.jsx` fn `Prefs` L5317-5969. Sources : `/api/prospect/donnees` (`identityMeta.phoneVerifiedAt`), `/api/prospect/verification` (`rib`), `/api/prospect/payout/status`, `/api/me/email-tracking`. Actions : `phone/start`+`phone/verify`, `rib` POST/DELETE, `payout/onboarding`, `payout/withdraw`, `email-tracking` POST.

**Files:**
- Create: `app/(prospect)/preferences.tsx`

- [ ] **Step 1: Relever les blocs de la section `Prefs` web**

Dans `Prospect.jsx` fn `Prefs`, lister les cartes/sections présentes et leur ordre (typiquement : Téléphone & vérification SMS, RIB/IBAN, Retrait des gains, Communications e-mail/consentement, Zone géographique, etc.). Le Step 2 implémente exactement ces blocs.

- [ ] **Step 2: Créer l'écran**

Créer `app/(prospect)/preferences.tsx` reproduisant les blocs du Step 1. Squelette des 4 blocs cœur (téléphone, RIB, retrait, e-mail) :

```tsx
// Préférences — miroir de la section Prefs du dashboard web
// (Prospect.jsx fn Prefs). Données : /api/prospect/donnees,
// /api/prospect/verification, /api/prospect/payout/status,
// /api/me/email-tracking. Actions : phone/rib/payout/email-tracking.
import { useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";

import { Card, eur, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import {
  useEmailTracking,
  usePayoutOnboarding,
  usePayoutStatus,
  usePayoutWithdraw,
  usePhoneStart,
  usePhoneVerify,
  useProspectDonnees,
  useProspectVerification,
  useProspectWallet,
  useSaveRib,
  useSetEmailTracking,
} from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";
import * as WebBrowser from "expo-web-browser";

export default function Preferences() {
  const don = useProspectDonnees();
  const ver = useProspectVerification();
  const pay = usePayoutStatus();
  const wal = useProspectWallet();
  const mail = useEmailTracking();
  useRefetchOnFocus(don, ver, pay, wal, mail);

  const phoneStart = usePhoneStart();
  const phoneVerify = usePhoneVerify();
  const saveRib = useSaveRib();
  const onboard = usePayoutOnboarding();
  const withdraw = usePayoutWithdraw();
  const setMail = useSetEmailTracking();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [holder, setHolder] = useState("");
  const [amount, setAmount] = useState("");

  return (
    <ScrollScreen
      onRefresh={() =>
        Promise.all([don.refetch(), ver.refetch(), pay.refetch(), wal.refetch(), mail.refetch()])
      }
    >
      <SectionTitle
        eyebrow="Préférences"
        title="Vos paramètres"
        desc="Vérification du téléphone, coordonnées bancaires, retraits et communications."
      />

      {/* Téléphone & vérification SMS */}
      <Card className="gap-3">
        <Text className="font-serif text-lg text-ink">Téléphone</Text>
        <QueryGate query={don}>
          {(d) =>
            d.identityMeta.phoneVerifiedAt ? (
              <Text className="text-sm text-good">✓ Numéro vérifié</Text>
            ) : (
              <View className="gap-2">
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+33612345678"
                  keyboardType="phone-pad"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink"
                />
                <Pressable
                  disabled={phoneStart.isPending}
                  className="items-center rounded-full bg-ink py-3"
                  onPress={() => phoneStart.mutate({ phone })}
                >
                  <Text className="text-sm font-semibold text-paper">
                    {phoneStart.isPending ? "…" : "Recevoir un code SMS"}
                  </Text>
                </Pressable>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="Code à 6 chiffres"
                  keyboardType="number-pad"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink"
                />
                <Pressable
                  disabled={phoneVerify.isPending}
                  className="items-center rounded-full border border-line py-3"
                  onPress={() => phoneVerify.mutate({ code })}
                >
                  <Text className="text-sm text-ink-2">
                    {phoneVerify.isPending ? "…" : "Valider le code"}
                  </Text>
                </Pressable>
              </View>
            )
          }
        </QueryGate>
      </Card>

      {/* RIB / IBAN */}
      <Card className="gap-3">
        <Text className="font-serif text-lg text-ink">Coordonnées bancaires</Text>
        <QueryGate query={ver}>
          {(v) =>
            v.rib ? (
              <View>
                <Text className="text-sm text-ink-2">{v.rib.ibanMasked}</Text>
                <Text className="text-xs text-ink-4">
                  {v.rib.holderName} · {v.rib.bic} ·{" "}
                  {v.rib.validated ? "validé" : "en attente"}
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                <TextInput value={iban} onChangeText={setIban} placeholder="IBAN" autoCapitalize="characters" className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink" />
                <TextInput value={bic} onChangeText={setBic} placeholder="BIC" autoCapitalize="characters" className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink" />
                <TextInput value={holder} onChangeText={setHolder} placeholder="Titulaire du compte" className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink" />
                <Pressable
                  disabled={saveRib.isPending}
                  className="items-center rounded-full bg-ink py-3"
                  onPress={() =>
                    saveRib.mutate({ iban, bic, holderName: holder })
                  }
                >
                  <Text className="text-sm font-semibold text-paper">
                    {saveRib.isPending ? "…" : "Enregistrer le RIB"}
                  </Text>
                </Pressable>
              </View>
            )
          }
        </QueryGate>
      </Card>

      {/* Retrait des gains */}
      <Card className="gap-3">
        <Text className="font-serif text-lg text-ink">Retrait des gains</Text>
        <QueryGate query={pay}>
          {(p) =>
            !p.detailsSubmitted ? (
              <Pressable
                disabled={onboard.isPending}
                className="items-center rounded-full bg-ink py-3"
                onPress={async () => {
                  const r = await onboard.mutateAsync();
                  await WebBrowser.openBrowserAsync(r.url);
                }}
              >
                <Text className="text-sm font-semibold text-paper">
                  {onboard.isPending ? "…" : "Configurer les paiements"}
                </Text>
              </Pressable>
            ) : (
              <View className="gap-2">
                <Text className="text-xs text-ink-4">
                  Disponible : {eur(wal.data?.availableEur ?? 0)}
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Montant en €"
                  keyboardType="decimal-pad"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink"
                />
                <Pressable
                  disabled={withdraw.isPending}
                  className="items-center rounded-full bg-ink py-3"
                  onPress={() =>
                    withdraw.mutate({
                      amountCents: Math.round(parseFloat(amount.replace(",", ".")) * 100),
                    })
                  }
                >
                  <Text className="text-sm font-semibold text-paper">
                    {withdraw.isPending ? "…" : "Demander un retrait"}
                  </Text>
                </Pressable>
              </View>
            )
          }
        </QueryGate>
      </Card>

      {/* Communications e-mail */}
      <Card className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="font-serif text-lg text-ink">Suivi e-mail</Text>
          <Text className="text-xs text-ink-4">
            Autoriser le suivi d'ouverture des e-mails BUUPP.
          </Text>
        </View>
        <QueryGate query={mail}>
          {(m) => (
            <Switch
              value={m.consent}
              onValueChange={(v) => setMail.mutate({ consent: v })}
            />
          )}
        </QueryGate>
      </Card>
    </ScrollScreen>
  );
}
```

> Ajouter les éventuels blocs supplémentaires de la section `Prefs` web relevés au Step 1 (ex. zone géographique) avec leur source de données ; ne pas omettre de bloc présent côté web (critère « identique au web »).

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 4: Smoke**

Onglet Préférences : état réel (numéro vérifié ou non, RIB masqué, statut payout, switch consentement) = web. Tester : envoi code SMS (le SMS Brevo doit arriver), enregistrement RIB, toggle consentement (persiste après refetch).

- [ ] **Step 5: Commit**

```bash
git add app/(prospect)/preferences.tsx
git commit -m "feat(mobile): onglet Préférences = miroir section Prefs web (phone/rib/payout/email)"
```

---

## Phase 3 — Écrans drawer

### Task 13: Vérification — paliers + RIB + acceptations physiques

**Référence web :** `Prospect.jsx` fn `VerifTiers` L4684-4946.

**Files:**
- Create: `app/(prospect)/verification.tsx`

- [ ] **Step 1: Créer l'écran**

```tsx
// Paliers de vérification — /api/prospect/verification.
// Champs/libellés = Prospect.jsx fn VerifTiers (web).
import { Text, View } from "react-native";

import { Card, dateFr, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import { useProspectVerification } from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

const TIER_LABEL: Record<string, string> = {
  basique: "Basique",
  verifie: "Vérifié",
  certifie: "Certifié",
};

export default function Verification() {
  const q = useProspectVerification();
  useRefetchOnFocus(q);
  return (
    <ScrollScreen onRefresh={q.refetch}>
      <SectionTitle
        eyebrow="Paliers de vérification"
        title="Votre niveau"
        desc="Plus votre profil est vérifié, plus vous accédez à des mises en relation premium."
      />
      <QueryGate query={q}>
        {(d) => (
          <>
            <Card dark>
              <Text className="font-mono text-[11px] uppercase text-ink-5">
                Palier actuel
              </Text>
              <Text className="mt-1 font-serif text-3xl text-paper">
                {TIER_LABEL[d.tier] ?? d.tier}
              </Text>
              <View className="mt-3 h-2 overflow-hidden rounded-full bg-ink-4">
                <View
                  className="h-2 rounded-full bg-violet"
                  style={{ width: `${Math.max(0, Math.min(100, d.progress))}%` }}
                />
              </View>
            </Card>

            <Card>
              <Text className="font-serif text-lg text-ink">Coordonnées bancaires</Text>
              {d.rib ? (
                <View className="mt-1">
                  <Text className="text-sm text-ink-2">{d.rib.ibanMasked}</Text>
                  <Text className="text-xs text-ink-4">
                    {d.rib.holderName} · {d.rib.bic}
                  </Text>
                  <Text className="mt-1 text-xs text-ink-4">
                    {d.rib.validated
                      ? `Validé le ${dateFr(d.rib.validatedAt)}`
                      : "En attente de validation"}
                  </Text>
                </View>
              ) : (
                <Text className="mt-1 text-sm text-ink-4">
                  Aucun RIB enregistré — ajoutez-le dans Préférences.
                </Text>
              )}
            </Card>

            <Card>
              <Text className="font-serif text-lg text-ink">
                Acceptations physiques
              </Text>
              <Text className="mt-1 font-serif text-2xl text-violet">
                {d.physicalAcceptances}
              </Text>
            </Card>
          </>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
```

- [ ] **Step 2: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 3: Smoke**

Drawer → Paliers de vérification : palier, barre de progression, RIB masqué, acceptations = web.

- [ ] **Step 4: Commit**

```bash
git add app/(prospect)/verification.tsx
git commit -m "feat(mobile): écran drawer Paliers de vérification (parité web)"
```

---

### Task 14: BUUPP Score — score + composantes + historique

**Référence web :** `Prospect.jsx` fn `ScorePanel` L4947-5316.

**Files:**
- Modify: `app/(prospect)/score.tsx`

- [ ] **Step 1: Étendre l'écran existant**

Ajouter à `app/(prospect)/score.tsx` : `useRefetchOnFocus(q, h)` et un bloc historique sous le `Card` des barres. Imports à ajouter :

```tsx
import { useProspectScore, useProspectScoreHistory } from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";
```

Dans le composant, après `const q = useProspectScore();` :

```tsx
  const h = useProspectScoreHistory("3M");
  useRefetchOnFocus(q, h);
```

Après le `</Card>` des barres (avant `</>`), ajouter le bloc historique (liste simple, parité données ; pas de courbe — équivalent textuel) :

```tsx
            <Card>
              <Text className="font-serif text-lg text-ink">
                Historique (3 mois)
              </Text>
              {h.data && h.data.points.length > 0 ? (
                <View className="mt-2 gap-1">
                  {h.data.points.slice(-12).map((p) => (
                    <View key={p.date} className="flex-row justify-between">
                      <Text className="font-mono text-xs text-ink-4">
                        {p.date}
                      </Text>
                      <Text className="text-xs text-ink-2">{p.score} / 1000</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="mt-1 text-xs text-ink-4">
                  Pas encore d'historique.
                </Text>
              )}
            </Card>
```

Brancher `onRefresh` sur les deux : remplacer `onRefresh={q.refetch}` par `onRefresh={() => Promise.all([q.refetch(), h.refetch()])}`.

- [ ] **Step 2: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 3: Smoke**

Drawer → BUUPP Score : score /1000, 3 barres (complétude/fraîcheur/acceptation), historique = web.

- [ ] **Step 4: Commit**

```bash
git add app/(prospect)/score.tsx
git commit -m "feat(mobile): écran drawer BUUPP Score + historique (parité web)"
```

---

### Task 15: Parrainage

**Référence web :** `Prospect.jsx` fn `Parrainage` L5970-6258. Le type `Parrainage` existe déjà dans `lib/queries.ts` (lignes ~86-95) et correspond à la shape — ajouter les champs manquants relevés (`launchAt`, `vipThreshold`, `vipBudgetMinEur`, `vipFlatBonusEur`).

**Files:**
- Modify: `lib/queries.ts` (type `Parrainage`)
- Create: `app/(prospect)/parrainage.tsx`

- [ ] **Step 1: Compléter le type**

Remplacer le type `Parrainage` dans `lib/queries.ts` par :

```ts
export type Parrainage = {
  refCode: string;
  launchAt: string | null;
  cap: number;
  count: number;
  remaining: number;
  vipEligible: boolean;
  vipThreshold: number;
  vipBudgetMinEur: number;
  vipFlatBonusEur: number;
  filleuls: {
    prenom: string | null;
    nom: string | null;
    ville: string | null;
    createdAt: string;
  }[];
};
```

- [ ] **Step 2: Créer l'écran**

```tsx
// Parrainage — /api/prospect/parrainage. Partage du code via Share natif.
// Champs = Prospect.jsx fn Parrainage (web).
import { Pressable, Share, Text, View } from "react-native";

import { Card, dateFr, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import { useParrainage } from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

export default function ParrainageScreen() {
  const q = useParrainage();
  useRefetchOnFocus(q);
  return (
    <ScrollScreen onRefresh={q.refetch}>
      <SectionTitle
        eyebrow="Parrainage"
        title="Invitez, gagnez plus"
        desc="Partagez votre code. Chaque filleul inscrit augmente vos avantages."
      />
      <QueryGate query={q}>
        {(d) => (
          <>
            <Card dark>
              <Text className="font-mono text-[11px] uppercase text-ink-5">
                Votre code
              </Text>
              <Text className="mt-1 font-serif text-3xl tracking-widest text-paper">
                {d.refCode}
              </Text>
              <Pressable
                className="mt-3 items-center rounded-full bg-paper py-2.5"
                onPress={() =>
                  Share.share({
                    message: `Rejoins BUUPP avec mon code ${d.refCode} : https://www.buupp.com/inscription/prospect?ref=${d.refCode}`,
                  })
                }
              >
                <Text className="text-sm font-semibold text-ink">Partager</Text>
              </Pressable>
            </Card>

            <View className="flex-row gap-3">
              <Card className="flex-1">
                <Text className="text-[10px] font-bold uppercase text-ink-4">
                  Filleuls
                </Text>
                <Text className="mt-1 font-serif text-2xl text-ink">
                  {d.count} / {d.cap}
                </Text>
              </Card>
              <Card className="flex-1">
                <Text className="text-[10px] font-bold uppercase text-ink-4">
                  Restants
                </Text>
                <Text className="mt-1 font-serif text-2xl text-violet">
                  {d.remaining}
                </Text>
              </Card>
            </View>

            {d.vipEligible ? (
              <Card>
                <Text className="text-sm text-good">
                  ✓ Éligible VIP ({d.vipThreshold} filleuls) — bonus{" "}
                  {d.vipFlatBonusEur} €
                </Text>
              </Card>
            ) : null}

            <Card>
              <Text className="font-serif text-lg text-ink">Vos filleuls</Text>
              {d.filleuls.length > 0 ? (
                <View className="mt-2 gap-1">
                  {d.filleuls.map((f, i) => (
                    <View key={i} className="flex-row justify-between">
                      <Text className="text-sm text-ink-2">
                        {[f.prenom, f.nom].filter(Boolean).join(" ") || "—"}
                        {f.ville ? ` · ${f.ville}` : ""}
                      </Text>
                      <Text className="font-mono text-xs text-ink-4">
                        {dateFr(f.createdAt)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="mt-1 text-xs text-ink-4">
                  Aucun filleul pour le moment.
                </Text>
              )}
            </Card>
          </>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
```

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 4: Smoke**

Drawer → Parrainage : code, compteurs, éligibilité VIP, liste filleuls = web ; Partager ouvre la feuille de partage native.

- [ ] **Step 5: Commit**

```bash
git add lib/queries.ts app/(prospect)/parrainage.tsx
git commit -m "feat(mobile): écran drawer Parrainage + partage code (parité web)"
```

---

### Task 16: Informations fiscales + téléchargements

**Référence web :** `Prospect.jsx` fn `Fiscal` L6259-6402 ; téléchargements `GET /api/prospect/fiscal/[year]/recap` et `/dgfip-receipt`.

**Files:**
- Create: `app/(prospect)/fiscal.tsx`

- [ ] **Step 1: Créer l'écran**

```tsx
// Informations fiscales — /api/prospect/fiscal. Téléchargements récap /
// reçu DGFiP via WebBrowser (routes protégées, session Clerk).
import * as WebBrowser from "expo-web-browser";
import { Pressable, Text, View } from "react-native";

import { apiBase } from "../../lib/api";
import { Card, eur, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import { useProspectFiscal } from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

export default function FiscalScreen() {
  const q = useProspectFiscal();
  useRefetchOnFocus(q);

  const open = (path: string) =>
    WebBrowser.openBrowserAsync(`${apiBase()}${path}`);

  return (
    <ScrollScreen onRefresh={q.refetch}>
      <SectionTitle
        eyebrow="Informations fiscales"
        title="Vos revenus déclarables"
        desc="Récapitulatif annuel de vos gains BUUPP et seuils de déclaration DGFiP."
      />
      <QueryGate query={q}>
        {(d) => (
          <>
            <Card>
              <Text className="font-serif text-lg text-ink">
                Année {d.currentYear.year}
              </Text>
              <Text className="mt-1 font-serif text-3xl text-violet">
                {eur(d.currentYear.totalEur)}
              </Text>
              <Text className="mt-1 text-xs text-ink-4">
                {d.currentYear.transactionCount} transaction
                {d.currentYear.transactionCount > 1 ? "s" : ""} ·{" "}
                {d.currentYear.thresholdReached
                  ? "Seuil DGFiP atteint"
                  : `Seuil : ${eur(d.thresholdEur)} / ${d.thresholdTransactions} tx`}
              </Text>
              <Pressable
                className="mt-3 self-start rounded-full border border-line px-4 py-2"
                onPress={() =>
                  open(`/api/prospect/fiscal/${d.currentYear.year}/recap`)
                }
              >
                <Text className="text-xs text-ink-2">Télécharger le récapitulatif</Text>
              </Pressable>
            </Card>

            <Card>
              <Text className="font-serif text-lg text-ink">
                Année {d.previousYear.year}
              </Text>
              <Text className="mt-1 font-serif text-3xl text-ink">
                {eur(d.previousYear.totalEur)}
              </Text>
              <Text className="mt-1 text-xs text-ink-4">
                {d.previousYear.transactionCount} transaction
                {d.previousYear.transactionCount > 1 ? "s" : ""} ·{" "}
                {d.previousYear.reportedToDgfip
                  ? "Déclaré à la DGFiP"
                  : "Non déclaré"}
              </Text>
              <View className="mt-3 flex-row gap-2">
                <Pressable
                  className="rounded-full border border-line px-4 py-2"
                  onPress={() =>
                    open(`/api/prospect/fiscal/${d.previousYear.year}/recap`)
                  }
                >
                  <Text className="text-xs text-ink-2">Récapitulatif</Text>
                </Pressable>
                {d.previousYear.reportedToDgfip ? (
                  <Pressable
                    className="rounded-full border border-line px-4 py-2"
                    onPress={() =>
                      open(
                        `/api/prospect/fiscal/${d.previousYear.year}/dgfip-receipt`,
                      )
                    }
                  >
                    <Text className="text-xs text-ink-2">Reçu DGFiP</Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>
          </>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
```

> Si l'ouverture `WebBrowser` des routes protégées renvoie un 401 (pas de session navigateur), implémenter le repli : `expo-file-system` `downloadAsync` avec header `Authorization: Bearer <token Clerk>` (via `useAuth().getToken()`), puis `expo-sharing`. Ce repli n'est à coder que si le smoke échoue.

- [ ] **Step 2: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 3: Smoke**

Drawer → Informations fiscales : montants/transactions/seuils année courante & précédente = web ; boutons de téléchargement ouvrent le document (sinon appliquer le repli ci-dessus).

- [ ] **Step 4: Commit**

```bash
git add app/(prospect)/fiscal.tsx
git commit -m "feat(mobile): écran drawer Informations fiscales + téléchargements (parité web)"
```

---

### Task 17: Vos suggestions

**Référence web :** `Prospect.jsx` fn `SuggestionsPanel` L1351-1857. `POST /api/me/suggestions` `{ subject, message }` → `{ ok: true }`.

**Files:**
- Create: `app/(prospect)/suggestions.tsx`

- [ ] **Step 1: Créer l'écran**

```tsx
// Vos suggestions — POST /api/me/suggestions (parité Prospect.jsx
// fn SuggestionsPanel).
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Card, ScrollScreen, SectionTitle } from "../../components/screen";
import { useSendSuggestion } from "../../lib/queries";

export default function Suggestions() {
  const send = useSendSuggestion();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!message.trim()) return;
    await send.mutateAsync({
      subject: subject.trim() || null,
      message: message.trim(),
    });
    setSent(true);
    setSubject("");
    setMessage("");
  }

  return (
    <ScrollScreen>
      <SectionTitle
        eyebrow="Vos suggestions"
        title="Faites-nous part de vos idées"
        desc="Une remarque, un bug, une idée d'amélioration ? L'équipe BUUPP vous lit."
      />
      <Card className="gap-3">
        <View className="gap-1">
          <Text className="text-[11px] uppercase text-ink-4">Sujet (optionnel)</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink"
          />
        </View>
        <View className="gap-1">
          <Text className="text-[11px] uppercase text-ink-4">Message</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            className="min-h-[120px] rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink"
            style={{ textAlignVertical: "top" }}
          />
        </View>
        <Pressable
          disabled={send.isPending || !message.trim()}
          className={`items-center rounded-full py-3 ${
            send.isPending || !message.trim() ? "bg-ink-5" : "bg-ink"
          }`}
          onPress={submit}
        >
          <Text className="text-sm font-semibold text-paper">
            {send.isPending ? "Envoi…" : "Envoyer"}
          </Text>
        </Pressable>
        {sent ? (
          <Text className="text-center text-sm text-good">
            Merci ! Votre message a bien été transmis.
          </Text>
        ) : null}
        {send.isError ? (
          <Text className="text-center text-sm text-bad">
            Échec de l'envoi — réessayez.
          </Text>
        ) : null}
      </Card>
    </ScrollScreen>
  );
}
```

- [ ] **Step 2: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 3: Smoke**

Drawer → Vos suggestions : envoyer un message → confirmation ; l'e-mail arrive à l'équipe (Brevo) comme depuis le web.

- [ ] **Step 4: Commit**

```bash
git add app/(prospect)/suggestions.tsx
git commit -m "feat(mobile): écran drawer Vos suggestions (POST /api/me/suggestions)"
```

---

## Phase 4 — Vérification finale

### Task 18: Revue d'ensemble, parité web & non-régression

**Files:** aucun (vérification), correctifs ponctuels si besoin.

- [ ] **Step 1: Typecheck + lint global**

Run: `cd <WT>/mobile && npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 2: Export web (acceptation spec)**

Run: `cd <WT>/mobile && npx expo export -p web`
Expected: build OK, pas d'erreur de bundling (toutes les routes drawer existent).

- [ ] **Step 3: Parité données vs web (manuel, compte de test prospect)**

Pour CHAQUE écran (Portefeuille, Mes données, Mise en relation, Messages, Préférences, Vérification, Score, Parrainage, Fiscal) : ouvrir le web `/(prospect)?tab=…` et l'écran mobile avec le **même compte**, comparer chaque valeur affichée (montants `x,xx €`, dates `jj/mm/aaaa`, libellés, compteurs, badges). Noter tout écart → corriger l'écran concerné (commit `fix(mobile): parité <écran>`).

- [ ] **Step 4: Fraîcheur au focus**

Modifier une donnée côté web (ex. accepter une relation / éditer un champ), revenir sur l'écran mobile correspondant (changer d'onglet puis revenir) → la valeur se met à jour sans relancer l'app, **sans** polling en arrière-plan (vérifier qu'aucun refetch ne se déclenche tant qu'on ne quitte/revient pas sur l'écran).

- [ ] **Step 5: Non-régression pro & backend**

Run: `git diff --name-only main...worktree-mobile-app | grep -E '^app/\(pro\)/|^app/api/' || echo "OK: aucun fichier pro/backend modifié"`
Expected: `OK: aucun fichier pro/backend modifié`.

- [ ] **Step 6: Commit final éventuel**

```bash
git add -A && git commit -m "test(mobile): vérification parité web prospect + non-régression"
```

---

## Self-Review (auteur du plan)

- **Couverture spec :** tab bar 5 onglets (T6) ; drawer header Portefeuille only + 8 entrées (T6/T7) ; Suivez-nous/Déconnexion/Supprimer (T7) ; chaque écran sur données réelles (T8-17) ; refetch au focus, pas de polling (T1/T2) ; parité web + non-régression pro/backend (T18). ✔ Tous les points de la spec ont une tâche.
- **Placeholders :** les seuls renvois « relever dans Prospect.jsx » (T9 `FIELDS`/actions tier, T10 shape relations, T5 actions tier, T12 blocs Prefs) sont des lectures **précises** d'un contrat web faisant autorité (chemin + fonction + lignes donnés), ce que la spec impose explicitement comme source de vérité — pas du « TODO » vague. Tous les autres steps contiennent le code complet.
- **Cohérence des types :** noms de hooks/types (`useProspectMovements`, `usePatchDonnees`, `TierKey`, `Verification`, `Fiscal`, `Parrainage`…) définis en Phase 0 et réutilisés à l'identique en Phases 2-3. ✔
- **Ambiguïté résolue :** « temps réel » = refetch au focus (T1/T2, pas de `refetchInterval`) ; « Messages » = notifications (T11) ; « Préférences » = miroir `Prefs` web (T12).
