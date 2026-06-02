// Créer une campagne — étape 1 : choix de l'objectif (7 objectifs en grille
// 2 colonnes, alignés sur le dashboard web). Chaque carte ouvre une page
// dédiée (objectif/[id]) listant ses sous-opérations. Contexte réel (crédit,
// plan) affiché en tête.
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Card, eur, QueryGate, ScrollScreen } from "../../components/screen";
import { OBJECTIVES } from "../../lib/pro-objectives";
import { useProPlan, useProWallet } from "../../lib/queries";
import { useTheme } from "../../lib/theme";

export default function ProCreation() {
  const { c } = useTheme();
  const wallet = useProWallet();
  const plan = useProPlan();

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
        Choisissez un objectif
      </Text>

      {/* Grille 2 colonnes — cartes compactes. */}
      <View className="flex-row flex-wrap justify-between">
        {OBJECTIVES.map((o) => (
          <Pressable
            key={o.id}
            onPress={() => router.push(`/(pro)/objectif?id=${o.id}` as never)}
            accessibilityRole="button"
            accessibilityLabel={o.name}
            className="rounded-3xl p-4 active:opacity-80"
            style={{
              width: "48%",
              marginBottom: 12,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.borderSoft,
            }}
          >
            <View
              className="items-center justify-center"
              style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: c.tintViolet }}
            >
              <Ionicons name={o.icon} size={22} color={c.accVioletDeep} />
            </View>
            <Text className="mt-3 font-serif text-[16px] leading-5 text-ink">
              {o.name}
            </Text>
            <Text className="mt-1 text-[11.5px] leading-4 text-ink-4" numberOfLines={2}>
              {o.sub.length} opération{o.sub.length > 1 ? "s" : ""}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollScreen>
  );
}
