// Réglages pro — notifications, mode d'affichage (thèmes), langue et
// divers. Cartes Notifications / Langue / Général alignées pixel sur les
// réglages prospect (reg.html). Le mode d'affichage est RÉEL (ThemeProvider,
// persté SecureStore) ; les toggles notifications/général restent un
// brouillon local non persté.
import { Ionicons } from "@expo/vector-icons";
import { type ReactNode, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ScrollScreen, SectionTitle } from "../../components/screen";
import { ThemePicker } from "../../components/theme-picker";
import { useTheme, type Palette } from "../../lib/theme";

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
        backgroundColor: value ? c.accent : isDark ? c.ink5 : "#D8D1C0",
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

export default function ProReglages() {
  const { c } = useTheme();
  // États locaux (brouillon — non persistés / non appliqués), SAUF le mode
  // d'affichage (thème) qui est RÉEL (ThemeProvider, persté SecureStore).
  const [pushAll, setPushAll] = useState(true);
  const [notifRelations, setNotifRelations] = useState(true);
  const [notifFlash, setNotifFlash] = useState(true);
  const [notifGains, setNotifGains] = useState(true);
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [haptics, setHaptics] = useState(true);

  return (
    <ScrollScreen headerVariant="pro">
      <SectionTitle
        eyebrow="Réglages"
        title="Préférences"
        desc="Notifications, apparence et préférences de l'application."
      />

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
        <ThemePicker />
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
        Version préliminaire — l&apos;enregistrement des réglages
        notifications / général sera branché prochainement.
      </Text>
    </ScrollScreen>
  );
}
