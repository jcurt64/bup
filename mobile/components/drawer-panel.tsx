// Panneau du drawer prospect : navigation vers les écrans secondaires +
// Suivez-nous (liens externes) + Déconnexion / Supprimer le compte
// (modales de confirmation, parité web Prospect.jsx).
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Dimensions, Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";

import { useDeleteAccount } from "../lib/queries";

const SOCIAL = [
  { icon: "logo-facebook" as const, url: "https://www.facebook.com/buupp", label: "Facebook BUUPP" },
  { icon: "logo-instagram" as const, url: "https://www.instagram.com/buupp", label: "Instagram BUUPP" },
  { icon: "logo-tiktok" as const, url: "https://www.tiktok.com/@buupp", label: "TikTok BUUPP" },
];

const NAV: { label: string; route: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "Paliers de vérification", route: "/(prospect)/verification", icon: "shield-checkmark-outline" },
  { label: "BUUPP Score", route: "/(prospect)/score", icon: "speedometer-outline" },
  { label: "Parrainage", route: "/(prospect)/parrainage", icon: "gift-outline" },
  { label: "Informations fiscales", route: "/(prospect)/fiscal", icon: "document-text-outline" },
  { label: "Vos suggestions", route: "/(prospect)/suggestions", icon: "bulb-outline" },
];

function Row({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl px-4 py-3.5 active:bg-ivory-2"
    >
      <Ionicons name={icon} size={20} color={danger ? "#C0392B" : "#13235B"} />
      <Text className={`text-base ${danger ? "text-bad" : "text-ink"}`}>{label}</Text>
    </Pressable>
  );
}

export default function DrawerPanel() {
  const { signOut } = useAuth();
  const del = useDeleteAccount();
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
      await signOut();
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
      await signOut();
      router.replace("/(auth)/sign-in");
    } catch {
      setBusy(false);
      Alert.alert(
        "Erreur",
        "La suppression du compte a échoué. Réessayez plus tard.",
      );
    }
  }

  return (
    <View className="flex-1 flex-row">
      <Animated.View
        className="bg-paper"
        style={{ width: W, transform: [{ translateX: tx }], elevation: 8 }}
      >
        <ScrollView contentContainerClassName="gap-1 px-4 pb-10 pt-14">
          <Text className="px-4 pb-2 font-serif text-2xl text-ink">Menu</Text>
          {NAV.map((n) => (
            <Row key={n.route} icon={n.icon} label={n.label} onPress={() => go(n.route)} />
          ))}

          <Text
            className="mt-4 px-4 text-[11px] font-bold uppercase text-ink-4"
            style={{ letterSpacing: 1.2 }}
          >
            Suivez-nous
          </Text>
          <View className="flex-row gap-3 px-4 py-2">
            {SOCIAL.map((s) => (
              <Pressable
                key={s.url}
                onPress={() => Linking.openURL(s.url)}
                accessibilityLabel={s.label}
                accessibilityRole="link"
                className="h-11 w-11 items-center justify-center rounded-full border border-line active:opacity-70"
              >
                <Ionicons name={s.icon} size={18} color="#13235B" />
              </Pressable>
            ))}
          </View>

          <View className="my-3 h-px bg-line" />
          <Row icon="log-out-outline" label="Déconnexion" onPress={() => setConfirm("signout")} />
          <Row
            icon="trash-outline"
            label="Supprimer mon compte"
            danger
            onPress={() => setConfirm("delete")}
          />
        </ScrollView>
      </Animated.View>

      {/* Scrim : ferme le drawer */}
      <Animated.View style={{ flex: 1, opacity: scrim }}>
        <Pressable className="flex-1 bg-black/40" onPress={dismiss} />
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
