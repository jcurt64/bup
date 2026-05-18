// BUUPP Score — /api/prospect/score (score /1000 + 3 composantes).
import { Text, View } from "react-native";

import { Card, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import { useProspectScore } from "../../lib/queries";

function Bar({ label, pct, hint }: { label: string; pct: number; hint: string }) {
  return (
    <View className="gap-1.5">
      <View className="flex-row justify-between">
        <Text className="text-sm text-ink-2">{label}</Text>
        <Text className="font-mono text-xs text-ink-4">{Math.round(pct)}%</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-ivory-2">
        <View
          className="h-2 rounded-full bg-violet"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </View>
      <Text className="text-[11px] text-ink-4">{hint}</Text>
    </View>
  );
}

export default function ScoreScreen() {
  const q = useProspectScore();
  return (
    <ScrollScreen onRefresh={q.refetch}>
      <SectionTitle
        eyebrow="BUUPP Score"
        title="Votre cote de confiance"
        desc="Calculé sur 1000 à partir de la complétude, la fraîcheur de vos données et votre taux d'acceptation."
      />
      <QueryGate query={q}>
        {(d) => (
          <>
            <Card dark>
              <Text className="font-mono text-[11px] uppercase text-ink-5">
                Score actuel
              </Text>
              <Text className="mt-1 font-serif text-5xl text-paper">
                {d.score}
                <Text className="text-xl text-ink-5"> / 1000</Text>
              </Text>
            </Card>
            <Card className="gap-5">
              <Bar
                label="Complétude"
                pct={d.breakdown.completeness.pct}
                hint={`${d.breakdown.completeness.filled}/${d.breakdown.completeness.total} paliers renseignés`}
              />
              <Bar
                label="Fraîcheur"
                pct={d.breakdown.freshness.pct}
                hint={`Dernière mise à jour il y a ${d.breakdown.freshness.ageDays} j`}
              />
              <Bar
                label="Acceptation"
                pct={d.breakdown.acceptance.pct}
                hint={`${d.breakdown.acceptance.accepted}/${d.breakdown.acceptance.total} mises en relation acceptées`}
              />
            </Card>
          </>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
