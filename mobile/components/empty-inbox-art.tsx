// Illustration animée de la boîte de réception vide (sheet Messages).
// Mouvements lents et continus, sans pulsation : halo qui respire,
// anneau pointillé qui tourne, enveloppe qui flotte en se balançant,
// avion en papier qui fait le tour de l'anneau, étincelles qui scintillent.
// Couleurs du thème (4 coloris).
import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { withAlpha } from "../lib/color";
import { useTheme } from "../lib/theme";

const SIZE = 184;

function useLoop(duration: number, { linear = false, delay = 0 } = {}) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration, easing: linear ? Easing.linear : Easing.inOut(Easing.sin) }),
        -1,
        !linear,
      ),
    );
    return () => cancelAnimation(v);
  }, [v, duration, linear, delay]);
  return v;
}

// Étincelle : apparaît / grandit puis s'efface, puis repos.
function Sparkle({
  delay,
  size,
  color,
  style,
}: {
  delay: number;
  size: number;
  color: string;
  style: object;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 900, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 1400 }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(p);
  }, [p, delay]);
  const anim = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.4 + p.value * 0.6 }, { rotate: `${p.value * 40}deg` }],
  }));
  return (
    <Animated.View style={[{ position: "absolute" }, style, anim]}>
      <Ionicons name="sparkles" size={size} color={color} />
    </Animated.View>
  );
}

function Orbiter({ spin, color }: { spin: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", width: 140, height: 140 }, style]}
    >
      {/* Avion posé sur le haut de l'anneau, orienté dans le sens du tour */}
      <View style={{ position: "absolute", top: -11, left: 59, transform: [{ rotate: "45deg" }] }}>
        <Ionicons name="paper-plane" size={22} color={color} />
      </View>
    </Animated.View>
  );
}

export function EmptyInboxArt() {
  const { c, isDark } = useTheme();
  const breath = useLoop(4200);
  const ring = useLoop(40000, { linear: true });
  const orbit = useLoop(9000, { linear: true });
  const float = useLoop(2800);
  const sway = useLoop(3600, { delay: 400 });

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.94 + breath.value * 0.08 }],
    opacity: 0.8 + breath.value * 0.2,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ring.value * 360}deg` }],
  }));
  const envStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -6 + float.value * 12 },
      { rotate: `${-5 + sway.value * 10}deg` },
    ],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1.1 - float.value * 0.25 }],
    opacity: 0.35 - float.value * 0.15,
  }));

  return (
    <View
      style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}
      accessibilityLabel="Boîte de réception vide"
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            backgroundColor: withAlpha(c.violet, isDark ? "26" : "1A"),
          },
          haloStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 140,
            height: 140,
            borderRadius: 70,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: withAlpha(c.violet, "66"),
          },
          ringStyle,
        ]}
      />
      <Orbiter spin={orbit} color={c.accAmber} />

      {/* Ombre au sol qui suit le flottement */}
      <Animated.View
        style={[
          {
            position: "absolute",
            bottom: 44,
            width: 54,
            height: 8,
            borderRadius: 4,
            backgroundColor: c.violet,
          },
          shadowStyle,
        ]}
      />
      <Animated.View style={envStyle}>
        <Ionicons name="mail" size={64} color={c.violet} />
      </Animated.View>

      <Sparkle delay={200} size={18} color={c.accAmber} style={{ top: 46, right: 44 }} />
      <Sparkle delay={1300} size={13} color={c.violet} style={{ top: 62, left: 40 }} />
      <Sparkle delay={2300} size={15} color={c.accCoral} style={{ bottom: 50, right: 36 }} />
    </View>
  );
}
