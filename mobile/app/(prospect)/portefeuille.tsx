// 1er écran réellement branché : Portefeuille prospect via
// /api/prospect/wallet (la MÊME route que le web → mêmes données,
// synchro par construction). Pull-to-refresh = fraîcheur active (§6.2).
import { useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { ApiError } from "../../lib/api";
import { useProspectWallet } from "../../lib/queries";

const eur = (n: unknown) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(n ?? 0));

export default function Portefeuille() {
  const q = useProspectWallet();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await q.refetch();
    setRefreshing(false);
  }

  return (
    <ScrollView
      className="flex-1 bg-ivory"
      contentContainerClassName="p-5 gap-4"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {q.isPending ? (
        <View className="items-center py-16">
          <ActivityIndicator color="#4F46E5" />
        </View>
      ) : q.isError ? (
        <View className="rounded-xl border-l-4 border-bad bg-paper p-4">
          <Text className="text-sm text-bad">
            {q.error instanceof ApiError && q.error.status === 401
              ? "Session expirée — reconnectez-vous."
              : "Impossible de charger le portefeuille."}
          </Text>
        </View>
      ) : (
        <>
          <View className="rounded-2xl bg-ink p-6">
            <Text className="font-mono text-xs uppercase text-ink-5">
              Solde disponible
            </Text>
            <Text className="mt-1 font-serif text-4xl text-paper">
              {eur(q.data?.balanceEur)}
            </Text>
          </View>
          <View className="rounded-2xl border border-line bg-paper p-5">
            <Text className="font-mono text-xs uppercase text-ink-4">
              Gains du mois
            </Text>
            <Text className="mt-1 font-serif text-2xl text-ink">
              {eur(q.data?.monthGainsEur)}
            </Text>
          </View>
          <Text className="text-center text-xs text-ink-4">
            Données servies par /api/prospect/wallet — identiques au web.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
