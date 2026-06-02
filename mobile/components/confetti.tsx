// Effet confettis (one-shot) — pièces colorées qui tombent, via Reanimated.
// Aucune dépendance native supplémentaire. Décoratif : pointerEvents none.
import { useEffect } from "react";
import { useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

const COLORS = ["#7C5CFF", "#F2B65A", "#FF7A6B", "#2FB8A6", "#5B8DEF", "#E8C767", "#34D399"];
const COUNT = 44;

function Piece({ width, height, i }: { width: number; height: number; i: number }) {
  // Pseudo-aléatoire déterministe par index (évite Math.random au render).
  const r = (n: number) => {
    const x = Math.sin((i + 1) * 9301 + n * 49297) * 233280;
    return x - Math.floor(x);
  };
  const startX = r(1) * width;
  const drift = (r(2) - 0.5) * 140;
  const size = 6 + r(3) * 8;
  const color = COLORS[Math.floor(r(4) * COLORS.length)];
  const rot0 = r(5) * 360;
  const delay = r(6) * 500;
  const dur = 2200 + r(7) * 1600;

  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: dur, easing: Easing.linear }));
  }, [p, delay, dur]);

  const style = useAnimatedStyle(() => {
    "worklet";
    const opacity = p.value < 0.8 ? 1 : Math.max(0, 1 - (p.value - 0.8) / 0.2);
    return {
      opacity,
      transform: [
        { translateX: startX + drift * p.value },
        { translateY: -24 + (height + 80) * p.value },
        { rotate: `${rot0 + p.value * 900}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        { position: "absolute", top: 0, left: 0, width: size, height: size * 0.6, borderRadius: 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

export function Confetti() {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
      {Array.from({ length: COUNT }).map((_, i) => (
        <Piece key={i} i={i} width={width} height={height} />
      ))}
    </View>
  );
}
