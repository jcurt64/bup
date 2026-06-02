// Analytics pro — /api/pro/analytics (breakdowns paliers/géo/âge/sexe).
import { Text, View } from "react-native";

import { Card, QueryGate, ScrollScreen } from "../../components/screen";
import { useProAnalytics } from "../../lib/queries";
import { useTheme } from "../../lib/theme";

function Bars({
  rows,
}: {
  rows: { label: string; pct: number; hint?: string }[];
}) {
  const { c } = useTheme();
  if (rows.length === 0) {
    return <Text className="text-sm text-ink-4">Données insuffisantes.</Text>;
  }
  return (
    <View className="gap-2.5">
      {rows.map((r, i) => (
        <View key={i}>
          <View className="flex-row justify-between">
            <Text className="text-[13px] text-ink-2">{r.label}</Text>
            <Text className="font-mono text-[12px] text-ink-3">
              {r.hint ?? `${r.pct}%`}
            </Text>
          </View>
          <View
            className="mt-1 h-2 overflow-hidden rounded-full"
            style={{ backgroundColor: c.track }}
          >
            <View
              style={{
                width: `${Math.max(0, Math.min(100, r.pct))}%`,
                height: "100%",
                borderRadius: 999,
                backgroundColor: c.accent,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function ProAnalytics() {
  const q = useProAnalytics(undefined, "30d");
  return (
    <ScrollScreen
      headerVariant="pro"
      hero={{
        nav: "drawer",
        eyebrow: "Analytics",
        title: "Performance",
        desc: "Acceptations par profil sur les 30 derniers jours.",
      }}
      onRefresh={q.refetch}
    >
      <QueryGate query={q}>
        {(d) => (
          <View className="gap-4">
            <Card>
              <Text className="font-serif text-lg text-ink">Par palier</Text>
              <View className="mt-3">
                <Bars
                  rows={d.acceptanceByTier.map((t) => ({
                    label: t.label,
                    pct: t.pct,
                  }))}
                />
              </View>
            </Card>

            <Card>
              <Text className="font-serif text-lg text-ink">Top localisations</Text>
              <View className="mt-3">
                <Bars
                  rows={d.geoBreakdown.map((g) => ({
                    label: g.ville,
                    pct: g.pct,
                    hint: `${g.contacts} contact${g.contacts > 1 ? "s" : ""}`,
                  }))}
                />
              </View>
            </Card>

            <View className="flex-row gap-3">
              <Card className="flex-1">
                <Text className="font-serif text-lg text-ink">Âge</Text>
                <View className="mt-3">
                  <Bars rows={d.ageBreakdown} />
                </View>
              </Card>
              <Card className="flex-1">
                <Text className="font-serif text-lg text-ink">Sexe</Text>
                <View className="mt-3">
                  <Bars rows={d.sexBreakdown} />
                </View>
              </Card>
            </View>

            <Text className="text-center text-[11px] text-ink-4">
              Échantillon : {d.sampleSize.rows} sollicitation
              {d.sampleSize.rows > 1 ? "s" : ""} · {d.sampleSize.wins} acceptée
              {d.sampleSize.wins > 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
