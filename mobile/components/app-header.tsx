// Barre d'en-tête commune (rendue au-dessus du GradientHero par
// ScrollScreen) : ☰ menu | logo2 centré | 🔔 messages + 👤 compte.
// Fonds pastels pour différencier les actions.
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MessagesSheet } from "./messages-sheet";
import { useNotifications } from "../lib/queries";

const LOGO = require("../assets/images/logo2.png");

function IconButton({
  icon,
  bg,
  color,
  label,
  onPress,
  badgeCount,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  color: string;
  label: string;
  onPress: () => void;
  /** Si > 0 : pastille rouge en haut à droite avec le chiffre.
   *  Capé à « 9+ » pour ne pas déborder du bouton (40×40). */
  badgeCount?: number;
}) {
  const showBadge = (badgeCount ?? 0) > 0;
  const badgeText =
    badgeCount && badgeCount > 9 ? "9+" : String(badgeCount ?? 0);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={
        showBadge ? `${label} (${badgeCount} non lu${badgeCount! > 1 ? "s" : ""})` : label
      }
      className={`h-10 w-10 items-center justify-center rounded-full ${bg} active:opacity-70`}
    >
      <Ionicons name={icon} size={20} color={color} />
      {showBadge ? (
        <View
          pointerEvents="none"
          accessible={false}
          style={{
            position: "absolute",
            top: -3,
            right: -3,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: "#DC2626",
            borderWidth: 2,
            borderColor: "#F7F4EC", // = bg-ivory (matche le header)
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text className="font-mono text-[10px] font-bold text-paper">
            {badgeText}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const [showMessages, setShowMessages] = useState(false);
  // Hydrate le compteur non-lus pour le badge sur la cloche. Le hook a
  // un staleTime de 15s côté queries.ts, donc le badge se met à jour
  // automatiquement à intervalle régulier sans polling explicit.
  const notif = useNotifications();
  const unread = notif.data?.unreadCount ?? 0;

  return (
    <>
      <View
        style={{ paddingTop: insets.top + 6 }}
        className="flex-row items-center justify-between border-b border-line bg-ivory px-4 pb-3"
      >
        <IconButton
          icon="person-outline"
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
            label="Messages"
            onPress={() => setShowMessages(true)}
            badgeCount={unread}
          />
          <IconButton
            icon="menu"
            bg="bg-teal-soft"
            color="#2FB8A6"
            label="Mon compte"
            onPress={() => router.push("/account")}
          />
        </View>
      </View>

      <MessagesSheet
        visible={showMessages}
        onClose={() => setShowMessages(false)}
      />
    </>
  );
}
