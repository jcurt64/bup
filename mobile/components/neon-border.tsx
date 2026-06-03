// « La Vitrine » — bordure néon animée qui tourne autour d'une carte pour
// signaler un service à forte valeur ajoutée. Technique : un dégradé linéaire
// (carré couvrant la diagonale de la carte) tourne en continu DERRIÈRE une
// surface opaque ; seul le liseré de `borderWidth` autour de la surface laisse
// voir le dégradé → on perçoit une lumière qui balaie la bordure. Le fond du
// conteneur porte une lueur violette constante : la bande brillante du dégradé
// tourne par-dessus. Réutilisé côté pro (carte Vitrine du détail campagne) et
// côté prospect (encart « Découvrir sa vitrine »).
import { useEffect, useState, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../lib/theme";

// Ajoute un canal alpha à une couleur hex #RRGGBB (RN accepte #RRGGBBAA).
const alpha = (hex: string, aa: string) =>
  /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${aa}` : hex;

export function NeonBorder({
  children,
  radius = 24,
  borderWidth = 2,
  padding = 20,
  duration = 3600,
  surface,
  glow,
  bright,
  style,
}: {
  children: ReactNode;
  /** Rayon extérieur de la carte. L'intérieur est arrondi à `radius - borderWidth`. */
  radius?: number;
  /** Épaisseur du liseré néon visible. */
  borderWidth?: number;
  /** Padding interne (0 = la surface épouse l'enfant, qui gère son espacement). */
  padding?: number;
  /** Durée d'un tour complet (ms). */
  duration?: number;
  /** Couleur de la surface opaque centrale (défaut : surface du thème). */
  surface?: string;
  /** Lueur violette constante de la bordure (défaut : accViolet du thème). */
  glow?: string;
  /** Cœur brillant qui balaie la bordure (défaut : blanc). */
  bright?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, isDark } = useTheme();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const angle = useSharedValue(0);

  useEffect(() => {
    angle.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(angle);
  }, [angle, duration]);

  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value * 360}deg` }],
  }));

  // Carré couvrant toute la carte quel que soit l'angle (diagonale).
  const diag = Math.ceil(Math.hypot(box.w, box.h)) || 0;
  const violet = glow ?? c.accViolet;
  const core = bright ?? "#FFFFFF";
  // Densité adaptée au thème : sur fond sombre le halo (shadow) est invisible
  // → on densifie la lueur constante de la bordure ; sur fond clair on allège
  // la base et on s'appuie sur le halo coloré pour le volume.
  const baseAlpha = isDark ? "80" : "59"; // ~50% sombre / ~35% clair
  const haloOpacity = isDark ? 0.85 : 0.5;
  const haloRadius = isDark ? 22 : 16;
  // Dégradé : transparent → violet → cœur brillant → violet → transparent.
  // La partie transparente laisse voir la lueur constante du fond ; la bande
  // violet/blanc balaie la bordure en tournant.
  const stops: readonly [string, string, string, string, string] = [
    alpha(violet, "00"),
    violet,
    core,
    violet,
    alpha(violet, "00"),
  ];

  return (
    <View
      onLayout={(e) =>
        setBox({
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        })
      }
      style={[
        {
          borderRadius: radius,
          overflow: "hidden",
          padding: borderWidth,
          backgroundColor: alpha(violet, baseAlpha), // lueur constante de la bordure
          // Halo coloré diffus autour de la carte (iOS) + élévation (Android).
          shadowColor: violet,
          shadowOpacity: haloOpacity,
          shadowRadius: haloRadius,
          shadowOffset: { width: 0, height: 0 },
          elevation: isDark ? 12 : 8,
        },
        style,
      ]}
    >
      {diag > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              width: diag,
              height: diag,
              left: (box.w - diag) / 2,
              top: (box.h - diag) / 2,
            },
            spin,
          ]}
        >
          <LinearGradient
            colors={stops}
            locations={[0, 0.4, 0.5, 0.6, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ) : null}
      <View
        style={{
          borderRadius: Math.max(0, radius - borderWidth),
          backgroundColor: surface ?? c.surface,
          padding,
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );
}
