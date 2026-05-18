// Espace pro — squelette (à étoffer : Vue d'ensemble, Campagnes,
// Contacts, Facturation… branchés sur /api/pro/*).
import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Tabs } from "expo-router";

export default function ProLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && !isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  return (
    <Tabs screenOptions={{ headerShown: true, tabBarActiveTintColor: "#4F46E5" }}>
      <Tabs.Screen name="overview" options={{ title: "Vue d'ensemble" }} />
    </Tabs>
  );
}
