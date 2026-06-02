// Détail d'un objectif de campagne — listé ses sous-opérations (sélection
// multiple, coût indicatif). Ouvert depuis la grille de « Créer une
// campagne » via /(pro)/objectif?id=<objectiveId>. Les étapes suivantes
// (ciblage, budget, paiement) viendront ensuite.
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Card, ScrollScreen } from "../../components/screen";
import { OBJECTIVES } from "../../lib/pro-objectives";
import { useTheme } from "../../lib/theme";

export default function ProObjectif() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const obj = OBJECTIVES.find((o) => o.id === id) ?? null;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (sid: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });

  if (!obj) {
    return (
      <ScrollScreen
        headerVariant="pro"
        hero={{ nav: "back", eyebrow: "Objectif", title: "Introuvable" }}
      >
        <Card>
          <Text className="text-sm text-ink-4">Cet objectif n&apos;existe pas.</Text>
        </Card>
      </ScrollScreen>
    );
  }

  return (
    <ScrollScreen
      headerVariant="pro"
      hero={{ nav: "back", eyebrow: "Objectif", title: obj.name, desc: obj.desc }}
    >
      <Text className="text-[11px] font-bold uppercase text-ink-4" style={{ letterSpacing: 1.2 }}>
        Opérations disponibles
      </Text>

      <View className="gap-2">
        {obj.sub.map((s) => {
          const on = selected.has(s.id);
          return (
            <Pressable
              key={s.id}
              onPress={() => toggle(s.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              className="flex-row items-center rounded-2xl border bg-paper p-3.5 active:opacity-80"
              style={{ gap: 12, borderColor: on ? c.accent : c.borderSoft }}
            >
              <View
                className="items-center justify-center"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 7,
                  borderWidth: 1.5,
                  borderColor: on ? c.accent : c.ink5,
                  backgroundColor: on ? c.accent : "transparent",
                }}
              >
                {on ? <Ionicons name="checkmark" size={15} color={c.btnText} /> : null}
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-medium text-ink">{s.name}</Text>
                <Text className="mt-0.5 text-[12px] leading-4 text-ink-4">{s.desc}</Text>
              </View>
              <Text className="font-mono text-[13px] text-ink-3">
                {s.cost.toFixed(2)} €
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        className="mt-1 flex-row items-center gap-2 rounded-2xl px-4 py-3"
        style={{ backgroundColor: c.accentSoft }}
      >
        <Ionicons name="information-circle-outline" size={18} color={c.accentInk} />
        <Text className="flex-1 text-[12.5px]" style={{ color: c.accentInk }}>
          {selected.size > 0
            ? `${selected.size} opération${selected.size > 1 ? "s" : ""} sélectionnée${selected.size > 1 ? "s" : ""}. Le ciblage, le budget et le paiement arrivent prochainement.`
            : "Sélectionnez une ou plusieurs opérations pour continuer."}
        </Text>
      </View>
    </ScrollScreen>
  );
}
