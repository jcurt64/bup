// Réglages — réglages de l'application (BROUILLON DESIGN). Notifications,
// mode d'affichage (thèmes), langue et divers. Les contrôles sont
// interactifs en local (useState) mais NON persistés et NON câblés à un
// vrai système de thème : à brancher ultérieurement (« on le modifiera
// après »). Aucun appel back-end — purement design.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";

import { Card, ScrollScreen } from "../../components/screen";

// Mélange un hex `#RRGGBB` avec du blanc (alpha) → fond pastel discret.
function softBg(hex: string, mix = 0.16): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${mix})`;
}

// Thèmes d'affichage proposés — l'aperçu est un dégradé représentatif.
const THEMES = [
  { key: "buupp", label: "BUUPP", colors: ["#7C5CFC", "#13235B"] as const },
  { key: "clair", label: "Clair", colors: ["#FFFFFF", "#EFEADD"] as const },
  { key: "sombre", label: "Sombre", colors: ["#1E1646", "#0A0820"] as const },
  { key: "forest", label: "Forest", colors: ["#2E8B57", "#1F5E3A"] as const },
  { key: "bluelight", label: "Blue light", colors: ["#7FB2FF", "#3E6FE0"] as const },
  { key: "fushia", label: "Fushia", colors: ["#FF5CA8", "#C8246B"] as const },
] as const;

type ThemeKey = (typeof THEMES)[number]["key"];

// Ligne « libellé + description + interrupteur ». Séparateur bas sauf
// dernière ligne (`last`).
function ToggleRow({
  icon,
  color,
  title,
  desc,
  value,
  onValueChange,
  disabled,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  desc?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center gap-3 py-3 ${last ? "" : "border-b border-line"}`}
      style={disabled ? { opacity: 0.45 } : undefined}
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: softBg(color) }}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View className="flex-1">
        <Text className="text-[15px] text-ink">{title}</Text>
        {desc ? (
          <Text className="mt-0.5 text-[12px] leading-4 text-ink-4">{desc}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: "#7C5CFC", false: "#D7D3C7" }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="#D7D3C7"
      />
    </View>
  );
}

// Carte d'aperçu de thème sélectionnable (dégradé + libellé + coche).
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Thème ${label}`}
      style={{ width: "48%", marginBottom: 12 }}
      className="active:opacity-80"
    >
      <View
        className="overflow-hidden rounded-2xl"
        style={{
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? "#7C5CFC" : "#E6E3DA",
        }}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ height: 54 }}
        />
        <View className="flex-row items-center justify-between bg-paper px-3 py-2">
          <Text
            className={`text-[13px] ${selected ? "font-semibold text-ink" : "text-ink-3"}`}
          >
            {label}
          </Text>
          {selected ? (
            <Ionicons name="checkmark-circle" size={16} color="#7C5CFC" />
          ) : (
            <View className="h-4 w-4 rounded-full border border-line" />
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function Reglages() {
  // États locaux (brouillon — non persistés / non appliqués).
  const [pushAll, setPushAll] = useState(true);
  const [notifRelations, setNotifRelations] = useState(true);
  const [notifFlash, setNotifFlash] = useState(true);
  const [notifGains, setNotifGains] = useState(true);
  // Défaut = thème signature de l'application (BUUPP).
  const [theme, setTheme] = useState<ThemeKey>("buupp");
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [haptics, setHaptics] = useState(true);

  return (
    <ScrollScreen
      hero={{
        eyebrow: "Réglages",
        title: "Personnalisez votre espace",
        desc: "Notifications, apparence et préférences de l'application.",
      }}
    >
      {/* ── Notifications ─────────────────────────────────────────────── */}
      <Card className="gap-1" badge={{ icon: "notifications-outline", tone: "amber" }}>
        <Text className="font-serif text-lg text-ink">Notifications</Text>
        <Text className="text-xs text-ink-4">
          Choisissez ce pour quoi vous souhaitez être alerté.
        </Text>
        <View className="mt-1">
          <ToggleRow
            icon="notifications"
            color="#F2B65A"
            title="Notifications push"
            desc="Activer ou couper toutes les notifications"
            value={pushAll}
            onValueChange={setPushAll}
          />
          <ToggleRow
            icon="people"
            color="#FF7A6B"
            title="Mises en relation"
            desc="Quand un professionnel souhaite vous contacter"
            value={notifRelations}
            onValueChange={setNotifRelations}
            disabled={!pushAll}
          />
          <ToggleRow
            icon="flash"
            color="#7C5CFC"
            title="Flash deals"
            desc="Offres limitées dans le temps"
            value={notifFlash}
            onValueChange={setNotifFlash}
            disabled={!pushAll}
          />
          <ToggleRow
            icon="wallet"
            color="#2FB8A6"
            title="Gains & retraits"
            desc="Mouvements sur votre portefeuille"
            value={notifGains}
            onValueChange={setNotifGains}
            disabled={!pushAll}
            last
          />
        </View>
      </Card>

      {/* ── Mode d'affichage (thèmes) ─────────────────────────────────── */}
      <Card className="gap-1" badge={{ icon: "color-palette-outline", tone: "violet" }}>
        <Text className="font-serif text-lg text-ink">Mode d&apos;affichage</Text>
        <Text className="mb-3 text-xs text-ink-4">
          Choisissez l&apos;apparence de l&apos;application.
        </Text>
        <View className="flex-row flex-wrap justify-between">
          {THEMES.map((t) => (
            <ThemeSwatch
              key={t.key}
              label={t.label}
              colors={t.colors}
              selected={theme === t.key}
              onPress={() => setTheme(t.key)}
            />
          ))}
        </View>
      </Card>

      {/* ── Langue ────────────────────────────────────────────────────── */}
      <Card className="gap-1" badge={{ icon: "language-outline", tone: "sky" }}>
        <Text className="font-serif text-lg text-ink">Langue</Text>
        <Text className="mb-2 text-xs text-ink-4">Langue de l&apos;interface.</Text>
        <View className="flex-row gap-2">
          {[
            { k: "fr" as const, l: "Français" },
            { k: "en" as const, l: "English" },
          ].map((o) => {
            const on = lang === o.k;
            return (
              <Pressable
                key={o.k}
                onPress={() => setLang(o.k)}
                className={`flex-1 items-center rounded-full py-2.5 ${
                  on ? "bg-ink" : "border border-line bg-paper"
                } active:opacity-80`}
              >
                <Text
                  className={`text-sm ${on ? "font-semibold text-paper" : "text-ink-3"}`}
                >
                  {o.l}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* ── Général / accessibilité ───────────────────────────────────── */}
      <Card className="gap-1" badge={{ icon: "options-outline", tone: "coral" }}>
        <Text className="font-serif text-lg text-ink">Général</Text>
        <View className="mt-1">
          <ToggleRow
            icon="phone-portrait-outline"
            color="#5B8DEF"
            title="Retour haptique"
            desc="Vibrations légères lors des interactions"
            value={haptics}
            onValueChange={setHaptics}
          />
          <ToggleRow
            icon="accessibility-outline"
            color="#16A34A"
            title="Animations réduites"
            desc="Limiter les effets de mouvement"
            value={reducedMotion}
            onValueChange={setReducedMotion}
            last
          />
        </View>
      </Card>

      <Text className="px-2 text-center text-[12px] leading-4 text-ink-4">
        Version préliminaire — l&apos;enregistrement des réglages et
        l&apos;application des thèmes seront branchés prochainement.
      </Text>
    </ScrollScreen>
  );
}
