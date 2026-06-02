// Sheet de recharge de crédit pro — flux identique au web :
// POST /api/stripe/checkout → ouverture de la page Stripe Checkout dans le
// navigateur in-app → au retour, POST /api/pro/topup/reconcile (idempotent,
// le webhook crédite aussi côté serveur) → refetch wallet.
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import { ApiError } from "../lib/api";
import { useCreateTopupCheckout, useReconcileTopup } from "../lib/queries";
import { useTheme } from "../lib/theme";

// Messages lisibles selon le code d'erreur de /api/stripe/checkout.
function checkoutErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    let code = "";
    try {
      code = (JSON.parse(e.body) as { error?: string }).error ?? "";
    } catch {
      /* corps non-JSON */
    }
    if (e.status === 401) return "Session expirée — reconnectez-vous.";
    if (code === "invalid_amount") return "Montant invalide (50 € à 10 000 €).";
    if (e.status === 404)
      return "Service de paiement indisponible (route absente sur ce déploiement).";
    if (e.status >= 500)
      return "Paiement momentanément indisponible côté serveur (Stripe non configuré ?).";
    return `Erreur ${e.status}${code ? ` — ${code}` : ""}.`;
  }
  return e instanceof Error && e.message ? e.message : "Réessayez dans un instant.";
}

const PRESETS = [200, 500, 1000, 2000]; // €, comme le web (min 50 / max 10 000 côté serveur)
const MIN_EUR = 50;
const MAX_EUR = 10000;

export function RechargeSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [amount, setAmount] = useState(200);
  const [customText, setCustomText] = useState("");
  const [busy, setBusy] = useState(false);
  const amountValid = amount >= MIN_EUR && amount <= MAX_EUR;
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
      Alert.alert("Recharge impossible", checkoutErrorMessage(e));
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

      <View className="mb-3 flex-row flex-wrap" style={{ gap: 10 }}>
        {PRESETS.map((p) => {
          const on = customText === "" && amount === p;
          return (
            <Pressable
              key={p}
              onPress={() => {
                setAmount(p);
                setCustomText("");
              }}
              className="items-center rounded-2xl active:opacity-80"
              style={{
                width: "47%",
                paddingVertical: 16,
                borderWidth: 1.5,
                borderColor: on ? c.accent : c.borderSoft,
                backgroundColor: on ? c.accentSoft : c.surface,
              }}
            >
              <Text className="font-serif text-2xl" style={{ color: on ? c.accentInk : c.text }}>
                {p} €
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Montant libre (50 € – 10 000 €). */}
      <View className="mb-1">
        <Text className="mb-1 text-[12px] font-semibold text-ink-3">Montant libre</Text>
        <View
          className="flex-row items-center rounded-2xl px-3"
          style={{
            borderWidth: 1.5,
            borderColor: customText !== "" ? c.accent : c.borderSoft,
            backgroundColor: c.field,
          }}
        >
          <TextInput
            value={customText}
            onChangeText={(t) => {
              const clean = t.replace(/[^0-9]/g, "");
              setCustomText(clean);
              const n = parseInt(clean, 10);
              if (!Number.isNaN(n)) setAmount(n);
            }}
            keyboardType="number-pad"
            placeholder="Autre montant"
            placeholderTextColor={c.textMuted}
            style={{ flex: 1, paddingVertical: 12, fontSize: 16, color: c.text }}
          />
          <Text className="font-serif text-lg text-ink-3">€</Text>
        </View>
      </View>
      <Text className="mb-4 text-[11px]" style={{ color: amountValid ? c.textMuted : c.bad }}>
        Entre {MIN_EUR} € et {MAX_EUR.toLocaleString("fr-FR")} €.
      </Text>

      <Pressable
        disabled={busy || !amountValid}
        onPress={pay}
        accessibilityRole="button"
        className="flex-row items-center justify-center gap-2 rounded-full py-3.5 active:opacity-80"
        style={{ backgroundColor: c.btnBg, opacity: amountValid ? 1 : 0.5 }}
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
