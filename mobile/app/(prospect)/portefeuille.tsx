// Portefeuille prospect — /api/prospect/wallet (champs réels du web).
import { Text, View } from "react-native";

import { Card, eur, QueryGate, ScrollScreen, Stat } from "../../components/screen";
import { useProspectWallet } from "../../lib/queries";

export default function Portefeuille() {
  const q = useProspectWallet();
  return (
    <ScrollScreen onRefresh={q.refetch}>
      <QueryGate query={q}>
        {(d) => (
          <>
            <Card dark>
              <Text className="font-mono text-[11px] uppercase text-ink-5">
                Disponible au retrait
              </Text>
              <Text className="mt-1 font-serif text-4xl text-paper">
                {eur(d.availableEur)}
              </Text>
              <Text className="mt-1 text-xs text-ink-5">
                {d.canWithdraw
                  ? "Retrait possible"
                  : `Seuil de retrait : ${eur(d.withdrawThresholdEur)}`}
              </Text>
            </Card>

            <View className="flex-row gap-3">
              <Stat label="Ce mois" value={eur(d.monthGainsEur)} />
              <Stat label="Total cumulé" value={eur(d.lifetimeGainsEur)} />
            </View>
            <View className="flex-row gap-3">
              <Stat
                label="En séquestre"
                value={eur(d.escrowEur)}
                hint="campagnes en cours"
              />
              <Stat
                label="Mises en relation"
                value={String(d.relationsCount)}
              />
            </View>

            <Text className="text-center text-xs text-ink-4">
              Source /api/prospect/wallet — identique au web.
            </Text>
          </>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
