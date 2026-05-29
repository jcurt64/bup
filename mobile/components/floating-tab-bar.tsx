// Tab bar pilule flottante (cf. public/prototype/redesign.png) : barre
// rounded-full / Liquid Glass, ombre. Onglet actif = pilule navy PLEINE
// qui englobe l'icône ET le libellé (icône + texte blancs) et GLISSE
// d'un onglet à l'autre (Reanimated, withSpring) ; inactif = icône +
// libellé navy discrets sur le fond clair.
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useEffect, useRef, useState } from "react";
import { type LayoutChangeEvent, Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
// Combinée au paddingHorizontal de la barre (4), la marge gauche de la
// pilule la plus à gauche = 4 + 3 = 7px, égale à la marge haute/basse
// (paddingVertical 7) → marges parfaitement équilibrées (cf. redesign).
const PILL_INSET = 3;
// Couleurs : pilule pleine = ink (échantillon maquette ≈ #0A1628),
// items inactifs = navy discret sur le fond clair.
const PILL_BG = "#0F1629";
const INACTIVE = "#13235B";

export default function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const glass = isLiquidGlassAvailable();
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
  const slot = rowW > 0 ? rowW / n : 0;
  const pillW = slot > 0 ? slot - PILL_INSET * 2 : 0;
  const target = slot > 0 ? slot * activePos + PILL_INSET : 0;

  const tx = useSharedValue(0);
  const inited = useRef(false);
  useEffect(() => {
    if (slot <= 0) return;
    if (!inited.current) {
      tx.value = target; // pas d'animation au 1er positionnement
      inited.current = true;
    } else {
      tx.value = withSpring(target, {
        damping: 18,
        stiffness: 180,
        mass: 0.6,
      });
    }
  }, [target, slot, tx]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  const row = (
    <View
      onLayout={(e: LayoutChangeEvent) => setRowW(e.nativeEvent.layout.width)}
      style={{ flexDirection: "row", alignItems: "flex-start" }}
    >
      {slot > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 0,
              top: 0,
              width: pillW,
              height: ITEM_H,
              borderRadius: 999,
              backgroundColor: PILL_BG,
            },
            pillStyle,
          ]}
        />
      ) : null}

      {items.map((it) => {
        const focused = it.key === activeKey;
        return (
          <Pressable
            key={it.key}
            onPress={() => navigation.navigate(it.name as never)}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={LABEL[it.name]}
            style={{
              flex: 1,
              height: ITEM_H,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {it.name === "donnees" ? (
              <MaterialCommunityIcons
                name="database-outline"
                size={22}
                color={focused ? "#FFFFFF" : INACTIVE}
              />
            ) : (
              <Ionicons
                name={ICON[it.name]}
                size={21}
                color={focused ? "#FFFFFF" : INACTIVE}
              />
            )}
            <Text
              numberOfLines={1}
              style={{
                marginTop: LABEL_GAP,
                fontSize: 9.5,
                fontWeight: "600",
                color: focused ? "#FFFFFF" : INACTIVE,
              }}
            >
              {LABEL[it.name]}
            </Text>
          </Pressable>
        );
      })}
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
          glassEffectStyle="regular"
          isInteractive
          tintColor="rgba(255, 255, 255, 0.34)"
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
          className="rounded-full bg-paper"
          style={{ paddingHorizontal: 4, paddingVertical: 7, ...shadow }}
        >
          {row}
        </View>
      )}
    </View>
  );
}
