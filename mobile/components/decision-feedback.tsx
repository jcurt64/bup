// Encart affiché sous la card d'un flash deal juste après une décision
// (accept ou refuse). Illustration 3D thiings.co + message amical
// + confettis animés en RN (Reanimated) pour l'accept : éclatement radial
// depuis le centre puis retombée, par-dessus le contenu.
import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const POPPER = require("../assets/images/celebrate-popper.png");
const PEACE = require("../assets/images/peace-sign.png");

// Couleurs des confettis (palette flash deal + accents fr).
const CONFETTI_COLORS = [
  "#7C5CFC", // violet
  "#F2B65A", // amber
  "#2FB8A6", // teal
  "#FF7A6B", // coral
  "#5B8DEF", // sky
  "#16A34A", // good
];

const CONFETTI_COUNT = 38;

// Confetti rectangulaire : part du centre de la card, éclate vers l'extérieur
// (biais vers le haut), puis retombe avec gravité en tournant, et s'estompe.
function ConfettiParticle({
  index,
  count,
  width,
  height,
}: {
  index: number;
  count: number;
  width: number;
  height: number;
}) {
  const cx = width / 2;
  const cy = height * 0.42;
  // Angle réparti sur le cercle + léger désordre déterministe.
  const angle = (index / count) * Math.PI * 2 + (index % 3) * 0.25;
  const speed = 46 + (index % 6) * 16;
  const burstX = Math.cos(angle) * speed;
  const burstY = Math.sin(angle) * speed - 26; // biais vers le haut
  const fallY = burstY + height * 0.7 + (index % 4) * 22;
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const sizeW = 6 + (index % 3) * 2;
  const sizeH = 9 + (index % 2) * 3;

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rot = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = (index % 8) * 22;
    // Opacité en UNE seule assignation (fade-in → tenue → fade-out). Deux
    // assignations se seraient écrasées → opacité bloquée à 0 (confettis
    // invisibles).
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 90 }),
        withTiming(1, { duration: 980 }),
        withTiming(0, { duration: 340 }),
      ),
    );
    tx.value = withDelay(
      delay,
      withTiming(burstX * 1.12, { duration: 1300, easing: Easing.out(Easing.quad) }),
    );
    ty.value = withDelay(
      delay,
      withSequence(
        withTiming(burstY, { duration: 320, easing: Easing.out(Easing.quad) }),
        withTiming(fallY, { duration: 980, easing: Easing.in(Easing.quad) }),
      ),
    );
    rot.value = withDelay(
      delay,
      withRepeat(withTiming(360, { duration: 700, easing: Easing.linear }), -1),
    );
    return () => {
      cancelAnimation(tx);
      cancelAnimation(ty);
      cancelAnimation(rot);
      cancelAnimation(opacity);
    };
    // index stable par particule, pas de dépendance dynamique.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rot.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          top: cy,
          left: cx - sizeW / 2,
          width: sizeW,
          height: sizeH,
          backgroundColor: color,
          borderRadius: 1,
        },
        style,
      ]}
    />
  );
}

export function DecisionFeedback({
  decision,
}: {
  decision: "accept" | "refuse";
}) {
  // Dimensions réelles de la card (mesurées) pour centrer l'éclatement.
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  if (decision === "accept") {
    return (
      <View
        className="overflow-hidden rounded-2xl"
        onLayout={onLayout}
        style={{
          padding: 18,
          backgroundColor: "#FAF7FF",
          borderWidth: 1,
          borderColor: "#E4DEF5",
          position: "relative",
        }}
      >
        <View className="items-center">
          <Image
            source={POPPER}
            style={{ width: 96, height: 96 }}
            contentFit="contain"
            accessibilityLabel="Félicitations"
          />
          <Text className="mt-2 font-serif text-xl text-ink">Félicitations !</Text>
          <Text className="mt-1 text-center text-[13.5px] leading-5 text-ink-3">
            Sollicitation acceptée. Vos coins arrivent{"\n"}
            sur votre portefeuille.
          </Text>
        </View>

        {/* Couche confettis PAR-DESSUS le contenu (éclatement radial). */}
        {size.w > 0 ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
              <ConfettiParticle
                key={i}
                index={i}
                count={CONFETTI_COUNT}
                width={size.w}
                height={size.h}
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  }
  return (
    <View
      className="rounded-2xl"
      style={{
        padding: 18,
        backgroundColor: "#EFEADD",
        borderWidth: 1,
        borderColor: "#E6E3DA",
      }}
    >
      <View className="items-center">
        <Image
          source={PEACE}
          style={{ width: 88, height: 88 }}
          contentFit="contain"
          accessibilityLabel="À la prochaine"
        />
        <Text className="mt-2 font-serif text-xl text-ink">C’est noté !</Text>
        <Text className="mt-1 text-center text-[13.5px] leading-5 text-ink-3">
          Aucun souci, on se retrouve sur{"\n"}
          la prochaine occasion.
        </Text>
      </View>
    </View>
  );
}
