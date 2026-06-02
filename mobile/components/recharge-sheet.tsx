// Sheet de recharge de crédit pro — flux identique au web :
// POST /api/stripe/checkout → ouverture de la page Stripe Checkout dans le
// navigateur in-app → au retour, POST /api/pro/topup/reconcile (idempotent,
// le webhook crédite aussi côté serveur) → refetch wallet.
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import { useCreateTopupCheckout, useReconcileTopup } from "../lib/queries";
import { useTheme } from "../lib/theme";

const PRESETS = [50, 100, 200, 500]; // €, min 50 € côté serveur

export function RechargeSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState(false);
  const checkout = useCreateTopupCheckout();
  const reconcile = useReconcileTopup();

  async function pay() {
    setBusy(true);
    try {
      const { url } = await checkout.mutateAsync({ amountCents: amount * 100 });
      // L'id de session (cs_...) est présent dans l'URL Checkout — réutilisé
      // pour le reconcile au retour.
      const sessionId = url.match(/cs_[A-Za-z0-9_]+/)?.[0] ?? null;
      await WebBrowser.openBrowserAsync(url);
      // Le navigateur s'est fermé : on tente le reconcile (no-op si pas payé
      // ou déjà crédité par le webhook).
      if (sessionId) {
        try {
          const r = await reconcile.mutateAsync({ sessionId });
          if (r.ok) {
            Alert.alert(
              "Compte rechargé",
              r.alreadyCredited
                ? "Votre crédit est à jour."
                : `+${(r.amountCents / 100).toFixed(2)} € ajoutés à votre crédit.`,
            );
          }
        } catch {
          // Paiement non finalisé / annulé → on ne fait rien (le wallet est
          // déjà rafraîchi par l'invalidation au cas où le webhook a crédité).
        }
      }
      onClose();
    } catch (e) {
      Alert.alert(
        "Recharge impossible",
        e instanceof Error && e.message
          ? e.message
          : "Réessayez dans un instant.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View className="mb-2 flex-row items-center gap-2">
        <View
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: c.tintBlue }}
        >
          <Ionicons name="card-outline" size={18} color={c.accBlue} />
        </View>
        <Text className="font-serif text-xl text-ink">Recharger mon compte</Text>
      </View>
      <Text className="mb-4 text-[13px] leading-5 text-ink-3">
        Le crédit sert à payer les acceptations de vos campagnes. Paiement
        sécurisé via Stripe.
      </Text>

      <View className="mb-4 flex-row flex-wrap" style={{ gap: 10 }}>
        {PRESETS.map((p) => {
          const on = amount === p;
          return (
            <Pressable
              key={p}
              onPress={() => setAmount(p)}
              className="items-center rounded-2xl active:opacity-80"
              style={{
                width: "47%",
                paddingVertical: 16,
                borderWidth: 1.5,
                borderColor: on ? c.accent : c.borderSoft,
                backgroundColor: on ? c.accentSoft : c.surface,
              }}
            >
              <Text
                className="font-serif text-2xl"
                style={{ color: on ? c.accentInk : c.text }}
              >
                {p} €
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        disabled={busy}
        onPress={pay}
        accessibilityRole="button"
        className="flex-row items-center justify-center gap-2 rounded-full py-3.5 active:opacity-80"
        style={{ backgroundColor: c.btnBg }}
      >
        {busy ? (
          <ActivityIndicator color={c.btnText} />
        ) : (
          <>
            <Ionicons name="lock-closed" size={16} color={c.btnText} />
            <Text className="text-base font-semibold" style={{ color: c.btnText }}>
              Payer {amount} € avec Stripe
            </Text>
          </>
        )}
      </Pressable>
    </BottomSheet>
  );
}
