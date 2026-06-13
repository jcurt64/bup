// Ballon de foot (marqueur Coupe du Monde) — image PNG réaliste, jumelle du
// ballon SVG côté web. Animation d'entrée : le ballon apparaît ~1,5 s après le
// logo, tombe du « ciel », fait deux rebonds, puis tourne en continu.
// Tout en reanimated (déjà présent dans le projet, aucune dépendance ajoutée).
import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const DROP_FROM = 64; // px au-dessus de sa position de repos au départ
const START_DELAY = 1500; // le logo s'affiche d'abord, le ballon tombe après
// Chute puis rebonds (durées en ms) — chute = ease-in (accélère),
// remontées = ease-out, redescentes = ease-in, comme une vraie balle.
const FALL = 620;
const B1_UP = 300;
const B1_DOWN = 300;
const B2_UP = 170;
const B2_DOWN = 170;
const SPIN_AT = START_DELAY + FALL + B1_UP + B1_DOWN + B2_UP + B2_DOWN;
const SPIN_MS = 5000; // un tour toutes les 5 s (aligné sur le web)

// L'intro (chute + rebonds) ne doit jouer qu'UNE fois par session. Le header
// est re-monté à chaque navigation (Expo Router) → sans ce garde-fou module,
// la chute se rejouerait à chaque changement de page. Après l'intro, le ballon
// apparaît déjà posé et se contente de tourner sur place.
let introPlayed = false;

export function WorldCupBall({ size = 22 }: { size?: number }) {
  const translateY = useSharedValue(introPlayed ? 0 : -DROP_FROM);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(introPlayed ? 1 : 0);

  useEffect(() => {
    const spin = () =>
      withRepeat(
        withTiming(360, { duration: SPIN_MS, easing: Easing.linear }),
        -1,
        false,
      );

    if (introPlayed) {
      // Déjà vu cette session : pas de re-chute, ballon posé qui tourne.
      opacity.value = 1;
      translateY.value = 0;
      rotate.value = spin();
      return;
    }
    introPlayed = true;

    // Invisible pendant le délai (le logo est seul à l'écran), puis fade-in.
    opacity.value = withDelay(START_DELAY, withTiming(1, { duration: 90 }));
    // Chute + 2 rebonds décroissants jusqu'à l'arrêt.
    translateY.value = withDelay(
      START_DELAY,
      withSequence(
        withTiming(0, { duration: FALL, easing: Easing.in(Easing.quad) }),
        withTiming(-12, { duration: B1_UP, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: B1_DOWN, easing: Easing.in(Easing.quad) }),
        withTiming(-5, { duration: B2_UP, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: B2_DOWN, easing: Easing.in(Easing.quad) }),
      ),
    );
    // Rotation continue, démarrée une fois le ballon posé.
    rotate.value = withDelay(SPIN_AT, spin());
  }, [opacity, translateY, rotate]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { rotateZ: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.Image
      source={require("../assets/images/worldcup-ball.png")}
      style={[{ width: size, height: size }, animatedStyle]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
