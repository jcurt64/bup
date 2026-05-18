// Routeur racine : aiguille selon l'état d'auth Clerk + le rôle réel
// (résolu par /api/me/role — MÊME source que le web, donc cohérent).
import { useAuth } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useRole } from "../lib/queries";

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const role = useRole();

  if (!isLoaded) return <Splash />;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  if (role.isPending) return <Splash />;
  if (role.data?.role === "pro") return <Redirect href="/(pro)/overview" />;
  if (role.data?.role === "prospect")
    return <Redirect href="/(prospect)/portefeuille" />;

  // Connecté mais sans rôle encore matérialisé → sélection de rôle.
  return <Redirect href="/(auth)/role-select" />;
}

function Splash() {
  return (
    <View className="flex-1 items-center justify-center bg-ivory">
      <ActivityIndicator size="large" color="#4F46E5" />
    </View>
  );
}
