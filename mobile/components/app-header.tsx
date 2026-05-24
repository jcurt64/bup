// Barre d'en-tête commune. Deux états interpolés via le scroll de la
// page (cf. HeaderScrollContext dans ScrollScreen) :
//
//   - état « expanded » (top de la page) : ☰ menu | logo+buupp centré
//     | ⚡ flash + 🔔 messages + 👤 compte. Layout historique.
//   - état « compact » (page scrollée) : logo « b » mini + nom de page
//     (depuis usePathname) + extras optionnels poussés par la page (ex.
//     sur Portefeuille : disponible + séquestre avec leurs icônes).
//
// Le header est rendu en position absolute par-dessus le ScrollView
// (ScrollScreen réserve la hauteur via paddingTop) — son fond utilise
// expo-glass-effect quand iOS 26+ le supporte (même Liquid Glass que la
// FloatingTabBar), sinon ivoire translucide.
import { Ionicons } from "@expo/vector-icons";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { router, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FlashDealsSheet } from "./flash-deals-sheet";
import { useFlashSheet } from "./flash-sheet-context";
import { MessagesSheet } from "./messages-sheet";
import {
  HEADER_BASE_HEIGHT,
  HEADER_SCROLL_THRESHOLD,
  HEADER_SCROLL_TRANSITION,
  useHeaderScroll,
} from "../lib/header-scroll";
import { useFlashDeals, useNotifications } from "../lib/queries";

// Mapping pathname → libellé de page affiché dans le header compact.
// On match sur la fin du segment (ignore les groupes (prospect)/(pro)).
// Si non trouvé : fallback sur le dernier segment capitalisé.
const PAGE_LABELS: Record<string, string> = {
  portefeuille: "Portefeuille",
  donnees: "Données",
  relations: "Relations",
  preferences: "Préférences",
  messages: "Messages",
  verification: "Vérification",
  score: "BUUPP Score",
  parrainage: "Parrainage",
  fiscal: "Fiscalité",
  suggestions: "Suggestions",
  overview: "Tableau de bord",
  campagnes: "Campagnes",
  contacts: "Contacts",
  facturation: "Facturation",
};

function pageNameFromPathname(pathname: string): string {
  const segs = pathname.split("/").filter(Boolean);
  const last = segs[segs.length - 1] ?? "";
  return (
    PAGE_LABELS[last] ?? (last ? last.charAt(0).toUpperCase() + last.slice(1) : "")
  );
}

function IconButton({
  icon,
  bg,
  gradient,
  color,
  label,
  onPress,
  badgeCount,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  bg?: string;
  gradient?: [string, string];
  color: string;
  label: string;
  onPress: () => void;
  badgeCount?: number;
}) {
  const showBadge = (badgeCount ?? 0) > 0;
  const badgeText = String(badgeCount ?? 0);
  const accessibilityLabel = showBadge
    ? `${label} (${badgeCount} non lu${badgeCount! > 1 ? "s" : ""})`
    : label;
  const badge = showBadge ? (
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
        borderColor: "#F7F4EC",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text className="font-mono text-[10px] font-bold text-paper">
        {badgeText}
      </Text>
    </View>
  ) : null;

  if (gradient) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={8}
        accessibilityLabel={accessibilityLabel}
        className="h-10 w-10 active:opacity-70"
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={20} color={color} />
        </LinearGradient>
        {badge}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={accessibilityLabel}
      className={`h-10 w-10 items-center justify-center rounded-full ${bg ?? ""} active:opacity-70`}
    >
      <Ionicons name={icon} size={20} color={color} />
      {badge}
    </Pressable>
  );
}

function FlashHeaderButton({
  onPress,
  active,
}: {
  onPress: () => void;
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
    scale.value = 1;
    opacity.value = 0.25;
    scale.value = withRepeat(
      withTiming(1.3, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
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
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: "#0F1629" }}
      >
        <Ionicons name="flash" size={20} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

// Mini-logo « b » — pastille gradient navy→bleu identique au BrandLogo
// pour le header compact. Garde l'identité Buupp sans manger la place
// du titre de page.
function BrandMark() {
  return (
    <LinearGradient
      colors={["#13235B", "#2F44C0"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        className="font-serif-bold text-paper"
        style={{ fontSize: 18, lineHeight: 22 }}
      >
        b
      </Text>
    </LinearGradient>
  );
}

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const ctx = useHeaderScroll();
  const [showMessages, setShowMessages] = useState(false);
  const flashSheet = useFlashSheet();
  const notif = useNotifications();
  const unread = notif.data?.unreadCount ?? 0;
  const flashCount = useFlashDeals().data?.deals.length ?? 0;
  const glass = isLiquidGlassAvailable();
  const pageName = pageNameFromPathname(pathname);

  // Transition smooth entre expanded et compact via `withTiming` (300 ms,
  // easing cubique in-out) plutôt qu'une interpolation linéaire 1-pour-1
  // sur scrollY. Le scroll déclenche juste la cible (0 ou 1) ; l'easing
  // temporel lisse l'animation même lors d'un scroll abrupt. Si pas de
  // Context (AppHeader hors ScrollScreen), reste en mode expanded.
  const target = useDerivedValue(() => {
    if (!ctx) return 0;
    return ctx.scrollY.value > HEADER_SCROLL_THRESHOLD ? 1 : 0;
  });
  const progress = useDerivedValue(() =>
    withTiming(target.value, {
      duration: 300,
      easing: Easing.inOut(Easing.cubic),
    }),
  );

  const expandedStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
  }));
  const compactStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  // Pointer-events : bascule quand on dépasse la moitié de la transition,
  // évite que les boutons cachés captent le tap.
  const expandedPointerStyle = useAnimatedStyle(() => ({
    pointerEvents: progress.value > 0.5 ? "none" : "auto",
  }));
  const compactPointerStyle = useAnimatedStyle(() => ({
    pointerEvents: progress.value > 0.5 ? "auto" : "none",
  }));

  const totalHeight = insets.top + HEADER_BASE_HEIGHT;

  return (
    <>
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: totalHeight,
          zIndex: 50,
        }}
      >
        {/* Fond translucide — GlassView Liquid Glass iOS 26+, sinon
            ivoire à 78 % d'opacité. Aucun border pour rester discret. */}
        {glass ? (
          <GlassView
            glassEffectStyle="regular"
            tintColor="rgba(247, 244, 236, 0.34)"
            style={{ position: "absolute", inset: 0 } as never}
          />
        ) : (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(247, 244, 236, 0.78)",
            }}
          />
        )}

        {/* Conteneur contenu — réserve la safe area top + 84 px ; les
            deux layouts (expanded / compact) sont stackés en absolute
            dans cette zone. */}
        <View
          style={{
            paddingTop: insets.top,
            height: totalHeight,
          }}
        >
          {/* Layout expanded — historique, visible quand le scroll est
              en haut. */}
          <Animated.View
            style={[
              {
                position: "absolute",
                top: insets.top,
                left: 0,
                right: 0,
                height: HEADER_BASE_HEIGHT,
                paddingHorizontal: 16,
                paddingTop: 20,
                paddingBottom: 24,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              },
              expandedStyle,
              expandedPointerStyle,
            ]}
          >
            <IconButton
              icon="person-outline"
              gradient={["#7C5CFC", "#13235B"]}
              color="#FFFFFF"
              label="Ouvrir le menu"
              onPress={() => router.push("/drawer")}
            />

            <View className="flex-row items-center gap-2">
              <BrandMark />
              <Text className="font-serif-bold text-2xl text-ink">buupp</Text>
            </View>

            <View className="flex-row items-center gap-4">
              <FlashHeaderButton
                onPress={() => flashSheet.open()}
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
          </Animated.View>

          {/* Layout compact — apparaît quand on a scrollé : logo « b »
              + nom de page à gauche, extras (icône + valeur) à droite. */}
          <Animated.View
            style={[
              {
                position: "absolute",
                top: insets.top,
                left: 0,
                right: 0,
                height: HEADER_BASE_HEIGHT,
                paddingHorizontal: 16,
                paddingTop: 20,
                paddingBottom: 24,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              },
              compactStyle,
              compactPointerStyle,
            ]}
          >
            <View className="flex-row items-center gap-2.5">
              <BrandMark />
              <Text
                className="font-serif text-xl text-ink"
                numberOfLines={1}
              >
                {pageName}
              </Text>
            </View>
            {ctx?.compactExtras?.length ? (
              <View className="flex-row items-center gap-4">
                {ctx.compactExtras.map((e, i) => (
                  <View
                    key={i}
                    className="flex-row items-center gap-2"
                  >
                    <Ionicons
                      name={e.icon}
                      size={20}
                      color={e.color ?? "#0F1629"}
                    />
                    <Text className="font-mono text-[15px] font-semibold text-ink">
                      {e.value}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Animated.View>
        </View>
      </View>

      <MessagesSheet
        visible={showMessages}
        onClose={() => setShowMessages(false)}
      />
      <FlashDealsSheet
        visible={flashSheet.isOpen}
        onClose={flashSheet.close}
      />
    </>
  );
}
