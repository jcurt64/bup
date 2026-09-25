// Motifs décoratifs de fond de carte (points, rayures, cercles, vagues,
// confettis). Toujours pointerEvents="none" ; à placer dans un conteneur
// `overflow: "hidden"`. La couleur (avec alpha) est fournie par l'appelant.
import { View, type ViewStyle } from "react-native";

export type MotifVariant = "dots" | "stripes" | "rings" | "waves" | "confetti";

export function Motif({
  variant,
  color,
  style,
}: {
  variant: MotifVariant;
  color: string;
  style?: ViewStyle;
}) {
  if (variant === "dots") {
    return (
      <View pointerEvents="none" style={[{ position: "absolute", top: 14, right: 14 }, style]}>
        {Array.from({ length: 5 }).map((_, r) => (
          <View key={r} style={{ flexDirection: "row", gap: 9, marginBottom: 9 }}>
            {Array.from({ length: 7 }).map((__, k) => (
              <View
                key={k}
                style={{
                  width: 3.5,
                  height: 3.5,
                  borderRadius: 2,
                  backgroundColor: color,
                  // fondu vers le bas-gauche
                  opacity: Math.max(0.12, 1 - (r * 0.18 + (6 - k) * 0.12)),
                }}
              />
            ))}
          </View>
        ))}
      </View>
    );
  }
  if (variant === "waves") {
    // Arcs concentriques qui débordent du coin bas-droit (ondulations).
    return (
      <View pointerEvents="none" style={[{ position: "absolute", bottom: -120, right: -60 }, style]}>
        {[260, 215, 170, 125].map((d) => (
          <View
            key={d}
            style={{
              position: "absolute",
              bottom: 0,
              right: (260 - d) / 2,
              width: d,
              height: d,
              borderRadius: d / 2,
              borderWidth: 1.5,
              borderColor: color,
            }}
          />
        ))}
      </View>
    );
  }
  if (variant === "confetti") {
    // Petits confettis éparpillés en haut à droite (formes + rotations fixes).
    const bits: { t: number; r: number; w: number; h: number; rot: number; o: number }[] = [
      { t: 12, r: 18, w: 8, h: 3, rot: 25, o: 1 },
      { t: 30, r: 52, w: 5, h: 5, rot: 0, o: 0.8 },
      { t: 10, r: 84, w: 9, h: 3, rot: -30, o: 0.7 },
      { t: 44, r: 20, w: 4, h: 4, rot: 0, o: 0.6 },
      { t: 58, r: 66, w: 8, h: 3, rot: 60, o: 0.55 },
      { t: 26, r: 118, w: 4, h: 4, rot: 0, o: 0.45 },
      { t: 70, r: 34, w: 7, h: 3, rot: -15, o: 0.4 },
      { t: 48, r: 100, w: 6, h: 3, rot: 40, o: 0.35 },
    ];
    return (
      <View pointerEvents="none" style={[{ position: "absolute", top: 0, right: 0, width: 140, height: 90 }, style]}>
        {bits.map((b, i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              top: b.t,
              right: b.r,
              width: b.w,
              height: b.h,
              borderRadius: b.w === b.h ? b.w / 2 : 2,
              backgroundColor: color,
              opacity: b.o,
              transform: [{ rotate: `${b.rot}deg` }],
            }}
          />
        ))}
      </View>
    );
  }
  if (variant === "stripes") {
    return (
      <View
        pointerEvents="none"
        style={[
          { position: "absolute", top: -40, right: -30, width: 180, height: 180, transform: [{ rotate: "35deg" }] },
          style,
        ]}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <View
            key={i}
            style={{ height: 2, marginBottom: 12, borderRadius: 1, backgroundColor: color }}
          />
        ))}
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={[{ position: "absolute", top: -70, right: -70 }, style]}>
      {[220, 170, 120].map((d) => (
        <View
          key={d}
          style={{
            position: "absolute",
            top: (220 - d) / 2,
            left: (220 - d) / 2,
            width: d,
            height: d,
            borderRadius: d / 2,
            borderWidth: 1,
            borderColor: color,
          }}
        />
      ))}
    </View>
  );
}

