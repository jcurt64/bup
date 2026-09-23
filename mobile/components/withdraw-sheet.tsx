// Retrait des gains — sheet ouverte depuis la carte « Disponible » du
// Portefeuille (parité web : bouton « Retirer mes gains » + RetraitModal).
// Étapes : onboarding Stripe Connect tant que payoutsEnabled est faux, puis
// saisie du montant (min seuil / max retirable), erreurs serveur affichées,
// état « Retrait enregistré ». Le serveur re-vérifie tout.
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { ApiError } from "../lib/api";
import {
  usePayoutOnboarding,
  usePayoutStatus,
  usePayoutWithdraw,
  useProspectWallet,
} from "../lib/queries";
import { useTheme } from "../lib/theme";
import { BottomSheet } from "./bottom-sheet";

const eur = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

// Message lisible d'une erreur API ({ message } JSON) — repli générique.
function apiErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    try {
      const j = JSON.parse(e.body) as { message?: string; error?: string };
      if (j.message) return j.message;
      if (j.error) return j.error;
    } catch {
      // corps non-JSON
    }
  }
  return fallback;
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className="items-center active:opacity-90"
      style={{
        marginTop: 14,
        paddingVertical: 15,
        borderRadius: 13,
        backgroundColor: c.btnBg,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ fontSize: 14.5, fontWeight: "600", color: c.btnText }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function WithdrawSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const wal = useProspectWallet();
  const pay = usePayoutStatus();
  const onboard = usePayoutOnboarding();
  const withdraw = usePayoutWithdraw();

  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Réinitialise la sheet à chaque ouverture ; relit le statut Stripe.
  useEffect(() => {
    if (!visible) return;
    setAmount("");
    setError(null);
    setDone(false);
    void pay.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const threshold = wal.data?.withdrawThresholdEur ?? 5;
  // Plafond client = part réellement retirable (hors bonus fondateur
  // verrouillé) quand le backend l'expose, sinon le solde disponible.
  const maxEur = wal.data?.withdrawableEur ?? wal.data?.availableEur ?? 0;

  const submit = () => {
    const v = Math.max(0, Number(amount.replace(",", ".")) || 0);
    if (v < threshold) return setError(`Minimum ${threshold} €.`);
    if (v > maxEur) return setError("Solde insuffisant.");
    setError(null);
    withdraw.mutate(
      { amountCents: Math.round(v * 100) },
      {
        onSuccess: () => setDone(true),
        onError: (e) => setError(apiErrorMessage(e, "Erreur lors du retrait.")),
      },
    );
  };

  const p = pay.data;

  let body: React.ReactNode;
  if (done) {
    body = (
      <View className="items-center" style={{ gap: 6, paddingVertical: 8 }}>
        <View
          className="items-center justify-center"
          style={{ width: 52, height: 52, borderRadius: 999, backgroundColor: c.goodSoft }}
        >
          <Ionicons name="checkmark" size={26} color={c.good} />
        </View>
        <Text className="font-serif" style={{ fontSize: 21, color: c.text, marginTop: 4 }}>
          Retrait enregistré
        </Text>
        <Text style={{ fontSize: 13, lineHeight: 19, color: c.textSub, textAlign: "center" }}>
          Le virement sera versé sur l&apos;IBAN renseigné chez Stripe sous 1 à 3
          jours ouvrés.
        </Text>
        <PrimaryButton label="Fermer" onPress={onClose} />
      </View>
    );
  } else if (!p) {
    body = (
      <Text style={{ fontSize: 13, color: pay.isError ? c.bad : c.textSub }}>
        {pay.isError ? "Impossible de lire le statut de vos retraits." : "Chargement…"}
      </Text>
    );
  } else if (!p.payoutsEnabled) {
    body = (
      <View>
        <View style={{ padding: 14, borderRadius: 13, backgroundColor: c.field }}>
          <Text className="font-serif" style={{ fontSize: 16, color: c.text }}>
            {p.hasAccount ? "Finalisez votre onboarding Stripe" : "Activez vos retraits"}
          </Text>
          <Text style={{ marginTop: 6, fontSize: 12.5, lineHeight: 18, color: c.textSub }}>
            Pour recevoir vos gains sur votre IBAN, vous devez d&apos;abord créer
            un compte Stripe Connect (procédure hébergée par Stripe, ~2 minutes :
            votre IBAN). Vos données ne transitent jamais par BUUPP.
          </Text>
        </View>
        {onboard.isError ? (
          <Text style={{ marginTop: 10, fontSize: 12.5, color: c.bad }}>
            {apiErrorMessage(onboard.error, "Erreur lors de l'activation.")}
          </Text>
        ) : null}
        <PrimaryButton
          label={
            onboard.isPending
              ? "Redirection…"
              : p.hasAccount
                ? "Reprendre l'onboarding"
                : "Activer mes retraits"
          }
          disabled={onboard.isPending}
          onPress={async () => {
            try {
              const r = await onboard.mutateAsync();
              if (r?.url) await WebBrowser.openBrowserAsync(r.url);
            } catch {
              // erreur affichée via onboard.isError
            } finally {
              // Au retour du navigateur, relire le statut Stripe.
              void pay.refetch();
            }
          }}
        />
      </View>
    );
  } else {
    body = (
      <View>
        <Text style={{ fontSize: 12.5, color: c.textSub }}>
          Retirable : <Text style={{ fontWeight: "700", color: c.text }}>{eur(maxEur)}</Text>
        </Text>
        <TextInput
          value={amount}
          onChangeText={(t) => {
            setAmount(t);
            setError(null);
          }}
          placeholder="Montant en €"
          placeholderTextColor={c.textMuted}
          keyboardType="decimal-pad"
          style={{
            marginTop: 11,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 13,
            backgroundColor: c.field,
            borderWidth: 1,
            borderColor: c.borderSoft,
            fontSize: 14.5,
            color: c.text,
          }}
        />
        <View className="flex-row items-center justify-between" style={{ marginTop: 6 }}>
          <Text style={{ fontSize: 12, color: c.textMuted }}>
            Min {threshold} € · Max {eur(maxEur)}
          </Text>
          <Pressable onPress={() => setAmount(String(maxEur).replace(".", ","))} hitSlop={8}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: c.accent }}>Tout retirer</Text>
          </Pressable>
        </View>
        {error ? (
          <Text style={{ marginTop: 10, fontSize: 12.5, color: c.bad }}>{error}</Text>
        ) : null}
        <PrimaryButton
          label={withdraw.isPending ? "Retrait…" : "Confirmer le retrait"}
          disabled={withdraw.isPending}
          onPress={submit}
        />
        <Text style={{ marginTop: 10, fontSize: 11.5, color: c.textMuted, textAlign: "center" }}>
          Virement vers votre compte Stripe, puis sur votre IBAN.
        </Text>
      </View>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ padding: 22, paddingBottom: 8 }}>
        <Text className="font-mono text-[11px] uppercase text-ink-4" style={{ letterSpacing: 1.2 }}>
          Portefeuille
        </Text>
        <Text className="font-serif" style={{ fontSize: 24, color: c.text, marginTop: 4, marginBottom: 16 }}>
          Retirer mes gains
        </Text>
        {body}
      </View>
    </BottomSheet>
  );
}
