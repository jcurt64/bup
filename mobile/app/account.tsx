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

// Ordre + icônes + couleur d'accent par lien. Chaque pastille a sa
// propre teinte (icône + fond pastel) pour différencier visuellement
// les rubriques sans peser sur la hiérarchie générale.
const LINKS: {
  slug: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Couleur de l'icône (fond = même teinte à 16 % d'opacité). */
  color: string;
  /** Override du titre serveur si besoin (sinon on prend `title` du registre). */
  labelOverride?: string;
}[] = [
  { slug: "cgu", icon: "reader-outline", color: "#7C5CFC" }, // violet
  { slug: "cgv", icon: "receipt-outline", color: "#FF7A6B" }, // coral
  { slug: "rgpd", icon: "shield-checkmark-outline", color: "#2FB8A6", labelOverride: "Politique des données personnelles" }, // teal
  { slug: "cookies", icon: "cafe-outline", color: "#F2B65A", labelOverride: "Politique des cookies" }, // amber
  { slug: "contact-dpo", icon: "mail-outline", color: "#5B8DEF", labelOverride: "Contact DPO" }, // sky
  { slug: "bareme", icon: "bar-chart-outline", color: "#16A34A", labelOverride: "Barème des paliers" }, // good
  { slug: "minimisation", icon: "funnel-outline", color: "#B45309", labelOverride: "Minimisation" }, // gold
  { slug: "aide", icon: "book-outline", color: "#5B3FD6", labelOverride: "Documentation" }, // violet-deep
];

// Mixe un hex `#RRGGBB` avec du blanc à `mix` % pour obtenir un fond
// pastel discret (équivalent CSS `color-mix(white, color, mix%)`).
function softBg(hex: string, mix = 0.16): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${mix})`;
}

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
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  version?: string;
  date?: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3.5 active:opacity-80"
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: softBg(color) }}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View className="flex-1">
        <Text className="text-[15px] text-ink" numberOfLines={1}>
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
      <Ionicons name="chevron-forward" size={18} color="#B7BCC7" />
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
          Informations utiles
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
                  color={l.color}
                  version={meta?.version}
                  date={meta?.date}
                  onPress={() => openWeb(meta?.href ?? `/${l.slug}`)}
                />
              );
            })
          )}
        </View>

        {/* Séparateur visuel */}
        <View className="my-2 h-px bg-line" />

        {/* Bloc « Suppression définitive » — parité visuelle DeleteAccountModal
            web (Prospect.jsx) : bordure rouge épaisse en haut, badge `!` rond,
            encart rouge sur la perte des BUUPP coins, tip ambre sur le retrait
            préalable des gains, bouton danger plein largeur. */}
        <View
          className="rounded-2xl bg-paper"
          style={{
            borderTopWidth: 4,
            borderTopColor: "#DC2626",
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderBottomWidth: 1,
            borderLeftColor: "#E6E3DA",
            borderRightColor: "#E6E3DA",
            borderBottomColor: "#E6E3DA",
            padding: 18,
            gap: 14,
          }}
        >
          {/* En-tête : badge rond `!` + titre rouge centrés */}
          <View className="items-center">
            <View
              className="mb-2.5 h-14 w-14 items-center justify-center rounded-full"
              style={{
                backgroundColor: "#FEF2F2",
                borderWidth: 1,
                borderColor: "#FCA5A5",
              }}
            >
              <Ionicons name="alert" size={28} color="#DC2626" />
            </View>
            <Text
              className="font-serif text-[20px] leading-6"
              style={{ color: "#991B1B" }}
            >
              Suppression définitive du compte
            </Text>
            <Text className="mt-1 text-[12.5px] text-ink-2">
              Cette action est <Text className="font-semibold">irréversible</Text>.
            </Text>
          </View>

          {/* Encart rouge : pertes encourues (BUUPP coins) */}
          <View
            className="rounded-xl"
            style={{
              backgroundColor: "#FEF2F2",
              borderLeftWidth: 3,
              borderLeftColor: "#DC2626",
              borderWidth: 1,
              borderColor: "#FCA5A5",
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <Text
              className="text-[13.5px] leading-5"
              style={{ color: "#991B1B" }}
            >
              En supprimant définitivement votre compte, vous effacerez{" "}
              <Text className="font-semibold">
                toutes vos données personnelles
              </Text>{" "}
              et perdrez{" "}
              <Text className="font-semibold">
                définitivement le solde de vos BUUPP coins
              </Text>
              . Vous ne pourrez pas les récupérer, même en recréant un nouveau
              compte avec les mêmes identifiants.
            </Text>
          </View>

          {/* Tip ambre : retirer ses gains d'abord */}
          <View
            className="flex-row gap-2 rounded-xl"
            style={{
              backgroundColor: "#FEF6E7",
              borderWidth: 1,
              borderColor: "#F5C57A",
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Ionicons name="warning-outline" size={16} color="#92400E" />
            <Text
              className="flex-1 text-[12.5px] leading-5"
              style={{ color: "#92400E" }}
            >
              <Text className="font-semibold">Avant de continuer :</Text>{" "}
              pensez à récupérer vos gains — une fois supprimé, votre solde ne
              pourra pas être versé.
            </Text>
          </View>

          {/* Bouton plein rouge */}
          <Pressable
            disabled={busy}
            onPress={confirmDelete}
            accessibilityRole="button"
            accessibilityLabel="Supprimer définitivement mon compte"
            className="flex-row items-center justify-center gap-2 rounded-full py-3.5 active:opacity-80"
            style={{ backgroundColor: busy ? "#FCA5A5" : "#DC2626" }}
          >
            <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
            <Text className="text-sm font-semibold text-paper">
              {busy ? "Suppression…" : "Supprimer définitivement mon compte"}
            </Text>
          </Pressable>
        </View>

        <Text className="mt-2 px-1 text-center text-[11px] leading-4 text-ink-4">
          Pour toute question préalable, contactez le DPO via le lien
          « Contact DPO » ci-dessus.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
