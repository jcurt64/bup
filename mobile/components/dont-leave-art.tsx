// Mascotte « Ne nous quitte pas » (popups de suppression du compte) :
// une bouille ronde aux yeux suppliants, sourcils tristes, joues roses,
// une larme qui coule régulièrement, des petits cœurs qui s'envolent et un
// léger balancement. Purement décoratif (Views + Reanimated, pas d'image) ;
// couleurs du thème.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { Text, View } from "react-native";
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

import { shade } from "../lib/color";
import { useTheme } from "../lib/theme";

function Tear({ left, delay }: { left: number; delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1300, easing: Easing.in(Easing.quad) }),
          withTiming(1, { duration: 900 }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(p);
  }, [p, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.05 ? p.value * 20 : 1 - p.value,
    transform: [
      { translateY: p.value * 34 },
      { rotate: "45deg" },
      { scale: 0.7 + p.value * 0.3 },
    ],
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 48,
          left,
          width: 8,
          height: 11,
          borderRadius: 5,
          borderTopLeftRadius: 1,
          backgroundColor: "#7CC8FF",
        },
        style,
      ]}
    />
  );
}

function FloatingHeart({
  delay,
  x,
  color,
  size,
}: {
  delay: number;
  x: number;
  color: string;
  size: number;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false),
    );
    return () => cancelAnimation(p);
  }, [p, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.15 ? p.value / 0.15 : 1 - (p.value - 0.15) / 0.85,
    transform: [
      { translateY: -p.value * 46 },
      { translateX: Math.sin(p.value * Math.PI * 2) * 5 },
      { scale: 0.6 + p.value * 0.5 },
    ],
  }));
  return (
    <Animated.View style={[{ position: "absolute", bottom: 30, left: x }, style]}>
      <Ionicons name="heart" size={size} color={color} />
    </Animated.View>
  );
}

export function DontLeaveArt({ compact = false }: { compact?: boolean }) {
  const { c } = useTheme();
  const sway = useSharedValue(0);
  useEffect(() => {
    sway.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(sway);
  }, [sway]);
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-5 + sway.value * 10}deg` }, { translateY: sway.value * 3 }],
  }));

  const eye = (left: number) => (
    <View
      style={{
        position: "absolute",
        top: 28,
        left,
        width: 22,
        height: 24,
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
      }}
    >
      {/* Pupille relevée (regard suppliant) + reflets */}
      <View
        style={{
          position: "absolute",
          top: 2,
          left: 4,
          width: 14,
          height: 15,
          borderRadius: 8,
          backgroundColor: "#1B1440",
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 4,
          left: 10,
          width: 5,
          height: 5,
          borderRadius: 3,
          backgroundColor: "#FFFFFF",
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 11,
          left: 6,
          width: 3,
          height: 3,
          borderRadius: 2,
          backgroundColor: "#FFFFFF",
        }}
      />
    </View>
  );

  const brow = (left: number, rotate: string) => (
    <View
      style={{
        position: "absolute",
        top: 18,
        left,
        width: 16,
        height: 3.5,
        borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.9)",
        transform: [{ rotate }],
      }}
    />
  );

  return (
    <View style={{ alignItems: "center", marginTop: compact ? 4 : 10 }}>
      <View style={{ width: 150, height: compact ? 108 : 118, alignItems: "center" }}>
        <FloatingHeart delay={0} x={18} color={c.coral} size={16} />
        <FloatingHeart delay={900} x={116} color={c.violet} size={13} />
        <FloatingHeart delay={1700} x={104} color={c.coral} size={11} />

        <Animated.View style={[{ marginTop: 8 }, bodyStyle]}>
          <LinearGradient
            colors={[shade(c.violet, 0.12), shade(c.violet, -0.3)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 92,
              height: 92,
              borderRadius: 46,
              shadowColor: c.violet,
              shadowOpacity: 0.35,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 5,
            }}
          >
            {brow(16, "-18deg")}
            {brow(58, "18deg")}
            {eye(15)}
            {eye(55)}
            {/* Joues roses */}
            <View
              style={{
                position: "absolute",
                top: 56,
                left: 8,
                width: 14,
                height: 8,
                borderRadius: 4,
                backgroundColor: "rgba(255,138,160,0.55)",
              }}
            />
            <View
              style={{
                position: "absolute",
                top: 56,
                right: 8,
                width: 14,
                height: 8,
                borderRadius: 4,
                backgroundColor: "rgba(255,138,160,0.55)",
              }}
            />
            {/* Petite moue */}
            <View
              style={{
                position: "absolute",
                top: 64,
                left: 37,
                width: 18,
                height: 9,
                borderTopLeftRadius: 9,
                borderTopRightRadius: 9,
                borderWidth: 3,
                borderBottomWidth: 0,
                borderColor: "#FFFFFF",
              }}
            />
            <Tear left={22} delay={300} />
            <Tear left={64} delay={1400} />
          </LinearGradient>
        </Animated.View>
      </View>
      <Text
        className="font-serif-italic"
        style={{ fontSize: compact ? 17 : 19, color: c.text, marginTop: 2 }}
      >
        Ne nous quitte pas… 🥺
      </Text>
      <Text style={{ fontSize: 12.5, color: c.textSub, marginTop: 3, textAlign: "center" }}>
        On a encore plein de belles choses à vivre ensemble.
      </Text>
    </View>
  );
}
