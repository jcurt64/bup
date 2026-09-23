// Sheet de recharge de crédit pro — flux identique au web :
// POST /api/stripe/checkout → ouverture de la page Stripe Checkout dans le
// navigateur in-app → au retour, POST /api/pro/topup/reconcile (idempotent,
// le webhook crédite aussi côté serveur) → refetch wallet.
// Option « Recharge automatique » (parité Objectives.jsx RechargeModal) :
// cochée, le checkout sauvegarde la carte (setup_future_usage) et active la
// recharge au seuil choisi ; désactivation directe via PATCH auto-recharge.
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import { ApiError } from "../lib/api";
import { useReconcileTopup } from "../lib/queries";
import {
  apiErrorMessage,
  AUTO_MAX_EUR,
  AUTO_THRESHOLD_MIN_EUR,
  useAutoRecharge,
  usePatchAutoRecharge,
  useTopupCheckout,
} from "../lib/queries-pro-billing";
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
  initialAmount,
}: {
  visible: boolean;
  onClose: () => void;
  /** Montant pré-rempli (€), ex. le manque à gagner d'un lancement bloqué
   *  pour solde insuffisant. Borné à [50, 10 000]. */
  initialAmount?: number;
}) {
  const { c } = useTheme();
  const [amount, setAmount] = useState(200);
  // À chaque ouverture avec un montant suggéré, on le pré-remplit.
  useEffect(() => {
    if (!visible || !initialAmount) return;
    const eur = Math.min(MAX_EUR, Math.max(MIN_EUR, Math.ceil(initialAmount)));
    setAmount(eur);
    setCustomText(PRESETS.includes(eur) ? "" : String(eur));
  }, [visible, initialAmount]);
  const [customText, setCustomText] = useState("");
  const [busy, setBusy] = useState(false);
  const amountValid = amount >= MIN_EUR && amount <= MAX_EUR;
  const checkout = useTopupCheckout();
  const reconcile = useReconcileTopup();
  const autoState = useAutoRecharge();
  const patchAuto = usePatchAutoRecharge();
  // Recharge auto décochée par défaut (geste explicite requis pour un débit
  // récurrent) ; pré-cochée si déjà active côté serveur.
  const [auto, setAuto] = useState(false);
  const [thresholdText, setThresholdText] = useState("100");
  const threshold = parseInt(thresholdText, 10);
  const thresholdValid =
    !Number.isNaN(threshold) && threshold >= AUTO_THRESHOLD_MIN_EUR && threshold <= AUTO_MAX_EUR;
  const autoEnabled = !!autoState.data?.enabled;
  const qc = useQueryClient();

  // Pré-remplissage à l'ouverture depuis l'état serveur.
  const { refetch: refetchAuto } = autoState;
  useEffect(() => {
    if (!visible) return;
    refetchAuto().then((r) => {
      if (r.data?.enabled) {
        setAuto(true);
        if (r.data.thresholdCents)
          setThresholdText(String(Math.round(r.data.thresholdCents / 100)));
      }
    });
  }, [visible, refetchAuto]);

  async function disableAuto() {
    try {
      await patchAuto.mutateAsync({ enabled: false });
      setAuto(false);
    } catch (e) {
      Alert.alert("Désactivation impossible", apiErrorMessage(e, "Réessayez dans un instant."));
    }
  }

  async function pay() {
    if (auto && !thresholdValid) {
      Alert.alert(
        "Seuil invalide",
        `Le seuil de recharge automatique doit être compris entre ${AUTO_THRESHOLD_MIN_EUR} € et ${AUTO_MAX_EUR.toLocaleString("fr-FR")} €.`,
      );
      return;
    }
    setBusy(true);
    try {
      const { url } = await checkout.mutateAsync({
        amountCents: amount * 100,
        enableAutoRecharge: auto,
        autoRechargeThresholdCents: Math.round((thresholdValid ? threshold : 100) * 100),
      });
      // L'id de session (cs_...) est présent dans l'URL Checkout — réutilisé
      // pour le reconcile au retour.
      const sessionId = url.match(/cs_[A-Za-z0-9_]+/)?.[0] ?? null;
      await WebBrowser.openBrowserAsync(url);
      // Carte sauvegardée / recharge auto activée par le webhook : on
      // rafraîchit ces états (Facturation) quel que soit le résultat.
      qc.invalidateQueries({ queryKey: ["pro", "auto-recharge"] });
      qc.invalidateQueries({ queryKey: ["pro", "payment-method"] });
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
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
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

      {/* Recharge automatique — parité web (Objectives.jsx RechargeModal). */}
      <View className="mb-4 rounded-2xl p-3.5" style={{ backgroundColor: c.surface2 }}>
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <View className="flex-1">
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Text className="text-[14px] font-semibold text-ink">Recharge automatique</Text>
              {autoEnabled ? (
                <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: c.accentSoft }}>
                  <Text className="text-[10px] font-semibold" style={{ color: c.accentInk }}>
                    Active
                  </Text>
                </View>
              ) : null}
            </View>
            <Text className="mt-0.5 text-[12px] leading-[17px] text-ink-4">
              Dès que le solde passe sous {thresholdValid ? threshold : "…"} €, recréditer{" "}
              {amount} € automatiquement. Vous pouvez désactiver à tout moment.
            </Text>
          </View>
          <Switch
            value={auto}
            onValueChange={setAuto}
            trackColor={{ false: c.track, true: c.accent }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Recharge automatique"
          />
        </View>

        {auto ? (
          <View
            className="mt-2.5 flex-row items-center pt-2.5"
            style={{ gap: 8, borderTopWidth: 1, borderTopColor: c.borderSoft }}
          >
            <Text className="text-[12px] text-ink-4">Seuil :</Text>
            <TextInput
              value={thresholdText}
              onChangeText={(t) => setThresholdText(t.replace(/[^0-9]/g, "").slice(0, 5))}
              keyboardType="number-pad"
              className="font-mono"
              style={{
                width: 80,
                paddingVertical: 6,
                paddingHorizontal: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: thresholdValid ? c.borderSoft : c.bad,
                backgroundColor: c.field,
                color: c.text,
                fontSize: 14,
              }}
            />
            <Text className="text-[12px] text-ink-4">
              € (entre {AUTO_THRESHOLD_MIN_EUR} et {AUTO_MAX_EUR.toLocaleString("fr-FR")})
            </Text>
          </View>
        ) : null}

        {autoEnabled && autoState.data?.lastFailureReason ? (
          <View
            className="mt-2.5 rounded-lg px-2.5 py-2"
            style={{ backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FCA5A5" }}
          >
            <Text style={{ color: "#991B1B", fontSize: 11.5, lineHeight: 16 }}>
              <Text style={{ fontWeight: "700" }}>Dernière tentative en échec : </Text>
              {autoState.data.lastFailureReason}. Pour réessayer, effectuez une recharge manuelle
              (votre nouveau moyen de paiement remplacera l&apos;ancien).
            </Text>
          </View>
        ) : null}

        {autoEnabled ? (
          <Pressable
            disabled={patchAuto.isPending}
            onPress={disableAuto}
            accessibilityRole="button"
            className="mt-2.5 self-start rounded-full px-3 py-1.5 active:opacity-70"
            style={{ borderWidth: 1, borderColor: c.borderSoft }}
          >
            <Text className="text-[12px] text-ink-3">
              {patchAuto.isPending ? "Désactivation…" : "Désactiver la recharge automatique"}
            </Text>
          </Pressable>
        ) : null}
      </View>

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
      </ScrollView>
    </BottomSheet>
  );
}
