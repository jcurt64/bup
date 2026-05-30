// Footer signature « buupp » partagé entre les bottom-sheets.
//   - variant "navy"  : bande sombre façon hero web (grille blanche +
//     glows indigo/orange) pour la page détail d'un mouvement.
//   - variant "ivory" : couloir ivoire quadrillé pour la sheet
//     notifications (parité avec l'ancienne signature claire).
// Bande PLEINE LARGEUR collée au bas de la sheet (marges négatives pour
// annuler le px-5 et la paddingBottom du BottomSheet), bord supérieur
// arrondi, grille en fond + « buupp » animé lettre par lettre + slogan.
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Variant = "navy" | "ivory";

const CONF: Record<
  Variant,
  {
    bg: string;
    letter: string;
    slogan: { blue: string; orange: string; gray: string; dot: string };
    grid: string;
    border?: string;
    /** Rayon des coins supérieurs (0 = fondu à plat, sans effet panneau). */
    radius: number;
    /** Grille clippée en ellipse centrée (vs pleine surface) → ne révèle
     *  pas la pleine largeur de la bande. */
    gridEllipse: boolean;
    glow: boolean;
  }
> = {
  navy: {
    bg: "#0F1629",
    letter: "#FBF8F1",
    slogan: {
      blue: "#C7D2FE",
      orange: "#F2994A",
      gray: "rgba(255,255,255,0.72)",
      dot: "rgba(255,255,255,0.35)",
    },
    grid: "rgba(255,255,255,0.06)",
    radius: 32,
    gridEllipse: false,
    glow: true,
  },
  ivory: {
    // Même ivoire que le fond de la BottomSheet → le footer FOND dans le
    // décor (pas de card) ; quadrillage clippé en ellipse comme décor.
    bg: "#F7F4EC",
    letter: "#13235B",
    slogan: {
      blue: "#13235B",
      orange: "#E0915A",
      gray: "#5B6478",
      dot: "#B7BCC7",
    },
    grid: "#E6E3DA",
    radius: 0,
    gridEllipse: true,
    glow: false,
  },
};

// Séquencement de l'animation (parité ancienne signature).
const INITIAL_DELAY = 450;
const STAGGER = 140;

// Lettre animée — fade-in + slide-up échelonné.
function Letter({
  char,
  index,
  color,
}: {
  char: string;
  index: number;
  color: string;
}) {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(14);
  useEffect(() => {
    const d = INITIAL_DELAY + index * STAGGER;
    opacity.value = withDelay(
      d,
      withTiming(1, { duration: 460, easing: Easing.out(Easing.quad) }),
    );
    ty.value = withDelay(
      d,
      withTiming(0, { duration: 460, easing: Easing.out(Easing.cubic) }),
    );
  }, [index, opacity, ty]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));
  return (
    <Animated.Text
      style={[
        { fontFamily: "DancingScript_700Bold", fontSize: 48, lineHeight: 56, color },
        style,
      ]}
    >
      {char}
    </Animated.Text>
  );
}

// Slogan tri-couleur — apparaît après le déploiement des lettres.
function Slogan({
  colors,
}: {
  colors: { blue: string; orange: string; gray: string; dot: string };
}) {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(8);
  useEffect(() => {
    const d = INITIAL_DELAY + 4 * STAGGER + 460 + 120;
    opacity.value = withDelay(
      d,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }),
    );
    ty.value = withDelay(
      d,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, [opacity, ty]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));
  return (
    <Animated.Text
      className="mt-1 font-mono text-[11px] font-semibold uppercase"
      style={[{ letterSpacing: 2.2 }, style]}
    >
      <Text style={{ color: colors.blue }}>Be used</Text>
      <Text style={{ color: colors.dot }}> · </Text>
      <Text style={{ color: colors.orange }}>paid &amp; </Text>
      <Text style={{ color: colors.gray }}>proud</Text>
    </Animated.Text>
  );
}

// Quadrillage — soit plein (clippé par l'overflow de la bande), soit
// clippé en ELLIPSE centrée (derrière « buupp ») pour ne pas révéler la
// pleine largeur (parité ancienne signature).
function Grid({ color, ellipse }: { color: string; ellipse?: boolean }) {
  if (ellipse) {
    const W = 300;
    const H = 150;
    const STEP = 22;
    const cols = Math.ceil(W / STEP);
    const rows = Math.ceil(H / STEP);
    return (
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 6,
          left: "50%",
          marginLeft: -W / 2,
          width: W,
          height: H,
          borderRadius: 999,
          overflow: "hidden",
          opacity: 0.55,
        }}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <View
            key={`h${i}`}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: i * STEP,
              height: 1,
              backgroundColor: color,
            }}
          />
        ))}
        {Array.from({ length: cols }).map((_, i) => (
          <View
            key={`v${i}`}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: i * STEP,
              width: 1,
              backgroundColor: color,
            }}
          />
        ))}
      </View>
    );
  }
  const STEP = 24;
  const N = 36;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: N }).map((_, i) => (
        <View
          key={`h${i}`}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: i * STEP,
            height: 1,
            backgroundColor: color,
          }}
        />
      ))}
      {Array.from({ length: N }).map((_, i) => (
        <View
          key={`v${i}`}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: i * STEP,
            width: 1,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

export function BuuppFooter({ variant }: { variant: Variant }) {
  const insets = useSafeAreaInsets();
  const conf = CONF[variant];
  const letters = "buupp".split("");
  return (
    <View
      className="items-center overflow-hidden px-6 pt-7"
      style={{
        backgroundColor: conf.bg,
        marginHorizontal: -20,
        marginBottom: -(insets.bottom + 16),
        paddingBottom: insets.bottom + 22,
        borderTopLeftRadius: conf.radius,
        borderTopRightRadius: conf.radius,
        ...(conf.border
          ? { borderTopWidth: 1, borderColor: conf.border }
          : null),
      }}
    >
      <Grid color={conf.grid} ellipse={conf.gridEllipse} />
      {conf.glow ? (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(165,180,252,0.16)", "rgba(165,180,252,0)"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.25, y: 0.85 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(242,153,74,0)", "rgba(242,153,74,0.14)"]}
            start={{ x: 0.6, y: 0.1 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : null}
      <View className="flex-row">
        {letters.map((c, i) => (
          <Letter key={`${c}-${i}`} char={c} index={i} color={conf.letter} />
        ))}
      </View>
      <Slogan colors={conf.slogan} />
    </View>
  );
}
