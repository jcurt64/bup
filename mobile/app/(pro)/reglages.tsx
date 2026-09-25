// Réglages pro — notifications (permission OS, components/push-settings)
// et mode d'affichage (thèmes, persisté SecureStore).
import { Ionicons } from "@expo/vector-icons";
import { type ReactNode } from "react";
import { Text } from "react-native";

import { FunCard } from "../../components/fun-card";
import { PushSettings } from "../../components/push-settings";
import { ScrollScreen, SectionTitle } from "../../components/screen";
import { ThemePicker } from "../../components/theme-picker";
import { useTheme } from "../../lib/theme";

// Carte de section : style « fun » partagé (FunCard) + titre + desc.
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
