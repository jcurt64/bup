// Contacts acquis — /api/pro/contacts. E-mail/téléphone renvoyés
// MASQUÉS par le serveur (alias watermarqué / numéro tronqué) :
// l'app affiche ce que l'API renvoie, jamais les vraies coordonnées
// brutes (invariant RGPD/anti-fraude — cf. MOBILE_APP_SPEC §6.4).
import { Text, View } from "react-native";

import { Card, dateFr, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import { useProContacts } from "../../lib/queries";

export default function Contacts() {
  const q = useProContacts();
  return (
    <ScrollScreen onRefresh={q.refetch}>
      <SectionTitle
        eyebrow="Contacts"
        title="Prospects acquis"
        desc="Coordonnées révélées via un alias tracé — toute fuite est imputable."
      />
      <QueryGate
        query={q}
        isEmpty={(d) => (d.rows?.length ?? 0) === 0}
        emptyLabel="Aucun contact acquis pour le moment."
      >
        {(d) => (
          <View className="gap-3">
            {d.rows.map((r) => (
              <Card key={r.relationId}>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="font-serif text-lg text-ink">
                      {r.name}
                    </Text>
                    <Text className="text-xs text-ink-4">
                      {r.campaign} · Palier {r.tier}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="font-mono text-xs text-ink-3">
                      Score {r.score}
                    </Text>
                    <Text className="font-mono text-[10px] text-ink-4">
                      {dateFr(r.receivedAt)}
                    </Text>
                  </View>
                </View>
                <View className="mt-3 gap-1">
                  <Text className="font-mono text-xs text-ink-2">
                    ✉︎ {r.email ?? "—"}
                  </Text>
                  <Text className="font-mono text-xs text-ink-2">
                    ☎︎ {r.telephone ?? "—"}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
