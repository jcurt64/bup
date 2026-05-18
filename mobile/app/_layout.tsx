import "../global.css";

import { ClerkProvider } from "@clerk/clerk-expo";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { tokenCache } from "../lib/clerk-token-cache";

// Synchro passive (cf. MOBILE_APP_SPEC.md §6.2) : RN n'a pas de "window
// focus" → on branche AppState sur le focusManager React Query pour
// refetch quand l'app revient au premier plan (récupère ce qui a changé
// sur le web entre-temps).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
  },
});

export default function RootLayout() {
  const appState = useRef(AppState.currentState);

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

  return (
    <ClerkProvider
      tokenCache={tokenCache}
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}
    >
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(prospect)" />
            <Stack.Screen name="(pro)" />
          </Stack>
          <StatusBar style="auto" />
        </SafeAreaProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
