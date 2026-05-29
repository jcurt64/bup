// Espace prospect — Tabs sans header natif (chaque écran rend son
// GradientHero) + tab bar pilule flottante. Écrans drawer = routes
// href:null poussées depuis le drawer (ouvert via le bouton menu du
// GradientHero de Portefeuille).
import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Tabs } from "expo-router";

import FloatingTabBar from "../../components/floating-tab-bar";
import { FlashSheetProvider } from "../../components/flash-sheet-context";

export default function ProspectLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && !isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return (
    <FlashSheetProvider>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <FloatingTabBar {...props} />}
      >
        <Tabs.Screen name="portefeuille" />
        <Tabs.Screen name="donnees" />
        <Tabs.Screen name="relations" />
        <Tabs.Screen name="preferences" />
        <Tabs.Screen name="reglages" />
        <Tabs.Screen name="messages" options={{ href: null }} />
        <Tabs.Screen name="verification" options={{ href: null }} />
        <Tabs.Screen name="score" options={{ href: null }} />
        <Tabs.Screen name="parrainage" options={{ href: null }} />
        <Tabs.Screen name="fiscal" options={{ href: null }} />
        <Tabs.Screen name="suggestions" options={{ href: null }} />
      </Tabs>
    </FlashSheetProvider>
  );
}
