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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { router, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
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
import { RechargeSheet } from "./recharge-sheet";
import { setDrawerOrigin } from "../lib/drawer-origin";
import {
  HEADER_BASE_HEIGHT,
  HEADER_SCROLL_THRESHOLD,
  useHeaderScroll,
} from "../lib/header-scroll";
import { useFlashDeals, useMeTyped, useNotifications } from "../lib/queries";
import { useTheme } from "../lib/theme";
import { PURCHASES_ENABLED } from "../lib/purchases";

// Mapping pathname → libellé de page affiché dans le header compact.
// On match sur la fin du segment (ignore les groupes (prospect)/(pro)).
// Si non trouvé : fallback sur le dernier segment capitalisé.
const PAGE_LABELS: Record<string, string> = {
  portefeuille: "Portefeuille",
  donnees: "Données",
  relations: "Relations",
  preferences: "Préférences",
  reglages: "Réglages",
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
    PAGE_LABELS[last] ??
    (last ? last.charAt(0).toUpperCase() + last.slice(1) : "")
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
  const { isDark } = useTheme();
  // En sombre, le fond clair (bg-paper) se confond avec le header foncé →
  // on utilise une pastille « givrée » (blanc translucide) bien visible.
  const darkBtnBg = "rgba(255,255,255,0.13)";
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
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text className="font-mono text-[10px] font-bold text-white">
        {badgeText}
      </Text>
    </View>
  ) : null;

  if (gradient) {
    // Même conteneur que la variante pleine (h-10 w-10 items-center) → l'icône
    // est centrée par le Pressable, garantissant le même centre que les autres
    // boutons. Le dégradé est un simple fond en absolute-fill.
    return (
      <Pressable
        onPress={onPress}
        hitSlop={8}
        accessibilityLabel={accessibilityLabel}
        className="h-10 w-10 items-center justify-center overflow-hidden rounded-full active:opacity-70"
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <Ionicons name={icon} size={22} color={color} />
        {badge}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={accessibilityLabel}
      className={`h-10 w-10 items-center justify-center rounded-full ${isDark ? "" : (bg ?? "")} active:opacity-70`}
      style={[LIGHT_BTN_SHADOW, isDark ? { backgroundColor: darkBtnBg } : null]}
    >
      <Ionicons name={icon} size={22} color={color} />
      {badge}
    </Pressable>
  );
}

// Ombre douce des boutons ronds clairs du header (cercles paper sur le
// fond ivoire translucide) — leur donne du relief comme dans la maquette.
const LIGHT_BTN_SHADOW = {
  shadowColor: "#0F1629",
  shadowOpacity: 0.08,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
} as const;

// ── Header étendu : bouton menu « squircle » + capsule d'actions ─────────

// Hauteur commune des éléments du header étendu (menu, flash, capsule).
const HEADER_BTN = 46;
const SLOT = 36;
const CAPSULE_PAD = 4;

function headerShadow(isDark: boolean, navyDeep: string) {
  return {
    shadowColor: isDark ? "#000000" : navyDeep,
    shadowOpacity: isDark ? 0.4 : 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  } as const;
}

// Menu : carré arrondi + trois traits de longueurs différentes, celui du
// milieu à la couleur d'accent du thème.
function MenuButton({ onPress }: { onPress: () => void }) {
  const { c, isDark } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Ouvrir le menu"
      className="active:opacity-70"
      style={[
        {
          width: HEADER_BTN,
          height: HEADER_BTN,
          borderRadius: 16,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.borderSoft,
          alignItems: "flex-start",
          justifyContent: "center",
          paddingLeft: 13,
          gap: 4,
        },
        headerShadow(isDark, c.navyDeep),
      ]}
    >
      <View
        style={{
          width: 19,
          height: 2.5,
          borderRadius: 2,
          backgroundColor: c.text,
        }}
      />
      <View
        style={{
          width: 12,
          height: 2.5,
          borderRadius: 2,
          backgroundColor: c.violet,
        }}
      />
      <View
        style={{
          width: 16,
          height: 2.5,
          borderRadius: 2,
          backgroundColor: c.text,
        }}
      />
    </Pressable>
  );
}

function Badge({ count, ring }: { count: number; ring: string }) {
  if (count <= 0) return null;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={{
        position: "absolute",
        top: -2,
        right: -2,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        borderRadius: 9,
        backgroundColor: "#DC2626",
        borderWidth: 2,
        borderColor: ring,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 9, fontWeight: "800", color: "#FFFFFF" }}>
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
}

function CapsuleSlot({
  icon,
  color,
  label,
  onPress,
  badgeCount = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  onPress: () => void;
  badgeCount?: number;
}) {
  const { c } = useTheme();
  const a11y =
    badgeCount > 0
      ? `${label} (${badgeCount} non lu${badgeCount > 1 ? "s" : ""})`
      : label;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => ({
        width: SLOT,
        height: SLOT,
        borderRadius: SLOT / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? c.surface2 : "transparent",
      })}
    >
      <Ionicons name={icon} size={21} color={color} />
      <Badge count={badgeCount} ring={c.surface} />
    </Pressable>
  );
}

// Flash deals : bouton rond autonome, à côté de la capsule, pour que son
// onde reste bien visible. Quand un flash deal est en cours, un anneau
// s'étend puis s'estompe (cycle 2,4 s) en passant du violet à l'orange
// puis au doré — même effet que la bannière flash du web.
function FlashButton({
  onPress,
  active,
  count,
}: {
  onPress: () => void;
  active: boolean;
  count: number;
}) {
  const { c, mode, isDark } = useTheme();
  const flashColor =
    mode === "forest" || mode === "fushia" ? c.accent : "#7C5CFC";
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [active, progress]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: active ? 0.55 * (1 - progress.value) : 0,
    transform: [{ scale: 0.95 + progress.value * 0.9 }],
    backgroundColor: interpolateColor(
      progress.value,
      [0, 0.35, 0.65],
      ["#7C3AED", "#FB923C", "#FFC53D"],
    ),
  }));
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={
        active ? `Flash deals (${count} en cours)` : "Flash deals"
      }
      style={{
        width: HEADER_BTN,
        height: HEADER_BTN,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            width: HEADER_BTN,
            height: HEADER_BTN,
            borderRadius: HEADER_BTN / 2,
          },
          ringStyle,
        ]}
      />
      <View
        style={[
          {
            width: HEADER_BTN,
            height: HEADER_BTN,
            borderRadius: HEADER_BTN / 2,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.borderSoft,
            alignItems: "center",
            justifyContent: "center",
          },
          headerShadow(isDark, c.navyDeep),
        ]}
      >
        <Ionicons
          name={active ? "flash" : "flash-outline"}
          size={21}
          color={flashColor}
        />
      </View>
      <Badge count={active ? count : 0} ring={c.surface} />
    </Pressable>
  );
}

// Compte : avatar rond aux initiales, dégradé de l'accent du thème.
function AvatarSlot({
  initials,
  onPress,
}: {
  initials: string;
  onPress: () => void;
}) {
  const { c, isDark } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel="Mon compte"
      className="active:opacity-80"
      style={{
        width: SLOT,
        height: SLOT,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <LinearGradient
        // En Sombre, violetDeep est clair → blanc peu lisible : dégradé foncé.
        colors={isDark ? ["#7C5CFC", "#4F3BC4"] : [c.violet, c.violetDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: SLOT,
          height: SLOT,
          borderRadius: SLOT / 2,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {initials ? (
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: "#FFFFFF",
              letterSpacing: 0.5,
            }}
          >
            {initials}
          </Text>
        ) : (
          <Ionicons name="person" size={17} color="#FFFFFF" />
        )}
      </LinearGradient>
    </Pressable>
  );
}

function ActionCapsule({ children }: { children: React.ReactNode }) {
  const { c, isDark } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: CAPSULE_PAD,
          paddingHorizontal: CAPSULE_PAD + 2,
          borderRadius: 999,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.borderSoft,
        },
        headerShadow(isDark, c.navyDeep),
      ]}
    >
      {children}
    </View>
  );
}

// Mini-logo « b » — pastille gradient navy→bleu identique au BrandLogo
// pour le header compact. Garde l'identité Buupp sans manger la place
// du titre de page.
function BrandMark() {
  // Logo « b » en pastille dégradé. Bleu buupp (navy → bleu) par défaut
  // (light/dark) ; en forest/fushia on suit la couleur du thème — dégradé
  // diagonal du ton profond (navyDeep) vers l'accent vif. Reste lisible sur
  // header clair comme sombre (texte blanc sur fond foncé→saturé).
  const { mode, c } = useTheme();
  const colors: [string, string] =
    mode === "forest" || mode === "fushia"
      ? [c.navyDeep, c.accent]
      : ["#13235B", "#2F44C0"];
  return (
    <LinearGradient
      colors={colors}
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
        className="font-serif-bold"
        style={{ fontSize: 18, lineHeight: 22, color: "#FFFFFF" }}
      >
        b
      </Text>
    </LinearGradient>
  );
}

export function AppHeader({
  variant = "prospect",
}: {
  /** "pro" → boutons header pro (lancer/recharger) + drawer pro. */
  variant?: "prospect" | "pro";
} = {}) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const ctx = useHeaderScroll();
  const [showMessages, setShowMessages] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const flashSheet = useFlashSheet();
  const notif = useNotifications();
  const unread = notif.data?.unreadCount ?? 0;
  const flashCount = useFlashDeals().data?.deals.length ?? 0;
  const initials = (useMeTyped().data?.initials ?? "")
    .slice(0, 2)
    .toUpperCase();
  const glass = isLiquidGlassAvailable();
  const pageName = pageNameFromPathname(pathname);
  const { c, mode, isDark } = useTheme();
  // Icônes des boutons du header : teinte de l'accent du thème en
  // forest/fushia, ink (navy sombre) en buupp et sombre — inchangés.
  const iconColor = mode === "forest" || mode === "fushia" ? c.accent : c.ink;

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
            glassEffectStyle={isDark ? "clear" : "regular"}
            tintColor={`${c.bg}${isDark ? "73" : "57"}`}
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
              backgroundColor: `${c.bg}${isDark ? "EB" : "E6"}`,
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
            <MenuButton
              onPress={() => {
                const drawer = variant === "pro" ? "/pro-drawer" : "/drawer";
                setDrawerOrigin(pathname, drawer);
                router.push(drawer);
              }}
            />

            <View className="flex-row items-center gap-2">
              <BrandMark />
              <Text className="font-serif-bold text-2xl text-ink">buupp</Text>
            </View>

            <View className="flex-row items-center" style={{ gap: 10 }}>
              {variant === "prospect" ? (
                <FlashButton
                  onPress={() => flashSheet.open()}
                  active={flashCount > 0}
                  count={flashCount}
                />
              ) : null}
              <ActionCapsule>
                {variant === "pro" && PURCHASES_ENABLED ? (
                  <CapsuleSlot
                    icon="add-circle-outline"
                    color={iconColor}
                    label="Recharger mon compte"
                    onPress={() => setShowRecharge(true)}
                  />
                ) : null}
                <CapsuleSlot
                  icon="notifications-outline"
                  color={iconColor}
                  label="Messages"
                  onPress={() => setShowMessages(true)}
                  badgeCount={unread}
                />
                <AvatarSlot
                  initials={initials}
                  onPress={() => router.push("/account")}
                />
              </ActionCapsule>
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
              <Text className="font-serif text-xl text-ink" numberOfLines={1}>
                {pageName}
              </Text>
            </View>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              {/* Au scroll (header compact), on affiche les DEUX « + ». */}
              {variant === "pro" ? (
                <>
                  <IconButton
                    icon="add"
                    gradient={["#2F44C0", "#13235B"]}
                    color="#FFFFFF"
                    label="Lancer une campagne"
                    onPress={() => router.push("/(pro)/creation")}
                  />
                  {PURCHASES_ENABLED ? (
                    <IconButton
                      icon="add"
                      bg="bg-paper"
                      color={iconColor}
                      label="Recharger mon compte"
                      onPress={() => setShowRecharge(true)}
                    />
                  ) : null}
                </>
              ) : null}
              {ctx?.compactExtras?.length ? (
                <View className="flex-row items-center gap-2">
                  {ctx.compactExtras.map((e, i) => {
                    const content = (
                      <>
                        {e.iconLib === "material" ? (
                          <MaterialCommunityIcons
                            name={e.icon}
                            size={18}
                            color={e.color ?? c.ink}
                          />
                        ) : (
                          <Ionicons
                            name={e.icon}
                            size={18}
                            color={e.color ?? c.ink}
                          />
                        )}
                        {e.value ? (
                          <Text
                            className="font-mono text-[14px] font-semibold"
                            style={{ color: e.color ?? c.ink }}
                          >
                            {e.value}
                          </Text>
                        ) : null}
                      </>
                    );
                    // padding réduit pour un extra icône-seul (bouton œil)
                    const padCls = e.value
                      ? "px-2.5 py-1"
                      : "h-8 w-8 justify-center";
                    // Extra interactif (onPress défini) → Pressable bouton ;
                    // sinon simple pilule décorative (comportement historique).
                    return e.onPress ? (
                      <Pressable
                        key={i}
                        onPress={e.onPress}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={e.accessibilityLabel ?? e.value}
                        className={`flex-row items-center gap-1.5 rounded-full active:opacity-70 ${padCls}`}
                        style={e.bg ? { backgroundColor: e.bg } : undefined}
                      >
                        {content}
                      </Pressable>
                    ) : (
                      <View
                        key={i}
                        className={`flex-row items-center gap-1.5 rounded-full ${padCls}`}
                        style={e.bg ? { backgroundColor: e.bg } : undefined}
                      >
                        {content}
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </Animated.View>
        </View>
      </View>

      <MessagesSheet
        visible={showMessages}
        onClose={() => setShowMessages(false)}
      />
      {variant === "pro" ? (
        <RechargeSheet
          visible={showRecharge}
          onClose={() => setShowRecharge(false)}
        />
      ) : null}
      <FlashDealsSheet visible={flashSheet.isOpen} onClose={flashSheet.close} />
    </>
  );
}
