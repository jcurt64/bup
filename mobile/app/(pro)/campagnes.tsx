// Campagnes — /api/pro/campaigns (GET). Liste lecture seule ; la
// création/édition (wizard) viendra en itération suivante.
import { Text, View } from "react-native";

import { Card, eur, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import { useProCampaigns } from "../../lib/queries";

const STATUS_TONE: Record<string, string> = {
  active: "text-good",
  paused: "text-warn",
  ended: "text-ink-4",
  draft: "text-ink-4",
};

export default function Campagnes() {
  const q = useProCampaigns();
  return (
    <ScrollScreen onRefresh={q.refetch} headerVariant="pro">
      <SectionTitle
        eyebrow="Campagnes"
        title="Vos campagnes"
        desc="Vous ne payez que les acceptations effectives."
      />
      <QueryGate
        query={q}
        isEmpty={(d) => (d.campaigns?.length ?? 0) === 0}
        emptyLabel="Aucune campagne. Lancez-en une via l'onglet Créer."
      >
        {(d) => (
          <View className="gap-3">
            {d.campaigns.map((c) => (
              <Card key={c.id}>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="font-serif text-lg text-ink">
                      {c.name}
                    </Text>
                    <Text className="text-xs text-ink-4">
                      {c.objectiveLabel}
                    </Text>
                  </View>
                  <Text
                    className={`font-mono text-[11px] uppercase ${
                      STATUS_TONE[c.status] ?? "text-ink-4"
                    }`}
                  >
                    {c.status}
                  </Text>
                </View>
                <View className="mt-3 flex-row justify-between">
                  <Text className="text-xs text-ink-4">
                    Budget {eur(c.budgetEur)} · dépensé {eur(c.spentEur)}
                  </Text>
                  <Text className="font-mono text-xs text-ink-2">
                    {c.contactsCount} contact{c.contactsCount > 1 ? "s" : ""}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
