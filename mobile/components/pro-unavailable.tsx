// Écran affiché à un compte PROFESSIONNEL qui se connecte sur iOS.
// Refus App Review 3.1.1 (22/11/2026) : l'appli iOS est réservée aux
// particuliers — pas d'inscription pro ni d'espace pro (le crédit pro
// s'achète hors In-App Purchase). Volontairement SANS lien ni mention du
// site (pas d'incitation à acheter ailleurs). Garde l'accès à « Mon
// compte » pour la suppression de compte (guideline 5.1.1(v)).
import { useAuth } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { Accent, BrandLogo, PrimaryButton } from "./ui";
import { unregisterPushToken } from "../lib/push";

export function ProUnavailable() {
  const { signOut, getToken } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

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

  return (
    <View className="flex-1 justify-center gap-6 bg-ivory px-6">
      <BrandLogo small />
      <View className="gap-2">
        <Text className="text-center font-serif text-3xl text-ink">
          Application <Accent>particuliers</Accent>
        </Text>
        <Text className="text-center text-lg leading-6 text-ink-3">
          Sur iPhone, BUUPP est réservée aux comptes particuliers. Votre compte
          professionnel n&apos;est pas accessible dans cette application.
        </Text>
      </View>
      <PrimaryButton label="Se déconnecter" loading={busy} onPress={doSignOut} />
      <Pressable
        onPress={() => router.push("/account")}
        accessibilityRole="button"
        className="items-center py-2 active:opacity-70"
      >
        <Text className="text-base font-semibold text-ink-2">Gérer mon compte</Text>
      </Pressable>
    </View>
  );
}
