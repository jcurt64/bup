// Routeur racine : onboarding (1ère ouverture) → auth → espace selon
// le rôle (résolu par /api/me/role, MÊME source que le web).
import { useAuth } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { BuuppLoader } from "../components/loader";
import { hasSeenOnboarding } from "../lib/onboarding";
import { useRole } from "../lib/queries";
import { getRoleIntent } from "../lib/role-intent";

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const role = useRole();
  const [seen, setSeen] = useState<boolean | null>(null);
  const [intent, setIntent] = useState<"prospect" | "pro" | null>(null);

  useEffect(() => {
    hasSeenOnboarding().then(setSeen);
    getRoleIntent().then(setIntent);
  }, []);

  if (!isLoaded || seen === null) return <Splash />;

  if (!isSignedIn) {
    return <Redirect href={seen ? "/(auth)/sign-in" : "/(onboarding)"} />;
  }

  if (role.isPending) return <Splash />;
  // Rôle illisible (réseau, jeton pas prêt…) : on NE devine PAS depuis
  // l'intention locale — un pro se retrouverait dans l'espace prospect.
  if (role.isError) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-ivory px-8">
        <Text className="text-center text-base text-ink-3">
          Impossible de charger votre espace. Vérifiez votre connexion.
        </Text>
        <Pressable
          onPress={() => role.refetch()}
          className="rounded-full bg-ink px-6 py-3 active:opacity-80"
        >
          <Text className="font-semibold text-paper">Réessayer</Text>
        </Pressable>
      </View>
    );
  }
  if (role.data?.role === "pro") return <Redirect href="/(pro)/overview" />;
  if (role.data?.role === "prospect")
    return <Redirect href="/(prospect)/portefeuille" />;
  // Compte sans rôle encore matérialisé : on suit l'intention choisie à
  // l'auth (le serveur tranchera via ensureRole) ; sinon écran de choix.
  if (intent === "pro") return <Redirect href="/(pro)/overview" />;
  if (intent === "prospect")
    return <Redirect href="/(prospect)/portefeuille" />;
  return <Redirect href="/(auth)/role-select" />;
}

function Splash() {
  return (
    <View className="flex-1 items-center justify-center bg-ivory">
      <BuuppLoader size="lg" />
    </View>
  );
}
