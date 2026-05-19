// Sheet « Mon compte » (icône personne). Mode sombre (désactivé pour
// l'instant — vrai dark mode = chantier ultérieur), Déconnexion, liens.
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, Pressable, Switch, Text, View } from "react-native";

import { BottomSheet } from "./bottom-sheet";

const WEB_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://buupp.com";

function Row({
  icon,
  label,
  hint,
  danger,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3.5 active:opacity-80"
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-violet-soft">
        <Ionicons
          name={icon}
          size={18}
          color={danger ? "#DC2626" : "#7C5CFC"}
        />
      </View>
      <Text
        className={`flex-1 text-base ${danger ? "text-bad" : "text-ink"}`}
      >
        {label}
      </Text>
      {hint ? (
        <Text className="font-mono text-[10px] uppercase text-ink-4">
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function AccountSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  async function doSignOut() {
    setBusy(true);
    try {
      await signOut();
      onClose();
      router.replace("/(auth)/sign-in");
    } catch {
      setBusy(false);
      Alert.alert("Erreur", "La déconnexion a échoué. Réessayez.");
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text className="mb-3 font-serif text-2xl text-ink">Mon compte</Text>

      <View className="gap-2.5">
        {/* Mode sombre — inactif pour l'instant */}
        <View className="flex-row items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3.5">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-sky-soft">
            <Ionicons name="moon-outline" size={18} color="#5B8DEF" />
          </View>
          <View className="flex-1">
            <Text className="text-base text-ink">Mode sombre</Text>
            <Text className="text-[11px] text-ink-4">Bientôt disponible</Text>
          </View>
          <Switch value={false} disabled />
        </View>

        <Row
          icon="options-outline"
          label="Préférences"
          onPress={() => {
            onClose();
            router.push("/(prospect)/preferences");
          }}
        />
        <Row
          icon="help-circle-outline"
          label="Aide"
          onPress={() => {
            void WebBrowser.openBrowserAsync(`${WEB_BASE}/aide`);
          }}
        />

        <View className="my-1 h-px bg-line" />

        <Row
          icon="log-out-outline"
          label={busy ? "Déconnexion…" : "Déconnexion"}
          danger
          onPress={busy ? undefined : doSignOut}
        />
      </View>
    </BottomSheet>
  );
}
