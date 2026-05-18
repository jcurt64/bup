// Portefeuille prospect — /api/prospect/wallet + /api/prospect/movements.
// Champs & formats alignés sur Prospect.jsx fn Portefeuille (web).
import { Text, View } from "react-native";

import { Card, dateFr, eur, QueryGate, ScrollScreen, Stat } from "../../components/screen";
import {
  useProspectMovements,
  useProspectWallet,
} from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

export default function Portefeuille() {
  const w = useProspectWallet();
  const m = useProspectMovements();
  useRefetchOnFocus(w, m);

  return (
    <ScrollScreen onRefresh={() => Promise.all([w.refetch(), m.refetch()])}>
      <QueryGate query={w}>
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
              <Stat label="En séquestre" value={eur(d.escrowEur)} hint="campagnes en cours" />
              <Stat label="Mises en relation" value={String(d.relationsCount)} />
            </View>
          </>
        )}
      </QueryGate>

      <Text
        className="mt-2 text-[11px] font-bold uppercase text-ink-4"
        style={{ letterSpacing: 1.2 }}
      >
        Mouvements
      </Text>
      <QueryGate
        query={m}
        isEmpty={(d) => (d.movements?.length ?? 0) === 0}
        emptyLabel="Aucun mouvement pour le moment."
      >
        {(d) => (
          <View className="gap-2">
            {d.movements.map((mv) => (
              <View
                key={mv.id}
                className="flex-row items-center justify-between rounded-2xl border border-line bg-paper p-3"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-sm text-ink-2" numberOfLines={1}>
                    {mv.origin}
                  </Text>
                  <Text className="font-mono text-[10px] text-ink-4">
                    {dateFr(mv.date)} · {mv.statusLabel}
                  </Text>
                </View>
                <Text
                  className={`font-serif text-base ${
                    mv.amountCents > 0 ? "text-violet" : "text-ink-3"
                  }`}
                >
                  {mv.sign}
                  {eur(Math.abs(mv.amountEur))}
                </Text>
              </View>
            ))}
          </View>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
