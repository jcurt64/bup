// Espace prospect — Tabs à 5 onglets (Portefeuille, Mes données, Mise en
// relation, Messages, Préférences). Les écrans secondaires (verif, score,
// parrainage, fiscal, suggestions) sont des routes empilées, accessibles
// via le drawer (modale du Stack racine) ouvert depuis le header de
// Portefeuille uniquement.
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, router, Tabs } from "expo-router";
import { Pressable } from "react-native";

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  portefeuille: "wallet-outline",
  donnees: "albums-outline",
  relations: "swap-horizontal",
  messages: "chatbubble-ellipses-outline",
  preferences: "options-outline",
};

export default function ProspectLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && !isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: "#7C5CFC",
        tabBarInactiveTintColor: "#8A91A1",
      }}
    >
      <Tabs.Screen
        name="portefeuille"
        options={{
          title: "Portefeuille",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.portefeuille} color={color} size={size} />
          ),
          headerLeft: () => (
            <Pressable
              onPress={() => router.push("/drawer")}
              hitSlop={12}
              style={{ paddingHorizontal: 16 }}
              accessibilityLabel="Ouvrir le menu"
            >
              <Ionicons name="menu" size={24} color="#13235B" />
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="donnees"
        options={{
          title: "Mes données",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.donnees} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="relations"
        options={{
          title: "Mise en relation",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.relations} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.messages} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="preferences"
        options={{
          title: "Préférences",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.preferences} color={color} size={size} />
          ),
        }}
      />

      {/* Écrans drawer — masqués de la tab bar (href: null) */}
      <Tabs.Screen name="verification" options={{ href: null, title: "Paliers de vérification" }} />
      <Tabs.Screen name="score" options={{ href: null, title: "BUUPP Score" }} />
      <Tabs.Screen name="parrainage" options={{ href: null, title: "Parrainage" }} />
      <Tabs.Screen name="fiscal" options={{ href: null, title: "Informations fiscales" }} />
      <Tabs.Screen name="suggestions" options={{ href: null, title: "Vos suggestions" }} />
    </Tabs>
  );
}
