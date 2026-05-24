// Loader « Wave bars » — 4 barres verticales qui ondulent en vague,
// aux couleurs Buupp (#4F46E5 par défaut). Remplace ActivityIndicator
// partout dans l'app pour une signature visuelle cohérente. Anim 60fps
// via react-native-reanimated, boucle infinie.
//
// Tailles : xs (dans bouton), sm, md (défaut), lg (splash écran).
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

type Size = "xs" | "sm" | "md" | "lg";

// Dimensions par taille — barres assez grasses pour rester lisibles
// même en xs (dans un bouton). Hauteur basse = 30 % de la max pour
// éviter une barre qui « disparaît » visuellement.
const PRESETS: Record<Size, { barW: number; barH: number; gap: number }> = {
  xs: { barW: 2.5, barH: 14, gap: 2.5 },
  sm: { barW: 3, barH: 20, gap: 3 },
  md: { barW: 4, barH: 30, gap: 4 },
  lg: { barW: 5, barH: 44, gap: 5 },
};

const BAR_COUNT = 4;
const STAGGER_MS = 110; // décalage entre 2 barres consécutives
const CYCLE_MS = 760; // durée d'un cycle complet up→down

function Bar({
  index,
  size,
  color,
}: {
  index: number;
  size: Size;
  color: string;
}) {
  const preset = PRESETS[size];
  // progress 0 → barre à 30 % de hauteur ; 1 → pleine hauteur.
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      index * STAGGER_MS,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: CYCLE_MS / 2,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0, {
            duration: CYCLE_MS / 2,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        false,
      ),
    );
  }, [index, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: preset.barH * (0.3 + 0.7 * progress.value),
  }));

  return (
    <Animated.View
      style={[
        {
          width: preset.barW,
          marginHorizontal: preset.gap / 2,
          backgroundColor: color,
          borderRadius: preset.barW / 2,
        },
        animatedStyle,
      ]}
    />
  );
}

export function BuuppLoader({
  size = "md",
  color = "#4F46E5",
}: {
  size?: Size;
  color?: string;
}) {
  const preset = PRESETS[size];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: preset.barH,
      }}
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement"
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <Bar key={i} index={i} size={size} color={color} />
      ))}
    </View>
  );
}
