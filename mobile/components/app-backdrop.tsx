// Fond des pages connectées (ScrollScreen) : quadrillage, voile coloré sous
// le header, deux halos qui dérivent très lentement et un fin cercle en
// pointillés. Même langage visuel que l'onboarding et la connexion, en plus
// discret (le contenu est dense). Couleurs 100 % issues du thème.
import { useEffect } from "react";
import { useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../lib/theme";
import { GridBg } from "./grid-bg";
import { Glow, withAlpha } from "./onboarding-art";

function useLoop(duration: number, linear = false) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(
      withTiming(1, { duration, easing: linear ? Easing.linear : Easing.inOut(Easing.sin) }),
      -1,
      !linear,
    );
    return () => cancelAnimation(v);
  }, [v, duration, linear]);
  return v;
}

export function AppBackdrop() {
  const { c, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const driftA = useLoop(16000);
  const driftB = useLoop(21000);
  const spin = useLoop(120000, true);

  const glowA = useAnimatedStyle(() => ({
    transform: [
      { translateX: -30 + driftA.value * 60 },
      { translateY: driftA.value * 50 },
    ],
  }));
  const glowB = useAnimatedStyle(() => ({
    transform: [
      { translateX: 20 - driftB.value * 60 },
      { translateY: -driftB.value * 60 },
    ],
  }));
  const orbit = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <GridBg opacity={isDark ? 0.2 : 0.3} />
      <LinearGradient
        colors={[withAlpha(c.violetSoft, isDark ? "99" : "F2"), withAlpha(c.bg, "00")]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: height * 0.38 }}
      />
      <Animated.View style={[{ position: "absolute", top: -120, right: -160 }, glowA]}>
        <Glow size={460} color={c.violet} strength={0.034} />
      </Animated.View>
      <Animated.View style={[{ position: "absolute", top: height * 0.55, left: -190 }, glowB]}>
        <Glow size={440} color={isDark ? c.accent : c.amber} strength={0.03} />
      </Animated.View>
      <Animated.View
        style={[
          {
            position: "absolute",
            top: -width * 0.25,
            left: width * 0.45,
            width: width * 0.95,
            height: width * 0.95,
            borderRadius: width,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: withAlpha(c.violet, "4D"),
          },
          orbit,
        ]}
      />
    </View>
  );
}
