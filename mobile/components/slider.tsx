// Slider horizontal léger (PanResponder, sans dépendance native). Thémé.
import { useRef, useState } from "react";
import { PanResponder, View, type GestureResponderEvent, type PanResponderGestureState } from "react-native";

import { useTheme } from "../lib/theme";

const THUMB = 26;
const TRACK_H = 6;

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const containerRef = useRef<View>(null);
  // Position/largeur fenêtre du conteneur, mesurées au début du geste.
  const box = useRef({ x: 0, w: 0 });

  const clampToStep = (v: number) => {
    const stepped = Math.round((v - min) / step) * step + min;
    return Math.max(min, Math.min(max, stepped));
  };
  const applyAbs = (absX: number) => {
    const usable = box.current.w - THUMB;
    if (usable <= 0) return;
    const ratio = Math.max(0, Math.min(1, (absX - box.current.x - THUMB / 2) / usable));
    onChange(clampToStep(min + ratio * (max - min)));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        containerRef.current?.measureInWindow((x, _y, w) => {
          box.current = { x, w };
          applyAbs(g.x0);
        });
      },
      onPanResponderMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        applyAbs(g.moveX);
      },
    }),
  ).current;

  const ratio = max > min ? (value - min) / (max - min) : 0;
  const usable = Math.max(0, width - THUMB);
  const left = ratio * usable;

  return (
    <View
      ref={containerRef}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...pan.panHandlers}
      style={{ height: THUMB, justifyContent: "center" }}
    >
      <View style={{ height: TRACK_H, borderRadius: 999, backgroundColor: c.track }}>
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: left + THUMB / 2,
            borderRadius: 999,
            backgroundColor: c.accent,
          }}
        />
      </View>
      <View
        style={{
          position: "absolute",
          left,
          width: THUMB,
          height: THUMB,
          borderRadius: 999,
          backgroundColor: c.surface,
          borderWidth: 2.5,
          borderColor: c.accent,
          shadowColor: "#000000",
          shadowOpacity: 0.15,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      />
    </View>
  );
}
