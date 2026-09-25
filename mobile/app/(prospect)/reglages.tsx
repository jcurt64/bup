// Réglages — réglages de l'application (aligné pixel sur reg.html).
// Notifications et mode d'affichage (thèmes).
// Le mode d'affichage (BUUPP / Sombre / Forest / Light Fushia) est persisté
// via expo-secure-store ; les notifications suivent la permission OS
// (components/push-settings).
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { FunCard } from "../../components/fun-card";
import { PushSettings } from "../../components/push-settings";
import { ScrollScreen } from "../../components/screen";
import { useTheme, type ThemeMode } from "../../lib/theme";
import { HERO_GRADIENT } from "../../lib/pro-theme";

// Thèmes d'affichage — dégradé d'aperçu (≈ diagonal) aligné reg.html.
// `mode` = mode réel du ThemeProvider appliqué quand on sélectionne la
// vignette. « BUUPP » est le thème clair par défaut.
const THEMES = [
  { key: "buupp", label: "BUUPP", mode: "light", colors: ["#7C5CFF", "#5B3FE0"] as const },
  { key: "sombre", label: "Sombre", mode: "dark", colors: ["#1A2238", "#0A1628"] as const },
  { key: "forest", label: "Forest", mode: "forest", colors: ["#2F8D5B", "#1D6B42"] as const },
  { key: "fushia", label: "Light Fushia", mode: "fushia", colors: ["#F25AA0", "#D63B80"] as const },
] as const satisfies readonly { key: string; label: string; mode: ThemeMode; colors: readonly [string, string] }[];

type ThemeKey = (typeof THEMES)[number]["key"];

// Carte de section : même style « fun » que Préférences (FunCard) —
// pastille icône dégradée, titre Fraunces, description, contenu.
function SettingsCard({
  iconBg,
  icon,
  iconColor,
  title,
  desc,
  children,
}: {
  iconBg: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  desc?: string;
  children?: ReactNode;
}) {
  const { c } = useTheme();
  return (
    <FunCard iconBg={iconBg} icon={icon} iconColor={iconColor}>
      <Text
        className="font-serif"
        style={{ fontSize: 21, color: c.text, marginTop: 15 }}
      >
        {title}
      </Text>
      {desc ? (
        <Text
          style={{ fontSize: 13, lineHeight: 19, color: c.textSub, marginTop: 7 }}
        >
          {desc}
        </Text>
      ) : null}
      {children}
    </FunCard>
  );
}

// Aperçu de thème sélectionnable (reg.html) : bandeau dégradé 64 px +
// pied (nom + indicateur). Sélectionné = bordure violette + ombre violette.
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

export default function Reglages() {
  const { c, mode, setMode } = useTheme();
  // Vignette sélectionnée = celle dont le `mode` correspond au thème actif.
  const selectedTheme: ThemeKey =
    THEMES.find((t) => t.mode === mode)?.key ?? "buupp";

  const pickTheme = (m: ThemeMode) => setMode(m);

  return (
    <ScrollScreen>
      {/* Hero — card gradient thémé (reg.html). */}
      <LinearGradient
        colors={HERO_GRADIENT[mode]}
        locations={[0, 0.6, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.85 }}
        style={{
          borderRadius: 22,
          padding: 22,
          shadowColor: "#5B3FE0",
          shadowOpacity: 0.26,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: 14 },
          elevation: 6,
        }}
      >
        <Text
          className="text-[11px] font-bold uppercase text-white/70"
          style={{ letterSpacing: 1.6 }}
        >
          Réglages
        </Text>
        <Text
          className="font-serif text-white"
          style={{ fontSize: 25, lineHeight: 28, marginTop: 4 }}
        >
          Personnalisez votre espace
        </Text>
        <Text className="mt-2 text-[14px] leading-5 text-white/80">
          Notifications, apparence et préférences de l&apos;application.
        </Text>
      </LinearGradient>

      {/* ── Notifications ─────────────────────────────────────────────── */}
      <SettingsCard
        iconBg={c.tintAmber}
        icon="notifications-outline"
        iconColor={c.accAmber}
        title="Notifications"
        desc="Choisissez ce pour quoi vous souhaitez être alerté."
      >
        <PushSettings />
      </SettingsCard>

      {/* ── Mode d'affichage (thèmes) ─────────────────────────────────── */}
      <SettingsCard
        iconBg={c.tintViolet}
        icon="color-palette-outline"
        iconColor={c.accVioletDeep}
        title="Mode d'affichage"
        desc="Choisissez l'apparence de l'application."
      >
        <View
          className="flex-row flex-wrap justify-between"
          style={{ marginTop: 16 }}
        >
          {THEMES.map((t) => (
            <ThemeSwatch
              key={t.key}
              label={t.label}
              colors={t.colors}
              selected={selectedTheme === t.key}
              onPress={() => pickTheme(t.mode)}
            />
          ))}
        </View>
      </SettingsCard>



    </ScrollScreen>
  );
}
