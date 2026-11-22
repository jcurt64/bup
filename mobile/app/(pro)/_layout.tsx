// Espace pro — Tabs sans header natif (chaque écran rend son header pro via
// ScrollScreen headerVariant="pro") + tab bar pilule flottante (5 onglets).
// Les écrans secondaires (facturation, analytics, informations, suggestions,
// messages) sont des routes href:null poussées depuis le drawer / header.
import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Tabs } from "expo-router";

import FloatingTabBarPro from "../../components/floating-tab-bar-pro";
import { FlashSheetProvider } from "../../components/flash-sheet-context";
import { ProUnavailable } from "../../components/pro-unavailable";
import { PRO_SPACE_ENABLED } from "../../lib/purchases";
import { useRole } from "../../lib/queries";

export default function ProLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const role = useRole();
  if (isLoaded && !isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  // Garde de rôle : un compte prospect n'affiche jamais l'espace pro.
  if (role.data?.role === "prospect") return <Redirect href="/(prospect)/portefeuille" />;
  // iOS : aucun écran pro (App Review 3.1.1) — rien n'est monté, donc aucun
  // appel /api/pro/* (pas de création de compte pro par ensureProAccount).
  if (!PRO_SPACE_ENABLED) return <ProUnavailable />;

  return (
    <FlashSheetProvider>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <FloatingTabBarPro {...props} />}
      >
        <Tabs.Screen name="overview" />
        <Tabs.Screen name="campagnes" />
        <Tabs.Screen name="creation" />
        <Tabs.Screen name="contacts" />
        <Tabs.Screen name="reglages" />
        <Tabs.Screen name="objectif" options={{ href: null }} />
        <Tabs.Screen name="campagne" options={{ href: null }} />
        <Tabs.Screen name="facturation" options={{ href: null }} />
        <Tabs.Screen name="analytics" options={{ href: null }} />
        <Tabs.Screen name="informations" options={{ href: null }} />
        <Tabs.Screen name="suggestions" options={{ href: null }} />
      </Tabs>
    </FlashSheetProvider>
  );
}
