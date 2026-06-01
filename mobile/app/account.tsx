// Page « Mon compte » — ouverte au clic sur l'icône hamburger du header.
// Slide-from-right (animation par défaut Stack). Liste les liens
// légaux + ressources (avec versionning live depuis /api/page-versions)
// puis l'action danger « Suppression du compte ».
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as Application from "expo-application";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BottomSheet } from "../components/bottom-sheet";
import { GridBg } from "../components/grid-bg";
import { BuuppLoader } from "../components/loader";
import { unregisterPushToken } from "../lib/push";
import { useApi } from "../lib/api";
import { useDeleteAccount, usePageVersions } from "../lib/queries";
import { useTheme } from "../lib/theme";

const WEB_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://buupp.com";

// Ajoute le marqueur `?from=mobile-app` à un href web : la RouteNav
// (pastille flottante du bas) et autres éléments « web-only » s'auto-
// masquent côté serveur quand ce flag est présent (persisté ensuite
// en localStorage pour les navigations internes au in-app browser).
function withMobileAppFlag(href: string): string {
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}from=mobile-app`;
}

// Ordre + icônes + couleur d'accent par lien. Chaque pastille a sa
// propre teinte (icône + fond pastel) pour différencier visuellement
// les rubriques sans peser sur la hiérarchie générale.
const LINKS: {
  slug: string;
  /** Glyphe Ionicons (`icon`) OU emoji texte (`emoji`). L'emoji est
   *  privilégié pour les pictos qui n'ont pas d'équivalent Ionicons
   *  satisfaisant (ex. cookies → 🍪, parité visuelle avec l'icône
   *  custom SVG du site web). */
  icon?: keyof typeof Ionicons.glyphMap;
  emoji?: string;
  /** Couleur de l'icône (fond = même teinte à 16 % d'opacité). */
  color: string;
  /** Override du titre serveur si besoin (sinon on prend `title` du registre). */
  labelOverride?: string;
}[] = [
  { slug: "cgu", icon: "reader-outline", color: "#7C5CFC" }, // violet
  { slug: "cgv", icon: "receipt-outline", color: "#FF7A6B" }, // coral
  { slug: "rgpd", icon: "shield-checkmark-outline", color: "#2FB8A6", labelOverride: "Politique des données personnelles" }, // teal
  { slug: "cookies", emoji: "🍪", color: "#F2B65A", labelOverride: "Politique des cookies" }, // amber
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

// Ombre douce des tuiles d'icône blanches (carré arrondi) — parité
// redesign.png : tuile blanche détachée sur la carte ivoire.
const TILE_SHADOW = {
  shadowColor: "#0F1629",
  shadowOpacity: 0.06,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

// "21/05/2026" — date courte fr-FR depuis un ISO "YYYY-MM-DD".
function fmtDateShort(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function Row({
  icon,
  emoji,
  label,
  version,
  date,
  color,
  danger,
  onPress,
  disabled,
}: {
  /** Ionicons glyph (mutuellement exclusif avec `emoji`). */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Emoji texte rendu dans la pastille (utilisé quand aucun Ionicons
   *  ne correspond — ex. 🍪 pour les cookies). */
  emoji?: string;
  label: string;
  version?: string;
  date?: string;
  color: string;
  danger?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { c } = useTheme();
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
      <View
        className="h-11 w-11 items-center justify-center rounded-xl border border-line bg-paper"
        style={TILE_SHADOW}
      >
        {emoji ? (
          <Text style={{ fontSize: 18, lineHeight: 22 }}>{emoji}</Text>
        ) : icon ? (
          <Ionicons name={icon} size={18} color={color} />
        ) : null}
      </View>
      <View className="flex-1 items-center px-1">
        <Text
          className={`text-center text-[15px] font-semibold ${danger ? "text-bad" : "text-ink"}`}
          numberOfLines={2}
        >
          {label}
        </Text>
        {version || date ? (
          <View className="mt-1 flex-row items-center gap-2">
            {version ? (
              <View
                className="rounded-full px-2 py-0.5"
                style={{ backgroundColor: softBg(color, 0.18) }}
              >
                <Text
                  className="font-mono text-[10.5px] font-bold"
                  style={{ color }}
                >
                  v{version}
                </Text>
              </View>
            ) : null}
            {date ? (
              <Text className="font-mono text-[11px] text-ink-4">
                {fmtDateShort(date)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.ink5} />
    </Pressable>
  );
}

export default function AccountPage() {
  const { c, isDark } = useTheme();
  const { signOut, getToken } = useAuth();
  const api = useApi();
  const versions = usePageVersions();
  const del = useDeleteAccount();
  const [busy, setBusy] = useState(false);
  // Sheet d'avertissement renforcée affichée au clic sur la Row
  // « Suppression du compte ». Ne pas confondre avec l'Alert natif
  // qui sert de confirmation finale juste avant le DELETE.
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);

  // Diagnostic push — lit /api/me/push-status au mount pour afficher le
  // nombre de devices enregistrés. `null` = chargement en cours.
  const [pushTokensCount, setPushTokensCount] = useState<number | null>(null);
  const [pushBusy, setPushBusy] = useState<"classic" | "flash" | null>(null);

  useEffect(() => {
    api<{ tokens: Array<unknown> }>("/api/me/push-status")
      .then((d) => setPushTokensCount(d.tokens?.length ?? 0))
      .catch(() => setPushTokensCount(0));
  }, [api]);

  async function sendTestPush(kind: "classic" | "flash") {
    setPushBusy(kind);
    try {
      const res = await api<{
        sent: number;
        tokens: number;
        reason?: string;
      }>("/api/me/push-test", {
        method: "POST",
        body: JSON.stringify({ kind }),
      });
      if (res.reason === "no_tokens_registered") {
        Alert.alert(
          "Aucun appareil enregistré",
          "Activez les notifications dans les réglages de l'OS, puis rouvrez l'app pour enregistrer ce device.",
        );
      } else {
        Alert.alert(
          "Push envoyé",
          `${res.sent} notification${res.sent > 1 ? "s" : ""} envoyée${res.sent > 1 ? "s" : ""} à ${res.tokens} appareil${res.tokens > 1 ? "s" : ""}. Vous devriez la recevoir d'ici quelques secondes.`,
        );
      }
    } catch {
      Alert.alert(
        "Échec",
        "Impossible d'envoyer le push de test. Vérifiez votre connexion et réessayez.",
      );
    } finally {
      setPushBusy(null);
    }
  }

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
    void WebBrowser.openBrowserAsync(`${WEB_BASE}${withMobileAppFlag(href)}`);
  }

  async function doDelete() {
    setBusy(true);
    try {
      await del.mutateAsync();
      await unregisterPushToken(getToken).catch(() => {});
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
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </Pressable>
        <Text className="flex-1 text-center font-serif-bold text-2xl text-ink">
          Informations utiles
        </Text>
        {/* Espaceur symétrique au bouton retour pour centrer le titre. */}
        <View className="h-10 w-10" />
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
              <BuuppLoader />
            </View>
          ) : (
            LINKS.map((l) => {
              const meta = items[l.slug];
              const label = l.labelOverride ?? meta?.title ?? l.slug;
              return (
                <Row
                  key={l.slug}
                  icon={l.icon}
                  emoji={l.emoji}
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

        {/* Diagnostic push — bloc support : combien de devices enregistrés
            + boutons pour déclencher un push de test (classique / flash).
            Lit /api/me/push-status au mount, déclenche /api/me/push-test. */}
        <View className="my-2 h-px bg-line" />
        <View className="gap-2">
          <Text
            className="font-mono text-[11px] uppercase text-ink-4"
            style={{ letterSpacing: 1.2 }}
          >
            Notifications push
          </Text>
          <View className="gap-3 rounded-2xl border border-line bg-paper p-3">
            <View className="flex-row items-center gap-3">
              <View
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(124, 92, 252, 0.16)" }}
              >
                <Ionicons
                  name="notifications-outline"
                  size={18}
                  color="#7C5CFC"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] text-ink">
                  {pushTokensCount === null
                    ? "Vérification…"
                    : pushTokensCount > 0
                      ? `${pushTokensCount} appareil${pushTokensCount > 1 ? "s" : ""} enregistré${pushTokensCount > 1 ? "s" : ""}`
                      : "Aucun appareil enregistré"}
                </Text>
                <Text className="mt-0.5 text-[12px] leading-4 text-ink-4">
                  Envoyez une notification de test pour vérifier que
                  votre device la reçoit bien.
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => sendTestPush("classic")}
                disabled={pushBusy !== null || pushTokensCount === 0}
                className="flex-1 items-center rounded-full bg-ink py-2.5 active:opacity-80"
                style={{
                  opacity:
                    pushBusy !== null || pushTokensCount === 0 ? 0.5 : 1,
                }}
              >
                <Text className="text-[13px] font-semibold text-paper">
                  {pushBusy === "classic" ? "Envoi…" : "Test classique"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => sendTestPush("flash")}
                disabled={pushBusy !== null || pushTokensCount === 0}
                className="flex-1 items-center rounded-full border border-line bg-paper py-2.5 active:opacity-70"
                style={{
                  opacity:
                    pushBusy !== null || pushTokensCount === 0 ? 0.5 : 1,
                }}
              >
                <Text className="text-[13px] font-medium text-ink">
                  {pushBusy === "flash" ? "Envoi…" : "Test flash"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Séparateur visuel + Row danger discrète. Le bloc d'avertissement
            renforcé n'apparaît qu'à l'ouverture du BottomSheet ci-dessous. */}
        <View className="my-2 h-px bg-line" />

        <Row
          icon="trash-outline"
          label="Suppression du compte"
          color={c.bad}
          danger
          onPress={() => setShowDeleteSheet(true)}
        />

        <Text className="mt-2 text-center text-[15px] text-ink-4">
          Version de l&apos;application {Application.nativeApplicationVersion ?? "1.0.0"}
        </Text>
      </ScrollView>

      {/* Sheet avertissement renforcée — affichée seulement au clic sur la Row */}
      <BottomSheet
        visible={showDeleteSheet}
        onClose={() => (busy ? undefined : setShowDeleteSheet(false))}
        heightPct={75}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 14, paddingBottom: 12 }}
        >
          {/* En-tête : badge rond `!` + titre rouge centrés */}
          <View className="items-center">
            <View
              className="mb-2.5 h-14 w-14 items-center justify-center rounded-full"
              style={{
                backgroundColor: isDark ? c.badSoft : "#FEF2F2",
                borderWidth: 1,
                borderColor: isDark ? c.bad : "#FCA5A5",
              }}
            >
              <Ionicons name="alert" size={28} color={c.bad} />
            </View>
            <Text
              className="font-serif text-[20px] leading-6"
              style={{ color: isDark ? c.bad : "#991B1B" }}
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
              backgroundColor: isDark ? c.badSoft : "#FEF2F2",
              borderLeftWidth: 3,
              borderLeftColor: c.bad,
              borderWidth: 1,
              borderColor: isDark ? c.bad : "#FCA5A5",
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <Text
              className="text-[13.5px] leading-5"
              style={{ color: isDark ? c.bad : "#991B1B" }}
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
              backgroundColor: isDark ? c.tintAmber : "#FEF6E7",
              borderWidth: 1,
              borderColor: isDark ? c.warn : "#F5C57A",
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Ionicons name="warning-outline" size={16} color={isDark ? c.gold : "#92400E"} />
            <Text
              className="flex-1 text-[12.5px] leading-5"
              style={{ color: isDark ? c.gold : "#92400E" }}
            >
              <Text className="font-semibold">Avant de continuer :</Text>{" "}
              pensez à récupérer vos gains — une fois supprimé, votre solde ne
              pourra pas être versé.
            </Text>
          </View>

          {/* Actions : Annuler (ghost) + Supprimer (plein rouge) */}
          <View className="mt-1 flex-row gap-3">
            <Pressable
              disabled={busy}
              onPress={() => setShowDeleteSheet(false)}
              className="flex-1 items-center rounded-full border border-line bg-paper py-3.5 active:opacity-70"
            >
              <Text className="text-sm font-medium text-ink-3">Annuler</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={confirmDelete}
              accessibilityRole="button"
              accessibilityLabel="Supprimer définitivement mon compte"
              className="flex-1 flex-row items-center justify-center gap-2 rounded-full py-3.5 active:opacity-80"
              style={{ backgroundColor: busy ? "#FCA5A5" : "#DC2626" }}
            >
              <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
              <Text className="text-sm font-semibold text-white">
                {busy ? "Suppression…" : "Supprimer"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}
