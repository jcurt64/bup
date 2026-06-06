// Panneau du drawer PRO : navigation vers Analytics, Mes informations,
// Facturation, Vos suggestions + Suivez-nous (liens externes) +
// Déconnexion / Supprimer le compte. Réutilise le thème (dcolors), la Row
// et les constantes du drawer prospect pour un design strictement identique.
import { useAuth } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Dimensions, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { dcolors, Row, SOCIAL } from "./drawer-panel";
import { eur } from "./screen";
import { resetOnboardingSeen } from "../lib/onboarding";
import { unregisterPushToken } from "../lib/push";
import { useTheme } from "../lib/theme";
import { useDeleteAccount, useMeTyped, useProWallet } from "../lib/queries";

const NAV: {
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  sub?: string;
}[] = [
  { label: "Analytics", route: "/(pro)/analytics", icon: "stats-chart-outline", sub: "Performance détaillée" },
  { label: "Mes informations", route: "/(pro)/informations", icon: "briefcase-outline", sub: "Société & facturation" },
  { label: "Facturation", route: "/(pro)/facturation", icon: "card-outline", sub: "Plan, crédit & factures" },
  { label: "Vos suggestions", route: "/(pro)/suggestions", icon: "bulb-outline", sub: "Aidez-nous à progresser" },
];

export default function ProDrawerPanel() {
  const { mode } = useTheme();
  const d = dcolors(mode);
  const { signOut, getToken } = useAuth();
  const qc = useQueryClient();
  const del = useDeleteAccount();
  const me = useMeTyped();
  const wallet = useProWallet();
  const raison = wallet.data?.raisonSociale?.trim() || null;
  const available = wallet.data?.walletAvailableEur ?? null;

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
  async function doResetOnboarding() {
    setBusy(true);
    try {
      await resetOnboardingSeen();
      await signOut();
      qc.clear(); // évite qu'un rôle/données en cache fuitent vers le compte suivant
      router.replace("/(onboarding)");
    } catch {
      setBusy(false);
      Alert.alert("Erreur", "Impossible de réinitialiser l'onboarding.");
    }
  }

  return (
    <View className="flex-1">
      <Animated.View
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: scrim }}
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
          borderTopRightRadius: 40,
          borderBottomRightRadius: 40,
          overflow: "hidden",
        }}
      >
        <LinearGradient
          colors={d.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView className="flex-1" contentContainerClassName="gap-1.5 px-4 pb-6 pt-16">
          {/* Titre + carte identité pro (raison sociale + crédit dispo). */}
          <View className="px-3 pb-3">
            <Text className="font-serif-bold text-2xl" style={{ lineHeight: 28, color: d.text }}>
              Mon espace
            </Text>
            <Text className="font-serif-italic text-2xl" style={{ lineHeight: 28, color: d.text }}>
              professionnel
            </Text>
          </View>

          <View
            className="mb-3 flex-row items-center gap-3 rounded-2xl px-3 py-3"
            style={{ backgroundColor: d.tile }}
          >
            <View
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: d.avatarTile }}
            >
              <Ionicons name="briefcase-outline" size={20} color={d.avatarIcon} />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-semibold" style={{ color: d.text }} numberOfLines={1}>
                {raison ?? "Mon entreprise"}
              </Text>
              <Text className="mt-0.5 text-[12px]" style={{ color: d.sub }} numberOfLines={1}>
                Crédit disponible · {available != null ? eur(available) : "…"}
              </Text>
            </View>
          </View>

          {NAV.map((n) => (
            <Row
              key={n.route}
              icon={n.icon}
              label={n.label}
              sub={n.sub}
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
          {/* Email du compte au-dessus de Déconnexion (parité web + drawer
              prospect). Source = /api/me (email Clerk côté pro). */}
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

          {__DEV__ ? (
            <>
              <View className="my-4 h-px" style={{ backgroundColor: d.border }} />
              <Text
                className="px-3 text-[13px] font-bold uppercase"
                style={{ letterSpacing: 1.2, color: d.muted }}
              >
                Outils dev
              </Text>
              <Row icon="refresh-outline" label="Revoir l'onboarding" onPress={doResetOnboarding} />
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
