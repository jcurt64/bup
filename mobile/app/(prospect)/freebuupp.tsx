// FREEBUUPP — espace prospect : feed des tirages ouverts + participation
// (ticket n°N) + mes participations + signalement non-réception du lot.
// Écran secondaire (href:null) ouvert depuis le drawer prospect.
import { useCallback } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { Card, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import {
  useFreebuuppFeed,
  useFreebuuppMine,
  useJoinFreebuupp,
  useReportFreebuupp,
  type FreebuuppFeedItem,
  type FreebuuppParticipation,
} from "../../lib/queries";
import { useTheme } from "../../lib/theme";
import { ApiError } from "../../lib/api";

function countdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Clôturé";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function FreebuuppProspect() {
  const { c } = useTheme();
  const feed = useFreebuuppFeed();
  const mine = useFreebuuppMine();
  const join = useJoinFreebuupp();
  const report = useReportFreebuupp();

  const onRefresh = useCallback(async () => {
    await Promise.all([feed.refetch(), mine.refetch()]);
  }, [feed, mine]);

  async function doJoin(fb: FreebuuppFeedItem) {
    try {
      const res = await join.mutateAsync({ id: fb.id });
      Alert.alert("Vous participez 🎫", `Votre numéro de tirage : #${res.participantNumber}\n\nSi vous gagnez, le professionnel vous contactera par téléphone.`);
    } catch (e) {
      let msg = "Réessayez.";
      if (e instanceof ApiError) {
        try {
          const b = JSON.parse(e.body) as { error?: string };
          if (b.error === "phone_unverified")
            msg = "Vérifiez d'abord votre numéro de téléphone (Paliers de vérification).";
          else if (b.error === "already_joined") msg = "Vous êtes déjà inscrit.";
          else if (b.error === "panel_full") msg = "Le panel est complet.";
          else if (b.error === "not_open") msg = "Les inscriptions sont closes.";
          else if (b.error === "freebuupp_disabled") msg = "Le service n'est pas encore actif.";
        } catch {}
      }
      Alert.alert("Participation impossible", msg);
    }
  }

  function doReport(p: FreebuuppParticipation) {
    Alert.alert(
      "Signaler la non-réception",
      `Vous avez gagné « ${p.title ?? "ce FREEBUUPP"} » mais n'avez pas reçu votre lot ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Signaler",
          style: "destructive",
          onPress: async () => {
            try {
              await report.mutateAsync({ id: p.freebuuppId });
              Alert.alert("Signalement envoyé", "BUUPP a bien reçu votre signalement.");
            } catch {
              Alert.alert("Erreur", "Réessayez plus tard.");
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollScreen
      onRefresh={onRefresh}
      hero={{
        eyebrow: "Tirage au sort",
        title: "FREEBUUPP",
        desc: "Inscrivez-vous gratuitement — un tirage vérifiable désigne les gagnants.",
        nav: "drawer",
      }}
    >
      <View className="gap-4">
        <SectionTitle eyebrow="En cours" title="Tirages ouverts" />
        <QueryGate
          query={feed}
          isEmpty={(d) => d.freebuupps.length === 0}
          emptyLabel="Aucun FREEBUUPP ouvert près de chez vous."
        >
          {(d) =>
            d.freebuupps.map((fb) => (
              <Card key={fb.id} badge={{ icon: "gift-outline", tone: "amber" }} tone="amber">
                <Text className="font-mono text-[11px] uppercase text-ink-4">{fb.brandName}</Text>
                <Text className="mt-1 font-serif text-xl text-ink">{fb.title}</Text>
                <Text className="mt-1 text-lg text-ink-3">🎁 {fb.prizeDescription}</Text>
                <View className="mt-2 flex-row justify-between">
                  <Text className="text-sm text-ink-4">⏳ {countdown(fb.closesAt)}</Text>
                  <Text className="text-sm text-ink-4">
                    {fb.placesLeft} places · {fb.winnersCount} gagnants
                  </Text>
                </View>
                {fb.alreadyJoined ? (
                  <View
                    className="mt-3 items-center rounded-full py-3"
                    style={{ backgroundColor: c.ink }}
                  >
                    <Text className="text-sm font-semibold" style={{ color: c.paper }}>
                      ✓ Inscrit · n°{fb.myNumber}
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    disabled={join.isPending}
                    onPress={() => doJoin(fb)}
                    className="mt-3 items-center rounded-full py-3 active:opacity-80"
                    style={{ backgroundColor: c.accent }}
                  >
                    <Text className="text-sm font-semibold" style={{ color: c.paper }}>
                      {join.isPending ? "Inscription…" : "Je participe"}
                    </Text>
                  </Pressable>
                )}
              </Card>
            ))
          }
        </QueryGate>

        <View className="mt-2">
          <SectionTitle eyebrow="Historique" title="Mes participations" />
        </View>
        <QueryGate
          query={mine}
          isEmpty={(d) => d.participations.length === 0}
          emptyLabel="Vous n'avez encore participé à aucun tirage."
        >
          {(d) =>
            d.participations.map((p) => (
              <Card key={p.freebuuppId}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="font-semibold text-ink">{p.title ?? "FREEBUUPP"}</Text>
                    <Text className="text-sm text-ink-4">
                      {p.brandName} · n°{p.participantNumber}
                    </Text>
                  </View>
                  <View className="items-end">
                    {p.result === "pending" && (
                      <Text className="font-mono text-[11px] uppercase text-ink-4">En attente</Text>
                    )}
                    {p.result === "lost" && <Text className="text-sm text-ink-4">Pas cette fois</Text>}
                    {p.result === "won" && (
                      <Text className="text-sm font-bold" style={{ color: c.good }}>
                        🎉 Gagné
                      </Text>
                    )}
                    {p.result === "won" &&
                      (p.prizeReported ? (
                        <Text className="mt-1 font-mono text-[11px] uppercase text-ink-4">Signalé</Text>
                      ) : (
                        <Pressable onPress={() => doReport(p)} className="mt-1 active:opacity-70">
                          <Text className="text-xs" style={{ color: c.bad }}>
                            Lot non reçu ?
                          </Text>
                        </Pressable>
                      ))}
                  </View>
                </View>
              </Card>
            ))
          }
        </QueryGate>
      </View>
    </ScrollScreen>
  );
}
