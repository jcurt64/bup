// Sélecteur de thème réutilisable (BUUPP / Sombre / Forest / Light Fushia).
// Source de vérité = ThemeProvider (useTheme().setMode), persté SecureStore.
// Design aligné sur la carte « Mode d'affichage » de Réglages prospect.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View } from "react-native";

import { useTheme, type ThemeMode } from "../lib/theme";

const THEMES = [
  { key: "buupp", label: "BUUPP", mode: "light", colors: ["#7C5CFF", "#5B3FE0"] as const },
  { key: "sombre", label: "Sombre", mode: "dark", colors: ["#1A2238", "#0A1628"] as const },
  { key: "forest", label: "Forest", mode: "forest", colors: ["#2F8D5B", "#1D6B42"] as const },
  { key: "fushia", label: "Light Fushia", mode: "fushia", colors: ["#F25AA0", "#D63B80"] as const },
] as const satisfies readonly {
  key: string;
  label: string;
  mode: ThemeMode;
  colors: readonly [string, string];
}[];

type ThemeKey = (typeof THEMES)[number]["key"];

function ThemeSwatch({
  label,
  colors,
  selected,
  onPress,
}: {
  label: string;
  colors: readonly [string, string];
  selected: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Thème ${label}`}
      style={{ width: "48%", marginBottom: 11 }}
      className="active:opacity-80"
    >
      <View
        style={{
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1.5,
          borderColor: selected ? c.accent : c.borderSoft,
          ...(selected
            ? {
                shadowColor: c.accent,
                shadowOpacity: 0.2,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: 4,
              }
            : {
                shadowColor: "#000000",
                shadowOpacity: 0.04,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 1,
              }),
        }}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={{ height: 64 }}
        />
        <View
          className="flex-row items-center justify-between"
          style={{ paddingHorizontal: 12, paddingVertical: 9, backgroundColor: c.surface }}
        >
          <Text style={{ fontSize: 13.5, fontWeight: "600", color: c.text }}>
            {label}
          </Text>
          {selected ? (
            <View
              className="items-center justify-center"
              style={{ width: 20, height: 20, borderRadius: 999, backgroundColor: c.accent }}
            >
              <Ionicons name="checkmark" size={13} color={c.btnText} />
            </View>
          ) : (
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: c.ink5,
              }}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}

export function ThemePicker() {
  const { mode, setMode } = useTheme();
  const selected: ThemeKey =
    THEMES.find((t) => t.mode === mode)?.key ?? "buupp";
  return (
    <View className="flex-row flex-wrap justify-between" style={{ marginTop: 16 }}>
      {THEMES.map((t) => (
        <ThemeSwatch
          key={t.key}
          label={t.label}
          colors={t.colors}
          selected={selected === t.key}
          onPress={() => setMode(t.mode)}
        />
      ))}
    </View>
  );
}
