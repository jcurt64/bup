// Créer une campagne — point d'entrée du wizard (étapes alignées sur le
// dashboard web pro). Cette première version affiche le contexte réel
// (crédit disponible, plan & plafond de campagnes) + le déroulé des étapes ;
// la logique complète du wizard (ciblage, budget, paiement) suit.
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { Card, eur, QueryGate, ScrollScreen } from "../../components/screen";
import { useProPlan, useProWallet } from "../../lib/queries";
import { useTheme } from "../../lib/theme";

const STEPS: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] = [
  { icon: "flag-outline", title: "Objectif", desc: "Type de campagne et sous-types de demande." },
  { icon: "options-outline", title: "Ciblage", desc: "Paliers de données, zone géographique, âge, vérification, mots-clés." },
  { icon: "time-outline", title: "Durée & budget", desc: "Durée de diffusion, nombre de contacts et coût par contact." },
  { icon: "checkmark-done-outline", title: "Récapitulatif", desc: "Vérification puis lancement (débit sur votre crédit)." },
];

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
        Étapes de création
      </Text>

      <View className="gap-3">
        {STEPS.map((s, i) => (
          <Card key={s.title}>
            <View className="flex-row items-start" style={{ gap: 12 }}>
              <View
                className="items-center justify-center"
                style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.tintViolet }}
              >
                <Ionicons name={s.icon} size={20} color={c.accVioletDeep} />
              </View>
              <View className="flex-1">
                <Text className="font-serif text-lg text-ink">
                  {i + 1}. {s.title}
                </Text>
                <Text className="mt-0.5 text-[13px] leading-5 text-ink-3">
                  {s.desc}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </View>

      <View
        className="mt-1 flex-row items-center gap-2 rounded-2xl px-4 py-3"
        style={{ backgroundColor: c.accentSoft }}
      >
        <Ionicons name="construct-outline" size={18} color={c.accentInk} />
        <Text className="flex-1 text-[12.5px]" style={{ color: c.accentInk }}>
          Le formulaire complet de création arrive prochainement dans l&apos;app.
        </Text>
      </View>
    </ScrollScreen>
  );
}
