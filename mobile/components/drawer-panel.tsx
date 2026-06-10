// Panneau du drawer prospect : navigation vers les écrans secondaires +
// Suivez-nous (liens externes) + Déconnexion / Supprimer le compte
// (modales de confirmation, parité web Prospect.jsx).
import { useAuth } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Dimensions, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { unregisterPushToken } from "../lib/push";
import { resetOnboardingSeen } from "../lib/onboarding";
import { useTheme, type ThemeMode } from "../lib/theme";
import {
  useDeleteAccount,
  useMeTyped,
  useProspectScore,
  useProspectVerification,
} from "../lib/queries";

// Dégradé de fond du drawer par thème (diagonal top-left → bottom-right) :
// tous en « contenu clair sur dégradé foncé », seul le dégradé change.
//   • buupp → violet → navy ; forest → vert ; fushia → rose ;
//   • sombre → indigo foncé (contenu clair + sous-titres vers le blanc).
const DRAWER_GRADIENT: Record<ThemeMode, readonly [string, string]> = {
  light: ["#7C5CFC", "#13235B"],
  dark: ["#2A2E4E", "#14192B"],
  forest: ["#2F8D5B", "#103A26"],
  fushia: ["#D63B80", "#7A2350"],
};

// Couleurs du drawer selon le thème : tous partagent le schéma « contenu
// clair sur dégradé foncé », seul le dégradé change.
export function dcolors(mode: ThemeMode) {
  return mode === "dark"
    ? {
        gradient: DRAWER_GRADIENT.dark,
        // Drawer SOMBRE en mode sombre → contenu clair, sous-titres tendant
        // vers le blanc pour une bonne lisibilité sur le fond indigo.
        text: "#ECEEF5",
        sub: "#C9CFDE",
        muted: "#B4BCCE",
        tile: "rgba(255,255,255,0.07)",
        border: "rgba(255,255,255,0.12)",
        ring: "rgba(255,255,255,0.22)",
        avatarTile: "rgba(255,255,255,0.12)",
        avatarIcon: "#FFFFFF",
        amber: "#F2B65A",
        flashPill: "rgba(255,255,255,0.08)",
      }
    : {
        gradient: DRAWER_GRADIENT[mode],
        text: "#FFFFFF",
        // buupp : sous-titres éclaircis (tendant vers le blanc) pour une
        // meilleure lisibilité ; forest/fushia gardent l'opacité d'origine.
        sub: mode === "light" ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.65)",
        muted: mode === "light" ? "rgba(255,255,255,0.68)" : "rgba(255,255,255,0.45)",
        tile: "rgba(255,255,255,0.10)",
        border: "rgba(255,255,255,0.15)",
        ring: "rgba(255,255,255,0.25)",
        avatarTile: "rgba(255,255,255,0.15)",
        avatarIcon: "#FFFFFF",
        amber: "#F2B65A",
        flashPill: "rgba(255,255,255,0.08)",
      };
}

// Libellés + position 1-based des paliers de vérification (parité
// Prospect.jsx / portefeuille.tsx — affichés dans la carte de statut).
const VERIF_LABELS: Record<string, string> = {
  basique: "Basique",
  verifie: "Vérifié",
  certifie_confiance: "Certifié confiance",
};
function verifTierPosition(tier: string | undefined): number {
  if (tier === "verifie") return 2;
  if (tier === "certifie_confiance") return 3;
  return 1;
}
// Couleur destructive « Supprimer mon compte » — orange chaud (parité
// redesign.png, moins alarmant qu'un rouge plein).
export const DANGER = "#F2A24A";

export const SOCIAL = [
  { icon: "logo-facebook" as const, url: "https://www.facebook.com/buupp", label: "Facebook BUUPP" },
  { icon: "logo-instagram" as const, url: "https://www.instagram.com/buupp", label: "Instagram BUUPP" },
  { icon: "logo-tiktok" as const, url: "https://www.tiktok.com/@buupp", label: "TikTok BUUPP" },
];

const NAV: {
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Sous-titre statique (les entrées dynamiques le calculent au rendu). */
  sub?: string;
}[] = [
  { label: "Paliers de vérification", route: "/(prospect)/verification", icon: "shield-checkmark-outline" },
  { label: "BUUPP Score", route: "/(prospect)/score", icon: "speedometer-outline" },
  { label: "Parrainage", route: "/(prospect)/parrainage", icon: "gift-outline", sub: "Invitez, gagnez" },
  { label: "Informations fiscales", route: "/(prospect)/fiscal", icon: "document-text-outline", sub: "Déclaration & reçus" },
  { label: "Vos suggestions", route: "/(prospect)/suggestions", icon: "bulb-outline", sub: "Aidez-nous à progresser" },
];

export function Row({
  icon,
  label,
  sub,
  danger,
  chevron = true,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Sous-titre discret sous le label (parité redesign.png). */
  sub?: string;
  danger?: boolean;
  /** Affiche le chevron « › » à droite (défaut : oui). */
  chevron?: boolean;
  onPress: () => void;
}) {
  const { mode } = useTheme();
  const d = dcolors(mode);
  const color = danger ? DANGER : d.text;
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl px-3 py-3 active:opacity-70"
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-2xl"
        style={{ backgroundColor: d.tile }}
      >
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View className="flex-1">
        <Text className="text-[16px] font-medium" style={{ color }}>
          {label}
        </Text>
        {sub ? (
          <Text className="mt-0.5 text-[12.5px]" style={{ color: d.muted }}>
            {sub}
          </Text>
        ) : null}
      </View>
      {chevron ? (
        <Ionicons name="chevron-forward" size={18} color={d.muted} />
      ) : null}
    </Pressable>
  );
}

// Anneau de score — cercle bordé (pas de react-native-svg dans le projet)
// affichant « {score} / 1000 » en haut à droite du drawer (parité
// redesign.png, sans l'arc de progression).
function ScoreRing({ score }: { score: number | null }) {
  const { mode } = useTheme();
  const d = dcolors(mode);
  return (
    <View
      className="h-14 w-14 items-center justify-center rounded-full"
      style={{ borderWidth: 3, borderColor: d.ring }}
    >
      <Text
        className="font-serif-bold text-base"
        style={{ lineHeight: 18, color: d.text }}
      >
        {score != null ? score : "…"}
      </Text>
      <Text className="font-mono text-[8px]" style={{ color: d.muted }}>
        / 1000
      </Text>
    </View>
  );
}

export default function DrawerPanel() {
  const { mode } = useTheme();
  const d = dcolors(mode);
  const { signOut, getToken } = useAuth();
  const qc = useQueryClient();
  const del = useDeleteAccount();
  // Données lecture seule (aucun back modifié) alimentant la carte de
  // statut + les sous-titres dynamiques de la navigation.
  const me = useMeTyped();
  const verif = useProspectVerification();
  const score = useProspectScore();
  const firstName = me.data?.prenom?.trim() || null;
  const tierLabel = VERIF_LABELS[verif.data?.tier ?? ""] ?? "Basique";
  const tierPos = verifTierPosition(verif.data?.tier);
  const scoreNum = score.data?.score ?? null;
  // FREEBUUPP : entrée de menu affichée seulement si le service est activé
  // (flag exposé par /api/me). Service livré désactivé → masqué par défaut.
  const freebuuppOn =
    (me.data as { freebuuppEnabled?: boolean } | undefined)?.freebuuppEnabled === true;
  const navItems = freebuuppOn
    ? [
        { label: "FREEBUUPP", route: "/(prospect)/freebuupp", icon: "gift-outline" as const, sub: "Tirage au sort" },
        ...NAV,
      ]
    : NAV;
  const navSub = (route: string, fallback?: string) =>
    route.endsWith("verification")
      ? `Niveau ${tierPos} sur 3`
      : route.endsWith("score")
        ? scoreNum != null
          ? `${scoreNum} / 1000`
          : "…"
        : fallback;
  const [confirm, setConfirm] = useState<null | "signout" | "delete">(null);
  const [busy, setBusy] = useState(false);
  const W = Math.min(360, Dimensions.get("window").width * 0.82);
  const tx = useRef(new Animated.Value(-W)).current;
  const scrim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(tx, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(scrim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [tx, scrim]);
  const dismiss = () => {
    Animated.parallel([
      Animated.timing(tx, { toValue: -W, duration: 180, useNativeDriver: true }),
      Animated.timing(scrim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => router.back());
  };
  const go = (route: string) => {
    router.back();
    router.push(route as never);
  };

  async function doSignOut() {
    setBusy(true);
    try {
      await unregisterPushToken(getToken).catch(() => {});
      await signOut();
      qc.clear(); // évite qu'un rôle/données en cache fuitent vers le compte suivant
      router.replace("/(auth)/sign-in");
    } catch {
      setBusy(false);
      Alert.alert("Erreur", "La déconnexion a échoué. Réessayez.");
    }
  }
  async function doDelete() {
    setBusy(true);
    try {
      await del.mutateAsync();
      await unregisterPushToken(getToken).catch(() => {});
      await signOut();
      qc.clear(); // évite qu'un rôle/données en cache fuitent vers le compte suivant
      router.replace("/(auth)/sign-in");
    } catch {
      setBusy(false);
      Alert.alert(
        "Erreur",
        "La suppression du compte a échoué. Réessayez plus tard.",
      );
    }
  }
  // Outil DEV — relance le carrousel d'onboarding : on efface le flag
  // SecureStore puis on signe-out + redirige vers /(onboarding). La
  // déconnexion est nécessaire car le router racine (app/index.tsx) saute
  // l'onboarding pour les comptes signed-in.
  async function doResetOnboarding() {
    setBusy(true);
    try {
      await resetOnboardingSeen();
      await signOut();
      qc.clear(); // évite qu'un rôle/données en cache fuitent vers le compte suivant
      router.replace("/(onboarding)");
    } catch {
      setBusy(false);
      Alert.alert(
        "Erreur",
        "Impossible de réinitialiser l'onboarding.",
      );
    }
  }

  return (
    <View className="flex-1">
      {/* Scrim plein écran SOUS le panneau : les coins arrondis du
          panneau laissent voir cette couche sombre, jamais du blanc
          (fond du modal). Tap = fermeture. */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: scrim,
        }}
      >
        <Pressable className="flex-1 bg-black/50" onPress={dismiss} />
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: W,
          transform: [{ translateX: tx }],
          elevation: 8,
          // Coins droits arrondis XL ; overflow hidden clippe le contenu
          // ET le gradient au radius. Le blanc derrière les coins est
          // masqué par le scrim sombre.
          borderTopRightRadius: 40,
          borderBottomRightRadius: 40,
          overflow: "hidden",
        }}
      >
        {/* Fond gradient violet → navy (mêmes teintes que la pastille
            active de la tab bar et le bouton person du header) en
            absolute-fill derrière le ScrollView. Diagonal top-left →
            bottom-right pour cohérence avec les autres surfaces gradient
            de l'app. */}
        <LinearGradient
          colors={d.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-1.5 px-4 pb-6 pt-16"
        >
          {/* Titre « Mon statut buupper » (2 lignes serif) + anneau de
              score à droite (parité redesign.png). */}
          <View className="flex-row items-start justify-between px-3 pb-3">
            <View>
              <Text
                className="font-serif-bold text-2xl"
                style={{ lineHeight: 28, color: d.text }}
              >
                Mon statut
              </Text>
              <Text
                className="font-serif-italic text-2xl"
                style={{ lineHeight: 28, color: d.text }}
              >
                buupper
              </Text>
            </View>
            <ScoreRing score={scoreNum} />
          </View>

          {/* Carte de statut : avatar + prénom + palier de vérification,
              et pastille « ⚡ {score} » bordée ambre à droite. */}
          <View
            className="mb-3 flex-row items-center gap-3 rounded-2xl px-3 py-3"
            style={{ backgroundColor: d.tile }}
          >
            <View
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: d.avatarTile }}
            >
              <Ionicons name="person-outline" size={20} color={d.avatarIcon} />
            </View>
            <View className="flex-1">
              <Text
                className="text-[15px] font-semibold"
                style={{ color: d.text }}
                numberOfLines={1}
              >
                {firstName ?? "Mon compte"}
              </Text>
              <Text
                className="mt-0.5 text-[12px]"
                style={{ color: d.sub }}
                numberOfLines={1}
              >
                Vérification {tierLabel} · Niveau {tierPos}/3
              </Text>
            </View>
            <View
              className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
              style={{
                borderWidth: 1,
                borderColor: "rgba(242,182,90,0.7)",
                backgroundColor: d.flashPill,
              }}
            >
              <Ionicons name="flash" size={12} color={d.amber} />
              <Text className="text-[13px] font-bold" style={{ color: d.text }}>
                {scoreNum != null ? scoreNum : "…"}
              </Text>
            </View>
          </View>

          {navItems.map((n) => (
            <Row
              key={n.route}
              icon={n.icon}
              label={n.label}
              sub={navSub(n.route, n.sub)}
              onPress={() => go(n.route)}
            />
          ))}

          <Text
            className="mt-5 px-3 text-[13px] font-bold uppercase"
            style={{ letterSpacing: 1.2, color: d.muted }}
          >
            Suivez-nous
          </Text>
          <View className="flex-row gap-3 px-3 py-2">
            {SOCIAL.map((s) => (
              <Pressable
                key={s.url}
                onPress={() => Linking.openURL(s.url)}
                accessibilityLabel={s.label}
                accessibilityRole="link"
                className="h-11 w-11 items-center justify-center rounded-2xl active:opacity-70"
                style={{ backgroundColor: d.tile }}
              >
                <Ionicons name={s.icon} size={18} color={d.text} />
              </Pressable>
            ))}
          </View>

          <View className="my-4 h-px" style={{ backgroundColor: d.border }} />
          {/* Email du souscripteur au-dessus de Déconnexion (parité web :
              Prospect.jsx bloc `dash-logout` > `dash-user-email`). Source =
              /api/me (prospect_identity.email). Tronqué sur une ligne. */}
          {me.data?.email ? (
            <Text
              className="px-3 pb-2 text-[12px]"
              style={{ color: d.muted }}
              numberOfLines={1}
            >
              {me.data.email}
            </Text>
          ) : null}
          <Row icon="power" label="Déconnexion" onPress={() => setConfirm("signout")} />
          <Row
            icon="trash-outline"
            label="Supprimer mon compte"
            danger
            chevron={false}
            onPress={() => setConfirm("delete")}
          />

          {/* Outils DEV — section visible uniquement en build dev.
              `__DEV__` est tree-shake'é en prod, ne ship jamais. */}
          {__DEV__ ? (
            <>
              <View className="my-4 h-px" style={{ backgroundColor: d.border }} />
              <Text
                className="px-3 text-[13px] font-bold uppercase"
                style={{ letterSpacing: 1.2, color: d.muted }}
              >
                Outils dev
              </Text>
              <Row
                icon="refresh-outline"
                label="Revoir l'onboarding"
                onPress={doResetOnboarding}
              />
            </>
          ) : null}
        </ScrollView>
      </Animated.View>

      <Modal transparent visible={confirm !== null} animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/50 px-8">
          <View className="w-full gap-4 rounded-2xl bg-paper p-6">
            <Text className="font-serif text-xl text-ink">
              {confirm === "delete" ? "Supprimer définitivement ?" : "Se déconnecter ?"}
            </Text>
            <Text className="text-sm leading-5 text-ink-3">
              {confirm === "delete"
                ? "Cette action efface définitivement votre compte et toutes vos données (RGPD). Irréversible."
                : "Vous devrez vous reconnecter pour accéder à votre espace."}
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                className="flex-1 items-center rounded-full border border-line py-3"
                onPress={() => setConfirm(null)}
              >
                <Text className="text-sm text-ink-3">Annuler</Text>
              </Pressable>
              <Pressable
                disabled={busy || del.isPending}
                className={`flex-1 items-center rounded-full py-3 ${
                  confirm === "delete" ? "bg-bad" : "bg-ink"
                }`}
                onPress={confirm === "delete" ? doDelete : doSignOut}
              >
                <Text className="text-sm font-semibold text-paper">
                  {busy || del.isPending
                    ? "…"
                    : confirm === "delete"
                      ? "Supprimer"
                      : "Se déconnecter"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
