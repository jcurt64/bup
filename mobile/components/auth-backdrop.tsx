// Fond de l'écran de connexion : quadrillage, voile coloré en haut, halos
// qui dérivent lentement, orbite en pointillés et quelques pastilles
// flottantes rappelant l'univers BUUPP (placées hors de la zone du
// formulaire). Mouvements volontairement lents, dans l'esprit apaisé de
// l'onboarding. Couleurs 100 % issues du thème (4 coloris).
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../lib/theme";
import { GridBg } from "./grid-bg";
import { Card, Glow, IconTile, Pop, withAlpha } from "./onboarding-art";

function useLoop(duration: number, reverse = true) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(
      withTiming(1, {
        duration,
        easing: reverse ? Easing.inOut(Easing.sin) : Easing.linear,
      }),
      -1,
      reverse,
    );
    return () => cancelAnimation(v);
  }, [v, duration, reverse]);
  return v;
}

export function AuthBackdrop() {
  const { c, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const driftA = useLoop(14000);
  const driftB = useLoop(18000);
  const spin = useLoop(90000, false);

  const glowA = useAnimatedStyle(() => ({
    transform: [
      { translateX: -40 + driftA.value * 80 },
      { translateY: driftA.value * 40 },
    ],
  }));
  const glowB = useAnimatedStyle(() => ({
    transform: [
      { translateX: 30 - driftB.value * 70 },
      { translateY: -driftB.value * 50 },
    ],
  }));
  const orbit = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  const top = insets.top + 8;
  const bottom = insets.bottom + 10;

  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <GridBg opacity={isDark ? 0.22 : 0.32} />

      {/* Voile coloré du haut + reflet chaud en bas */}
      <LinearGradient
        colors={[withAlpha(c.violetSoft, isDark ? "B3" : "FF"), withAlpha(c.bg, "00")]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: height * 0.42 }}
      />
      <LinearGradient
        colors={[withAlpha(c.bg, "00"), withAlpha(c.violetSoft, isDark ? "80" : "CC")]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: height * 0.25 }}
      />

      <Animated.View style={[{ position: "absolute", top: -140, right: -150 }, glowA]}>
        <Glow size={440} color={c.violet} />
      </Animated.View>
      <Animated.View style={[{ position: "absolute", bottom: -120, left: -170 }, glowB]}>
        <Glow size={400} color={isDark ? c.accent : c.amber} />
      </Animated.View>

      {/* Grande orbite en pointillés, à cheval sur le bord droit */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: height * 0.06,
            left: width * 0.52,
            width: width * 0.9,
            height: width * 0.9,
            borderRadius: width,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: withAlpha(c.violet, "40"),
          },
          orbit,
        ]}
      />
      <View
        style={{
          position: "absolute",
          bottom: height * 0.08,
          left: -width * 0.35,
          width: width * 0.7,
          height: width * 0.7,
          borderRadius: width,
          borderWidth: 1,
          borderColor: withAlpha(c.violet, "26"),
        }}
      />

      {/* Pastilles flottantes — coins haut et bas, hors formulaire */}
      <Pop active delay={200} rotate={-8} float={6} floatDuration={3400} style={{ top: top + 6, left: 18 }}>
        <Card style={{ padding: 8, borderRadius: 14 }}>
          <IconTile name="wallet" bg={c.tintGreen} color={c.accGreen} size={26} />
        </Card>
      </Pop>
      <Pop active delay={400} rotate={7} float={5} floatDuration={3000} style={{ top: top + 28, right: 22 }}>
        <Card style={{ padding: 8, borderRadius: 14 }}>
          <IconTile name="notifications" bg={c.tintViolet} color={c.accViolet} size={26} />
        </Card>
      </Pop>
      <Pop active delay={600} rotate={6} float={6} floatDuration={3800} style={{ bottom: bottom + 8, left: 26 }}>
        <Card style={{ padding: 8, borderRadius: 14 }}>
          <IconTile name="shield-checkmark" bg={c.tintBlue} color={c.accBlue} size={26} />
        </Card>
      </Pop>
      <Pop active delay={800} rotate={-6} float={5} floatDuration={3200} style={{ bottom: bottom + 20, right: 30 }}>
        <Card style={{ padding: 8, borderRadius: 14 }}>
          <IconTile name="sparkles" bg={c.tintAmber} color={c.accAmber} size={26} />
        </Card>
      </Pop>
    </View>
  );
}
