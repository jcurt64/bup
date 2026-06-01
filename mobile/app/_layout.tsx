import "../global.css";

import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  useQueryClient,
} from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  Fraunces_600SemiBold_Italic,
  Fraunces_700Bold,
} from "@expo-google-fonts/fraunces";
import { DancingScript_700Bold } from "@expo-google-fonts/dancing-script";
import "react-native-reanimated";

import { PushBannerProvider, usePushBanner } from "../components/in-app-push-banner";
import { tokenCache } from "../lib/clerk-token-cache";
import { ensurePushChannelsAndroid, registerForPushNotifications } from "../lib/push";
import { ThemeProvider, useTheme } from "../lib/theme";

// StatusBar dont les icônes (claires/sombres) suivent le thème actif.
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

// Handler global — bannière OS off en foreground (on a notre bannière
// in-app), mais on garde la notification dans la "Notification list"
// du centre de notifs (badge + son OK).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Synchro passive (cf. MOBILE_APP_SPEC.md §6.2) : RN n'a pas de "window
// focus" → on branche AppState sur le focusManager React Query pour
// refetch quand l'app revient au premier plan (récupère ce qui a changé
// sur le web entre-temps).
//
// refetchOnWindowFocus désactivé par défaut : le défaut `true` provoquait
// un refetch de toutes les queries à chaque retour foreground / changement
// d'écran (perçu comme focus en RN), d'où un loader visible inutilement
// sur Accueil/Relations. Les mutations qui modifient l'état invalident
// déjà les clés concernées. staleTime de base passé à 60 s pour aligner.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  },
});

function PushBridge() {
  const banner = usePushBanner();
  const { getToken, isSignedIn } = useAuth();
  const qc = useQueryClient();

  // Setup Android channels une seule fois au mount.
  useEffect(() => {
    void ensurePushChannelsAndroid();
  }, []);

  // Au cold start signed-in : refresh silencieux du token (last_seen_at).
  useEffect(() => {
    if (!isSignedIn) return;
    void registerForPushNotifications(getToken);
  }, [isSignedIn, getToken]);

  // Foreground listener — bannière + refetch.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notif) => {
      const data = (notif.request.content.data ?? {}) as Record<string, unknown>;
      const type = data.type === "flash" ? "flash" : "classic";
      banner.show({
        type,
        title: notif.request.content.title ?? "",
        body: notif.request.content.body ?? "",
        data,
      });
      void qc.invalidateQueries({ queryKey: ["prospect", "relations"] });
      void qc.invalidateQueries({ queryKey: ["flash-deals"] });
    });
    return () => sub.remove();
  }, [banner, qc]);

  // Tap listener (warm + cold start).
  useEffect(() => {
    function handle(response: Notifications.NotificationResponse) {
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      const screen = data.screen as string | undefined;
      const relationId = data.relationId as string | undefined;
      const campaignId = data.campaignId as string | undefined;
      if (screen === "relations" && relationId) {
        router.push(`/(prospect)/relations?focusRelation=${encodeURIComponent(relationId)}`);
      } else if (screen === "flash-deals" && campaignId) {
        router.push(`/(prospect)/portefeuille?openFlash=${encodeURIComponent(campaignId)}`);
      }
    }
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) handle(r);
    });
    return () => sub.remove();
  }, []);

  return null;
}

export default function RootLayout() {
  const appState = useRef(AppState.currentState);
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
    Fraunces_700Bold,
    DancingScript_700Bold,
  });

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      const wasBackground = appState.current.match(/inactive|background/);
      if (wasBackground && next === "active") {
        focusManager.setFocused(true);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <ClerkProvider
      tokenCache={tokenCache}
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}
    >
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ThemeProvider>
          <PushBannerProvider>
            <PushBridge />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(prospect)" />
              <Stack.Screen name="(pro)" />
              <Stack.Screen
                name="drawer"
                options={{
                  presentation: "transparentModal",
                  headerShown: false,
                  animation: "none",
                }}
              />
              <Stack.Screen
                name="account"
                options={{
                  headerShown: false,
                  animation: "slide_from_right",
                }}
              />
            </Stack>
            <ThemedStatusBar />
          </PushBannerProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
