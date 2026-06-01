// Réglages — réglages de l'application (aligné pixel sur reg.html).
// Notifications, mode d'affichage (thèmes), langue et divers.
// Le mode d'affichage « Clair » / « Sombre » est RÉEL (branché sur le
// ThemeProvider, persté via expo-secure-store). Les autres thèmes et les
// toggles notifications/général restent un brouillon local non persté.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ScrollScreen } from "../../components/screen";
import { useTheme, type Palette } from "../../lib/theme";

const VIOLET = "#7C5CFF";

// Thèmes d'affichage — dégradé d'aperçu (≈ diagonal) aligné reg.html.
const THEMES = [
  { key: "buupp", label: "BUUPP", colors: ["#7C5CFF", "#5B3FE0"] as const },
  { key: "clair", label: "Clair", colors: ["#FBF9F4", "#ECE7D9"] as const },
  { key: "sombre", label: "Sombre", colors: ["#1A2238", "#0A1628"] as const },
  { key: "forest", label: "Forest", colors: ["#2F8D5B", "#1D6B42"] as const },
  { key: "bluelight", label: "Blue light", colors: ["#7DB4F0", "#3F7FD6"] as const },
  { key: "fushia", label: "Fushia", colors: ["#F25AA0", "#D63B80"] as const },
] as const;

type ThemeKey = (typeof THEMES)[number]["key"];

function cardStyle(c: Palette) {
  return {
    backgroundColor: c.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  } as const;
}

// Carte de section : tuile icône (42) + titre Fraunces + desc + contenu.
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
    <View style={cardStyle(c)}>
      <View
        className="items-center justify-center"
        style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: iconBg }}
      >
        <Ionicons name={icon} size={21} color={iconColor} />
      </View>
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
    </View>
  );
}

// Toggle pill 52×30 (reg.html) — violet ON, neutre OFF, knob 24 qui glisse.
function Toggle({
  value,
  onValueChange,
  disabled,
  label,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  const { c, isDark } = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      style={{
        width: 52,
        height: 30,
        borderRadius: 999,
        backgroundColor: value ? VIOLET : isDark ? c.ink5 : "#D8D1C0",
        flexShrink: 0,
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 3,
          left: value ? 25 : 3,
          width: 24,
          height: 24,
          borderRadius: 999,
          backgroundColor: "#FFFFFF",
          shadowColor: "#000000",
          shadowOpacity: 0.22,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        }}
      />
    </Pressable>
  );
}

// Ligne « tuile icône + titre + sous-titre + toggle ». Filet bas sauf
// dernière ligne (`last`).
function SettingRow({
  iconBg,
  icon,
  iconColor,
  title,
  desc,
  value,
  onValueChange,
  disabled,
  last,
}: {
  iconBg: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  desc?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View
      className="flex-row items-center"
      style={{
        gap: 13,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.track,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <View
        className="items-center justify-center"
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          backgroundColor: iconBg,
          flexShrink: 0,
        }}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          className="font-serif"
          style={{ fontSize: 16.5, color: c.text, lineHeight: 19 }}
        >
          {title}
        </Text>
        {desc ? (
          <Text
            style={{ fontSize: 12.5, color: c.textSub, marginTop: 2, lineHeight: 17 }}
          >
            {desc}
          </Text>
        ) : null}
      </View>
      <Toggle
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        label={title}
      />
    </View>
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
          borderColor: selected ? VIOLET : c.borderSoft,
          ...(selected
            ? {
                shadowColor: VIOLET,
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
              style={{ width: 20, height: 20, borderRadius: 999, backgroundColor: VIOLET }}
            >
              <Ionicons name="checkmark" size={13} color="#FFFFFF" />
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
  const { c, isDark, setMode } = useTheme();
  // États locaux (brouillon — non persistés / non appliqués), SAUF le mode
  // clair/sombre qui est réel (ThemeProvider).
  const [pushAll, setPushAll] = useState(true);
  const [notifRelations, setNotifRelations] = useState(true);
  const [notifFlash, setNotifFlash] = useState(true);
  const [notifGains, setNotifGains] = useState(true);
  // Sélection visuelle : « sombre » si le thème sombre est actif, sinon le
  // dernier choix local (défaut « BUUPP »).
  const [lightChoice, setLightChoice] = useState<ThemeKey>("buupp");
  const selectedTheme: ThemeKey = isDark ? "sombre" : lightChoice;
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [haptics, setHaptics] = useState(true);

  const pickTheme = (key: ThemeKey) => {
    if (key === "sombre") {
      setMode("dark");
    } else {
      setLightChoice(key);
      setMode("light");
    }
  };

  return (
    <ScrollScreen>
      {/* Hero — card gradient violet (reg.html). */}
      <LinearGradient
        colors={["#5B3FE0", "#7C5CFF", "#8A6BFF"]}
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
        <View style={{ marginTop: 6 }}>
          <SettingRow
            iconBg={c.tintAmber}
            icon="notifications"
            iconColor={c.accAmber}
            title="Notifications push"
            desc="Activer ou couper toutes les notifications"
            value={pushAll}
            onValueChange={setPushAll}
          />
          <SettingRow
            iconBg={c.tintCoral}
            icon="people"
            iconColor={c.accCoral}
            title="Mises en relation"
            desc="Quand un professionnel souhaite vous contacter"
            value={notifRelations}
            onValueChange={setNotifRelations}
            disabled={!pushAll}
          />
          <SettingRow
            iconBg={c.tintViolet}
            icon="flash"
            iconColor={c.accVioletDeep}
            title="Flash deals"
            desc="Offres limitées dans le temps"
            value={notifFlash}
            onValueChange={setNotifFlash}
            disabled={!pushAll}
          />
          <SettingRow
            iconBg={c.tintGreen}
            icon="wallet"
            iconColor={c.accGreen}
            title="Gains & retraits"
            desc="Mouvements sur votre portefeuille"
            value={notifGains}
            onValueChange={setNotifGains}
            disabled={!pushAll}
            last
          />
        </View>
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
              onPress={() => pickTheme(t.key)}
            />
          ))}
        </View>
      </SettingsCard>

      {/* ── Langue ────────────────────────────────────────────────────── */}
      <SettingsCard
        iconBg={c.tintBlue}
        icon="language-outline"
        iconColor={c.accBlue}
        title="Langue"
        desc="Langue de l'interface."
      >
        <View
          className="flex-row"
          style={{
            gap: 8,
            marginTop: 16,
            padding: 5,
            borderRadius: 16,
            backgroundColor: c.surface2,
            borderWidth: 1,
            borderColor: c.borderSoft,
          }}
        >
          {[
            { k: "fr" as const, l: "Français" },
            { k: "en" as const, l: "English" },
          ].map((o) => {
            const on = lang === o.k;
            return (
              <Pressable
                key={o.k}
                onPress={() => setLang(o.k)}
                className="flex-1 items-center active:opacity-80"
                style={{
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: on ? c.btnBg : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 14.5,
                    fontWeight: "600",
                    color: on ? c.btnText : c.textSub,
                  }}
                >
                  {o.l}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SettingsCard>

      {/* ── Général / accessibilité ───────────────────────────────────── */}
      <SettingsCard
        iconBg={c.tintCoral}
        icon="options-outline"
        iconColor={c.accCoral}
        title="Général"
      >
        <View style={{ marginTop: 6 }}>
          <SettingRow
            iconBg={c.tintViolet}
            icon="phone-portrait-outline"
            iconColor={c.accVioletDeep}
            title="Retour haptique"
            desc="Vibrations légères lors des interactions"
            value={haptics}
            onValueChange={setHaptics}
          />
          <SettingRow
            iconBg={c.tintGreen}
            icon="accessibility-outline"
            iconColor={c.accGreen}
            title="Animations réduites"
            desc="Limiter les effets de mouvement"
            value={reducedMotion}
            onValueChange={setReducedMotion}
            last
          />
        </View>
      </SettingsCard>

      <Text
        style={{
          marginTop: 4,
          paddingHorizontal: 8,
          textAlign: "center",
          fontSize: 12,
          fontStyle: "italic",
          lineHeight: 18,
          color: c.textMuted,
        }}
      >
        Version préliminaire — l&apos;enregistrement des réglages et
        l&apos;application des thèmes (hors clair / sombre) seront branchés
        prochainement.
      </Text>
    </ScrollScreen>
  );
}
