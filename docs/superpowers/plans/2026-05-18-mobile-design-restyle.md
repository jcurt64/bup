# Mobile Design Restyle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre l'UI mobile prospect (fond ivoire conservé, cartes héro en dégradé, cartes claires à badges colorés, tab bar pilule flottante, drawer gauche animé, headers natifs off, onboarding/auth complétés) via des primitives partagées, sans toucher au backend ni à la couche données.

**Architecture:** On centralise tout le style dans des primitives (`components/ui.tsx`, `components/screen.tsx`, nouveaux `components/floating-tab-bar.tsx`) ; les 13 écrans prospect consomment `ScrollScreen` (étendu avec un `hero`) et `Card` (étendu avec `badge`) — donc le restyle se propage par changement central + petits réglages par écran. Navigation : `headerShown:false` partout, chaque écran rend son header via `GradientHero` ; tab bar custom ; drawer = panneau animé depuis la gauche (route Stack `transparentModal` sans slide bas).

**Tech Stack:** Expo SDK 54, expo-router, NativeWind, `expo-linear-gradient` (nouvelle dép), `react-native-reanimated` (déjà dép), `react-native-safe-area-context` (déjà dép), `@expo/vector-icons`.

**Vérification (pas de runner de tests) :** chaque tâche → `cd <WT>/mobile && npx tsc --noEmit` (0 erreur) + `npm run lint` (0 erreur) + smoke décrit. `<WT>` = `/Users/mjlk_blockchain/Desktop/buupp/.claude/worktrees/mobile-app`. Toutes commandes/chemins relatifs à `<WT>/mobile`. Branche `worktree-mobile-app`. Ne PAS toucher `app/(pro)/*`, `app/api/*`, ni `lib/queries.ts`/hooks (données/parité figées).

---

## File Structure

**Modifiés :**
- `package.json`, `package-lock.json` — ajout `expo-linear-gradient`.
- `tailwind.config.js` — tokens accent (coral/teal/amber/sky + soft).
- `components/ui.tsx` — `BrandLogo` (dégradé), `PrimaryButton` restylé (pill), `SocialButtons` (Apple/Google/Facebook), `Field` restylé léger.
- `components/screen.tsx` — `GradientHero` (nouveau), `ScrollScreen` (+ prop `hero`, padding bas tab bar), `Card` (+ prop `badge`), `Stat` (+ `tone`).
- `components/drawer-panel.tsx` — animation slide depuis la gauche + scrim fade.
- `app/_layout.tsx` — route `drawer` : `animation:"none"` (pas de slide bas).
- `app/(prospect)/_layout.tsx` — `headerShown:false`, `tabBar` custom, suppression `headerLeft`.
- `app/(prospect)/portefeuille.tsx` … les 11 écrans prospect — passage à `hero` + badges.
- `app/(onboarding)/index.tsx` — `BrandLogo`.
- `app/(auth)/sign-in.tsx`, `app/(auth)/role-select.tsx` — `BrandLogo`, toggle/cartes rôle, `SocialButtons`, `LegalFooter`.

**Créés :**
- `components/floating-tab-bar.tsx` — tab bar pilule flottante.

---

## Phase 0 — Dépendance + tokens

### Task 1: Installer expo-linear-gradient + tokens couleur

**Files:** `package.json`, `package-lock.json`, `tailwind.config.js`

- [ ] **Step 1: Installer la dép (versionnée SDK 54)**

Run: `npx expo install expo-linear-gradient`
Expected: ajoute `expo-linear-gradient` (~15.x) à `package.json`.

- [ ] **Step 2: Ajouter les tokens accent**

Dans `tailwind.config.js`, dans `theme.extend.colors`, après la ligne `bad: "#DC2626",` ajouter :

```js
        coral: { DEFAULT: "#FF7A6B", soft: "#FFE7E3" },
        teal: { DEFAULT: "#2FB8A6", soft: "#DCF4F0" },
        amber: { DEFAULT: "#F2B65A", soft: "#FCEFD6" },
        sky: { DEFAULT: "#5B8DEF", soft: "#E4ECFD" },
```

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json tailwind.config.js
git commit -m "chore(mobile): expo-linear-gradient + tokens accent (coral/teal/amber/sky)"
```

---

## Phase 1 — Primitives partagées

### Task 2: BrandLogo (pill dégradé) + PrimaryButton pill + SocialButtons

**Files:** `components/ui.tsx`

- [ ] **Step 1: Ajouter les imports**

En tête de `components/ui.tsx`, ajouter aux imports existants :

```tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
```

- [ ] **Step 2: Ajouter `BrandLogo` (et garder `BrandPill` en alias)**

Remplacer la fonction `BrandPill` par :

```tsx
/** Logo "buupp" — pill dégradé navy→bleu, texte serif blanc (cf. maquettes). */
export function BrandLogo({ small = false }: { small?: boolean }) {
  return (
    <LinearGradient
      colors={["#13235B", "#2F44C0"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        alignSelf: "center",
        borderRadius: 999,
        paddingHorizontal: small ? 20 : 32,
        paddingVertical: small ? 8 : 14,
        shadowColor: "#13235B",
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      }}
    >
      <Text
        className={`font-serif font-bold text-paper ${small ? "text-base" : "text-2xl"}`}
      >
        buupp
      </Text>
    </LinearGradient>
  );
}

/** Compat : ancien nom. */
export function BrandPill({ small = false }: { small?: boolean }) {
  return <BrandLogo small={small} />;
}
```

- [ ] **Step 3: Restyler `PrimaryButton` en pill (API inchangée)**

Remplacer le corps `return (...)` de `PrimaryButton` par :

```tsx
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      className={`flex-row items-center justify-center gap-2 rounded-full py-4 ${
        off ? "bg-ink-5" : "bg-ink active:opacity-80"
      }`}
      style={
        off
          ? undefined
          : {
              shadowColor: "#0F1629",
              shadowOpacity: 0.18,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
            }
      }
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className="text-base font-semibold text-paper">
          {label}
          {arrow ? "  →" : ""}
        </Text>
      )}
    </Pressable>
  );
```

- [ ] **Step 4: Ajouter `SocialButtons`**

À la fin de `components/ui.tsx` ajouter :

```tsx
/** 3 boutons de connexion sociale (cf. buupp-onboarding/4.png). */
export function SocialButtons({
  onPress,
}: {
  onPress: (p: "apple" | "google" | "facebook") => void;
}) {
  const items: {
    key: "apple" | "google" | "facebook";
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
  }[] = [
    { key: "apple", icon: "logo-apple", color: "#0F1629" },
    { key: "google", icon: "logo-google", color: "#EA4335" },
    { key: "facebook", icon: "logo-facebook", color: "#1877F2" },
  ];
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-line" />
        <Text
          className="text-[11px] font-bold uppercase text-ink-4"
          style={{ letterSpacing: 2 }}
        >
          ou
        </Text>
        <View className="h-px flex-1 bg-line" />
      </View>
      <View className="flex-row gap-3">
        {items.map((it) => (
          <Pressable
            key={it.key}
            onPress={() => onPress(it.key)}
            accessibilityRole="button"
            accessibilityLabel={`Continuer avec ${it.key}`}
            className="flex-1 items-center justify-center rounded-2xl border border-line bg-paper py-3.5 active:opacity-70"
          >
            <Ionicons name={it.icon} size={22} color={it.color} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
```

- [ ] **Step 5: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur. (Si `logo-google` n'existe pas dans la version d'`@expo/vector-icons` → `tsc` le signalera ; remplacer par `"logo-google"` → `"logo-chrome"` et garder la couleur.)

- [ ] **Step 6: Commit**

```bash
git add components/ui.tsx
git commit -m "feat(mobile): BrandLogo dégradé + PrimaryButton pill + SocialButtons"
```

---

### Task 3: GradientHero + ScrollScreen(hero) + Card(badge) + Stat(tone)

**Files:** `components/screen.tsx`

- [ ] **Step 1: Imports**

Remplacer la ligne d'import RN par (ajout `Pressable`) et ajouter LinearGradient + Ionicons :

```tsx
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
```

- [ ] **Step 2: Ajouter `GradientHero` (avant `ScrollScreen`)**

```tsx
type HeroProps = {
  title: string;
  eyebrow?: string;
  desc?: string;
  /** "menu" ouvre le drawer, "back" revient en arrière, undefined = rien */
  nav?: "menu" | "back";
  children?: ReactNode;
};

import { router } from "expo-router";

export function GradientHero({ title, eyebrow, desc, nav, children }: HeroProps) {
  return (
    <LinearGradient
      colors={["#7C5CFC", "#13235B"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 28, padding: 20, paddingTop: 22 }}
    >
      {nav ? (
        <Pressable
          onPress={() =>
            nav === "menu" ? router.push("/drawer") : router.back()
          }
          hitSlop={12}
          accessibilityLabel={nav === "menu" ? "Ouvrir le menu" : "Retour"}
          className="mb-3 h-9 w-9 items-center justify-center rounded-full bg-white/15"
        >
          <Ionicons
            name={nav === "menu" ? "menu" : "chevron-back"}
            size={20}
            color="#FFFFFF"
          />
        </Pressable>
      ) : null}
      {eyebrow ? (
        <Text
          className="text-[11px] font-bold uppercase text-white/70"
          style={{ letterSpacing: 1.5 }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text className="mt-1 font-serif text-2xl text-paper">{title}</Text>
      {desc ? (
        <Text className="mt-1 text-sm leading-5 text-white/75">{desc}</Text>
      ) : null}
      {children ? <View className="mt-3">{children}</View> : null}
    </LinearGradient>
  );
}
```

- [ ] **Step 3: Étendre `ScrollScreen`**

Remplacer la signature + le `return` de `ScrollScreen` par :

```tsx
export function ScrollScreen({
  children,
  onRefresh,
  hero,
}: {
  children: ReactNode;
  onRefresh?: () => Promise<unknown>;
  hero?: HeroProps;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  return (
    <View className="flex-1 bg-ivory">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 120, gap: 16 }}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          ) : undefined
        }
      >
        {hero ? <GradientHero {...hero} /> : null}
        {children}
      </ScrollView>
    </View>
  );
}
```

(Notes : `paddingTop:56` = sous la status bar puisque plus de header natif ; `paddingBottom:120` = espace pour la tab bar flottante.)

- [ ] **Step 4: Étendre `Card` avec un badge coloré**

Remplacer la fonction `Card` par :

```tsx
type Tone = "violet" | "coral" | "teal" | "amber" | "sky";
const TONE_BG: Record<Tone, string> = {
  violet: "bg-violet-soft",
  coral: "bg-coral-soft",
  teal: "bg-teal-soft",
  amber: "bg-amber-soft",
  sky: "bg-sky-soft",
};
const TONE_FG: Record<Tone, string> = {
  violet: "#7C5CFC",
  coral: "#FF7A6B",
  teal: "#2FB8A6",
  amber: "#F2B65A",
  sky: "#5B8DEF",
};

export function Card({
  children,
  dark = false,
  className = "",
  badge,
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
  badge?: { icon: keyof typeof Ionicons.glyphMap; tone?: Tone };
}) {
  return (
    <View
      className={`rounded-3xl p-5 ${dark ? "bg-ink" : "border border-line bg-paper"} ${className}`}
      style={
        dark
          ? undefined
          : {
              shadowColor: "#0F1629",
              shadowOpacity: 0.05,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
            }
      }
    >
      {badge ? (
        <View
          className={`mb-3 h-10 w-10 items-center justify-center rounded-full ${
            TONE_BG[badge.tone ?? "violet"]
          }`}
        >
          <Ionicons
            name={badge.icon}
            size={20}
            color={TONE_FG[badge.tone ?? "violet"]}
          />
        </View>
      ) : null}
      {children}
    </View>
  );
}
```

- [ ] **Step 5: Étendre `Stat` (coins arrondis + tone optionnel)**

Dans `Stat`, remplacer le conteneur `className="flex-1 rounded-2xl border border-line bg-paper p-4"` par `className="flex-1 rounded-3xl border border-line bg-paper p-4"`. (Reste inchangé.)

- [ ] **Step 6: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 7: Commit**

```bash
git add components/screen.tsx
git commit -m "feat(mobile): GradientHero + ScrollScreen(hero) + Card(badge) + Stat arrondi"
```

---

### Task 4: FloatingTabBar (pilule flottante, cf. tab.png)

**Files:** Create `components/floating-tab-bar.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// Tab bar pilule flottante (cf. public/prototype/tab.png) : barre
// rounded-full détachée, ombre ; onglet actif = pastille dégradé
// violet→navy + icône blanche ; inactif = icône discrète.
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  portefeuille: "wallet-outline",
  donnees: "albums-outline",
  relations: "swap-horizontal-outline",
  messages: "chatbubble-ellipses-outline",
  preferences: "options-outline",
};
const LABEL: Record<string, string> = {
  portefeuille: "Portefeuille",
  donnees: "Données",
  relations: "Relations",
  messages: "Messages",
  preferences: "Préf.",
};
const TABS = ["portefeuille", "donnees", "relations", "messages", "preferences"];

export default function FloatingTabBar({
  state,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // n'affiche que les 5 onglets visibles (les routes href:null sont
  // dans state.routes mais pas dans TABS).
  const routeByName = Object.fromEntries(
    state.routes.map((r, i) => [r.name, { key: r.key, index: i }]),
  );
  return (
    <View
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: insets.bottom + 10,
      }}
      pointerEvents="box-none"
    >
      <View
        className="flex-row items-center justify-between rounded-full bg-paper px-3 py-2.5"
        style={{
          shadowColor: "#0F1629",
          shadowOpacity: 0.16,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 12,
        }}
      >
        {TABS.map((name) => {
          const entry = routeByName[name];
          if (!entry) return null;
          const focused = state.index === entry.index;
          return (
            <Pressable
              key={name}
              onPress={() => navigation.navigate(name as never)}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={LABEL[name]}
              className="items-center"
              style={{ flex: 1 }}
            >
              {focused ? (
                <LinearGradient
                  colors={["#7C5CFC", "#13235B"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    height: 44,
                    width: 44,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={ICON[name]} size={20} color="#FFFFFF" />
                </LinearGradient>
              ) : (
                <View className="h-11 w-11 items-center justify-center rounded-full">
                  <Ionicons name={ICON[name]} size={20} color="#8A91A1" />
                </View>
              )}
              {focused ? (
                <Text className="mt-0.5 text-[10px] font-semibold text-ink">
                  {LABEL[name]}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur. Si `@react-navigation/bottom-tabs` type `BottomTabBarProps` est introuvable, l'importer via `import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";` (paquet déjà dépendance d'expo-router/Tabs — confirmer dans node_modules ; sinon typer le param `props: any` avec un commentaire `// eslint-disable-next-line` minimal et utiliser `props.state`/`props.navigation`).

- [ ] **Step 3: Commit**

```bash
git add components/floating-tab-bar.tsx
git commit -m "feat(mobile): FloatingTabBar pilule flottante (tab.png)"
```

---

## Phase 2 — Navigation (headers off + tab bar custom + drawer gauche)

### Task 5: Layout prospect — headerShown:false + FloatingTabBar

**Files:** `app/(prospect)/_layout.tsx`

- [ ] **Step 1: Réécrire le layout**

Remplacer tout `app/(prospect)/_layout.tsx` par :

```tsx
// Espace prospect — Tabs sans header natif (chaque écran rend son
// GradientHero) + tab bar pilule flottante. Écrans drawer = routes
// href:null poussées depuis le drawer (ouvert via le bouton menu du
// GradientHero de Portefeuille).
import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Tabs } from "expo-router";

import FloatingTabBar from "../../components/floating-tab-bar";

export default function ProspectLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && !isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="portefeuille" />
      <Tabs.Screen name="donnees" />
      <Tabs.Screen name="relations" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="preferences" />
      <Tabs.Screen name="verification" options={{ href: null }} />
      <Tabs.Screen name="score" options={{ href: null }} />
      <Tabs.Screen name="parrainage" options={{ href: null }} />
      <Tabs.Screen name="fiscal" options={{ href: null }} />
      <Tabs.Screen name="suggestions" options={{ href: null }} />
    </Tabs>
  );
}
```

- [ ] **Step 2: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add app/(prospect)/_layout.tsx
git commit -m "feat(mobile): prospect Tabs headerShown:false + FloatingTabBar"
```

---

### Task 6: Drawer — slide depuis la gauche + pas de slide bas

**Files:** `app/_layout.tsx`, `components/drawer-panel.tsx`

- [ ] **Step 1: Route drawer sans slide bas**

Dans `app/_layout.tsx`, remplacer le bloc :

```tsx
            <Stack.Screen
              name="drawer"
              options={{ presentation: "transparentModal", headerShown: false }}
            />
```

par :

```tsx
            <Stack.Screen
              name="drawer"
              options={{
                presentation: "transparentModal",
                headerShown: false,
                animation: "none",
              }}
            />
```

(`animation:"none"` supprime le slide-up par défaut ; l'animation d'entrée gauche est gérée dans le panneau.)

- [ ] **Step 2: Animer le panneau depuis la gauche**

Dans `components/drawer-panel.tsx` : ajouter les imports en tête (après les imports existants) :

```tsx
import { useEffect, useRef } from "react";
import { Animated, Dimensions } from "react-native";
```

(garder `useState` déjà importé ; `useEffect`/`useRef` peuvent déjà être absents — fusionner avec l'import `react` existant `import { useState } from "react";` → `import { useEffect, useRef, useState } from "react";` et ajouter `Animated, Dimensions` à l'import `react-native` existant.)

Dans le composant `DrawerPanel`, juste après `const [busy, setBusy] = useState(false);`, ajouter :

```tsx
  const W = Math.min(360, Dimensions.get("window").width * 0.82);
  const tx = useRef(new Animated.Value(-W)).current;
  const scrim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(tx, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(scrim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [tx, scrim]);
  const dismiss = () => {
    Animated.parallel([
      Animated.timing(tx, { toValue: -W, duration: 180, useNativeDriver: true }),
      Animated.timing(scrim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => router.back());
  };
```

Remplacer `const close = () => router.back();` par `const close = dismiss;` et, dans `go`, remplacer `router.back();` par `dismiss();` puis garder `router.push(route as never);` APRÈS (l'ordre : push d'abord puis dismiss pose un flash ; faire `router.back(); router.push(...)` synchrone est OK car la modale se ferme et la route empile — conserver le comportement actuel : remplacer le corps de `go` par :

```tsx
  const go = (route: string) => {
    router.back();
    router.push(route as never);
  };
```

(`go` garde `router.back()` direct — la fermeture animée est pour le scrim/close ; la navigation vers un écran reste instantanée pour éviter un flash. `close`/scrim utilisent `dismiss`.)

Remplacer le conteneur racine `return ( <View className="flex-1 flex-row"> ... </View> )` :
- Envelopper le panneau gauche dans un `Animated.View` avec `style={{ width: W, transform: [{ translateX: tx }] }}` (retirer la classe `w-[82%] max-w-[360px]`, garder `bg-paper` + l'`elevation`).
- Le scrim devient `Animated.View` avec `style={{ flex: 1, opacity: scrim }}` enveloppant un `Pressable` plein (`onPress={dismiss}`, `className="flex-1 bg-black/40"`).

Bloc `return` final :

```tsx
  return (
    <View className="flex-1 flex-row">
      <Animated.View
        className="bg-paper"
        style={{ width: W, transform: [{ translateX: tx }], elevation: 8 }}
      >
        <ScrollView contentContainerClassName="gap-1 px-4 pb-10 pt-14">
          {/* …contenu inchangé : titre Menu, NAV.map, Suivez-nous, séparateur, Déconnexion, Supprimer… */}
        </ScrollView>
      </Animated.View>
      <Animated.View style={{ flex: 1, opacity: scrim }}>
        <Pressable className="flex-1 bg-black/40" onPress={dismiss} />
      </Animated.View>
      {/* …Modal de confirmation inchangée… */}
    </View>
  );
```

Conserver tel quel : `Row`, `NAV`, `SOCIAL`, le contenu du `ScrollView`, la `Modal` de confirmation, `doSignOut`/`doDelete`. Ne change que l'enveloppe (Animated) + `close`/`dismiss`.

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx components/drawer-panel.tsx
git commit -m "feat(mobile): drawer slide depuis la gauche (plus de modale bas)"
```

---

## Phase 3 — Application aux écrans prospect (hero + badges)

> **Recette commune (appliquée à chaque écran ci-dessous) :** chaque écran utilise déjà `ScrollScreen` + `SectionTitle`. Pour chacun : (a) **supprimer** le `<SectionTitle eyebrow=… title=… desc=… />` en tête du contenu ; (b) passer ces mêmes textes à `ScrollScreen` via `hero={{ eyebrow, title, desc, nav }}` où `nav` = `"menu"` pour Portefeuille, `"back"` pour les écrans drawer (verification/score/parrainage/fiscal/suggestions), absent pour les onglets (donnees/relations/messages/preferences) ; (c) si l'écran a une "carte vedette" `<Card dark>` en tête (gros chiffre), la **déplacer dans le `children` du hero** OU la garder en 1re carte — au choix le plus lisible, mais retirer `dark` (le dégradé du hero porte déjà le contraste) ; (d) ajouter des `badge={{icon,tone}}` aux cartes thématiques (icônes Ionicons cohérentes). `SectionTitle` reste exporté pour les sous-sections internes.

### Task 7: Portefeuille

**Files:** `app/(prospect)/portefeuille.tsx`

- [ ] **Step 1:** Lire le fichier. Retirer le `SectionTitle` de tête s'il existe ; envelopper via `ScrollScreen hero={{ eyebrow: "Portefeuille", title: "Votre portefeuille", nav: "menu" }}`. Mettre le solde "Disponible au retrait" dans `hero.children` (Text blancs sur le dégradé) en retirant le `<Card dark>` correspondant. Ajouter badges : carte mouvements `badge={{icon:"swap-vertical-outline",tone:"sky"}}`, cartes Stat conservées. Garder toute la logique données/QueryGate/useRefetchOnFocus/hooks **inchangée**.

- [ ] **Step 2:** Run `npx tsc --noEmit && npm run lint` → 0 erreur.

- [ ] **Step 3:** Commit `git add app/(prospect)/portefeuille.tsx && git commit -m "feat(mobile): Portefeuille — hero dégradé + bouton menu + badges"`

### Task 8: Mes données

**Files:** `app/(prospect)/donnees.tsx`

- [ ] **Step 1:** Recette commune. `hero={{ eyebrow:"Mes données — RGPD art. 15 à 22", title:"Vos paliers", desc:<la desc existante> }}` (pas de `nav` — onglet). Bannière RGPD : la garder en carte sous le hero. Cartes paliers : `badge={{icon:"albums-outline",tone:"violet"}}` (ou variez par palier si pertinent). Logique données inchangée.
- [ ] **Step 2:** tsc+lint 0.
- [ ] **Step 3:** Commit `feat(mobile): Mes données — hero + badges`.

### Task 9: Mise en relation

**Files:** `app/(prospect)/relations.tsx`

- [ ] **Step 1:** Recette commune. `hero={{ eyebrow:"Mises en relation", title:"Demandes en attente", desc:<existante> }}` (onglet, pas de nav). Cartes pending : `badge={{icon:"people-outline",tone:"coral"}}`. Conserver filtre Toutes/Acceptées/Refusées, compteurs, accept/refuse, hooks — **inchangés**.
- [ ] **Step 2:** tsc+lint 0.
- [ ] **Step 3:** Commit `feat(mobile): Relations — hero + badges`.

### Task 10: Messages (notifications)

**Files:** `components/notifications-screen.tsx`

- [ ] **Step 1:** Recette commune. `hero={{ eyebrow:"Messages", title:"Vos notifications", desc:<existante> }}` (onglet). Cartes notif : `badge={{icon:"notifications-outline",tone:"amber"}}`. Marquage lu / pièce jointe / authed download — inchangés.
- [ ] **Step 2:** tsc+lint 0.
- [ ] **Step 3:** Commit `feat(mobile): Messages — hero + badges`.

### Task 11: Préférences

**Files:** `app/(prospect)/preferences.tsx`

- [ ] **Step 1:** Recette commune. `hero={{ eyebrow:"Préférences", title:"Vos paramètres", desc:<existante> }}` (onglet). Badges par bloc : Téléphone `{icon:"call-outline",tone:"sky"}`, RIB `{icon:"card-outline",tone:"teal"}`, Retrait `{icon:"cash-outline",tone:"violet"}`, Suivi e-mail `{icon:"mail-outline",tone:"amber"}`, Zone `{icon:"location-outline",tone:"coral"}`. Toute la logique (mutations, QueryGate, blocs read-only) **inchangée**.
- [ ] **Step 2:** tsc+lint 0.
- [ ] **Step 3:** Commit `feat(mobile): Préférences — hero + badges`.

### Task 12: Écrans drawer (Vérification, Score, Parrainage, Fiscal, Suggestions)

**Files:** `app/(prospect)/verification.tsx`, `score.tsx`, `parrainage.tsx`, `fiscal.tsx`, `suggestions.tsx`

- [ ] **Step 1:** Pour CHAQUE fichier, recette commune avec `nav:"back"` :
  - verification : `hero={{ eyebrow:"Paliers de vérification", title:"Votre niveau", desc:<existante>, nav:"back" }}`, badges : RIB `{icon:"card-outline",tone:"teal"}`, acceptations `{icon:"checkmark-circle-outline",tone:"good" → utiliser tone "teal"}`.
  - score : `hero={{ eyebrow:"BUUPP Score", title:"Votre cote de confiance", desc:<existante>, nav:"back" }}`, mettre le gros score dans `hero.children` (retirer le `<Card dark>` score) ; conserver sélecteur range, conseils, historique.
  - parrainage : `hero={{ eyebrow:"Parrainage", title:"Invitez, gagnez plus", desc:<existante>, nav:"back" }}` ; le code de parrainage peut rester sa carte (badge `{icon:"gift-outline",tone:"violet"}`) ; conserver compte à rebours, 4 stats, filleuls, copier.
  - fiscal : `hero={{ eyebrow:"Informations fiscales", title:"Vos revenus déclarables", desc:<existante>, nav:"back" }}` ; badges année courante `{icon:"calendar-outline",tone:"sky"}`, Seuils `{icon:"information-circle-outline",tone:"amber"}` ; conserver barre, messages seuil/DGFiP, téléchargements authed.
  - suggestions : `hero={{ eyebrow:"Vos suggestions", title:"Faites-nous part de vos idées", desc:<existante>, nav:"back" }}` ; carte formulaire badge `{icon:"bulb-outline",tone:"amber"}` ; conserver POST/try-catch/sent.
  Toute logique données/mutations **inchangée**. `SectionTitle` interne conservé pour sous-sections.
- [ ] **Step 2:** tsc+lint 0 après chaque fichier.
- [ ] **Step 3:** Commit unique `git add app/(prospect)/{verification,score,parrainage,fiscal,suggestions}.tsx && git commit -m "feat(mobile): écrans drawer — hero dégradé + retour + badges"`.

---

## Phase 4 — Onboarding & Auth

### Task 13: Onboarding restyle (BrandLogo)

**Files:** `app/(onboarding)/index.tsx`

- [ ] **Step 1:** Lire le fichier. Remplacer toute utilisation de `BrandPill` par `BrandLogo` (import depuis `../../components/ui`). Vérifier fond ivoire, titres serif + `Accent` violet italique, dots de pagination foncés (token `bg-ink` actif / `bg-ink-5` inactif) — aligner sur `public/prototype/buupp-onboarding/1.png`-`3.png`. Ne pas changer la logique de slides / `markOnboardingSeen` / navigation.
- [ ] **Step 2:** tsc+lint 0.
- [ ] **Step 3:** Commit `feat(mobile): onboarding — logo dégradé (parité maquette)`.

### Task 14: Auth sign-in — logo, toggle, cartes rôle, social, footer

**Files:** `app/(auth)/sign-in.tsx`

- [ ] **Step 1:** Lire `app/(auth)/sign-in.tsx` en entier. Appliquer, en gardant **strictement** le flux Clerk passwordless email-code existant (ne pas ajouter de champ mot de passe / "mot de passe oublié") :
  - Remplacer le logo par `BrandLogo` (import `../../components/ui`).
  - Titre « Bon retour, » + `<Accent>buupper</Accent>` + « . » (serif), sous-titre « Reprenez là où vous en étiez. » — style maquette `4.png`.
  - Si un toggle Connexion/Inscription existe, le styler en pill (actif `bg-ink` texte paper, inactif texte ink-3) ; sinon ne pas en inventer.
  - Si des cartes de rôle existent, sélection = `border-violet bg-violet-soft` ; sinon laisser.
  - Avant le footer, insérer `<SocialButtons onPress={(p)=>{ /* voir Step 2 */ }} />`.
  - Ajouter `<LegalFooter />` (déjà exporté par `components/ui`) en bas.
- [ ] **Step 2:** Brancher les boutons sociaux via Clerk OAuth si dispo : utiliser `useOAuth` de `@clerk/clerk-expo` avec stratégies `oauth_apple` / `oauth_google` / `oauth_facebook`. Implémentation :

```tsx
import { useOAuth } from "@clerk/clerk-expo";
// …
const apple = useOAuth({ strategy: "oauth_apple" });
const google = useOAuth({ strategy: "oauth_google" });
const facebook = useOAuth({ strategy: "oauth_facebook" });
const onSocial = async (p: "apple" | "google" | "facebook") => {
  const flow = p === "apple" ? apple : p === "google" ? google : facebook;
  try {
    const res = await flow.startOAuthFlow();
    if (res?.createdSessionId && res.setActive) {
      await res.setActive({ session: res.createdSessionId });
      router.replace("/");
    }
  } catch {
    Alert.alert("Connexion sociale", "Indisponible pour le moment.");
  }
};
```

(Si `useOAuth` n'existe pas dans la version `@clerk/clerk-expo` installée — `tsc` le dira — remplacer `onSocial` par un simple `Alert.alert("Bientôt", "Connexion sociale bientôt disponible.")` et garder les boutons affichés. Importer `Alert` de react-native, `router` d'expo-router si absents.)

- [ ] **Step 3:** Run `npx tsc --noEmit && npm run lint` → 0 erreur. Vérifier que le flux email-code existant compile et n'est pas modifié dans sa logique.
- [ ] **Step 4:** Commit `git add app/(auth)/sign-in.tsx && git commit -m "feat(mobile): auth — logo dégradé, social Apple/Google/Facebook, footer légal (parité 4.png)"`.

### Task 15: Auth role-select restyle

**Files:** `app/(auth)/role-select.tsx`

- [ ] **Step 1:** Restyler les deux `Pressable` de rôle en cartes maquette : `rounded-3xl border border-line bg-paper p-5`, et au survol/sélection visuelle un accent (laisser la navigation `router.replace` inchangée). Ajouter `BrandLogo` en tête + titre serif « Vous êtes… » avec un `Accent`. Fond ivoire conservé. Optionnel : `LegalFooter` en bas.
- [ ] **Step 2:** tsc+lint 0.
- [ ] **Step 3:** Commit `feat(mobile): role-select — style maquette + logo`.

---

## Phase 5 — Vérification finale

### Task 16: Revue d'ensemble design + non-régression

**Files:** aucun (vérif) ; correctifs ponctuels si besoin.

- [ ] **Step 1:** `cd <WT>/mobile && npx tsc --noEmit && npm run lint` → 0 erreur.
- [ ] **Step 2:** `npx expo export -p web` → build OK (toutes routes résolues, gradients/tab bar/drawer compilent).
- [ ] **Step 3:** Non-régression données/parité : `git -C <WT> diff --name-only main...worktree-mobile-app | grep -E '^mobile/lib/queries.ts$' && echo "queries.ts modifié — VÉRIFIER qu'aucune logique données n'a changé (seul un éventuel ajout de type toléré)"` ; vérifier qu'aucun fichier `app/api/` ou `app/(pro)/` n'est modifié : `git -C <WT> diff --name-only main...worktree-mobile-app | grep -E 'app/api/|/\(pro\)/' || echo "OK backend/pro intacts"`.
- [ ] **Step 4:** Revue visuelle statique : fond ivoire partout (`grep -rL bg-ivory app/(prospect)` ne doit pointer que des écrans utilisant `ScrollScreen` qui porte déjà `bg-ivory`) ; aucun `headerShown: true` résiduel (`grep -rn "headerShown: true" app` → vide) ; tab bar custom branchée (`grep -n "tabBar=" app/(prospect)/_layout.tsx`) ; `presentation: "transparentModal"` + `animation: "none"` sur la route drawer.
- [ ] **Step 5:** Commit éventuel `git add -A && git commit -m "fix(mobile): correctifs revue design finale"` (sinon aucun).

---

## Self-Review (auteur)

- **Couverture spec :** §1 système de design → Tasks 1-4 (tokens, BrandLogo, GradientHero/Card/Stat, FloatingTabBar) ; §2 headerShown:false → Tasks 5,6 + recette Phase 3 (hero remplace header) ; §3 tab bar → Task 4-5 ; §4 onboarding/auth → Tasks 13-15 (logo, toggle/rôle, social, footer) ; §5 drawer gauche → Task 6 ; §6 critères → Task 16 ; §7 hors-périmètre respecté (pas de pro/backend/data, OAuth fallback prévu). ✔
- **Placeholders :** la « recette commune » Phase 3 est une transformation mécanique précise avec, pour chaque écran, les props `hero` exactes et les badges nommés — pas du « TODO » vague ; les primitives ont du code complet (Tasks 2-4) ; les fallbacks (logo-google/BottomTabBarProps/useOAuth) sont des branches déterministes guidées par `tsc`. ✔
- **Cohérence types :** `HeroProps`/`GradientHero`/`ScrollScreen.hero`/`Card.badge {icon,tone}`/`Tone`/`SocialButtons.onPress(p)`/`FloatingTabBar` (BottomTabBarProps) définis en Phase 1 et réutilisés tels quels en Phases 2-4. ✔
- **Ambiguïté :** tab bar = libellé court sous l'onglet actif seulement (résolu spec) ; `go()` du drawer garde `router.back()` direct (navigation instantanée) tandis que `dismiss()` anime scrim/close — explicité Task 6.
