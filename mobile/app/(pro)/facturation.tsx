// Facturation — crédit (/api/pro/wallet) + factures (/api/pro/invoices).
import { Text, View } from "react-native";

import {
  Card,
  dateFr,
  eur,
  QueryGate,
  ScrollScreen,
  Stat,
} from "../../components/screen";
import { useProInvoices, useProWallet } from "../../lib/queries";

export default function Facturation() {
  const w = useProWallet();
  const inv = useProInvoices();

  return (
    <ScrollScreen
      headerVariant="pro"
      hero={{ nav: "drawer", eyebrow: "Facturation", title: "Crédit & factures" }}
      onRefresh={async () => {
        await Promise.all([w.refetch(), inv.refetch()]);
      }}
    >
      <QueryGate query={w}>
        {(d) => (
          <>
            <Card dark>
              <Text className="font-mono text-[11px] uppercase text-ink-5">
                Crédit disponible
              </Text>
              <Text className="mt-1 font-serif text-4xl text-paper">
                {eur(d.walletAvailableEur)}
              </Text>
            </Card>
            <View className="flex-row gap-3">
              <Stat label="Solde total" value={eur(d.walletBalanceEur)} />
              <Stat
                label="Réservé"
                value={eur(d.walletReservedEur)}
                hint="campagnes actives"
              />
            </View>
          </>
        )}
      </QueryGate>

      <Text
        className="mt-2 text-[11px] font-bold uppercase text-ink-4"
        style={{ letterSpacing: 1.2 }}
      >
        Factures
      </Text>
      <QueryGate
        query={inv}
        isEmpty={(d) => (d.invoices?.length ?? 0) === 0}
        emptyLabel="Aucune facture pour le moment."
      >
        {(d) => (
          <View className="gap-2">
            {d.invoices.map((f) => (
              <View
                key={f.number}
                className="flex-row items-center justify-between rounded-2xl border border-line bg-paper p-3"
              >
                <View className="flex-1 pr-2">
                  <Text className="text-sm text-ink">{f.label}</Text>
                  <Text className="font-mono text-[10px] text-ink-4">
                    {f.number} · {dateFr(f.date)} · {f.statusLabel}
                  </Text>
                </View>
                <Text className="font-mono text-sm text-ink-2">
                  {eur(f.amountEur)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
