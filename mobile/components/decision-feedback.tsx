// Encart affiché sous la card d'un flash deal juste après une décision
// (accept ou refuse). Illustration 3D thiings.co + message amical
// + confettis animés en RN (Reanimated) pour l'accept.
import { useEffect } from "react";
import { Image } from "expo-image";
import { Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
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

// Génère un confetti rectangulaire animé partant du centre haut et
// retombant vers le bas avec une rotation. `delay` étale les particules
// pour un effet "rafale" plutôt que synchro parfaite.
function ConfettiParticle({
  index,
  width,
}: {
  index: number;
  width: number;
}) {
  // Position de départ : étalée horizontalement autour du centre.
  const startX = ((index * 73) % width) - width / 2;
  // Position cible : retombe en bas, dérive horizontale légère.
  const targetY = 220 + (index % 3) * 30;
  const targetX = startX + ((index % 5) - 2) * 30;
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const sizeW = 6 + (index % 3) * 2;
  const sizeH = 10 + (index % 2) * 2;

  const ty = useSharedValue(-40);
  const tx = useSharedValue(startX);
  const rot = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = (index % 12) * 40;
    const duration = 1400 + (index % 4) * 200;
    opacity.value = withDelay(delay, withTiming(1, { duration: 120 }));
    ty.value = withDelay(
      delay,
      withTiming(targetY, { duration, easing: Easing.out(Easing.quad) }),
    );
    tx.value = withDelay(
      delay,
      withTiming(targetX, { duration, easing: Easing.out(Easing.quad) }),
    );
    rot.value = withDelay(
      delay,
      withRepeat(withTiming(360, { duration: 800, easing: Easing.linear }), -1),
    );
    // Fade out à la fin pour ne pas s'accrocher à l'écran.
    opacity.value = withDelay(
      delay + duration - 300,
      withTiming(0, { duration: 300 }),
    );
    return () => {
      cancelAnimation(ty);
      cancelAnimation(tx);
      cancelAnimation(rot);
      cancelAnimation(opacity);
    };
    // index stable par particule, no dépendance dynamique.
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
          top: 0,
          left: width / 2 - sizeW / 2,
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
  const { width } = useWindowDimensions();
  // 40 particules pour un effet « rafale » sans surcharger le GPU.
  const particleCount = decision === "accept" ? 40 : 0;

  if (decision === "accept") {
    return (
      <View
        className="overflow-hidden rounded-2xl"
        style={{
          padding: 18,
          backgroundColor: "#FAF7FF",
          borderWidth: 1,
          borderColor: "#E4DEF5",
          position: "relative",
        }}
      >
        {/* Couche confettis (absolument positionnée, sous le contenu) */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: "hidden",
          }}
        >
          {Array.from({ length: particleCount }).map((_, i) => (
            <ConfettiParticle key={i} index={i} width={width - 40} />
          ))}
        </View>
        <View className="items-center">
          <Image
            source={POPPER}
            style={{ width: 96, height: 96 }}
            contentFit="contain"
            accessibilityLabel="Félicitations"
          />
          <Text className="mt-2 font-serif text-xl text-ink">
            Félicitations !
          </Text>
          <Text className="mt-1 text-center text-[13.5px] leading-5 text-ink-3">
            Sollicitation acceptée. Vos coins arrivent{"\n"}
            sur votre portefeuille.
          </Text>
        </View>
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
        <Text className="mt-2 font-serif text-xl text-ink">
          C'est noté !
        </Text>
        <Text className="mt-1 text-center text-[13.5px] leading-5 text-ink-3">
          Aucun souci, on se retrouve sur{"\n"}
          la prochaine occasion.
        </Text>
      </View>
    </View>
  );
}
