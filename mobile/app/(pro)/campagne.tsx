// Détail d'une campagne — /api/pro/campaigns/[id]. Design aligné c1.html :
// en-tête (objectif/statut/méta + dupliquer), 4 mini-cartes (budget consommé,
// contacts obtenus, taux, coût moyen) à icônes colorées, fenêtre de diffusion,
// onglets (Vue d'ensemble / Contacts / Configuration / Activité / Facturation),
// entonnoir, budget (+ message commission).
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Card, dateFr, eur, QueryGate, ScrollScreen } from "../../components/screen";
import { useProCampaign, type ProCampaignDetail } from "../../lib/queries";
import { useTheme } from "../../lib/theme";

type Tab = "overview" | "contacts" | "config" | "activity";

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

function MiniCard({
  icon,
  tintBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tintBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub: string;
}) {
  const { c } = useTheme();
  return (
    <View
      style={{
        width: "48%",
        marginBottom: 10,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: c.borderSoft,
        backgroundColor: c.surface,
        padding: 14,
      }}
    >
      <View className="items-center justify-center" style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: tintBg }}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text className="mt-2.5 font-mono uppercase" style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: c.textSub }} numberOfLines={2}>
        {label}
      </Text>
      <Text className="mt-0.5 font-serif text-xl text-ink">{value}</Text>
      <Text className="text-[11px] text-ink-4" numberOfLines={1}>
        {sub}
      </Text>
    </View>
  );
}

const FUNNEL: { key: keyof ProCampaignDetail["funnel"]; label: string }[] = [
  { key: "matched", label: "Prospects matchés" },
  { key: "sent", label: "Demandes envoyées" },
  { key: "accepted", label: "Acceptées" },
  { key: "settled", label: "Créditées (séquestre écoulé)" },
  { key: "refused", label: "Refusées" },
  { key: "expired", label: "Expirées" },
];

function FunnelRow({ label, count, base }: { label: string; count: number; base: number }) {
  const { c } = useTheme();
  const pct = base > 0 ? Math.round((count / base) * 100) : 0;
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text className="text-[13px] text-ink-2">{label}</Text>
        <Text className="font-mono text-[12px] text-ink-3">{count} · {pct} %</Text>
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

const ACT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  settled: "checkmark-done",
  accepted: "checkmark-circle",
  refused: "close-circle",
  expired: "time-outline",
  pending: "paper-plane-outline",
};

export default function ProCampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const q = useProCampaign(id);
  const { c } = useTheme();
  const d = q.data;
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <ScrollScreen
      headerVariant="pro"
      hero={{ nav: "back", eyebrow: "Campagne", title: d?.objectiveLabel ?? "Campagne", desc: d?.name ?? undefined }}
      onRefresh={q.refetch}
    >
      <QueryGate query={q}>
        {(d) => {
          const sm = statusMeta(d.status, c);
          const budgetPct = d.budgetEur > 0 ? Math.round((d.spentEur / d.budgetEur) * 100) : 0;
          const ages = d.targeting.ages.length ? d.targeting.ages.join(", ") : "Tous";
          const TABS: { key: Tab; label: string }[] = [
            { key: "overview", label: "Vue d'ensemble" },
            { key: "contacts", label: `Contacts (${d.contacts.length})` },
            { key: "config", label: "Configuration" },
            { key: "activity", label: "Activité" },
          ];
          return (
            <View className="gap-4">
              {/* Statut + méta + dupliquer. */}
              <Card>
                <View className="flex-row items-center justify-between">
                  <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: sm.bg }}>
                    <Text className="text-[11px] font-bold" style={{ color: sm.color }}>{sm.label}</Text>
                  </View>
                </View>
                <Text className="mt-2 text-[12.5px] leading-5 text-ink-3">
                  Créée le {d.createdAtLabel} · diffusion jusqu&apos;au {d.endsAtLabel ?? "—"} · coût unitaire {eur(d.costPerContactEur)}
                </Text>
                <Pressable
                  onPress={() => router.push((d.objectiveId ? `/(pro)/objectif?id=${d.objectiveId}` : "/(pro)/creation") as never)}
                  accessibilityRole="button"
                  className="mt-3 flex-row items-center justify-center gap-2 rounded-full border py-2.5 active:opacity-80"
                  style={{ borderColor: c.borderSoft }}
                >
                  <Ionicons name="copy-outline" size={15} color={c.ink3} />
                  <Text className="text-[13px] font-medium text-ink-3">Dupliquer cette campagne</Text>
                </Pressable>
              </Card>

              {/* 4 mini-cartes. */}
              <View className="flex-row flex-wrap justify-between">
                <MiniCard icon="wallet-outline" tintBg={c.tintViolet} iconColor={c.accVioletDeep} label="Budget consommé" value={eur(d.spentEur)} sub={`sur ${eur(d.budgetEur)} · ${budgetPct}% engagé`} />
                <MiniCard icon="people-outline" tintBg={c.tintGreen} iconColor={c.accGreen} label="Contacts obtenus" value={String(d.winCount)} sub={`objectif ~${d.plannedContacts}`} />
                <MiniCard icon="trending-up" tintBg={c.tintBlue} iconColor={c.accBlue} label="Taux d'acceptation" value={d.acceptanceRate != null ? `${d.acceptanceRate}%` : "—"} sub={`${d.winCount} / ${d.funnel.sent} · ${d.funnel.pending} en attente`} />
                <MiniCard icon="pricetag-outline" tintBg={c.tintAmber} iconColor={c.accAmber} label="Coût moyen / contact" value={eur(d.avgCostEur)} sub={`prévu ${eur(d.costPerContactEur)}`} />
              </View>

              {/* Fenêtre de diffusion. */}
              <View>
                <Text className="mb-2 font-mono uppercase" style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: c.textSub }}>
                  Fenêtre de diffusion
                </Text>
                <View
                  className="flex-row items-center rounded-2xl px-4 py-3"
                  style={{ gap: 12, backgroundColor: d.status === "active" ? c.goodSoft : c.surface2, borderWidth: 1, borderColor: c.borderSoft }}
                >
                  <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: c.surface }}>
                    <Ionicons name="calendar-outline" size={20} color={d.status === "active" ? c.good : c.textSub} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[13.5px] font-semibold text-ink">
                      {d.status === "active" ? `Diffusion jusqu'au ${d.endsAtLabel ?? "—"}` : `Campagne clôturée le ${d.endsAtLabel ?? "—"}`}
                    </Text>
                    <Text className="text-[11.5px] text-ink-4">Lancée le {d.startsAtLabel}</Text>
                  </View>
                </View>
              </View>

              {/* Onglets. */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {TABS.map((t) => {
                  const on = tab === t.key;
                  return (
                    <Pressable
                      key={t.key}
                      onPress={() => setTab(t.key)}
                      className="rounded-full px-3.5 py-1.5 active:opacity-80"
                      style={{ borderWidth: 1.5, borderColor: on ? c.accent : c.borderSoft, backgroundColor: on ? c.accent : c.surface }}
                    >
                      <Text className="text-[13px] font-semibold" style={{ color: on ? c.btnText : c.textSub }}>
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Contenu de l'onglet. */}
              {tab === "overview" ? (
                <Card>
                  <Text className="font-serif text-lg text-ink">Entonnoir</Text>
                  <Text className="text-[12px] text-ink-4">Du matching au crédit</Text>
                  <View className="mt-3 gap-3">
                    {FUNNEL.map((f) => (
                      <FunnelRow key={f.key} label={f.label} count={d.funnel[f.key]} base={d.funnel.matched || d.funnel.sent || 1} />
                    ))}
                  </View>
                </Card>
              ) : null}

              {tab === "contacts" ? (
                d.contacts.length > 0 ? (
                  <View className="rounded-2xl border" style={{ borderColor: c.borderSoft, backgroundColor: c.surface }}>
                    {d.contacts.map((ct, i) => (
                      <View key={ct.id} className="flex-row items-center justify-between px-4 py-3" style={i > 0 ? { borderTopWidth: 1, borderTopColor: c.borderSoft } : undefined}>
                        <View className="flex-1 pr-3">
                          <Text className="text-[14px] text-ink" numberOfLines={1}>{ct.name}</Text>
                          <Text className="text-[11.5px] text-ink-4">{ct.tierLabel} · {dateFr(ct.decidedAt)}</Text>
                        </View>
                        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: ct.statusChip === "good" ? c.goodSoft : c.amberSoft }}>
                          <Text className="text-[11px] font-semibold" style={{ color: ct.statusChip === "good" ? c.good : c.warn }}>{ct.statusLabel}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Card><Text className="text-sm text-ink-4">Aucun contact acquis pour l&apos;instant.</Text></Card>
                )
              ) : null}

              {tab === "config" ? (
                <Card>
                  {[
                    ["Objectif", d.objectiveLabel],
                    ["Paliers", d.targeting.tierLabels.join(", ") || "—"],
                    ["Zone", d.targeting.geoLabel],
                    ["Âges", ages],
                    ["Vérification", d.targeting.verifLabel],
                    ["Durée", d.targeting.durationKey ?? "—"],
                    ["Mots-clés", d.targeting.keywords.length ? d.targeting.keywords.join(", ") : "—"],
                    ["Exclure certifiés", d.targeting.excludeCertified ? "Oui" : "Non"],
                  ].map(([k, v], i) => (
                    <View key={i} className={`flex-row justify-between ${i > 0 ? "mt-2" : ""}`}>
                      <Text className="text-[13px] text-ink-4">{k}</Text>
                      <Text className="flex-1 text-right text-[13px] font-medium text-ink" numberOfLines={1}>{v}</Text>
                    </View>
                  ))}
                </Card>
              ) : null}

              {tab === "activity" ? (
                d.activity.length > 0 ? (
                  <View className="rounded-2xl border" style={{ borderColor: c.borderSoft, backgroundColor: c.surface }}>
                    {d.activity.map((a, i) => (
                      <View key={i} className="flex-row items-start px-4 py-3" style={[{ gap: 10 }, i > 0 ? { borderTopWidth: 1, borderTopColor: c.borderSoft } : undefined]}>
                        <Ionicons name={ACT_ICON[a.kind] ?? "ellipse-outline"} size={16} color={c.accent} style={{ marginTop: 1 }} />
                        <View className="flex-1">
                          <Text className="text-[13px] text-ink-2">{a.label}</Text>
                          <Text className="text-[11px] text-ink-4">{dateFr(a.ts)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Card><Text className="text-sm text-ink-4">Aucune activité pour l&apos;instant.</Text></Card>
                )
              ) : null}

              {/* Carte Budget — toujours affichée en bas du détail. */}
              <Card>
                  <Text className="font-serif text-lg text-ink">Budget</Text>
                  <Text className="mt-1 text-[13px] text-ink-2">{eur(d.spentEur)} engagés sur {eur(d.budgetEur)}</Text>
                  <View className="mt-2 h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: c.track }}>
                    <LinearGradient colors={[c.violet, c.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${Math.max(0, Math.min(100, budgetPct))}%`, height: "100%", borderRadius: 999 }} />
                  </View>
                  <View className="mt-1 flex-row justify-between">
                    <Text className="font-mono text-[11px] text-ink-4">0 €</Text>
                    <Text className="font-mono text-[11px] text-ink-4">{eur(d.budgetEur)}</Text>
                  </View>
                  <View className="mt-3 flex-row items-center justify-between">
                    <View>
                      <Text className="font-mono uppercase" style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: c.textMuted }}>Reste à engager</Text>
                      <Text className="mt-0.5 font-serif text-xl text-ink">{eur(d.remainingEur)}</Text>
                    </View>
                    <Text className="font-mono text-[11px] text-ink-4">{budgetPct} %</Text>
                  </View>
                  <View className="mt-3 flex-row items-start gap-2 rounded-2xl px-3 py-2.5" style={{ backgroundColor: c.accentSoft }}>
                    <Ionicons name="information-circle-outline" size={16} color={c.accentInk} style={{ marginTop: 1 }} />
                    <Text className="flex-1 text-[12px] leading-4" style={{ color: c.accentInk }}>
                      La commission BUUPP n&apos;est due qu&apos;à l&apos;acceptation d&apos;un prospect, au prorata des acceptations.
                    </Text>
                  </View>
                </Card>
            </View>
          );
        }}
      </QueryGate>
    </ScrollScreen>
  );
}
