// components/referral-badge.tsx
// Badge couronne de parrainage (pastille LinearGradient) + popup paliers.
// Pas de react-native-svg : la couronne est un glyphe sur pastille gradient
// (même approche que CoinBadge).
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

export type BadgeTier = "cuivre" | "argent" | "or";

const TIER_GRADIENT: Record<BadgeTier, [string, string]> = {
  cuivre: ["#D08B4F", "#8C5A2B"],
  argent: ["#D9DCE1", "#8A8F98"],
  or: ["#E8C767", "#B8860B"],
};

const TIERS: { tier: BadgeTier; label: string; range: string; advantage: string }[] = [
  { tier: "cuivre", label: "Bronze", range: "1–2 filleuls", advantage: "Bonus : 50 % des BUUPP coins de la 1ʳᵉ acceptation de chaque filleul (1er mois post-lancement)." },
  { tier: "argent", label: "Argent", range: "3–9 filleuls", advantage: "Prioritaire : tous les avantages Bronze + accès aux offres flash 1 h avant tout le monde." },
  { tier: "or", label: "Or", range: "10 filleuls", advantage: "Governor : tous les avantages + consulté·e par BUUPP sur les nouveautés (droit de vote)." },
];

function CrownPill({ tier, size = 22 }: { tier: BadgeTier; size?: number }) {
  return (
    <LinearGradient
      colors={TIER_GRADIENT[tier]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: 999, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontSize: size * 0.55 }}>👑</Text>
    </LinearGradient>
  );
}

export function ReferralBadge({
  tier,
  founderNumber,
}: {
  tier: BadgeTier;
  founderNumber: number | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityLabel="Votre badge de parrainage" accessibilityRole="button" onPress={() => setOpen(true)} hitSlop={8}>
        <CrownPill tier={tier} size={22} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <Pressable onPress={() => {}} className="rounded-3xl bg-paper p-5" style={{ width: "100%", maxWidth: 420 }}>
            <View className="flex-row items-center gap-3">
              <CrownPill tier={tier} size={30} />
              {founderNumber != null && (
                <Text className="font-mono text-lg font-bold text-ink">Fondateur #{founderNumber}</Text>
              )}
            </View>
            <Text className="mt-1 text-[13px] text-ink-3">Votre palier de parrainage</Text>

            <View className="mt-4" style={{ gap: 10 }}>
              {TIERS.map((t) => {
                const current = t.tier === tier;
                return (
                  <View
                    key={t.tier}
                    className="flex-row items-center gap-3 rounded-2xl p-3"
                    style={{
                      borderWidth: current ? 2 : 1,
                      borderColor: current ? TIER_GRADIENT[t.tier][1] : "rgba(0,0,0,0.08)",
                    }}
                  >
                    <CrownPill tier={t.tier} size={22} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text className="font-semibold text-ink">
                        {t.label} <Text className="text-ink-3">· {t.range}</Text>
                        {current ? <Text style={{ color: TIER_GRADIENT[t.tier][1] }}>{"  • Votre palier"}</Text> : null}
                      </Text>
                      <Text className="text-[12.5px] text-ink-3">{t.advantage}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {tier !== "or" ? (
              <View className="mt-4 rounded-2xl p-3" style={{ backgroundColor: "rgba(124,92,252,0.08)", borderWidth: 1, borderColor: "rgba(124,92,252,0.25)" }}>
                <Text className="text-[13px] leading-5 text-ink-2">
                  Parrainez des prospects pour monter de palier et devenir un <Text className="font-semibold">Golden Buupper</Text>. Votre lien est dans l'onglet Parrainage.
                </Text>
                <Pressable
                  onPress={() => { setOpen(false); router.push("/(prospect)/parrainage"); }}
                  className="mt-3 items-center rounded-full bg-violet py-2.5"
                >
                  <Text className="text-sm font-semibold text-paper">Voir mon lien de parrainage →</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable className="mt-4 items-center rounded-full border border-ink/15 py-3" onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Fermer">
              <Text className="font-semibold text-ink">Fermer</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
