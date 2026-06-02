// Tab bar pilule flottante — variante PRO (5 onglets : Accueil, Campagnes,
// Créer, Contacts, Réglages). Design + thèmes strictement identiques à la
// version prospect (floating-tab-bar.tsx) ; seules la liste d'onglets et
// l'absence de badge changent. L'onglet « Créer » est un « + » central.
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme, type ThemeMode } from "../lib/theme";

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  overview: "home-outline",
  campagnes: "megaphone-outline",
  creation: "add", // « + » central — lancer une campagne
  contacts: "people-outline",
  reglages: "settings-outline",
};
const LABEL: Record<string, string> = {
  overview: "Accueil",
  campagnes: "Campagnes",
  creation: "Créer",
  contacts: "Contacts",
  reglages: "Réglages",
};
const TABS = ["overview", "campagnes", "creation", "contacts", "reglages"];

const ITEM_H = 52;
const LABEL_GAP = 2;
const PILL_INSET = 3;
const ACTIVE_EXTRA = 40;
// Items inactifs = navy discret sur le fond clair (buupp) ; teinte du thème
// en forest/fushia ; gris clair en sombre.
const INACTIVE = "#13235B";

// Dégradé de la pilule active, par thème (aligné floating-tab-bar prospect).
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
};

function Tab({
  index,
  ap,
  wInactive,
  wActive,
  routeName,
  focused,
  onPress,
}: TabProps) {
  const { c, mode, isDark } = useTheme();
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
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <View>
          {routeName === "creation" ? (
            <Ionicons
              name="add"
              size={26}
              color={focused ? "#FFFFFF" : inactiveColor}
            />
          ) : (
            <Ionicons
              name={ICON[routeName]}
              size={21}
              color={focused ? "#FFFFFF" : inactiveColor}
            />
          )}
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

export default function FloatingTabBarPro({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const glass = isLiquidGlassAvailable();
  const { c, mode, isDark } = useTheme();
  const pillColors = PILL_GRADIENT[mode];
  const barBg = mode === "forest" || mode === "fushia" ? c.field : c.paper;
  const shadow = {
    shadowColor: "#0F1629",
    shadowOpacity: glass ? 0.1 : 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  } as const;

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
  const extra = n > 1 ? ACTIVE_EXTRA : 0;
  const wInactive = equal > 0 ? equal - extra / Math.max(1, n - 1) : 0;
  const wActive = equal > 0 ? equal + extra : 0;
  const pillW = wActive > 0 ? wActive - PILL_INSET * 2 : 0;

  const ap = useSharedValue(activePos);
  const inited = useRef(false);
  useEffect(() => {
    if (!inited.current) {
      ap.value = activePos;
      inited.current = true;
    } else {
      ap.value = withSpring(activePos, { damping: 18, stiffness: 180, mass: 0.6 });
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
          style={{ borderRadius: 999, paddingHorizontal: 4, paddingVertical: 7, ...shadow }}
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
