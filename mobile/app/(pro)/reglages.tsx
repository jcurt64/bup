// Réglages pro — mode d'affichage (thèmes) + accès rapides. Le mode
// d'affichage est RÉEL (ThemeProvider, persté). Design aligné prospect.
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Card, ScrollScreen, SectionTitle } from "../../components/screen";
import { ThemePicker } from "../../components/theme-picker";
import { useTheme } from "../../lib/theme";

const LINKS: {
  label: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}[] = [
  { label: "Mes informations", desc: "Société, SIREN, facturation", icon: "briefcase-outline", route: "/(pro)/informations" },
  { label: "Facturation", desc: "Plan, crédit & factures", icon: "card-outline", route: "/(pro)/facturation" },
  { label: "Analytics", desc: "Performance détaillée", icon: "stats-chart-outline", route: "/(pro)/analytics" },
  { label: "Vos suggestions", desc: "Aidez-nous à progresser", icon: "bulb-outline", route: "/(pro)/suggestions" },
];

export default function ProReglages() {
  const { c } = useTheme();
  return (
    <ScrollScreen headerVariant="pro">
      <SectionTitle
        eyebrow="Réglages"
        title="Préférences"
        desc="Apparence de l'application et accès à votre espace."
      />

      <Card>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <View
            className="items-center justify-center"
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.tintViolet }}
          >
            <Ionicons name="color-palette-outline" size={20} color={c.accVioletDeep} />
          </View>
          <Text className="flex-1 font-serif" style={{ fontSize: 20, color: c.text }}>
            Mode d&apos;affichage
          </Text>
        </View>
        <Text style={{ marginTop: 8, fontSize: 13.5, lineHeight: 21, color: c.textSub }}>
          Choisissez l&apos;apparence de l&apos;application.
        </Text>
        <ThemePicker />
      </Card>

      <View className="gap-2">
        {LINKS.map((l) => (
          <Pressable
            key={l.route}
            onPress={() => router.push(l.route as never)}
            className="flex-row items-center gap-3 rounded-2xl border border-line bg-paper px-3 py-3 active:opacity-70"
          >
            <View
              className="h-11 w-11 items-center justify-center rounded-2xl"
              style={{ backgroundColor: c.tintViolet }}
            >
              <Ionicons name={l.icon} size={20} color={c.accVioletDeep} />
            </View>
            <View className="flex-1">
              <Text className="text-[16px] font-medium text-ink">{l.label}</Text>
              <Text className="mt-0.5 text-[12.5px] text-ink-4">{l.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.ink4} />
          </Pressable>
        ))}
      </View>
    </ScrollScreen>
  );
}
