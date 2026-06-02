// Tab bar pilule flottante (cf. public/prototype/redesign.png) : barre
// rounded-full / Liquid Glass, ombre. Onglet actif = pilule navy PLEINE,
// PLUS LARGE que les autres, qui englobe l'icône ET le libellé (icône +
// texte blancs) et GLISSE d'un onglet à l'autre (Reanimated, withSpring).
// Onglets inactifs = icône seule, navy discret sur le fond clair (leur
// libellé est masqué : opacité 0, mais reste réservé pour que les icônes
// restent alignées verticalement). Au changement d'onglet, les largeurs
// des slots et l'opacité des libellés s'animent de concert avec la pilule.
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useProspectRelations } from "../lib/queries";
import { useTheme, type ThemeMode } from "../lib/theme";

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  portefeuille: "home-outline",
  donnees: "albums-outline", // remplacé par MaterialCommunityIcons database-outline au rendu
  relations: "people-outline",
  preferences: "options-outline",
  reglages: "settings-outline",
};
const LABEL: Record<string, string> = {
  portefeuille: "Accueil",
  donnees: "Données",
  relations: "Relations",
  preferences: "Préf.",
  reglages: "Réglages",
};
const TABS = ["portefeuille", "relations", "donnees", "preferences", "reglages"];
// Hauteur d'un item = hauteur de la pilule active. Le contenu (icône +
// label) est centré verticalement à l'intérieur ; une hauteur un peu plus
// généreuse laisse du padding vertical autour du contenu quand l'onglet
// est actif. La pilule reste plus large que haute (stadium horizontal,
// pas un rond — cf. redesign.png).
const ITEM_H = 52;
// Écart vertical icône → label (resserré : le label « remonte » juste
// sous l'icône au lieu d'être collé au bas).
const LABEL_GAP = 2;
// Marge horizontale entre la pilule active et les bords de son slot.
const PILL_INSET = 3;
// Largeur supplémentaire (px) accordée à l'onglet actif par rapport à un
// slot uniforme. Elle est retranchée à parts égales aux onglets inactifs,
// donc la somme des largeurs reste exactement égale à la barre (pas de
// débordement ni d'espace). « un peu plus grande » → ~40px.
const ACTIVE_EXTRA = 40;
// Pilule active = dégradé bleu du logo buupp (rendu en LinearGradient).
// Items inactifs = navy discret sur le fond clair.
const INACTIVE = "#13235B";

// Dégradé de la pilule active, par thème. buupp/sombre = bleu logo ;
// forest = vert, fushia = rose (alignés sur l'accent du thème).
const PILL_GRADIENT: Record<ThemeMode, readonly [string, string]> = {
  light: ["#13235B", "#2F44C0"],
  dark: ["#13235B", "#2F44C0"],
  forest: ["#15583A", "#2F8D5B"],
  fushia: ["#B02A66", "#E84F98"],
};

// Teinte de fond (verre dépoli) de la barre, par thème.
const GLASS_TINT: Record<ThemeMode, string> = {
  light: "rgba(255, 255, 255, 0.34)",
  dark: "rgba(32, 39, 58, 0.55)",
  forest: "rgba(225, 241, 229, 0.50)",
  fushia: "rgba(252, 227, 238, 0.52)",
};

// Part d'« activité » d'un onglet en fonction de la position active
// flottante `ap` : 1 quand ap === index, décroît linéairement jusqu'à 0
// à un index d'écart. Pour tout `ap`, la somme des parts vaut 1 (seuls les
// deux index encadrants sont non nuls), ce qui garantit que la somme des
// largeurs reste constante pendant la transition.
function share(index: number, ap: number) {
  "worklet";
  return Math.max(0, 1 - Math.abs(index - ap));
}

type TabProps = {
  index: number;
  ap: SharedValue<number>;
  wInactive: number;
  wActive: number;
  routeName: string;
  focused: boolean;
  onPress: () => void;
  /** Badge (ex. demandes en attente) sur l'icône. 0 = masqué. */
  badgeCount?: number;
};

function Tab({
  index,
  ap,
  wInactive,
  wActive,
  routeName,
  focused,
  onPress,
  badgeCount = 0,
}: TabProps) {
  const { c, mode, isDark } = useTheme();
  // Icône inactive : gris clair lisible en sombre, navy discret en buupp,
  // teinte profonde du thème (vert/rose) en forest/fushia.
  const inactiveColor = isDark
    ? c.ink3
    : mode === "forest" || mode === "fushia"
      ? c.accentInk
      : INACTIVE;
  const tabStyle = useAnimatedStyle(() => ({
    width: wInactive + (wActive - wInactive) * share(index, ap.value),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: share(index, ap.value),
  }));

  return (
    <Animated.View style={[{ height: ITEM_H, overflow: "hidden" }, tabStyle]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={LABEL[routeName]}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View>
          {routeName === "donnees" ? (
            <MaterialCommunityIcons
              name="database-outline"
              size={22}
              color={focused ? "#FFFFFF" : inactiveColor}
            />
          ) : (
            <Ionicons
              name={ICON[routeName]}
              size={21}
              color={focused ? "#FFFFFF" : inactiveColor}
            />
          )}
          {badgeCount > 0 ? (
            // Badge : rouge si l'onglet est inactif, blanc s'il est actif.
            <View
              style={{
                position: "absolute",
                top: -5,
                right: -11,
                minWidth: 16,
                height: 16,
                paddingHorizontal: 4,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: focused ? "#FFFFFF" : "#DC2626",
              }}
            >
              <Text
                style={{
                  fontSize: 9.5,
                  fontWeight: "700",
                  color: focused ? "#13235B" : "#FFFFFF",
                }}
              >
                {badgeCount > 9 ? "9+" : badgeCount}
              </Text>
            </View>
          ) : null}
        </View>
        <Animated.Text
          numberOfLines={1}
          style={[
            {
              marginTop: LABEL_GAP,
              fontSize: 9.5,
              fontWeight: "600",
              color: "#FFFFFF",
            },
            labelStyle,
          ]}
        >
          {LABEL[routeName]}
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

export default function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const glass = isLiquidGlassAvailable();
  const { c, mode, isDark } = useTheme();
  const pillColors = PILL_GRADIENT[mode];
  // Fond non-verre : paper (buupp/sombre, look inchangé) ; teinte douce du
  // thème (field) pour forest/fushia.
  const barBg =
    mode === "forest" || mode === "fushia" ? c.field : c.paper;
  // Badge onglet Relations : nombre de demandes EN ATTENTE (on exclut celles
  // déjà acceptées qui restent dans le carrousel avec leur badge ✓).
  const pendingCount = (useProspectRelations().data?.pending ?? []).filter(
    (p) => !(p.relationStatus === "accepted" || p.decision === "Acceptée"),
  ).length;
  const shadow = {
    shadowColor: "#0F1629",
    shadowOpacity: glass ? 0.1 : 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  } as const;

  // Onglets présents, dans l'ordre d'affichage TABS.
  const items = TABS.map((name) => {
    const r = state.routes.find((rt) => rt.name === name);
    return r ? { name, key: r.key } : null;
  }).filter((x): x is { name: string; key: string } => x !== null);

  const activeKey = state.routes[state.index]?.key;
  const activePos = Math.max(
    0,
    items.findIndex((it) => it.key === activeKey),
  );

  const [rowW, setRowW] = useState(0);
  const n = items.length || 1;
  const equal = rowW > 0 ? rowW / n : 0;
  // L'onglet actif gagne ACTIVE_EXTRA ; ce surplus est retranché à parts
  // égales aux (n-1) onglets inactifs. Somme des largeurs = rowW.
  const extra = n > 1 ? ACTIVE_EXTRA : 0;
  const wInactive = equal > 0 ? equal - extra / Math.max(1, n - 1) : 0;
  const wActive = equal > 0 ? equal + extra : 0;
  const pillW = wActive > 0 ? wActive - PILL_INSET * 2 : 0;

  // Position active flottante : translateX de la pilule = ap * wInactive +
  // PILL_INSET (linéaire — à l'arrêt sur l'onglet k, les k onglets qui le
  // précèdent ont chacun la largeur wInactive).
  const ap = useSharedValue(activePos);
  const inited = useRef(false);
  useEffect(() => {
    if (!inited.current) {
      ap.value = activePos; // pas d'animation au 1er positionnement
      inited.current = true;
    } else {
      ap.value = withSpring(activePos, {
        damping: 18,
        stiffness: 180,
        mass: 0.6,
      });
    }
  }, [activePos, ap]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ap.value * wInactive + PILL_INSET }],
    width: pillW,
  }));

  const row = (
    <View
      onLayout={(e: LayoutChangeEvent) => setRowW(e.nativeEvent.layout.width)}
      style={{ flexDirection: "row", alignItems: "flex-start" }}
    >
      {rowW > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 0,
              top: 0,
              height: ITEM_H,
              borderRadius: 999,
              overflow: "hidden",
            },
            pillStyle,
          ]}
        >
          {/* Dégradé de la pilule active, teinté selon le thème (bleu logo
              en buupp/sombre, vert en forest, rose en fushia). */}
          <LinearGradient
            colors={pillColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}

      {items.map((it, i) => (
        <Tab
          key={it.key}
          index={i}
          ap={ap}
          wInactive={wInactive}
          wActive={wActive}
          routeName={it.name}
          focused={it.key === activeKey}
          onPress={() => navigation.navigate(it.name as never)}
          badgeCount={it.name === "relations" ? pendingCount : 0}
        />
      ))}
    </View>
  );

  return (
    <View
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: insets.bottom + 10,
      }}
      pointerEvents="box-none"
    >
      {glass ? (
        <GlassView
          glassEffectStyle={isDark ? "clear" : "regular"}
          isInteractive
          tintColor={GLASS_TINT[mode]}
          style={{
            borderRadius: 999,
            paddingHorizontal: 4,
            paddingVertical: 7,
            ...shadow,
          }}
        >
          {row}
        </GlassView>
      ) : (
        <View
          className="rounded-full"
          style={{ backgroundColor: barBg, paddingHorizontal: 4, paddingVertical: 7, ...shadow }}
        >
          {row}
        </View>
      )}
    </View>
  );
}
