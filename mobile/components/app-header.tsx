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
import { useFlashDeals, useNotifications } from "../lib/queries";
import { useTheme } from "../lib/theme";

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

function FlashHeaderButton({
  onPress,
  active,
}: {
  onPress: () => void;
  active: boolean;
}) {
  // Anneau pulsant quand un flash deal est lancé (active). Reproduit le
  // pulse de la bannière flash de l'app web (page d'accueil) : anneau qui
  // s'étend puis s'estompe, couleur --accent (#4F46E5), cycle 2,4 s. Le
  // disque coloré est masqué en son centre par le bouton blanc → seule la
  // couronne en expansion reste visible (effet radar, comme le box-shadow
  // animé du web).
  const PULSE_COLOR = "#4F46E5";
  const { c, mode, isDark } = useTheme();
  // Éclair teinté à l'accent du thème en forest/fushia, violet buupp sinon.
  const flashColor =
    mode === "forest" || mode === "fushia" ? c.accent : "#7C5CFC";
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value = 0.9;
      opacity.value = 0;
      return;
    }
    scale.value = 0.9;
    opacity.value = 0.5;
    scale.value = withRepeat(
      withTiming(2.1, { duration: 2400, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withTiming(0, { duration: 2400, easing: Easing.out(Easing.ease) }),
      -1,
      false,
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
            backgroundColor: PULSE_COLOR,
          },
          ringStyle,
        ]}
      />
      <View
        className={`h-10 w-10 items-center justify-center rounded-full ${isDark ? "" : "bg-paper"}`}
        style={[LIGHT_BTN_SHADOW, isDark ? { backgroundColor: "rgba(255,255,255,0.13)" } : null]}
      >
        <Ionicons name="flash" size={22} color={flashColor} />
      </View>
    </Pressable>
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
  const glass = isLiquidGlassAvailable();
  const pageName = pageNameFromPathname(pathname);
  const { c, mode, isDark } = useTheme();
  // Icônes des boutons du header : teinte de l'accent du thème en
  // forest/fushia, ink (navy sombre) en buupp et sombre — inchangés.
  const iconColor =
    mode === "forest" || mode === "fushia" ? c.accent : c.ink;

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
            tintColor={
              isDark ? "rgba(14, 18, 31, 0.45)" : "rgba(247, 244, 236, 0.34)"
            }
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
              backgroundColor: isDark
                ? "rgba(14, 18, 31, 0.82)"
                : "rgba(247, 244, 236, 0.78)",
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
              icon="menu"
              bg="bg-paper"
              color={iconColor}
              label="Ouvrir le menu"
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

            {variant === "pro" ? (
              // Header étendu : pas de « + » création ici (il apparaît dans le
              // header compact au scroll). Recharge + notifs + compte.
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <IconButton
                  icon="add"
                  bg="bg-paper"
                  color={iconColor}
                  label="Recharger mon compte"
                  onPress={() => setShowRecharge(true)}
                />
                <IconButton
                  icon="notifications-outline"
                  bg="bg-paper"
                  color={iconColor}
                  label="Messages"
                  onPress={() => setShowMessages(true)}
                  badgeCount={unread}
                />
                <IconButton
                  icon="person-outline"
                  bg="bg-paper"
                  color={iconColor}
                  label="Mon compte"
                  onPress={() => router.push("/account")}
                />
              </View>
            ) : (
              <View className="flex-row items-center gap-3">
                <FlashHeaderButton
                  onPress={() => flashSheet.open()}
                  active={flashCount > 0}
                />
                <IconButton
                  icon="notifications-outline"
                  bg="bg-paper"
                  color={iconColor}
                  label="Messages"
                  onPress={() => setShowMessages(true)}
                  badgeCount={unread}
                />
                <IconButton
                  icon="person-outline"
                  bg="bg-paper"
                  color={iconColor}
                  label="Mon compte"
                  onPress={() => router.push("/account")}
                />
              </View>
            )}
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
                  <IconButton
                    icon="add"
                    bg="bg-paper"
                    color={iconColor}
                    label="Recharger mon compte"
                    onPress={() => setShowRecharge(true)}
                  />
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
                  const padCls = e.value ? "px-2.5 py-1" : "h-8 w-8 justify-center";
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
      <FlashDealsSheet
        visible={flashSheet.isOpen}
        onClose={flashSheet.close}
      />
    </>
  );
}
