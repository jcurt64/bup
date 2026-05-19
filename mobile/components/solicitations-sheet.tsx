// Sheet « Demandes de sollicitation » (icône cloche). Liste UNIQUEMENT les
// sollicitations en attente (useProspectRelations().pending, fetch DB —
// mêmes données synchro web). Tap → modal détail + Accepter/Refuser via
// useDecideRelation, à l'identique du web (cf. app/(prospect)/relations).
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import { eur } from "./screen";
import {
  useDecideRelation,
  useProspectRelations,
  type Relation,
} from "../lib/queries";

function PendingRow({
  r,
  onPress,
}: {
  r: Relation;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-line bg-paper p-4 active:opacity-80"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="font-serif text-lg text-ink">{r.pro}</Text>
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
    </Pressable>
  );
}

function DetailSheet({
  relation,
  onClose,
}: {
  relation: Relation | null;
  onClose: () => void;
}) {
  const decide = useDecideRelation();
  const [busy, setBusy] = useState<null | "accept" | "refuse">(null);

  async function act(action: "accept" | "refuse") {
    if (!relation) return;
    setBusy(action);
    try {
      await decide.mutateAsync({ id: relation.id, action });
      onClose();
    } finally {
      setBusy(null);
    }
  }

  return (
    <BottomSheet visible={relation !== null} onClose={onClose}>
      {relation ? (
        <View className="gap-3 pb-1">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="font-serif text-2xl text-ink">
                {relation.pro}
              </Text>
              <Text className="text-sm text-ink-4">{relation.sector}</Text>
            </View>
            <View className="items-end">
              <Text className="font-serif text-2xl text-violet">
                {eur(relation.reward)}
              </Text>
              <Text className="font-mono text-[11px] text-ink-4">
                Palier {relation.tier} · {relation.timer}
              </Text>
            </View>
          </View>

          {relation.motif ? (
            <Text className="text-lg leading-6 text-ink-3">
              {relation.motif}
            </Text>
          ) : null}
          {relation.brief ? (
            <Text className="text-sm leading-5 text-ink-4">
              {relation.brief}
            </Text>
          ) : null}

          <View className="mt-3 flex-row gap-3">
            <Pressable
              disabled={busy !== null}
              onPress={() => act("refuse")}
              className="flex-1 items-center rounded-full border border-line py-3.5 active:opacity-70"
            >
              <Text className="text-sm font-medium text-ink-3">
                {busy === "refuse" ? "…" : "Refuser"}
              </Text>
            </Pressable>
            <Pressable
              disabled={busy !== null}
              onPress={() => act("accept")}
              className="flex-1 items-center rounded-full bg-ink py-3.5 active:opacity-80"
            >
              <Text className="text-sm font-semibold text-paper">
                {busy === "accept" ? "…" : "Accepter"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

export function SolicitationsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const q = useProspectRelations();
  const [selected, setSelected] = useState<Relation | null>(null);
  const pending = q.data?.pending ?? [];

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose}>
        <Text className="mb-1 font-serif text-2xl text-ink">
          Demandes de sollicitation
        </Text>
        <Text className="mb-3 text-sm text-ink-4">
          {pending.length === 0
            ? "Aucune demande en attente."
            : `${pending.length} demande${
                pending.length > 1 ? "s" : ""
              } en attente`}
        </Text>

        {q.isPending ? (
          <View className="items-center py-10">
            <ActivityIndicator color="#7C5CFC" />
          </View>
        ) : q.isError ? (
          <View className="rounded-2xl border-l-4 border-bad bg-paper p-4">
            <Text className="text-sm text-bad">
              Impossible de charger les demandes.
            </Text>
          </View>
        ) : pending.length === 0 ? (
          <View className="items-center rounded-2xl border border-line bg-paper p-8">
            <Text className="text-center text-sm text-ink-4">
              Vous serez notifié·e dès qu'un pro souhaite vous contacter.
            </Text>
          </View>
        ) : (
          <ScrollView
            className="grow-0"
            contentContainerClassName="gap-3 pb-2"
            showsVerticalScrollIndicator={false}
          >
            {pending.map((r) => (
              <PendingRow
                key={r.id}
                r={r}
                onPress={() => setSelected(r)}
              />
            ))}
          </ScrollView>
        )}
      </BottomSheet>

      <DetailSheet
        relation={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
