// Mes données — /api/prospect/donnees. Vue d'ensemble lecture seule des
// 5 paliers (champs renseignés). L'édition (PATCH par palier) sera
// ajoutée ensuite ; ici on présente fidèlement l'état réel.
import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";

import { useApi } from "../../lib/api";
import { Card, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";

type Tier = Record<string, unknown> | null;
type DonneesResp = {
  identity: Tier;
  localisation: Tier;
  vie: Tier;
  pro: Tier;
  patrimoine: Tier;
  hiddenTiers?: string[];
  removedTiers?: string[];
};

const TIERS: { key: keyof DonneesResp; n: number; label: string }[] = [
  { key: "identity", n: 1, label: "Identification" },
  { key: "localisation", n: 2, label: "Localisation" },
  { key: "vie", n: 3, label: "Style de vie" },
  { key: "pro", n: 4, label: "Professionnel" },
  { key: "patrimoine", n: 5, label: "Patrimoine" },
];

const filledEntries = (t: Tier) =>
  Object.entries(t ?? {}).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== "",
  );

export default function Donnees() {
  const api = useApi();
  const q = useQuery({
    queryKey: ["prospect", "donnees"],
    queryFn: () => api<DonneesResp>("/api/prospect/donnees"),
    staleTime: 30_000,
  });

  return (
    <ScrollScreen onRefresh={q.refetch}>
      <SectionTitle
        eyebrow="Mes données — RGPD art. 15 à 22"
        title="Vos paliers"
        desc="Plus vous renseignez de données, plus votre BUUPP Score et vos gains augmentent. Vous restez maître de ce que vous partagez."
      />
      <QueryGate query={q}>
        {(d) => (
          <View className="gap-3">
            {TIERS.map((t) => {
              const entries = filledEntries(d[t.key] as Tier);
              const hidden = d.hiddenTiers?.includes(String(t.key));
              const removed = d.removedTiers?.includes(String(t.key));
              return (
                <Card key={t.n} className={removed ? "opacity-60" : ""}>
                  <View className="flex-row items-center justify-between">
                    <Text className="font-serif text-lg text-ink">
                      P{t.n} · {t.label}
                    </Text>
                    <Text className="font-mono text-xs text-ink-4">
                      {removed
                        ? "supprimé"
                        : hidden
                          ? "masqué"
                          : `${entries.length} champ${entries.length > 1 ? "s" : ""}`}
                    </Text>
                  </View>
                  {entries.length > 0 ? (
                    <View className="mt-2 gap-1">
                      {entries.slice(0, 6).map(([k, v]) => (
                        <View key={k} className="flex-row justify-between">
                          <Text className="text-xs text-ink-4">{k}</Text>
                          <Text
                            className="max-w-[60%] text-right text-xs text-ink-2"
                            numberOfLines={1}
                          >
                            {String(v)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className="mt-1 text-xs text-ink-4">
                      Non renseigné.
                    </Text>
                  )}
                </Card>
              );
            })}
          </View>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
