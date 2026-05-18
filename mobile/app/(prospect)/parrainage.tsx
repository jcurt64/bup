// Parrainage — /api/prospect/parrainage. Partage du code via Share natif.
// Champs = Prospect.jsx fn Parrainage (web).
import { Pressable, Share, Text, View } from "react-native";

import { Card, dateFr, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import { useParrainage } from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

export default function ParrainageScreen() {
  const q = useParrainage();
  useRefetchOnFocus(q);
  return (
    <ScrollScreen onRefresh={q.refetch}>
      <SectionTitle
        eyebrow="Parrainage"
        title="Invitez, gagnez plus"
        desc="Partagez votre code. Chaque filleul inscrit augmente vos avantages."
      />
      <QueryGate query={q}>
        {(d) => (
          <>
            <Card dark>
              <Text className="font-mono text-[11px] uppercase text-ink-5">
                Votre code
              </Text>
              <Text className="mt-1 font-serif text-3xl tracking-widest text-paper">
                {d.refCode}
              </Text>
              <Pressable
                className="mt-3 items-center rounded-full bg-paper py-2.5"
                onPress={() =>
                  Share.share({
                    message: `Rejoins BUUPP avec mon code ${d.refCode} : https://www.buupp.com/inscription/prospect?ref=${d.refCode}`,
                  })
                }
              >
                <Text className="text-sm font-semibold text-ink">Partager</Text>
              </Pressable>
            </Card>

            <View className="flex-row gap-3">
              <Card className="flex-1">
                <Text className="text-[10px] font-bold uppercase text-ink-4">
                  Filleuls
                </Text>
                <Text className="mt-1 font-serif text-2xl text-ink">
                  {d.count} / {d.cap}
                </Text>
              </Card>
              <Card className="flex-1">
                <Text className="text-[10px] font-bold uppercase text-ink-4">
                  Restants
                </Text>
                <Text className="mt-1 font-serif text-2xl text-violet">
                  {d.remaining}
                </Text>
              </Card>
            </View>

            {d.vipEligible ? (
              <Card>
                <Text className="text-sm text-good">
                  ✓ Éligible VIP ({d.vipThreshold} filleuls) — bonus{" "}
                  {d.vipFlatBonusEur} €
                </Text>
              </Card>
            ) : null}

            {d.launchAt ? (
              <Card>
                <Text className="text-xs text-ink-4">
                  Programme actif depuis le {dateFr(d.launchAt)}
                </Text>
              </Card>
            ) : null}

            <Card>
              <Text className="font-serif text-lg text-ink">Vos filleuls</Text>
              {d.filleuls.length > 0 ? (
                <View className="mt-2 gap-1">
                  {d.filleuls.map((f, i) => (
                    <View key={i} className="flex-row justify-between">
                      <Text className="text-sm text-ink-2">
                        {[f.prenom, f.nom].filter(Boolean).join(" ") || "—"}
                        {f.ville ? ` · ${f.ville}` : ""}
                      </Text>
                      <Text className="font-mono text-xs text-ink-4">
                        {dateFr(f.createdAt)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="mt-1 text-xs text-ink-4">
                  Aucun filleul pour le moment.
                </Text>
              )}
            </Card>
          </>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
