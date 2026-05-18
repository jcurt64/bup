// Vue d'ensemble pro — /api/pro/overview (KPI réels).
import { Text, View } from "react-native";

import {
  Card,
  eur,
  QueryGate,
  ScrollScreen,
  SectionTitle,
  Stat,
} from "../../components/screen";
import { useProOverview } from "../../lib/queries";

export default function ProOverviewScreen() {
  const q = useProOverview();
  return (
    <ScrollScreen onRefresh={q.refetch}>
      <SectionTitle
        eyebrow="Vue d'ensemble"
        title="Vos 30 derniers jours"
        desc="Contacts acquis, performance et rentabilité estimée de vos campagnes."
      />
      <QueryGate query={q}>
        {(d) => (
          <>
            <View className="flex-row gap-3">
              <Stat
                label="Contacts acceptés (30j)"
                value={String(d.contactsAccepted30d)}
              />
              <Stat
                label="Taux d'acceptation"
                value={`${d.acceptanceRate}%`}
              />
            </View>
            <View className="flex-row gap-3">
              <Stat
                label="Coût moyen / contact"
                value={eur((d.avgCostCents ?? 0) / 100)}
              />
              <Stat
                label="ROI estimé"
                accent
                value={
                  d.roi?.pct == null
                    ? "—"
                    : `${d.roi.pct > 0 ? "+" : ""}${d.roi.pct} %`
                }
              />
            </View>
            <View className="flex-row gap-3">
              <Stat
                label="Campagnes actives"
                value={String(d.activeCampaignsCount)}
              />
              <Stat
                label="Acceptés ce mois"
                value={String(d.contactsAcceptedThisMonth)}
              />
            </View>

            <Card>
              <Text
                className="text-[11px] font-bold uppercase text-ink-4"
                style={{ letterSpacing: 1.2 }}
              >
                Dernières acceptations
              </Text>
              {d.lastAcceptances.length === 0 ? (
                <Text className="mt-2 text-sm text-ink-4">
                  Aucune acceptation pour le moment.
                </Text>
              ) : (
                <View className="mt-2 gap-2">
                  {d.lastAcceptances.map((a, i) => (
                    <View
                      key={i}
                      className={`flex-row justify-between pb-2 ${
                        i < d.lastAcceptances.length - 1
                          ? "border-b border-line"
                          : ""
                      }`}
                    >
                      <View>
                        <Text className="text-sm text-ink">{a.name}</Text>
                        <Text className="text-[11px] text-ink-4">
                          {a.campaign} · Palier {a.tier}
                        </Text>
                      </View>
                      <Text className="font-mono text-xs text-ink-3">
                        −{eur(a.costCents / 100)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
