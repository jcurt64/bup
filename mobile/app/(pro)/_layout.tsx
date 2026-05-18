// Espace pro — onglets (miroir du dashboard web pro).
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  overview: "grid-outline",
  campagnes: "megaphone-outline",
  contacts: "people-outline",
  facturation: "card-outline",
  messages: "chatbubble-ellipses-outline",
};

export default function ProLayout() {
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
        name="overview"
        options={{
          title: "Vue d'ensemble",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.overview} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="campagnes"
        options={{
          title: "Campagnes",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.campagnes} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: "Contacts",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.contacts} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="facturation"
        options={{
          title: "Facturation",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICON.facturation} color={color} size={size} />
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
