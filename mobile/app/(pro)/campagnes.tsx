// Campagnes (liste) — /api/pro/campaigns. Design aligné c.html : carte crédit
// (violet, thémée) + ROI, puis cartes campagne (statut, code, barre budget,
// Dupliquer / Voir le détail → détail).
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { eur, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import { HERO_GRADIENT } from "../../lib/pro-theme";
import { useProCampaigns, useProOverview, useProWallet, type Campaign } from "../../lib/queries";
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

      {code ? (
        <View className="mt-3 flex-row items-center" style={{ gap: 6 }}>
          <Text className="font-mono uppercase" style={{ fontSize: 9.5, letterSpacing: 1, color: c.textMuted }}>
            Code
          </Text>
          <Text className="font-mono text-[12px] text-ink-3">{code}</Text>
        </View>
      ) : null}

      {/* Barre budget consommé. */}
      <View className="mt-3">
        <View className="flex-row justify-between">
          <Text className="text-[11px] text-ink-4">
            Budget consommé · {eur(camp.spentEur)} / {eur(camp.budgetEur)}
          </Text>
          <Text className="font-mono text-[11px] text-ink-3">{pct} %</Text>
        </View>
        <View className="mt-1 h-2 overflow-hidden rounded-full" style={{ backgroundColor: c.track }}>
          <LinearGradient
            colors={[c.violet, c.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: `${pct}%`, height: "100%", borderRadius: 999 }}
          />
        </View>
        <Text className="mt-1 font-mono text-[11px] text-ink-4">
          {camp.contactsCount} contact{camp.contactsCount > 1 ? "s" : ""}
        </Text>
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
  const { mode } = useTheme();
  const roiPct = overview.data?.roi?.pct ?? null;

  return (
    <ScrollScreen
      onRefresh={async () => {
        await Promise.all([q.refetch(), wallet.refetch()]);
      }}
      headerVariant="pro"
    >
      <SectionTitle
        eyebrow="Campagnes"
        title="Vos initiatives en cours"
        desc="Vous ne payez que les acceptations effectives."
      />

      {/* Carte crédit disponible + ROI + nouvelle campagne. */}
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

      <QueryGate
        query={q}
        isEmpty={(d) => (d.campaigns?.length ?? 0) === 0}
        emptyLabel="Aucune campagne. Lancez-en une via l'onglet Créer."
      >
        {(d) => (
          <View className="gap-3">
            {d.campaigns.map((camp) => (
              <CampaignCard key={camp.id} camp={camp} />
            ))}
          </View>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
