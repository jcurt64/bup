// Analytics pro — /api/pro/analytics?campaignId&period. Parité web
// (Pro.jsx → Analytics) : filtres campagne + période (défaut : tout
// l'historique), taux de lecture des messages, paliers, heatmap
// « Meilleurs créneaux », géo, âge, sexe.
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { BottomSheet } from "../../components/bottom-sheet";
import { Card, QueryGate, ScrollScreen } from "../../components/screen";
import { useProAnalytics, type ProAnalytics as ProAnalyticsData } from "../../lib/queries";
import { useTheme } from "../../lib/theme";

type Period = "all" | "7d" | "30d" | "90d";
const PERIODS: [Period, string][] = [
  ["all", "Tout"],
  ["7d", "7J"],
  ["30d", "30J"],
  ["90d", "90J"],
];
const PERIOD_SCOPE: Record<Period, string> = {
  all: "depuis l'ouverture du compte",
  "7d": "sur les 7 derniers jours",
  "30d": "sur les 30 derniers jours",
  "90d": "sur les 90 derniers jours",
};

function Bars({
  rows,
}: {
  rows: { label: string; pct: number; hint?: string }[];
}) {
  const { c } = useTheme();
  if (rows.length === 0) {
    return <Text className="text-sm text-ink-4">Données insuffisantes.</Text>;
  }
  return (
    <View className="gap-2.5">
      {rows.map((r, i) => (
        <View key={i}>
          <View className="flex-row justify-between">
            <Text className="text-[13px] text-ink-2">{r.label}</Text>
            <Text className="font-mono text-[12px] text-ink-3">
              {r.hint ?? `${r.pct}%`}
            </Text>
          </View>
          <View
            className="mt-1 h-2 overflow-hidden rounded-full"
            style={{ backgroundColor: c.track }}
          >
            <View
              style={{
                width: `${Math.max(0, Math.min(100, r.pct))}%`,
                height: "100%",
                borderRadius: 999,
                backgroundColor: c.accent,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Filtres campagne + période ──────────────────────────────────────
function Filters({
  campaigns,
  campaignId,
  onCampaign,
  period,
  onPeriod,
}: {
  campaigns: ProAnalyticsData["campaigns"];
  campaignId: string | null;
  onCampaign: (id: string | null) => void;
  period: Period;
  onPeriod: (p: Period) => void;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const current = campaigns.find((x) => x.id === campaignId);
  const options: { id: string | null; name: string }[] = [
    { id: null, name: "Toutes les campagnes" },
    ...campaigns.map((x) => ({ id: x.id, name: x.name })),
  ];
  return (
    <Card>
      <Text className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: 1, color: c.textSub }}>
        Campagne
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Choisir la campagne"
        className="mt-1.5 flex-row items-center justify-between active:opacity-70"
        style={{ borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.field, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}
      >
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: c.text }}>
          {current ? current.name : "Toutes les campagnes"}
        </Text>
        <Ionicons name="chevron-down" size={16} color={c.ink4} />
      </Pressable>

      <Text className="mt-3 font-mono uppercase" style={{ fontSize: 10, letterSpacing: 1, color: c.textSub }}>
        Période
      </Text>
      <View className="mt-1.5 flex-row" style={{ gap: 6 }}>
        {PERIODS.map(([k, l]) => {
          const active = period === k;
          return (
            <Pressable
              key={k}
              onPress={() => onPeriod(k)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={k === "all" ? "Tout l'historique" : l}
              className="flex-1 items-center active:opacity-70"
              style={{ paddingVertical: 8, borderRadius: 999, backgroundColor: active ? c.btnBg : c.surface2 }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: "600", color: active ? c.btnText : c.textSub }}>{l}</Text>
            </Pressable>
          );
        })}
      </View>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text className="font-serif" style={{ fontSize: 20, color: c.text, marginBottom: 10 }}>
          Campagne
        </Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {options.map((o) => {
            const active = o.id === campaignId;
            return (
              <Pressable
                key={o.id ?? "all"}
                onPress={() => {
                  onCampaign(o.id);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className="flex-row items-center justify-between active:opacity-70"
                style={{ paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: c.borderSoft }}
              >
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, color: c.text, fontWeight: active ? "600" : "400" }}>
                  {o.name}
                </Text>
                {active ? <Ionicons name="checkmark" size={18} color={c.accent} /> : null}
              </Pressable>
            );
          })}
          <View style={{ height: 12 }} />
        </ScrollView>
      </BottomSheet>
    </Card>
  );
}

// ── Lecture des messages (open-rate, pixel gaté consentement CNIL) ────
function MessageOpensCard({ m }: { m: NonNullable<ProAnalyticsData["messageOpens"]> }) {
  const { c } = useTheme();
  const s = (n: number) => (n > 1 ? "s" : "");
  return (
    <Card>
      <Text className="font-serif text-lg text-ink">Lecture des messages</Text>
      <Text className="mt-0.5 text-[12px] text-ink-4">
        Part des prospects acceptés qui ont ouvert les messages que vous leur avez envoyés via BUUPP
      </Text>
      {m.rate === null ? (
        <View className="mt-3 items-center" style={{ paddingVertical: 8 }}>
          <Ionicons name="mail-open-outline" size={24} color={c.ink4} />
          <Text className="mt-2 text-center text-sm font-medium text-ink-2">
            {m.sent === 0 ? "Aucun message envoyé" : "Aucun message suivi pour l'instant"}
          </Text>
          <Text className="mt-0.5 text-center text-[12px] text-ink-4">
            {m.sent === 0
              ? "Dès que vous écrirez à vos prospects acceptés (onglet Contacts ou diffusion de segment), leur taux de lecture s'affichera ici."
              : `${m.sent} message${s(m.sent)} envoyé${s(m.sent)}, mais aucun n'est traçable : le suivi d'ouverture n'est activé que pour les prospects ayant explicitement consenti.`}
          </Text>
        </View>
      ) : (
        <View className="mt-3">
          <Text className="font-serif" style={{ fontSize: 48, lineHeight: 52, color: c.accent }}>
            {m.rate}%
          </Text>
          <View className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: c.track }}>
            <View style={{ width: `${Math.min(100, m.rate)}%`, height: "100%", borderRadius: 999, backgroundColor: c.accent }} />
          </View>
          <Text className="mt-2 text-[14px] text-ink-2">
            <Text style={{ fontWeight: "700" }}>{m.opened}</Text> ouverture{s(m.opened)} sur{" "}
            <Text style={{ fontWeight: "700" }}>{m.trackable}</Text> message{s(m.trackable)} suivi{s(m.trackable)}
          </Text>
          <Text className="mt-1 font-mono text-[11px] text-ink-4">
            {m.sent} envoyé{s(m.sent)} au total
            {m.sent > m.trackable ? ` · ${m.sent - m.trackable} sans suivi (consentement non donné)` : ""}
          </Text>
        </View>
      )}
    </Card>
  );
}

// ── Heatmap « Meilleurs créneaux » (jour × heure, heure de Paris) ─────
const DAYS = ["L", "M", "M", "J", "V", "S", "D"];
const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function Heatmap({ h }: { h: ProAnalyticsData["creneauHeatmap"] | null | undefined }) {
  const { c } = useTheme();
  const hours = (h?.hourLabels ?? [8, 10, 12, 14, 16, 18, 20]).map(String);
  const counts = h?.counts ?? DAYS.map(() => hours.map(() => 0));
  const max = h?.max ?? 0;
  const total = h?.total ?? 0;
  const cells: { di: number; hi: number; count: number }[] = [];
  for (let di = 0; di < DAYS.length; di++) {
    for (let hi = 0; hi < hours.length; hi++) {
      const n = counts[di]?.[hi] ?? 0;
      if (n > 0) cells.push({ di, hi, count: n });
    }
  }
  cells.sort((a, b) => b.count - a.count);
  const top = cells.slice(0, 3);

  return (
    <View>
      <View className="flex-row" style={{ gap: 4 }}>
        <View style={{ width: 16 }} />
        {hours.map((hh) => (
          <Text key={hh} className="font-mono" style={{ flex: 1, fontSize: 10, color: c.ink4, textAlign: "center" }}>
            {hh}h
          </Text>
        ))}
      </View>
      {DAYS.map((d, di) => (
        <View key={di} className="flex-row items-center" style={{ gap: 4, marginTop: 4 }}>
          <Text className="font-mono" style={{ width: 16, fontSize: 10, color: c.ink4 }}>
            {d}
          </Text>
          {hours.map((hh, hi) => {
            const n = counts[di]?.[hi] ?? 0;
            const intensity = max > 0 ? n / max : 0;
            return (
              <View
                key={hi}
                accessibilityLabel={`${DAY_LABELS[di]} ${hh}h : ${n} acceptation${n > 1 ? "s" : ""}`}
                style={{
                  flex: 1,
                  aspectRatio: 1,
                  borderRadius: 4,
                  overflow: "hidden",
                  backgroundColor: c.track,
                  borderWidth: n > 0 && intensity < 0.1 ? 1 : 0,
                  borderColor: c.accent + "33",
                }}
              >
                {intensity > 0 ? (
                  <View style={{ flex: 1, backgroundColor: c.accent, opacity: intensity * 0.8 }} />
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
      {total === 0 ? (
        <Text className="mt-3 text-[12px] leading-5 text-ink-4">
          Aucune acceptation enregistrée pour le moment. La heatmap s&apos;animera dès vos premiers contacts.
        </Text>
      ) : (
        <Text className="mt-3 text-[12px] leading-5 text-ink-3">
          <Text className="font-mono uppercase text-ink-4" style={{ fontSize: 10, letterSpacing: 1 }}>
            Top créneaux ·{" "}
          </Text>
          {top.map((t, i) => (
            <Text key={i}>
              <Text style={{ fontWeight: "700" }}>
                {DAY_LABELS[t.di]} {hours[t.hi]}h
              </Text>{" "}
              ({t.count}){i < top.length - 1 ? ", " : ""}
            </Text>
          ))}
          <Text className="text-ink-4">
            {" "}
            — sur {total} acceptation{total > 1 ? "s" : ""} au total
          </Text>
        </Text>
      )}
    </View>
  );
}

export default function ProAnalytics() {
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("all");
  const q = useProAnalytics(campaignId ?? undefined, period);

  // Sous-titre : reflète le périmètre réel des chiffres (parité web).
  const d = q.data;
  const wins = d?.sampleSize.wins ?? 0;
  const camp = campaignId ? d?.campaigns.find((x) => x.id === campaignId) : null;
  const scope = !d
    ? "Analyses de vos campagnes."
    : wins === 0
      ? "Aucune mise en relation acceptée pour ce périmètre — modifiez les filtres pour élargir la sélection."
      : `Analyses ${campaignId ? `de ${camp ? `« ${camp.name} »` : "la campagne sélectionnée"}` : "cumulées"} ${PERIOD_SCOPE[period]} · calculées sur ${wins} acceptation${wins > 1 ? "s" : ""}`;

  return (
    <ScrollScreen
      headerVariant="pro"
      hero={{
        nav: "drawer",
        eyebrow: "Analytics",
        title: "Performance",
        desc: scope,
      }}
      onRefresh={q.refetch}
    >
      <QueryGate query={q}>
        {(d) => (
          <View className="gap-4" style={{ opacity: q.isFetching && q.isPlaceholderData ? 0.6 : 1 }}>
            <Filters
              campaigns={d.campaigns ?? []}
              campaignId={campaignId}
              onCampaign={setCampaignId}
              period={period}
              onPeriod={setPeriod}
            />

            <MessageOpensCard
              m={d.messageOpens ?? { sent: 0, trackable: 0, opened: 0, rate: null }}
            />

            <Card>
              <Text className="font-serif text-lg text-ink">Par palier</Text>
              <View className="mt-3">
                <Bars
                  rows={d.acceptanceByTier.map((t) => ({
                    label: t.label,
                    pct: t.pct,
                  }))}
                />
              </View>
            </Card>

            <Card>
              <Text className="font-serif text-lg text-ink">Meilleurs créneaux</Text>
              <Text className="mt-0.5 text-[12px] text-ink-4">
                Concentration des acceptations heure × jour (heure de Paris)
              </Text>
              <View className="mt-3">
                <Heatmap h={d.creneauHeatmap} />
              </View>
            </Card>

            <Card>
              <Text className="font-serif text-lg text-ink">Top localisations</Text>
              <View className="mt-3">
                <Bars
                  rows={d.geoBreakdown.map((g) => ({
                    label: g.ville,
                    pct: g.pct,
                    hint: `${g.contacts} contact${g.contacts > 1 ? "s" : ""}`,
                  }))}
                />
              </View>
            </Card>

            <View className="flex-row gap-3">
              <Card className="flex-1">
                <Text className="font-serif text-lg text-ink">Âge</Text>
                <View className="mt-3">
                  <Bars rows={d.ageBreakdown} />
                </View>
              </Card>
              <Card className="flex-1">
                <Text className="font-serif text-lg text-ink">Sexe</Text>
                <View className="mt-3">
                  <Bars rows={d.sexBreakdown} />
                </View>
              </Card>
            </View>

            <Text className="text-center text-[11px] text-ink-4">
              Échantillon : {d.sampleSize.rows} sollicitation
              {d.sampleSize.rows > 1 ? "s" : ""} · {d.sampleSize.wins} acceptée
              {d.sampleSize.wins > 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
