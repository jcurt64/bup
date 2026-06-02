// Espace pro — Tabs sans header natif (chaque écran rend son header pro via
// ScrollScreen headerVariant="pro") + tab bar pilule flottante (5 onglets).
// Les écrans secondaires (facturation, analytics, informations, suggestions,
// messages) sont des routes href:null poussées depuis le drawer / header.
import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Tabs } from "expo-router";

import FloatingTabBarPro from "../../components/floating-tab-bar-pro";
import { FlashSheetProvider } from "../../components/flash-sheet-context";

export default function ProLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && !isSignedIn) return <Redirect href="/(auth)/sign-in" />;

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
        <Tabs.Screen name="messages" options={{ href: null }} />
      </Tabs>
    </FlashSheetProvider>
  );
}
