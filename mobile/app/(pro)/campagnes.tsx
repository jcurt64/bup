// Campagnes (liste) — /api/pro/campaigns. Design aligné c.html : carte crédit
// (violet thémé) + ROI + stats (active / taux / réservé), filtres de statut,
// puis cartes campagne (statut, chips CODE🔒 / date📅, stats budget/touchés/
// contacts, barre budget consommé, Dupliquer / Voir le détail).
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { eur, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import { HERO_GRADIENT } from "../../lib/pro-theme";
import { useProCampaigns, useProOverview, useProWallet, type Campaign } from "../../lib/queries";
import { useTheme } from "../../lib/theme";

type Filter = "all" | "active" | "paused" | "ended";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "active", label: "Actives" },
  { key: "paused", label: "En pause" },
  { key: "ended", label: "Terminées" },
];

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
const matchesFilter = (status: string, f: Filter) =>
  f === "all" ||
  (f === "active" && status === "active") ||
  (f === "paused" && status === "paused") ||
  (f === "ended" && status !== "active" && status !== "paused" && status !== "draft");

const dateShort = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

function StatCol({
  icon,
  color,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-1">
      <View className="flex-row items-center" style={{ gap: 4 }}>
        <Ionicons name={icon} size={12} color={color} />
        <Text className="font-mono uppercase" style={{ fontSize: 9.5, fontWeight: "700", letterSpacing: 0.6, color }}>
          {label}
        </Text>
      </View>
      <Text className="mt-0.5 font-serif text-[17px] text-ink">{value}</Text>
    </View>
  );
}

function CampaignCard({ camp }: { camp: Campaign }) {
  const { c } = useTheme();
  const sm = statusMeta(camp.status, c);
  const pct =
    camp.budgetEur > 0
      ? Math.max(0, Math.min(100, Math.round((camp.spentEur / camp.budgetEur) * 100)))
      : 0;
  const code = camp.code ?? camp.authCode ?? null;
  return (
    <View
      style={{
        borderRadius: 22,
        borderWidth: 1,
        borderColor: c.borderSoft,
        backgroundColor: c.surface,
        padding: 18,
        shadowColor: "#0F1629",
        shadowOpacity: 0.05,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 5 },
        elevation: 2,
      }}
    >
      <View className="flex-row items-start justify-between" style={{ gap: 10 }}>
        <View className="flex-1">
          <Text className="font-serif text-lg text-ink" numberOfLines={1}>
            {camp.name}
          </Text>
          <Text className="text-[12px] text-ink-4">{camp.objectiveLabel}</Text>
        </View>
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: sm.bg }}>
          <Text className="text-[11px] font-bold" style={{ color: sm.color }}>
            {sm.label}
          </Text>
        </View>
      </View>

      {/* Chips CODE (cadenas + fond) + date (calendrier). */}
      <View className="mt-3 flex-row flex-wrap items-center" style={{ gap: 8 }}>
        {code ? (
          <View
            className="flex-row items-center rounded-full px-2.5 py-1"
            style={{ gap: 5, backgroundColor: c.tintViolet }}
          >
            <Ionicons name="lock-closed" size={11} color={c.accVioletDeep} />
            <Text className="font-mono uppercase" style={{ fontSize: 9.5, letterSpacing: 0.6, color: c.accVioletDeep }}>
              Code
            </Text>
            <Text className="font-mono text-[12px] font-semibold" style={{ color: c.accVioletDeep }}>
              {code}
            </Text>
          </View>
        ) : null}
        <View className="flex-row items-center" style={{ gap: 5 }}>
          <Ionicons name="calendar-outline" size={13} color={c.textMuted} />
          <Text className="text-[12px] text-ink-3">{dateShort(camp.createdAt)}</Text>
        </View>
      </View>

      {/* Stats budget / touchés / contacts (libellés colorés). */}
      <View className="mt-3 flex-row" style={{ gap: 12 }}>
        <StatCol icon="wallet-outline" color={c.accVioletDeep} label="Budget" value={eur(camp.budgetEur)} />
        <StatCol icon="people-outline" color={c.accBlue} label="Touchés" value={String(camp.reachedCount)} />
        <StatCol icon="checkmark-circle-outline" color={c.accGreen} label="Contacts" value={String(camp.contactsCount)} />
      </View>

      {/* Barre budget consommé. */}
      <View className="mt-3">
        <View className="flex-row justify-between">
          <Text className="text-[11px] text-ink-4">Budget consommé · dépensé {eur(camp.spentEur)}</Text>
          <Text className="font-mono text-[11px] font-semibold" style={{ color: c.accentInk }}>{pct} %</Text>
        </View>
        <View className="mt-1 h-2 overflow-hidden rounded-full" style={{ backgroundColor: c.track }}>
          <LinearGradient
            colors={[c.violet, c.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: `${pct}%`, height: "100%", borderRadius: 999 }}
          />
        </View>
      </View>

      <View className="mt-3 flex-row" style={{ gap: 10 }}>
        <Pressable
          onPress={() => router.push("/(pro)/creation")}
          accessibilityRole="button"
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full border py-2.5 active:opacity-80"
          style={{ borderColor: c.borderSoft }}
        >
          <Ionicons name="copy-outline" size={15} color={c.ink3} />
          <Text className="text-[13px] font-medium text-ink-3">Dupliquer</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/(pro)/campagne?id=${camp.id}` as never)}
          accessibilityRole="button"
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-2.5 active:opacity-80"
          style={{ backgroundColor: c.btnBg }}
        >
          <Text className="text-[13px] font-semibold" style={{ color: c.btnText }}>
            Voir le détail
          </Text>
          <Ionicons name="arrow-forward" size={14} color={c.btnText} />
        </Pressable>
      </View>
    </View>
  );
}

export default function Campagnes() {
  const q = useProCampaigns();
  const wallet = useProWallet();
  const overview = useProOverview();
  const { c, mode } = useTheme();
  const [filter, setFilter] = useState<Filter>("all");
  const roiPct = overview.data?.roi?.pct ?? null;

  return (
    <ScrollScreen
      onRefresh={async () => {
        await Promise.all([q.refetch(), wallet.refetch(), overview.refetch()]);
      }}
      headerVariant="pro"
    >
      <SectionTitle
        eyebrow="Campagnes"
        title="Vos initiatives en cours"
        desc="Vous ne payez que les acceptations effectives."
      />

      {/* Carte crédit + ROI + stats + nouvelle campagne. */}
      <LinearGradient
        colors={HERO_GRADIENT[mode]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 24, padding: 20, overflow: "hidden" }}
      >
        <View
          pointerEvents="none"
          style={{ position: "absolute", right: -16, bottom: -28, width: 96, height: 96, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.07)" }}
        />
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="font-mono uppercase" style={{ fontSize: 10.5, fontWeight: "700", letterSpacing: 1.2, color: "rgba(255,255,255,0.72)" }}>
              Crédit disponible
            </Text>
            <Text className="mt-1 font-serif" style={{ fontSize: 30, color: "#FFFFFF" }}>
              {eur(wallet.data?.walletAvailableEur ?? 0)}
            </Text>
          </View>
          {roiPct != null ? (
            <View className="rounded-full px-3 py-1" style={{ backgroundColor: "rgba(255,255,255,0.16)" }}>
              <Text className="text-[12px] font-bold text-white">
                ROI {roiPct > 0 ? "+" : ""}{roiPct} %
              </Text>
            </View>
          ) : null}
        </View>

        {/* Stats : actives / taux moyen / réservé. */}
        <View className="mt-4 flex-row" style={{ gap: 22 }}>
          {[
            ["Active", String(overview.data?.activeCampaignsCount ?? 0)],
            ["Taux moyen", `${overview.data?.acceptanceRate ?? 0}%`],
            ["Réservé", eur(wallet.data?.walletReservedEur ?? 0)],
          ].map(([l, v]) => (
            <View key={l}>
              <Text className="font-mono uppercase" style={{ fontSize: 9.5, fontWeight: "700", letterSpacing: 0.8, color: "rgba(255,255,255,0.6)" }}>
                {l}
              </Text>
              <Text className="mt-0.5 font-serif text-base text-white">{v}</Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => router.push("/(pro)/creation")}
          accessibilityRole="button"
          className="mt-4 flex-row items-center justify-center gap-2 rounded-full py-3 active:opacity-80"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          <Ionicons name="add" size={18} color="#5B3FE0" />
          <Text className="text-[15px] font-semibold" style={{ color: "#5B3FE0" }}>
            Nouvelle campagne
          </Text>
        </Pressable>
      </LinearGradient>

      {/* Filtres de statut. */}
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              className="rounded-full px-3.5 py-1.5 active:opacity-80"
              style={{
                borderWidth: 1.5,
                borderColor: on ? c.accent : c.borderSoft,
                backgroundColor: on ? c.accent : c.surface,
              }}
            >
              <Text className="text-[13px] font-semibold" style={{ color: on ? c.btnText : c.textSub }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <QueryGate
        query={q}
        isEmpty={(d) => (d.campaigns?.length ?? 0) === 0}
        emptyLabel="Aucune campagne. Lancez-en une via l'onglet Créer."
      >
        {(d) => {
          const list = d.campaigns.filter((camp) => matchesFilter(camp.status, filter));
          if (list.length === 0) {
            return (
              <View className="items-center rounded-2xl border p-8" style={{ borderColor: c.borderSoft, backgroundColor: c.surface }}>
                <Text className="text-center text-sm text-ink-4">Aucune campagne dans ce filtre.</Text>
              </View>
            );
          }
          return (
            <View className="gap-3">
              {list.map((camp) => (
                <CampaignCard key={camp.id} camp={camp} />
              ))}
            </View>
          );
        }}
      </QueryGate>
    </ScrollScreen>
  );
}
