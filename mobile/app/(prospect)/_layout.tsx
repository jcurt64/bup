// Espace prospect — onglets (miroir du dashboard web prospect).
// 5 onglets principaux ; Parrainage / Vérification / Fiscal viendront
// en itération suivante (accessibles via un écran "Plus").
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  portefeuille: "wallet-outline",
  relations: "swap-horizontal",
  donnees: "albums-outline",
  score: "stats-chart-outline",
  messages: "chatbubble-ellipses-outline",
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
        }}
      />
      <Tabs.Screen
        name="relations"
        options={{
          title: "Relations",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.relations} color={color} size={size} />
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
        name="score"
        options={{
          title: "Score",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.score} color={color} size={size} />
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
    </Tabs>
  );
}
