// Réglages pro — notifications (permission OS, components/push-settings)
// et mode d'affichage (thèmes, persisté SecureStore).
import { Ionicons } from "@expo/vector-icons";
import { type ReactNode } from "react";
import { Text, View } from "react-native";

import { PushSettings } from "../../components/push-settings";
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

export default function ProReglages() {
  const { c } = useTheme();

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
        <ThemePicker />
      </SettingsCard>



    </ScrollScreen>
  );
}
