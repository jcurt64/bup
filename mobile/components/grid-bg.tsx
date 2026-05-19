// Quadrillage plein écran — superposé au fond (couleur inchangée) pour
// dynamiser les pages. Repris de l'écran d'onboarding, étendu à toute la
// page (cf. demande web→mobile). pointerEvents none → n'intercepte rien.
import { View, useWindowDimensions } from "react-native";

export function GridBg({
  color = "#E6E3DA",
  opacity = 0.5,
  step = 28,
}: {
  color?: string;
  opacity?: number;
  step?: number;
}) {
  const { width, height } = useWindowDimensions();
  const cols = Math.ceil(width / step) + 1;
  const rows = Math.ceil(height / step) + 1;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity }}
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
            left: i * step,
            width: 1,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}
