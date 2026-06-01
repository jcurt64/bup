// Quadrillage plein écran — superposé au fond (couleur inchangée) pour
// dynamiser les pages. Repris de l'écran d'onboarding, étendu à toute la
// page (cf. demande web→mobile). pointerEvents none → n'intercepte rien.
import { View, useWindowDimensions } from "react-native";

import { useTheme } from "../lib/theme";

export function GridBg({
  color,
  opacity,
  step = 28,
}: {
  color?: string;
  opacity?: number;
  step?: number;
}) {
  const { c, isDark } = useTheme();
  // Défaut : lignes = couleur de bordure du thème ; atténuées en sombre.
  const lineColor = color ?? c.line;
  const lineOpacity = opacity ?? (isDark ? 0.4 : 0.5);
  const { width, height } = useWindowDimensions();
  const cols = Math.ceil(width / step) + 1;
  const rows = Math.ceil(height / step) + 1;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: lineOpacity }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={`h${i}`}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: i * step,
            height: 1,
            backgroundColor: lineColor,
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
            left: i * step,
            width: 1,
            backgroundColor: lineColor,
          }}
        />
      ))}
    </View>
  );
}
