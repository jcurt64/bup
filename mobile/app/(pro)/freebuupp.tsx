// FREEBUUPP — espace pro : liste des tirages + création (10 € wallet).
// Le détail / tirage / mail consolation est sur freebuupp-detail.tsx.
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { Card, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import {
  useCreateFreebuupp,
  useProFreebuupps,
  type ProFreebuuppItem,
} from "../../lib/queries";
import { useTheme } from "../../lib/theme";
import { ApiError } from "../../lib/api";

const PANELS = [30, 50, 80];
const WINNERS = [2, 5, 10];
const GEOS: { id: string; label: string }[] = [
  { id: "national", label: "National" },
  { id: "region", label: "Région" },
  { id: "dept", label: "Département" },
  { id: "ville", label: "Ville" },
];
const STATUS_LABEL: Record<string, string> = {
  open: "En cours",
  closed: "Tirage…",
  drawn: "Tiré",
  canceled: "Annulé",
};

function countdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Clôturé";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function FreebuuppPro() {
  const { c } = useTheme();
  const list = useProFreebuupps();
  const create = useCreateFreebuupp();

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [prize, setPrize] = useState("");
  const [panel, setPanel] = useState(30);
  const [winners, setWinners] = useState(2);
  const [geo, setGeo] = useState("national");

  const onRefresh = useCallback(async () => {
    await list.refetch();
  }, [list]);

  function resetForm() {
    setTitle("");
    setPrize("");
    setPanel(30);
    setWinners(2);
    setGeo("national");
  }

  async function submit() {
    if (!title.trim() || !prize.trim()) {
      Alert.alert("Champs requis", "Renseignez un titre et le lot à gagner.");
      return;
    }
    if (winners >= panel) {
      Alert.alert("Réglage invalide", "Le nombre de gagnants doit être inférieur au panel.");
      return;
    }
    try {
      await create.mutateAsync({
        title: title.trim(),
        prizeDescription: prize.trim(),
        panelSize: panel,
        winnersCount: winners,
        geo,
      });
      resetForm();
      setCreating(false);
    } catch (e) {
      let msg = "Réessayez.";
      if (e instanceof ApiError) {
        try {
          const b = JSON.parse(e.body) as { error?: string };
          if (b.error === "insufficient_funds") msg = "Crédit insuffisant (10 € requis). Rechargez votre compte.";
          else if (b.error === "missing_company_info")
            msg = "Renseignez votre raison sociale et votre ville dans Mes informations.";
          else if (b.error === "freebuupp_disabled") msg = "Le service FREEBUUPP n'est pas encore activé.";
        } catch {}
      }
      Alert.alert("Lancement impossible", msg);
    }
  }

  const Chip = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      className="rounded-full px-4 py-2 active:opacity-80"
      style={{
        backgroundColor: active ? c.ink : c.field,
        borderWidth: 1,
        borderColor: c.field,
      }}
    >
      <Text className="text-sm" style={{ color: active ? c.paper : c.ink, fontWeight: active ? "600" : "400" }}>
        {label}
      </Text>
    </Pressable>
  );

  const input = {
    backgroundColor: c.field,
    color: c.ink,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  } as const;

  return (
    <ScrollScreen
      onRefresh={onRefresh}
      headerVariant="pro"
      hero={{
        eyebrow: "Tirage au sort",
        title: "FREEBUUPP",
        desc: "Faites découvrir un produit ou service — 10 € par tirage.",
        nav: "drawer",
      }}
    >
      <View className="gap-4">
        {!creating && (
          <Pressable
            onPress={() => setCreating(true)}
            className="items-center rounded-full py-3 active:opacity-80"
            style={{ backgroundColor: c.accent }}
          >
            <Text className="text-sm font-semibold" style={{ color: c.paper }}>
              + Lancer un FREEBUUPP
            </Text>
          </Pressable>
        )}

        {creating && (
          <Card>
            <SectionTitle eyebrow="FREEBUUPP" title="Nouveau tirage" />
            <View className="mt-3 gap-3">
              <TextInput
                value={title}
                onChangeText={setTitle}
                maxLength={120}
                placeholder="Titre (ex. 1 soin offert)"
                placeholderTextColor={c.textMuted}
                style={input}
              />
              <TextInput
                value={prize}
                onChangeText={setPrize}
                maxLength={200}
                placeholder="Lot à gagner (ex. soin du visage, 60 €)"
                placeholderTextColor={c.textMuted}
                style={input}
              />
              <Text className="font-mono text-[11px] uppercase text-ink-4">Participants (panel)</Text>
              <View className="flex-row gap-2">
                {PANELS.map((p) => (
                  <Chip key={p} active={panel === p} label={String(p)} onPress={() => setPanel(p)} />
                ))}
              </View>
              <Text className="font-mono text-[11px] uppercase text-ink-4">Gagnants</Text>
              <View className="flex-row gap-2">
                {WINNERS.map((w) => (
                  <Chip key={w} active={winners === w} label={String(w)} onPress={() => setWinners(w)} />
                ))}
              </View>
              <Text className="font-mono text-[11px] uppercase text-ink-4">Zone</Text>
              <View className="flex-row flex-wrap gap-2">
                {GEOS.map((g) => (
                  <Chip key={g.id} active={geo === g.id} label={g.label} onPress={() => setGeo(g.id)} />
                ))}
              </View>

              <View className="mt-2 flex-row items-center justify-between">
                <Pressable onPress={() => { setCreating(false); resetForm(); }} className="active:opacity-70">
                  <Text className="text-sm text-ink-4">Annuler</Text>
                </Pressable>
                <Pressable
                  disabled={create.isPending}
                  onPress={submit}
                  className="rounded-full px-5 py-3 active:opacity-80"
                  style={{ backgroundColor: c.accent }}
                >
                  <Text className="text-sm font-semibold" style={{ color: c.paper }}>
                    {create.isPending ? "Lancement…" : "Lancer (10 €)"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Card>
        )}

        <SectionTitle eyebrow="Mes tirages" title="FREEBUUPP" />
        <QueryGate
          query={list}
          isEmpty={(d) => d.freebuupps.length === 0}
          emptyLabel="Aucun FREEBUUPP pour l'instant."
        >
          {(d) =>
            d.freebuupps.map((fb: ProFreebuuppItem) => (
              <Pressable
                key={fb.id}
                onPress={() => router.push({ pathname: "/(pro)/freebuupp-detail", params: { id: fb.id } })}
                className="active:opacity-80"
              >
                <Card>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="font-semibold text-ink">{fb.title}</Text>
                      <Text className="text-sm text-ink-4">
                        🎁 {fb.prize_description} · {fb.panel_size} places · nombre de gagnant pour le tirage : {fb.winners_count}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="font-mono text-[11px] uppercase text-ink-4">
                        {STATUS_LABEL[fb.effectiveStatus] ?? fb.status}
                      </Text>
                      {fb.effectiveStatus === "open" && (
                        <Text className="text-sm text-ink-4">{countdown(fb.closes_at)}</Text>
                      )}
                      {fb.effectiveStatus === "closed" && (
                        <Text className="text-sm font-bold" style={{ color: c.accent }}>
                          Tirage en cours…
                        </Text>
                      )}
                    </View>
                  </View>
                </Card>
              </Pressable>
            ))
          }
        </QueryGate>
      </View>
    </ScrollScreen>
  );
}
