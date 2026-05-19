// Barre d'en-tête commune (rendue au-dessus du GradientHero par
// ScrollScreen) : ☰ menu | logo2 centré | 🔔 sollicitations + 👤 compte.
// Fonds pastels pour différencier les actions.
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountSheet } from "./account-sheet";
import { SolicitationsSheet } from "./solicitations-sheet";

const LOGO = require("../assets/images/logo2.png");

function IconButton({
  icon,
  bg,
  color,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={label}
      className={`h-10 w-10 items-center justify-center rounded-full ${bg} active:opacity-70`}
    >
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const [showSolic, setShowSolic] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  return (
    <>
      <View
        style={{ paddingTop: insets.top + 6 }}
        className="flex-row items-center justify-between border-b border-line bg-ivory px-4 pb-3"
      >
        <IconButton
          icon="menu"
          bg="bg-violet-soft"
          color="#7C5CFC"
          label="Ouvrir le menu"
          onPress={() => router.push("/drawer")}
        />

        <View className="flex-row items-center gap-2">
          <Image
            source={LOGO}
            style={{ width: 36, height: 28 }}
            contentFit="contain"
            accessibilityLabel="buupp"
          />
          <Text className="font-serif-bold text-2xl text-ink">buupp</Text>
        </View>

        <View className="flex-row items-center gap-2">
          <IconButton
            icon="notifications-outline"
            bg="bg-amber-soft"
            color="#F2B65A"
            label="Demandes de sollicitation"
            onPress={() => setShowSolic(true)}
          />
          <IconButton
            icon="person-outline"
            bg="bg-teal-soft"
            color="#2FB8A6"
            label="Mon compte"
            onPress={() => setShowAccount(true)}
          />
        </View>
      </View>

      <SolicitationsSheet
        visible={showSolic}
        onClose={() => setShowSolic(false)}
      />
      <AccountSheet
        visible={showAccount}
        onClose={() => setShowAccount(false)}
      />
    </>
  );
}
