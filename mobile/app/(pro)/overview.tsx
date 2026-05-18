// Vue d'ensemble pro — squelette branché sur /api/pro/overview.
// (Première brique ; KPI/graphes à enrichir au fil de l'intégration.)
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { useApi } from "../../lib/api";

export default function ProOverview() {
  const api = useApi();
  const q = useQuery({
    queryKey: ["pro", "overview"],
    queryFn: () => api<Record<string, unknown>>("/api/pro/overview"),
    staleTime: 30_000,
  });

  return (
    <ScrollView
      className="flex-1 bg-ivory"
      contentContainerClassName="p-5 gap-4"
    >
      {q.isPending ? (
        <View className="items-center py-16">
          <ActivityIndicator color="#4F46E5" />
        </View>
      ) : q.isError ? (
        <Text className="text-sm text-bad">
          Impossible de charger la vue d&apos;ensemble.
        </Text>
      ) : (
        <View className="rounded-2xl border border-line bg-paper p-5">
          <Text className="font-mono text-xs uppercase text-ink-4">
            /api/pro/overview
          </Text>
          <Text className="mt-2 text-sm text-ink-2">
            Connecté — squelette pro prêt. Brancher ici les KPI réels
            (contacts acceptés, taux, ROI…) renvoyés par l&apos;API.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
