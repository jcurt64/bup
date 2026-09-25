// Carte « Aucune demande pour l'instant » (Relations) : radar animé qui
// balaye lentement et fait apparaître des « blips » (pros qui passent),
// fond teinté à motif, état réel des notifications et deux raccourcis pour
// augmenter ses chances (compléter ses données, élargir sa zone).
// Couleurs du thème (4 coloris), mouvements lents.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { withAlpha } from "../lib/color";
import { useTheme } from "../lib/theme";
import { Motif } from "./motif";
import { PushStatusBadge } from "./push-settings";

const SIZE = 132;

function Blip({ x, y, delay, color }: { x: number; y: number; delay: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 1600, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 3900 }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(p);
  }, [p, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.6 + p.value * 0.6 }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: x - 5,
          top: y - 5,
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: color,
          borderWidth: 2,
          borderColor: "#FFFFFF",
        },
        style,
      ]}
    />
  );
}

function Radar() {
  const { c, isDark } = useTheme();
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(spin);
  }, [spin]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const half = SIZE / 2;
  return (
    <View
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: half,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: withAlpha(c.violet, isDark ? "26" : "14"),
        borderWidth: 1,
        borderColor: withAlpha(c.violet, "40"),
      }}
    >
      {[100, 68, 36].map((d) => (
        <View
          key={d}
          style={{
            position: "absolute",
            width: d,
            height: d,
            borderRadius: d / 2,
            borderWidth: 1,
            borderColor: withAlpha(c.violet, "4D"),
          }}
        />
      ))}
      {/* Axes */}
      <View style={{ position: "absolute", width: SIZE, height: 1, backgroundColor: withAlpha(c.violet, "26") }} />
      <View style={{ position: "absolute", width: 1, height: SIZE, backgroundColor: withAlpha(c.violet, "26") }} />
      {/* Balayage : quart de disque en dégradé qui tourne */}
      <Animated.View style={[{ position: "absolute", width: SIZE, height: SIZE }, sweep]}>
        <LinearGradient
          colors={[withAlpha(c.violet, "00"), withAlpha(c.violet, isDark ? "88" : "66")]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={{ position: "absolute", left: half, top: 0, width: half, height: half, borderTopRightRadius: half }}
        />
      </Animated.View>
      <Blip x={half + 30} y={half - 26} delay={400} color={c.accCoral} />
      <Blip x={half - 34} y={half + 20} delay={2300} color={c.accAmber} />
      <Blip x={half + 14} y={half + 36} delay={4200} color={c.good} />
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: c.violet,
          borderWidth: 3,
          borderColor: c.surface,
        }}
      />
    </View>
  );
}

function Shortcut({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="active:opacity-70"
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 11,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.borderSoft,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withAlpha(c.violet, "1F"),
        }}
      >
        <Ionicons name={icon} size={16} color={c.violet} />
      </View>
      <Text numberOfLines={2} style={{ flex: 1, fontSize: 12.5, fontWeight: "700", color: c.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function EmptyRequestsCard() {
  const { c, isDark } = useTheme();
  return (
    <View
      style={{
        borderRadius: 26,
        borderWidth: 1,
        borderColor: withAlpha(c.violet, "33"),
        backgroundColor: c.surface,
        shadowColor: isDark ? "#000000" : c.violet,
        shadowOpacity: isDark ? 0.35 : 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
      }}
    >
      <View style={{ borderRadius: 25, overflow: "hidden", paddingVertical: 24, paddingHorizontal: 18, alignItems: "center" }}>
        <LinearGradient
          colors={[withAlpha(c.violet, isDark ? "2E" : "1A"), withAlpha(c.surface, "00")]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.8 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <Motif variant="dots" color={withAlpha(c.violet, "66")} />

        <Radar />

        <View
          style={{
            marginTop: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: withAlpha(c.violet, "1A"),
          }}
        >
          <Ionicons name="scan-outline" size={12} color={c.violet} />
          <Text style={{ fontSize: 10.5, fontWeight: "800", letterSpacing: 1.4, color: c.violet }}>
            RECHERCHE EN COURS
          </Text>
        </View>
        <Text className="font-serif" style={{ fontSize: 22, color: c.text, textAlign: "center", marginTop: 10 }}>
          Aucune demande <Text className="font-serif-italic" style={{ color: c.violet }}>pour l’instant</Text>
        </Text>
        <Text
          style={{ fontSize: 13.5, lineHeight: 20, color: c.textSub, textAlign: "center", marginTop: 6, maxWidth: 300 }}
        >
          Mais ça ne saurait tarder… On vous prévient dès qu’une sollicitation arrive.
        </Text>
        <PushStatusBadge />

        <Text
          style={{
            alignSelf: "flex-start",
            marginTop: 20,
            fontSize: 10.5,
            fontWeight: "800",
            letterSpacing: 1.6,
            color: c.textSub,
          }}
        >
          EN ATTENDANT, BOOSTEZ VOS CHANCES
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 8, alignSelf: "stretch" }}>
          <Shortcut
            icon="layers-outline"
            label="Compléter mes données"
            onPress={() => router.push("/(prospect)/donnees")}
          />
          <Shortcut
            icon="navigate-circle-outline"
            label="Élargir ma zone"
            onPress={() => router.push("/(prospect)/preferences")}
          />
        </View>
      </View>
    </View>
  );
}
