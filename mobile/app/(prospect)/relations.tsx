// Mises en relation — /api/prospect/relations. Accept/refuse via la
// mutation useDecideRelation (body { action }) → invalidation des vues
// impactées (relations/wallet/score) = synchro web⇄mobile (§6.1).
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Card, eur, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import { useDecideRelation, useProspectRelations } from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

export default function Relations() {
  const q = useProspectRelations();
  const decide = useDecideRelation();
  useRefetchOnFocus(q);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(id: string, action: "accept" | "refuse") {
    setBusyId(id);
    try {
      await decide.mutateAsync({ id, action });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollScreen onRefresh={q.refetch}>
      <SectionTitle
        eyebrow="Mises en relation"
        title="Demandes en attente"
        desc="Acceptez pour être rémunéré·e. Sans réponse à temps, la sollicitation expire."
      />
      <QueryGate
        query={q}
        isEmpty={(d) => (d.pending?.length ?? 0) === 0}
        emptyLabel="Aucune demande en attente pour le moment."
      >
        {(d) => (
          <View className="gap-3">
            {d.pending.map((r) => (
              <Card key={r.id}>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="font-serif text-lg text-ink">
                      {r.pro}
                    </Text>
                    <Text className="text-xs text-ink-4">{r.sector}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="font-serif text-lg text-violet">
                      {eur(r.reward)}
                    </Text>
                    <Text className="font-mono text-[10px] text-ink-4">
                      Palier {r.tier} · {r.timer}
                    </Text>
                  </View>
                </View>
                {r.motif ? (
                  <Text className="mt-2 text-sm text-ink-3">{r.motif}</Text>
                ) : null}
                {r.brief ? (
                  <Text className="mt-1 text-xs text-ink-4">{r.brief}</Text>
                ) : null}
                <View className="mt-4 flex-row gap-3">
                  <Pressable
                    disabled={busyId === r.id}
                    onPress={() => act(r.id, "refuse")}
                    className="flex-1 items-center rounded-full border border-line py-3 active:opacity-70"
                  >
                    <Text className="text-sm font-medium text-ink-3">
                      Refuser
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={busyId === r.id}
                    onPress={() => act(r.id, "accept")}
                    className="flex-1 items-center rounded-full bg-ink py-3 active:opacity-80"
                  >
                    <Text className="text-sm font-semibold text-paper">
                      {busyId === r.id ? "…" : "Accepter"}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        )}
      </QueryGate>

      {q.data?.history?.length ? (
        <View className="gap-2">
          <Text
            className="mt-2 text-[11px] font-bold uppercase text-ink-4"
            style={{ letterSpacing: 1.2 }}
          >
            Historique
          </Text>
          {q.data.history.slice(0, 20).map((r) => (
            <View
              key={r.id}
              className="flex-row justify-between rounded-2xl border border-line bg-paper p-3"
            >
              <Text className="text-sm text-ink-2">{r.pro}</Text>
              <View className="items-end">
                <Text className="font-mono text-xs text-ink-4">{eur(r.reward)}</Text>
                <Text className="font-mono text-[10px] text-ink-4">
                  {r.status ?? ""}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollScreen>
  );
}
