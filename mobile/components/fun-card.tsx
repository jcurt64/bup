import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { View } from "react-native";

import { shade, withAlpha } from "../lib/color";
import { useTheme } from "../lib/theme";

// Carte « fun » (Préférences, Réglages…) : fond en dégradé teinté de la couleur de la
// carte, pastille icône en dégradé légèrement penchée, grand pictogramme en
// filigrane en bas à droite, halo décoratif et ombre colorée. Toutes les
// teintes viennent du thème (tint* / acc*), donc des 4 coloris.
export function FunCard({
  iconBg,
  icon,
  iconColor,
  right,
  children,
}: {
  iconBg: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  /** Slot à droite de l'en-tête (badge « Verrouillé », toggle…). */
  right?: ReactNode;
  children: ReactNode;
}) {
  const { c, isDark } = useTheme();
  return (
    <View
      style={{
        borderRadius: 26,
        borderWidth: 1,
        borderColor: withAlpha(iconColor, isDark ? "40" : "2E"),
        backgroundColor: c.surface,
        shadowColor: isDark ? "#000000" : iconColor,
        shadowOpacity: isDark ? 0.35 : 0.14,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
      }}
    >
      <View style={{ borderRadius: 25, overflow: "hidden", padding: 20 }}>
        <LinearGradient
          colors={
            isDark
              ? [iconBg, shade(iconBg, -0.35)]
              : [iconBg, shade(iconBg, 0.55), c.surface]
          }
          locations={isDark ? undefined : [0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {/* Halo rond en haut à droite */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -50,
            right: -40,
            width: 150,
            height: 150,
            borderRadius: 75,
            backgroundColor: withAlpha(iconColor, isDark ? "1F" : "14"),
          }}
        />
        {/* Pictogramme géant en filigrane */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: -18,
            bottom: -22,
            transform: [{ rotate: "-12deg" }],
            opacity: isDark ? 0.1 : 0.08,
          }}
        >
          <Ionicons name={icon} size={130} color={iconColor} />
        </View>
        <View
          className="flex-row items-center justify-between"
          style={{ gap: 12 }}
        >
          <LinearGradient
            colors={[shade(iconColor, 0.12), shade(iconColor, -0.28)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 46,
              height: 46,
              borderRadius: 15,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ rotate: "-6deg" }],
              shadowColor: iconColor,
              shadowOpacity: 0.4,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}
          >
            <Ionicons name={icon} size={22} color="#FFFFFF" />
          </LinearGradient>
          {right ?? null}
        </View>
        {children}
      </View>
    </View>
  );
}

