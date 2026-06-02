// Popup de choix de formule (Starter / Pro) — équivalent du PlanSelectorModal
// web. S'ouvre avant le lancement d'une campagne : (1) à la 1re campagne d'un
// cycle, ou (2) quand le quota du cycle est atteint (renouvellement). Choisir
// une formule appelle POST /api/pro/plan (réinitialise le cycle) puis ack.
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import { setPlanAck } from "../lib/plan-ack";
import { PLAN_DEFS, type PlanId } from "../lib/pro-plans";
import { useProPlan, useSetProPlan } from "../lib/queries";
import { useTheme } from "../lib/theme";

export function PlanSelectorSheet({
  visible,
  capReached,
  onClose,
  onChosen,
}: {
  visible: boolean;
  capReached: boolean;
  onClose: () => void;
  onChosen: (plan: PlanId) => void;
}) {
  const { c } = useTheme();
  const plan = useProPlan();
  const setPlan = useSetProPlan();
  const [choosing, setChoosing] = useState<PlanId | null>(null);
  const current = plan.data?.plan;
  const capPlan = plan.data?.plan;

  async function choose(id: PlanId) {
    setChoosing(id);
    try {
      await setPlan.mutateAsync({ plan: id });
      await setPlanAck();
      onChosen(id);
    } catch {
      Alert.alert("Erreur", "Impossible de changer de formule. Réessayez.");
    } finally {
      setChoosing(null);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text
        className="font-mono uppercase"
        style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: c.accent }}
      >
        {capReached ? "— Quota atteint" : "— Avant de lancer votre campagne"}
      </Text>
      <Text className="mt-1 font-serif text-xl text-ink">
        {capReached ? "Quota du cycle atteint" : "Choisissez votre plan"}
      </Text>
      <Text className="mb-4 mt-1 text-[12.5px] leading-5 text-ink-3">
        {capReached
          ? `Vous avez consommé l'intégralité de votre cycle ${capPlan === "pro" ? "Pro (10 campagnes)" : "Starter (2 campagnes)"}. Choisissez un mode pour lancer un nouveau cycle.`
          : "Le mode sélectionné détermine le nombre de prospects par campagne et le nombre de campagnes incluses dans votre cycle. Vous pouvez changer à tout moment."}
      </Text>

      <View className="gap-3">
        {PLAN_DEFS.map((p) => {
          const spec = plan.data?.specs?.[p.id];
          const isCurrent = current === p.id;
          const isPro = p.id === "pro";
          const accent = isPro ? c.accent : c.ink;
          const busy = choosing === p.id;
          return (
            <View
              key={p.id}
              style={{
                position: "relative",
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: isCurrent ? accent : c.borderSoft,
                backgroundColor: isCurrent ? c.accentSoft : c.surface,
                padding: 16,
                gap: 10,
              }}
            >
              {p.badge ? (
                <View
                  style={{
                    position: "absolute",
                    top: -10,
                    right: 14,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    backgroundColor: accent,
                  }}
                >
                  <Text className="font-mono" style={{ fontSize: 10, letterSpacing: 1, color: "#FFFFFF" }}>
                    {p.badge}
                  </Text>
                </View>
              ) : null}
              <View className="flex-row items-baseline justify-between" style={{ gap: 8 }}>
                <Text className="font-serif text-2xl" style={{ color: accent }}>
                  {p.label}
                </Text>
                <Text className="text-[13px] text-ink-3">
                  <Text className="font-serif text-xl text-ink">{spec?.monthlyEur ?? 0} €</Text>
                  {`  / ${spec?.maxCampaigns ?? (isPro ? 10 : 2)} campagnes`}
                </Text>
              </View>
              <View className="gap-2">
                {p.features.map((f, i) => (
                  <View key={i} className="flex-row" style={{ gap: 8 }}>
                    <Ionicons name="checkmark" size={14} color={accent} style={{ marginTop: 2 }} />
                    <Text className="flex-1 text-[13px] leading-4 text-ink-2">{f}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                disabled={isCurrent || choosing !== null}
                onPress={() => choose(p.id)}
                accessibilityRole="button"
                className="mt-1 flex-row items-center justify-center gap-2 rounded-full py-3 active:opacity-80"
                style={{
                  backgroundColor: isCurrent ? c.surface2 : isPro ? c.accent : c.btnBg,
                  borderWidth: 1.5,
                  borderColor: isCurrent ? c.borderSoft : isPro ? c.accent : c.btnBg,
                  opacity: choosing !== null && !busy ? 0.5 : 1,
                }}
              >
                {busy ? (
                  <ActivityIndicator color={isPro ? "#FFFFFF" : c.btnText} />
                ) : (
                  <Text
                    className="text-[14px] font-semibold"
                    style={{ color: isCurrent ? c.textSub : isPro ? "#FFFFFF" : c.btnText }}
                  >
                    {isCurrent && !capReached
                      ? "✓ Formule actuelle"
                      : capReached
                        ? `Démarrer un cycle ${p.label}`
                        : `Choisir ${p.label}`}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
    </BottomSheet>
  );
}
