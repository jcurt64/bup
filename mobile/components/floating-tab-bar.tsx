// Tab bar pilule flottante (cf. public/prototype/tab.png) : barre
// rounded-full / Liquid Glass, ombre. Onglet actif = pilule dégradé
// violet→navy qui GLISSE d'un onglet à l'autre (Reanimated, withSpring),
// icône blanche + libellé court ; inactif = icône discrète.
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
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
  donnees: "albums-outline",
  relations: "albums-outline", // remplacé par MaterialCommunityIcons handshake-outline au rendu
  preferences: "options-outline",
};
const LABEL: Record<string, string> = {
  portefeuille: "Accueil",
  donnees: "Données",
  relations: "Relations",
  preferences: "Préf.",
};
const TABS = ["portefeuille", "relations", "donnees", "preferences"];
const PILL = 44;

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
  const target = slot > 0 ? slot * activePos + (slot - PILL) / 2 : 0;

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
              width: PILL,
              height: PILL,
              borderRadius: 999,
              overflow: "hidden",
            },
            pillStyle,
          ]}
        >
          <LinearGradient
            colors={["#7C5CFC", "#13235B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
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
            style={{ flex: 1, alignItems: "center" }}
          >
            <View
              style={{
                width: PILL,
                height: PILL,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {it.name === "relations" ? (
                <MaterialCommunityIcons
                  name="handshake-outline"
                  size={22}
                  color={focused ? "#FFFFFF" : "#8A91A1"}
                />
              ) : (
                <Ionicons
                  name={ICON[it.name]}
                  size={20}
                  color={focused ? "#FFFFFF" : "#8A91A1"}
                />
              )}
            </View>
            <View style={{ height: 16, justifyContent: "center" }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "600",
                  color: focused ? "#0F1629" : "#8A91A1",
                }}
              >
                {LABEL[it.name]}
              </Text>
            </View>
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
            paddingHorizontal: 12,
            paddingVertical: 8,
            ...shadow,
          }}
        >
          {row}
        </GlassView>
      ) : (
        <View
          className="rounded-full bg-paper"
          style={{ paddingHorizontal: 12, paddingVertical: 8, ...shadow }}
        >
          {row}
        </View>
      )}
    </View>
  );
}
