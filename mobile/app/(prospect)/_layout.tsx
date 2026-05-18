// Espace prospect — onglets (miroir du dashboard web prospect).
// Garde d'auth : un non-connecté est renvoyé vers la connexion.
// (On démarre avec Portefeuille ; les autres onglets — Données,
// Relations, Score, Parrainage… — s'ajoutent au fil de l'intégration,
// chacun branché sur la route /api/prospect/* correspondante.)
import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Tabs } from "expo-router";

export default function ProspectLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && !isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: "#4F46E5",
      }}
    >
      <Tabs.Screen
        name="portefeuille"
        options={{ title: "Portefeuille" }}
      />
    </Tabs>
  );
}
