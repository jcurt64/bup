// Page « Mon compte » — ouverte au clic sur l'icône hamburger du header.
// Slide-from-right (animation par défaut Stack). Liste les liens
// légaux + ressources (avec versionning live depuis /api/page-versions)
// puis l'action danger « Suppression du compte ».
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GridBg } from "../components/grid-bg";
import { useDeleteAccount, usePageVersions } from "../lib/queries";

const WEB_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://buupp.com";

// Ordre + icônes des liens affichés (filtre sur les slugs renvoyés par
// /api/page-versions — on n'expose pas accessibilite ni status dans ce
// menu mobile, et `aide` est libellé « Documentation »).
const LINKS: {
  slug: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Override du titre serveur si besoin (sinon on prend `title` du registre). */
  labelOverride?: string;
}[] = [
  { slug: "cgu", icon: "reader-outline" },
  { slug: "cgv", icon: "receipt-outline" },
  { slug: "rgpd", icon: "shield-checkmark-outline", labelOverride: "Politique des données personnelles" },
  { slug: "cookies", icon: "key-outline", labelOverride: "Politique des cookies" },
  { slug: "contact-dpo", icon: "mail-outline", labelOverride: "Contact DPO" },
  { slug: "bareme", icon: "bar-chart-outline", labelOverride: "Barème des paliers" },
  { slug: "minimisation", icon: "funnel-outline", labelOverride: "Minimisation" },
  { slug: "aide", icon: "book-outline", labelOverride: "Documentation" },
];

// "21/05/2026" — date courte fr-FR depuis un ISO "YYYY-MM-DD".
function fmtDateShort(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function Row({
  icon,
  label,
  version,
  date,
  danger,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  version?: string;
  date?: string;
  danger?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const iconColor = danger ? "#DC2626" : "#7C5CFC";
  const iconBg = danger ? "bg-coral-soft" : "bg-violet-soft";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`flex-row items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3.5 active:opacity-80 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <View className={`h-9 w-9 items-center justify-center rounded-full ${iconBg}`}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text
          className={`text-[15px] ${danger ? "text-bad font-semibold" : "text-ink"}`}
          numberOfLines={1}
        >
          {label}
        </Text>
        {version || date ? (
          <Text
            className="mt-0.5 font-mono text-[10.5px] text-ink-4"
            numberOfLines={1}
          >
            {version ? `v${version}` : ""}
            {version && date ? " · " : ""}
            {date ? fmtDateShort(date) : ""}
          </Text>
        ) : null}
      </View>
      {!danger ? (
        <Ionicons name="chevron-forward" size={18} color="#B7BCC7" />
      ) : null}
    </Pressable>
  );
}

export default function AccountPage() {
  const { signOut } = useAuth();
  const versions = usePageVersions();
  const del = useDeleteAccount();
  const [busy, setBusy] = useState(false);

  // Build display rows in the fixed LINKS order, hydrated by /api/page-versions.
  const items = (versions.data?.items ?? []).reduce<Record<string, { title: string; href: string; version: string; date: string }>>(
    (acc, it) => {
      acc[it.slug] = {
        title: it.title,
        href: it.href,
        version: it.version,
        date: it.date,
      };
      return acc;
    },
    {},
  );

  function openWeb(href: string) {
    void WebBrowser.openBrowserAsync(`${WEB_BASE}${href}`);
  }

  async function doDelete() {
    setBusy(true);
    try {
      await del.mutateAsync();
      // Déconnexion Clerk côté client après le DELETE serveur — la row
      // a déjà sauté de Supabase + Clerk a été supprimé via API.
      try {
        await signOut();
      } catch {
        /* ignore — la session Clerk est déjà inopérante */
      }
      router.replace("/(auth)/sign-in");
    } catch {
      setBusy(false);
      Alert.alert(
        "Suppression impossible",
        "Une erreur est survenue. Réessayez ou contactez-nous via le DPO.",
      );
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Supprimer définitivement votre compte ?",
      "Toutes vos données (paliers, mises en relation, gains) seront effacées. Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: doDelete,
        },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ivory" edges={["top", "bottom"]}>
      <GridBg />
      {/* Header — back chevron + titre */}
      <View className="flex-row items-center gap-3 border-b border-line bg-ivory px-4 pb-3 pt-1">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel="Retour"
          className="h-10 w-10 items-center justify-center rounded-full bg-paper active:opacity-70"
        >
          <Ionicons name="chevron-back" size={22} color="#0F1629" />
        </Pressable>
        <Text className="flex-1 font-serif-bold text-2xl text-ink">
          Mon compte
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16 }}
      >
        {/* Légal + Ressources combinés en une seule liste (ordre figé
            par LINKS pour cohérence avec la spec utilisateur). */}
        <View className="gap-2">
          {versions.isPending ? (
            <View className="items-center py-8">
              <ActivityIndicator color="#7C5CFC" />
            </View>
          ) : (
            LINKS.map((l) => {
              const meta = items[l.slug];
              const label = l.labelOverride ?? meta?.title ?? l.slug;
              return (
                <Row
                  key={l.slug}
                  icon={l.icon}
                  label={label}
                  version={meta?.version}
                  date={meta?.date}
                  onPress={() => openWeb(meta?.href ?? `/${l.slug}`)}
                />
              );
            })
          )}
        </View>

        {/* Séparateur visuel + action danger */}
        <View className="my-2 h-px bg-line" />

        <Row
          icon="trash-outline"
          label={busy ? "Suppression…" : "Suppression du compte"}
          danger
          onPress={confirmDelete}
          disabled={busy}
        />

        <Text className="mt-2 px-1 text-center text-[11px] leading-4 text-ink-4">
          La suppression est définitive et efface l'ensemble de vos données
          BUUPP (paliers, mises en relation, gains). Pour toute question
          préalable, contactez le DPO.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
