// Créer une campagne — étape 1 : choix de l'objectif (7 objectifs, alignés
// sur le dashboard web) puis sélection des sous-opérations. Le contexte réel
// (crédit, plan) est affiché en tête. La suite du wizard (ciblage, budget,
// paiement) viendra ensuite.
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Card, eur, QueryGate, ScrollScreen } from "../../components/screen";
import { OBJECTIVES } from "../../lib/pro-objectives";
import { useProPlan, useProWallet } from "../../lib/queries";
import { useTheme } from "../../lib/theme";

export default function ProCreation() {
  const { c } = useTheme();
  const wallet = useProWallet();
  const plan = useProPlan();
  const [selectedObj, setSelectedObj] = useState<string | null>(null);
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());

  const obj = OBJECTIVES.find((o) => o.id === selectedObj) ?? null;

  const toggleSub = (id: string) =>
    setSelectedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pickObjective = (id: string) => {
    setSelectedObj((cur) => (cur === id ? null : id));
    setSelectedSubs(new Set()); // reset des sous-types au changement d'objectif
  };

  return (
    <ScrollScreen
      headerVariant="pro"
      hero={{
        eyebrow: "Nouvelle campagne",
        title: "Créer une campagne",
        desc: "Ciblez des prospects qualifiés — vous ne payez que les acceptations.",
      }}
    >
      {/* Contexte réel : crédit + plan. */}
      <View className="flex-row gap-3">
        <QueryGate query={wallet}>
          {(w) => (
            <Card className="flex-1">
              <Text className="font-mono text-[11px] uppercase text-ink-4" style={{ letterSpacing: 1 }}>
                Crédit disponible
              </Text>
              <Text className="mt-1 font-serif text-2xl text-ink">
                {eur(w.walletAvailableEur)}
              </Text>
            </Card>
          )}
        </QueryGate>
        <QueryGate query={plan}>
          {(p) => (
            <Card className="flex-1">
              <Text className="font-mono text-[11px] uppercase text-ink-4" style={{ letterSpacing: 1 }}>
                Plan {p.label}
              </Text>
              <Text className="mt-1 font-serif text-2xl text-ink">
                {p.cycleCount}/{p.cap}
              </Text>
              <Text className="text-[11px] text-ink-4">campagnes ce cycle</Text>
            </Card>
          )}
        </QueryGate>
      </View>

      <Text className="mt-2 text-[11px] font-bold uppercase text-ink-4" style={{ letterSpacing: 1.2 }}>
        1. Choisissez un objectif
      </Text>

      <View className="gap-3">
        {OBJECTIVES.map((o) => {
          const on = selectedObj === o.id;
          return (
            <View key={o.id}>
              <Pressable
                onPress={() => pickObjective(o.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                className="flex-row items-center rounded-3xl p-4 active:opacity-80"
                style={{
                  gap: 12,
                  backgroundColor: on ? c.accentSoft : c.surface,
                  borderWidth: 1,
                  borderColor: on ? c.accent : c.borderSoft,
                }}
              >
                <View
                  className="items-center justify-center"
                  style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: c.tintViolet }}
                >
                  <Ionicons name={o.icon} size={22} color={c.accVioletDeep} />
                </View>
                <View className="flex-1">
                  <Text className="font-serif text-lg" style={{ color: on ? c.accentInk : c.text }}>
                    {o.name}
                  </Text>
                  <Text className="mt-0.5 text-[12.5px] leading-4 text-ink-4">
                    {o.desc}
                  </Text>
                </View>
                <Ionicons
                  name={on ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={c.ink4}
                />
              </Pressable>

              {/* Sous-opérations de l'objectif sélectionné. */}
              {on ? (
                <View className="mt-2 gap-2 pl-2">
                  {o.sub.map((s) => {
                    const subOn = selectedSubs.has(s.id);
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => toggleSub(s.id)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: subOn }}
                        className="flex-row items-center rounded-2xl border bg-paper p-3 active:opacity-80"
                        style={{ gap: 10, borderColor: subOn ? c.accent : c.borderSoft }}
                      >
                        <View
                          className="items-center justify-center"
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 7,
                            borderWidth: 1.5,
                            borderColor: subOn ? c.accent : c.ink5,
                            backgroundColor: subOn ? c.accent : "transparent",
                          }}
                        >
                          {subOn ? (
                            <Ionicons name="checkmark" size={14} color={c.btnText} />
                          ) : null}
                        </View>
                        <View className="flex-1">
                          <Text className="text-[14px] font-medium text-ink">{s.name}</Text>
                          <Text className="text-[11.5px] leading-4 text-ink-4">{s.desc}</Text>
                        </View>
                        <Text className="font-mono text-[12px] text-ink-3">
                          {s.cost.toFixed(2)} €
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Récapitulatif de sélection + suite du wizard (à venir). */}
      <View
        className="mt-1 flex-row items-center gap-2 rounded-2xl px-4 py-3"
        style={{ backgroundColor: c.accentSoft }}
      >
        <Ionicons name="information-circle-outline" size={18} color={c.accentInk} />
        <Text className="flex-1 text-[12.5px]" style={{ color: c.accentInk }}>
          {obj
            ? `${obj.name} · ${selectedSubs.size} opération${selectedSubs.size > 1 ? "s" : ""} sélectionnée${selectedSubs.size > 1 ? "s" : ""}. Les étapes suivantes (ciblage, budget, paiement) arrivent prochainement.`
            : "Sélectionnez un objectif pour découvrir ses opérations."}
        </Text>
      </View>
    </ScrollScreen>
  );
}
