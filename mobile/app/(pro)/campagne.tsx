// Détail d'une campagne — /api/pro/campaigns/[id]. Design aligné c1.html :
// en-tête (objectif, statut, méta, dupliquer), fenêtre de diffusion,
// entonnoir (matching → crédit), barre de budget, liste de contacts.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Card, dateFr, eur, QueryGate, ScrollScreen } from "../../components/screen";
import { useProCampaign, type ProCampaignDetail } from "../../lib/queries";
import { useTheme } from "../../lib/theme";

function statusMeta(status: string, c: ReturnType<typeof useTheme>["c"]) {
  switch (status) {
    case "active":
      return { label: "Active", color: c.good, bg: c.goodSoft };
    case "paused":
      return { label: "En pause", color: c.warn, bg: c.amberSoft };
    case "draft":
      return { label: "Brouillon", color: c.textMuted, bg: c.surface2 };
    default:
      return { label: "Terminée", color: c.textSub, bg: c.surface2 };
  }
}

// Étapes de l'entonnoir (matching → crédit).
const FUNNEL: { key: keyof ProCampaignDetail["funnel"]; label: string }[] = [
  { key: "matched", label: "Prospects matchés" },
  { key: "sent", label: "Sollicitations envoyées" },
  { key: "accepted", label: "Acceptés" },
  { key: "settled", label: "Crédités" },
  { key: "refused", label: "Refusés" },
  { key: "expired", label: "Expirés" },
];

function FunnelRow({ label, count, base }: { label: string; count: number; base: number }) {
  const { c } = useTheme();
  const pct = base > 0 ? Math.round((count / base) * 100) : 0;
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text className="text-[13px] text-ink-2">{label}</Text>
        <Text className="font-mono text-[12px] text-ink-3">
          {count} · {pct} %
        </Text>
      </View>
      <View className="mt-1 h-2 overflow-hidden rounded-full" style={{ backgroundColor: c.track }}>
        <LinearGradient
          colors={[c.violet, c.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", borderRadius: 999 }}
        />
      </View>
    </View>
  );
}

export default function ProCampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const q = useProCampaign(id);
  const { c } = useTheme();
  const d = q.data;

  return (
    <ScrollScreen
      headerVariant="pro"
      hero={{
        nav: "back",
        eyebrow: "Campagne",
        title: d?.objectiveLabel ?? "Campagne",
        desc: d?.name ?? undefined,
      }}
      onRefresh={q.refetch}
    >
      <QueryGate query={q}>
        {(d) => {
          const sm = statusMeta(d.status, c);
          const budgetPct =
            d.budgetEur > 0
              ? Math.max(0, Math.min(100, Math.round((d.spentEur / d.budgetEur) * 100)))
              : 0;
          return (
            <View className="gap-4">
              {/* Statut + méta + dupliquer. */}
              <Card>
                <View className="flex-row items-center justify-between">
                  <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: sm.bg }}>
                    <Text className="text-[11px] font-bold" style={{ color: sm.color }}>
                      {sm.label}
                    </Text>
                  </View>
                  <Text className="font-mono text-[11px] text-ink-4">
                    Coût moyen {eur(d.avgCostEur)}
                  </Text>
                </View>
                <Text className="mt-2 text-[12.5px] leading-5 text-ink-3">
                  Créée le {d.createdAtLabel} · diffusion jusqu&apos;au{" "}
                  {d.endsAtLabel ?? "—"} · coût unitaire {eur(d.costPerContactEur)}
                </Text>
                <Pressable
                  onPress={() =>
                    router.push(
                      (d.objectiveId
                        ? `/(pro)/objectif?id=${d.objectiveId}`
                        : "/(pro)/creation") as never,
                    )
                  }
                  accessibilityRole="button"
                  className="mt-3 flex-row items-center justify-center gap-2 rounded-full border py-2.5 active:opacity-80"
                  style={{ borderColor: c.borderSoft }}
                >
                  <Ionicons name="copy-outline" size={15} color={c.ink3} />
                  <Text className="text-[13px] font-medium text-ink-3">Dupliquer cette campagne</Text>
                </Pressable>
              </Card>

              {/* Fenêtre de diffusion. */}
              <View>
                <Text className="mb-2 font-mono uppercase" style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: c.textSub }}>
                  Fenêtre de diffusion
                </Text>
                <Card>
                  <View className="flex-row items-center" style={{ gap: 10 }}>
                    <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: c.tintViolet }}>
                      <Ionicons name="time-outline" size={20} color={c.accVioletDeep} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[13px] text-ink-2">
                        {d.startsAtLabel} → {d.endsAtLabel ?? "—"}
                      </Text>
                      <Text className="text-[11.5px] text-ink-4">
                        {d.status === "active" ? "Diffusion en cours" : "Campagne clôturée"}
                      </Text>
                    </View>
                  </View>
                </Card>
              </View>

              {/* Entonnoir. */}
              <View>
                <Text className="mb-2 font-mono uppercase" style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: c.textSub }}>
                  Entonnoir
                </Text>
                <Card>
                  <Text className="text-[12px] text-ink-4">Du matching au crédit</Text>
                  <View className="mt-3 gap-3">
                    {FUNNEL.map((f) => (
                      <FunnelRow
                        key={f.key}
                        label={f.label}
                        count={d.funnel[f.key]}
                        base={d.funnel.matched || d.funnel.sent || 1}
                      />
                    ))}
                  </View>
                  {d.acceptanceRate != null ? (
                    <Text className="mt-3 text-center text-[11px] text-ink-4">
                      Taux d&apos;acceptation {d.acceptanceRate} % · {d.winCount} gagné
                      {d.winCount > 1 ? "s" : ""} sur {d.funnel.sent}
                    </Text>
                  ) : null}
                </Card>
              </View>

              {/* Budget. */}
              <View>
                <Text className="mb-2 font-mono uppercase" style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: c.textSub }}>
                  Budget
                </Text>
                <Card>
                  <Text className="text-[13px] text-ink-2">
                    {eur(d.spentEur)} engagés sur {eur(d.budgetEur)}
                  </Text>
                  <View className="mt-2 h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: c.track }}>
                    <LinearGradient
                      colors={[c.violet, c.accent]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ width: `${budgetPct}%`, height: "100%", borderRadius: 999 }}
                    />
                  </View>
                  <View className="mt-2 flex-row items-center justify-between">
                    <View>
                      <Text className="font-mono uppercase" style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: c.textMuted }}>
                        Reste à engager
                      </Text>
                      <Text className="mt-0.5 font-serif text-xl text-ink">{eur(d.remainingEur)}</Text>
                    </View>
                    <Text className="font-mono text-[11px] text-ink-4">{budgetPct} %</Text>
                  </View>
                </Card>
              </View>

              {/* Contacts. */}
              {d.contacts.length > 0 ? (
                <View>
                  <Text className="mb-2 font-mono uppercase" style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: c.textSub }}>
                    Contacts acquis
                  </Text>
                  <View className="rounded-2xl border" style={{ borderColor: c.borderSoft, backgroundColor: c.surface }}>
                    {d.contacts.map((ct, i) => (
                      <View
                        key={ct.id}
                        className="flex-row items-center justify-between px-4 py-3"
                        style={i > 0 ? { borderTopWidth: 1, borderTopColor: c.borderSoft } : undefined}
                      >
                        <View className="flex-1 pr-3">
                          <Text className="text-[14px] text-ink" numberOfLines={1}>
                            {ct.name}
                          </Text>
                          <Text className="text-[11.5px] text-ink-4">
                            {ct.tierLabel} · {dateFr(ct.decidedAt)}
                          </Text>
                        </View>
                        <View
                          className="rounded-full px-2 py-0.5"
                          style={{ backgroundColor: ct.statusChip === "good" ? c.goodSoft : c.amberSoft }}
                        >
                          <Text className="text-[11px] font-semibold" style={{ color: ct.statusChip === "good" ? c.good : c.warn }}>
                            {ct.statusLabel}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          );
        }}
      </QueryGate>
    </ScrollScreen>
  );
}
