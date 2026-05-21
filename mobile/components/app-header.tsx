// Barre d'en-tête commune (rendue au-dessus du GradientHero par
// ScrollScreen) : ☰ menu | logo2 centré | 🔔 messages + 👤 compte.
// Fonds pastels pour différencier les actions.
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FlashDealsSheet } from "./flash-deals-sheet";
import { MessagesSheet } from "./messages-sheet";
import { useFlashDeals, useNotifications } from "../lib/queries";

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
  /** Si > 0 : pastille rouge en haut à droite avec le chiffre exact.
   *  La largeur est auto (minWidth 18 + paddingHorizontal) pour
   *  accommoder les nombres à plusieurs chiffres. */
  badgeCount?: number;
}) {
  const showBadge = (badgeCount ?? 0) > 0;
  const badgeText = String(badgeCount ?? 0);
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

// Bouton flash deal : pastille ink (#0F1629) + icône éclair blanche +
// anneau accent violet (#4F46E5) qui pulse (scale + opacity) toutes
// les 2.4 s — équivalent RN du keyframes `flash-deal-badge-pulse` web.
// Ne s'affiche que s'il y a au moins 1 deal actif (sinon le bouton
// est inutile et on évite le bruit visuel).
function FlashHeaderButton({
  onPress,
  active,
}: {
  onPress: () => void;
  /** Si true : anneau pulsant violet (au moins 1 deal en cours).
   *  Si false : bouton statique (rien à signaler — évite le bruit). */
  active: boolean;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value = 1;
      opacity.value = 0;
      return;
    }
    // 0 → max sur 1.2 s, retour à 0 sur 1.2 s (= 2.4 s total) en boucle.
    scale.value = withRepeat(
      withTiming(1.55, { duration: 1200, easing: Easing.out(Easing.quad) }),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withTiming(0.55, { duration: 1200, easing: Easing.out(Easing.quad) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [active, scale, opacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel="Flash deals"
      className="h-10 w-10 items-center justify-center active:opacity-70"
    >
      {/* Anneau pulsant (positionné absolument derrière le bouton) */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            width: 40,
            height: 40,
            borderRadius: 999,
            backgroundColor: "#4F46E5",
          },
          ringStyle,
        ]}
      />
      {/* Pastille ink avec l'éclair */}
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: "#0F1629" }}
      >
        <Ionicons name="flash" size={20} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const [showMessages, setShowMessages] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  // Hydrate le compteur non-lus pour le badge sur la cloche. Le hook a
  // un staleTime de 15s côté queries.ts, donc le badge se met à jour
  // automatiquement à intervalle régulier sans polling explicit.
  const notif = useNotifications();
  const unread = notif.data?.unreadCount ?? 0;
  // N'affiche le bouton flash que s'il y a au moins 1 deal actif
  // (la query rafraîchit toutes les 10 s côté queries.ts).
  const flashCount = useFlashDeals().data?.deals.length ?? 0;

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
          <FlashHeaderButton
            onPress={() => setShowFlash(true)}
            active={flashCount > 0}
          />
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
      <FlashDealsSheet
        visible={showFlash}
        onClose={() => setShowFlash(false)}
      />
    </>
  );
}
