// Détail d'une campagne — /api/pro/campaigns/[id]. Design aligné c1.html :
// en-tête (objectif/statut/méta + dupliquer / pause 48 h / relancer), 4
// mini-cartes (budget consommé, contacts obtenus, taux, coût moyen), fenêtre de
// diffusion (+ Prolonger · 10 €), onglets (Vue d'ensemble / Contacts /
// Configuration / Activité / Facturation), progression quotidienne, entonnoir,
// budget (+ message commission). Parité web Pro.jsx CampaignDetail.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import {
  ExtendCampaignSheet,
  PauseCampaignSheet,
} from "../../components/campaign-action-sheets";
import { NeonBorder } from "../../components/neon-border";
import { Card, dateFr, eur, QueryGate, ScrollScreen } from "../../components/screen";
import type { ProCampaignDetail } from "../../lib/queries";
import {
  apiErrorCode,
  NO_CAMPAIGN_CONTACT_FILTERS,
  useCampaignExtend,
  useCampaignPauseToggle,
  useProCampaignDetail,
  type CampaignContactFilters,
  type ProCampaignDetailFull,
} from "../../lib/queries-pro-contacts";
import { useTheme } from "../../lib/theme";
import { useAuthedDownload } from "../../lib/use-authed-download";
import { PURCHASES_ENABLED } from "../../lib/purchases";

type Tab = "overview" | "contacts" | "config" | "activity" | "billing";

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

// « La Vitrine » — une tuile d'indicateur (réplique des 3 tiles web).
function VitrineTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View
      className="flex-1 rounded-xl border p-3"
      style={{ borderColor: c.borderSoft, backgroundColor: c.surface2 }}
    >
      <Text
        className="font-mono uppercase text-ink-4"
        style={{ fontSize: 9.5, letterSpacing: 0.3 }}
        numberOfLines={2}
      >
        {label}
      </Text>
      <Text className="mt-1 font-serif" style={{ fontSize: 22, color: accent ? c.accVioletDeep : c.text }}>
        {value}
      </Text>
      <Text className="mt-0.5 text-[10px] leading-[13px] text-ink-4" numberOfLines={2}>
        {sub}
      </Text>
    </View>
  );
}

// « La Vitrine » — carte du détail campagne (réplique web) : lien du site
// affiché sur l'annonce + 3 indicateurs distincts (visites du site,
// prospects acceptés, ratio clics/acceptés). Le lien ouvre directement le
// site du pro (pas d'interstitiel : c'est son propre site).
function VitrineCard({ d }: { d: ProCampaignDetail }) {
  const { c } = useTheme();
  const clicks = d.websiteClickCount ?? 0;
  const accepted = d.winCount ?? 0;
  const ratio = accepted > 0 ? `${Math.round((clicks / accepted) * 100)} %` : "—";
  const url = d.websiteUrl ?? "";
  return (
    // Bordure néon rotative — la Vitrine est un service à forte valeur ajoutée.
    <NeonBorder>
      <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text className="font-serif text-lg text-ink">La Vitrine</Text>
          <Text className="text-[12px] text-ink-4">
            Lien de votre site affiché sur l&apos;annonce vue par les prospects
          </Text>
        </View>
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: c.surface2 }}>
          <Text className="text-[11px] font-medium text-ink-3">
            {d.websiteAddonPaidCents > 0
              ? `Option : ${eur(d.websiteAddonPaidCents / 100)}`
              : "Offert · 1ʳᵉ campagne"}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={() => void WebBrowser.openBrowserAsync(url).catch(() => {})}
        accessibilityRole="link"
        className="mt-3 flex-row items-center gap-2 active:opacity-70"
      >
        <Ionicons name="globe-outline" size={16} color={c.accVioletDeep} />
        <Text
          className="flex-1 text-[13.5px] font-medium"
          style={{ color: c.accVioletDeep }}
          numberOfLines={1}
        >
          {url}
        </Text>
        <Ionicons name="open-outline" size={13} color={c.accVioletDeep} />
      </Pressable>
      <View className="mt-4 flex-row" style={{ gap: 10 }}>
        <VitrineTile
          accent
          label="Visites du site"
          value={String(clicks)}
          sub={`prospect${clicks === 1 ? "" : "s"} ayant cliqué (≠ accepté)`}
        />
        <VitrineTile
          label="Prospects acceptés"
          value={String(accepted)}
          sub="ont accepté la sollicitation"
        />
        <VitrineTile
          label="Clics / acceptés"
          value={ratio}
          sub={`${clicks} clic${clicks === 1 ? "" : "s"} pour ${accepted} accepté${accepted === 1 ? "" : "s"}`}
        />
      </View>
    </NeonBorder>
  );
}

const ACT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  settled: "checkmark-done",
  accepted: "checkmark-circle",
  refused: "close-circle",
  expired: "time-outline",
  pending: "paper-plane-outline",
};

// Libellés du seuil de Fiabilité minimum (parité web EDIT_FIAB_OPTS).
function fiabLabel(v: number | undefined): string {
  if (!v) return "Toutes (aucun filtre)";
  if (v >= 80) return "Excellente (≥ 80 / 100)";
  if (v >= 60) return "Bonne (≥ 60 / 100)";
  return `≥ ${v} / 100`;
}

const ERR_LABELS: Record<string, string> = {
  pause_already_used: "La pause a déjà été utilisée pour cette campagne.",
  invalid_transition: "Cette action n'est plus possible (statut modifié).",
  extension_already_used: "Cette campagne a déjà été prolongée.",
  campaign_not_extendable: "Cette campagne ne peut plus être prolongée.",
  campaign_expired: "La campagne est déjà expirée.",
  insufficient_funds: PURCHASES_ENABLED
    ? "Solde disponible insuffisant : 10 € sont nécessaires. Rechargez votre compte."
    : "Solde disponible insuffisant : 10 € sont nécessaires.",
  unknown_duration: "Durée de campagne inconnue — prolongation impossible.",
};
const errMsg = (e: unknown) => {
  const code = apiErrorCode(e);
  return (code && ERR_LABELS[code]) || `Échec : ${code ?? "réessayez"}`;
};

// « Progression quotidienne » : acceptations + crédits par jour sur 14 jours,
// en barres View (pas de lib de graphe). Source = `activity` (vide tant que la
// campagne n'est pas clôturée → graphe à plat, comme le web).
function DailyChart({ activity }: { activity: ProCampaignDetail["activity"] }) {
  const { c } = useTheme();
  const buckets = new Array(14).fill(0) as number[];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const a of activity) {
    if (a.kind !== "accepted" && a.kind !== "settled") continue;
    const d = new Date(a.ts);
    if (isNaN(d.getTime())) continue;
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
    if (diff >= 0 && diff < 14) buckets[13 - diff] += 1;
  }
  const max = Math.max(...buckets, 1);
  const H = 120;
  return (
    <Card>
      <Text className="font-serif text-lg text-ink">Progression quotidienne</Text>
      <Text className="text-[12px] text-ink-4">Acceptations + crédits par jour, sur les 14 derniers jours</Text>
      <View className="mt-5 flex-row items-end" style={{ height: H, gap: 4 }}>
        {buckets.map((v, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: H }}>
            {v > 0 ? (
              <Text className="font-mono" style={{ fontSize: 9, color: c.textMuted, marginBottom: 2 }}>{v}</Text>
            ) : null}
            <View
              style={{
                width: "100%",
                height: v > 0 ? Math.max(4, (v / max) * (H - 16)) : 2,
                borderRadius: 4,
                backgroundColor: v > 0 ? c.accent : c.track,
                opacity: 0.4 + (i / buckets.length) * 0.6,
              }}
            />
          </View>
        ))}
      </View>
      <View className="mt-2 flex-row justify-between border-t pt-2" style={{ borderTopColor: c.borderSoft }}>
        {["J−13", "J−10", "J−7", "J−4", "Aujourd'hui"].map((l) => (
          <Text key={l} className="font-mono" style={{ fontSize: 10, color: c.textMuted }}>{l}</Text>
        ))}
      </View>
    </Card>
  );
}

// Filtres de la liste « Contacts obtenus » (statut / score min / période) —
// brouillon local, appliqués côté serveur au clic sur « Appliquer ».
function ContactFiltersPanel({
  applied,
  onApply,
}: {
  applied: CampaignContactFilters;
  onApply: (f: CampaignContactFilters) => void;
}) {
  const { c } = useTheme();
  const [draft, setDraft] = useState<CampaignContactFilters>(applied);
  const Pill = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      className="rounded-full px-3 py-1.5 active:opacity-80"
      style={{ borderWidth: 1.5, borderColor: on ? c.accent : c.borderSoft, backgroundColor: on ? c.accentSoft : c.surface }}
    >
      <Text className="text-[12px] font-semibold" style={{ color: on ? c.accentInk : c.textSub }}>{label}</Text>
    </Pressable>
  );
  const Lbl = ({ t }: { t: string }) => (
    <Text className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: 0.6, color: c.textMuted }}>{t}</Text>
  );
  return (
    <View className="gap-3 rounded-2xl border p-3.5" style={{ borderColor: c.borderSoft, backgroundColor: c.surface2 }}>
      <Lbl t="Statut" />
      <View className="flex-row flex-wrap" style={{ gap: 6 }}>
        {([["all", "Tous"], ["accepted", "En séquestre"], ["settled", "Crédité"]] as const).map(([k, l]) => (
          <Pill key={k} on={draft.status === k} label={l} onPress={() => setDraft((d) => ({ ...d, status: k }))} />
        ))}
      </View>
      <Lbl t="Score min." />
      <TextInput
        value={draft.scoreMin}
        onChangeText={(t) => setDraft((d) => ({ ...d, scoreMin: t.replace(/[^\d]/g, "").slice(0, 4) }))}
        keyboardType="number-pad"
        placeholder="—"
        placeholderTextColor={c.textMuted}
        className="font-mono"
        style={{ width: 110, fontSize: 14, color: c.text, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSoft, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 }}
      />
      <Lbl t="Période" />
      <View className="flex-row flex-wrap" style={{ gap: 6 }}>
        {([["all", "Tout"], ["7d", "7 jours"], ["30d", "30 jours"], ["90d", "90 jours"]] as const).map(([k, l]) => (
          <Pill key={k} on={draft.period === k} label={l} onPress={() => setDraft((d) => ({ ...d, period: k }))} />
        ))}
      </View>
      <View className="mt-1 flex-row" style={{ gap: 8 }}>
        <Pressable
          onPress={() => onApply(draft)}
          className="flex-1 items-center rounded-full py-2.5 active:opacity-80"
          style={{ backgroundColor: c.accent }}
        >
          <Text className="text-[13px] font-semibold" style={{ color: c.btnText }}>Appliquer</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setDraft(NO_CAMPAIGN_CONTACT_FILTERS);
            onApply(NO_CAMPAIGN_CONTACT_FILTERS);
          }}
          className="flex-1 items-center rounded-full border py-2.5 active:opacity-80"
          style={{ borderColor: c.borderSoft }}
        >
          <Text className="text-[13px] font-semibold text-ink-3">Réinitialiser</Text>
        </Pressable>
      </View>
    </View>
  );
}

function slug(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 40) || "campagne"
  );
}

// Onglet « Facturation » — débits de la campagne + relevé PDF complet.
function BillingTab({ d }: { d: ProCampaignDetailFull }) {
  const { c } = useTheme();
  const download = useAuthedDownload();
  const [loading, setLoading] = useState(false);
  const commissionSpent = d.spentEur * 0.1;
  const totalDebited = d.spentEur + commissionSpent;
  const planned = d.costPerContactEur > 0 ? Math.round(d.budgetEur / d.costPerContactEur) : 0;
  const getStatement = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await download(`/api/pro/campaigns/${d.id}/statement`, `releve-campagne-${slug(d.name)}.pdf`);
    } catch (e) {
      Alert.alert("Relevé", "Impossible de générer le relevé : " + (e instanceof Error ? e.message : "réessayez"));
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card>
      <View className="flex-row items-start justify-between" style={{ gap: 10 }}>
        <View className="flex-1">
          <Text className="font-serif text-lg text-ink">Facturation de la campagne</Text>
          <Text className="text-[12px] text-ink-4">Détail des débits et contacts facturés</Text>
        </View>
        <Pressable
          onPress={getStatement}
          disabled={loading}
          className="flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 active:opacity-80"
          style={{ borderColor: c.borderSoft, opacity: loading ? 0.6 : 1 }}
        >
          <Ionicons name="download-outline" size={14} color={c.ink3} />
          <Text className="text-[12px] font-semibold text-ink-3">{loading ? "Génération…" : "Relevé complet"}</Text>
        </Pressable>
      </View>
      <View className="mt-4 flex-row" style={{ gap: 8 }}>
        {[
          ["Total débité", eur(totalDebited), "commission 10 % incluse"],
          ["Contacts facturés", `${d.winCount} / ${planned || "—"}`, ""],
          ["Moyenne / contact", eur(d.avgCostEur), ""],
        ].map(([l, v, sub]) => (
          <View key={l} className="flex-1 rounded-xl p-2.5" style={{ backgroundColor: c.surface2 }}>
            <Text className="font-mono uppercase text-ink-4" style={{ fontSize: 9, letterSpacing: 0.3 }} numberOfLines={2}>{l}</Text>
            <Text className="mt-1 font-serif text-ink" style={{ fontSize: 17 }} numberOfLines={1}>{v}</Text>
            {sub ? <Text className="font-mono text-ink-4" style={{ fontSize: 9 }} numberOfLines={2}>{sub}</Text> : null}
          </View>
        ))}
      </View>
      <View className="mt-3 gap-1 rounded-xl border px-3 py-2.5" style={{ borderColor: c.accent + "38", backgroundColor: c.accentSoft }}>
        <Text className="text-[12.5px] text-ink-2">Budget campagne consommé : <Text className="font-mono font-bold text-ink">{eur(d.spentEur)}</Text></Text>
        <Text className="text-[12.5px] text-ink-2">Commission BUUPP acquise (10 %) : <Text className="font-mono font-bold" style={{ color: c.accent }}>{eur(commissionSpent)}</Text></Text>
        <Text className="text-[12.5px] text-ink-2">Total débité du solde : <Text className="font-mono font-bold text-ink">{eur(totalDebited)}</Text></Text>
      </View>
      <View className="mt-3 flex-row items-start gap-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: c.goodSoft }}>
        <Ionicons name="information-circle-outline" size={15} color={c.good} style={{ marginTop: 1 }} />
        <Text className="flex-1 text-[12px] leading-4" style={{ color: c.good }}>
          <Text style={{ fontWeight: "700" }}>Aucune commission n&apos;est due si aucun prospect n&apos;accepte. </Text>
          {d.winCount === 0
            ? "Cette campagne n'a encore aucune acceptation enregistrée — aucune commission BUUPP n'a été facturée."
            : `La commission est facturée à hauteur de 10 % du gain de chaque prospect ayant accepté (${d.winCount} acceptation${d.winCount > 1 ? "s" : ""} à ce jour).`}
        </Text>
      </View>
      {d.contacts.length === 0 ? (
        <Text className="mt-4 text-center text-[13px] text-ink-4">
          {d.contactsLocked ? "Détail des contacts facturés disponible à la clôture." : "Aucun contact facturé pour le moment."}
        </Text>
      ) : (
        <View className="mt-3">
          {d.contacts.map((ct, i) => (
            <View key={ct.id} className="flex-row items-center justify-between py-2.5" style={i > 0 ? { borderTopWidth: 1, borderTopColor: c.borderSoft } : undefined}>
              <View className="flex-1 pr-2">
                <Text className="text-[13.5px] text-ink" numberOfLines={1}>{ct.name}</Text>
                <Text className="text-[11px] text-ink-4">{dateFr(ct.decidedAt)} · {ct.tierLabel}</Text>
              </View>
              <View className="items-end" style={{ gap: 3 }}>
                <Text className="font-mono text-[12.5px] text-ink">{eur(d.costPerContactEur)}</Text>
                <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: ct.statusChip === "good" ? c.goodSoft : c.amberSoft }}>
                  <Text className="text-[10.5px] font-semibold" style={{ color: ct.statusChip === "good" ? c.good : c.warn }}>{ct.statusLabel}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

export default function ProCampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [cFilters, setCFilters] = useState<CampaignContactFilters>(NO_CAMPAIGN_CONTACT_FILTERS);
  const q = useProCampaignDetail(id, cFilters);
  const { c } = useTheme();
  const d = q.data;
  const [tab, setTab] = useState<Tab>("overview");
  const [pauseOpen, setPauseOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [cFilterOpen, setCFilterOpen] = useState(false);
  const pauseToggle = useCampaignPauseToggle(id ?? "");
  const extend = useCampaignExtend(id ?? "");
  const cFilterActive =
    cFilters.status !== "all" || cFilters.scoreMin !== "" || cFilters.period !== "all";

  const resume = () =>
    pauseToggle.mutate("active", { onError: (e) => Alert.alert("Relancer", errMsg(e)) });
  const confirmPause = () =>
    pauseToggle.mutate("paused", {
      onSuccess: () => setPauseOpen(false),
      onError: (e) => {
        setPauseOpen(false);
        Alert.alert("Pause", errMsg(e));
      },
    });
  const confirmExtend = () =>
    extend.mutate(undefined, {
      onSuccess: () => setExtendOpen(false),
      onError: (e) => Alert.alert("Prolongation", errMsg(e)),
    });

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
          const planned = d.costPerContactEur > 0 ? Math.round(d.budgetEur / d.costPerContactEur) : 0;
          const TABS: { key: Tab; label: string }[] = [
            { key: "overview", label: "Vue d'ensemble" },
            // Badge = nombre d'acceptations (winCount), pas la liste détaillée
            // (vide tant que la campagne n'est pas clôturée) — parité web.
            { key: "contacts", label: `Contacts (${d.winCount})` },
            { key: "config", label: "Configuration" },
            { key: "activity", label: "Activité" },
            { key: "billing", label: "Facturation" },
          ];
          const windowTitle =
            d.status === "active"
              ? `Diffusion jusqu'au ${d.endsAtLabel ?? "—"}`
              : d.status === "paused"
                ? "Campagne en pause — peut être relancée tant qu'elle n'est pas expirée"
                : d.status === "completed"
                  ? `Campagne clôturée le ${d.endsAtLabel ?? "—"}`
                  : `Période : du ${d.startsAtLabel ?? "—"} au ${d.endsAtLabel ?? "—"}`;
          return (
            <View className="gap-4">
              {/* Statut + méta + actions (dupliquer / pause / relancer). */}
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
                  onPress={() => router.push(`/(pro)/objectif?duplicate=${encodeURIComponent(d.id)}` as never)}
                  accessibilityRole="button"
                  className="mt-3 flex-row items-center justify-center gap-2 rounded-full border py-2.5 active:opacity-80"
                  style={{ borderColor: c.borderSoft }}
                >
                  <Ionicons name="copy-outline" size={15} color={c.ink3} />
                  <Text className="text-[13px] font-medium text-ink-3">Dupliquer cette campagne</Text>
                </Pressable>
                {d.status === "active" && d.pauseEligible ? (
                  <Pressable
                    onPress={() => setPauseOpen(true)}
                    accessibilityRole="button"
                    className="mt-2 flex-row items-center justify-center gap-2 rounded-full border py-2.5 active:opacity-80"
                    style={{ borderColor: c.borderSoft }}
                  >
                    <Ionicons name="pause" size={15} color={c.ink3} />
                    <Text className="text-[13px] font-medium text-ink-3">Mettre en pause 48 h</Text>
                  </Pressable>
                ) : null}
                {d.status === "paused" ? (
                  <Pressable
                    onPress={resume}
                    disabled={pauseToggle.isPending}
                    accessibilityRole="button"
                    className="mt-2 flex-row items-center justify-center gap-2 rounded-full py-2.5 active:opacity-80"
                    style={{ backgroundColor: c.accent, opacity: pauseToggle.isPending ? 0.6 : 1 }}
                  >
                    <Ionicons name="play" size={15} color={c.btnText} />
                    <Text className="text-[13px] font-semibold" style={{ color: c.btnText }}>
                      {pauseToggle.isPending ? "Relance…" : "Relancer"}
                    </Text>
                  </Pressable>
                ) : null}
              </Card>

              {/* 4 mini-cartes. */}
              <View className="flex-row flex-wrap justify-between">
                <MiniCard icon="wallet-outline" tintBg={c.tintViolet} iconColor={c.accVioletDeep} label="Budget consommé" value={eur(d.spentEur)} sub={`sur ${eur(d.budgetEur)} · ${budgetPct}% engagé`} />
                <MiniCard icon="people-outline" tintBg={c.tintGreen} iconColor={c.accGreen} label="Contacts obtenus" value={String(d.winCount)} sub={`objectif ~${d.plannedContacts}`} />
                <MiniCard icon="trending-up" tintBg={c.tintBlue} iconColor={c.accBlue} label="Taux d'acceptation" value={d.acceptanceRate != null ? `${d.acceptanceRate}%` : "—"} sub={`${d.winCount} / ${d.funnel.sent} · ${d.funnel.pending} en attente`} />
                <MiniCard icon="pricetag-outline" tintBg={c.tintAmber} iconColor={c.accAmber} label="Coût moyen / contact" value={eur(d.avgCostEur)} sub={`prévu ${eur(d.costPerContactEur)}`} />
              </View>

              {/* Fenêtre de diffusion + prolongation. */}
              <View>
                <Text className="mb-2 font-mono uppercase" style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: c.textSub }}>
                  Fenêtre de diffusion
                </Text>
                <View
                  className="rounded-2xl px-4 py-3"
                  style={{ backgroundColor: d.status === "active" ? c.goodSoft : c.surface2, borderWidth: 1, borderColor: c.borderSoft }}
                >
                  <View className="flex-row items-center" style={{ gap: 12 }}>
                    <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: c.surface }}>
                      <Ionicons name="calendar-outline" size={20} color={d.status === "active" ? c.good : c.textSub} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[13.5px] font-semibold text-ink">{windowTitle}</Text>
                      <Text className="text-[11.5px] text-ink-4">
                        Lancée le {d.startsAtLabel}
                        {d.targeting.days != null ? ` · durée initiale : ${d.targeting.days} jour${d.targeting.days > 1 ? "s" : ""}` : ""}
                      </Text>
                    </View>
                  </View>
                  {d.extensionUsed ? (
                    <View className="mt-3 self-start rounded-full px-3 py-1.5" style={{ backgroundColor: c.surface }}>
                      <Text className="text-[11.5px] font-semibold text-ink-3">
                        Prolongée{d.extendedAtLabel ? ` le ${d.extendedAtLabel}` : ""}
                      </Text>
                    </View>
                  ) : d.extendEligible ? (
                    <Pressable
                      onPress={() => setExtendOpen(true)}
                      accessibilityRole="button"
                      className="mt-3 flex-row items-center justify-center gap-1.5 rounded-full py-2.5 active:opacity-80"
                      style={{ backgroundColor: c.accent }}
                    >
                      <Ionicons name="add" size={16} color={c.btnText} />
                      <Text className="text-[13px] font-semibold" style={{ color: c.btnText }}>Prolonger · 10 €</Text>
                    </Pressable>
                  ) : null}
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
              {tab === "overview" ? <DailyChart activity={d.activity} /> : null}

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

              {/* « La Vitrine » — lien du site + 3 indicateurs (option payante). */}
              {tab === "overview" && d.websiteUrl ? (
                <VitrineCard d={d} />
              ) : null}

              {tab === "contacts" ? (
                d.contactsLocked ? (
                  <Card>
                    <View className="items-center" style={{ paddingVertical: 8 }}>
                      <Ionicons name="lock-closed" size={28} color={c.gold} />
                      <Text className="mt-2 text-center text-[15px] font-semibold text-ink">
                        Données des prospects disponibles à la clôture
                      </Text>
                      <Text className="mt-1 text-center text-[12.5px] text-ink-4">
                        {d.lockedUntil
                          ? "Déblocage le " + dateFr(d.lockedUntil)
                          : "Déblocage à la clôture de la campagne"}
                      </Text>
                      <View className="mt-3 flex-row" style={{ gap: 20 }}>
                        <Text className="text-[13px] text-ink-4">
                          <Text className="font-semibold text-ink">{d.funnel.accepted}</Text> acceptés
                        </Text>
                        <Text className="text-[13px] text-ink-4">
                          <Text className="font-semibold text-ink">{d.funnel.refused}</Text> refusés
                        </Text>
                      </View>
                    </View>
                  </Card>
                ) : (
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
                      <View className="flex-1">
                        <Text className="font-serif text-lg text-ink">Contacts obtenus</Text>
                        <Text className="text-[12px] text-ink-4">
                          {d.contacts.length} prospect{d.contacts.length > 1 ? "s" : ""} ayant accepté votre mise en relation
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => setCFilterOpen((o) => !o)}
                        className="flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 active:opacity-80"
                        style={{ borderColor: cFilterActive ? c.accent : c.borderSoft }}
                      >
                        <Ionicons name="funnel-outline" size={13} color={cFilterActive ? c.accent : c.ink3} />
                        <Text className="text-[12px] font-semibold" style={{ color: cFilterActive ? c.accent : c.textSub }}>
                          Filtrer{cFilterActive ? " •" : ""}
                        </Text>
                      </Pressable>
                    </View>
                    {cFilterOpen ? (
                      <ContactFiltersPanel applied={cFilters} onApply={setCFilters} />
                    ) : null}
                    {d.contacts.length > 0 ? (
                      <View className="rounded-2xl border" style={{ borderColor: c.borderSoft, backgroundColor: c.surface }}>
                        {d.contacts.map((ct, i) => (
                          <View key={ct.id} className="flex-row items-center justify-between px-4 py-3" style={i > 0 ? { borderTopWidth: 1, borderTopColor: c.borderSoft } : undefined}>
                            <View className="flex-1 pr-3">
                              <Text className="text-[14px] text-ink" numberOfLines={1}>{ct.name}</Text>
                              <Text className="text-[11.5px] text-ink-4">
                                {ct.score != null ? `Score ${ct.score} · ` : ""}{ct.tierLabel} · {dateFr(ct.decidedAt)}
                              </Text>
                            </View>
                            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: ct.statusChip === "good" ? c.goodSoft : c.amberSoft }}>
                              <Text className="text-[11px] font-semibold" style={{ color: ct.statusChip === "good" ? c.good : c.warn }}>{ct.statusLabel}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Card>
                        <Text className="text-sm text-ink-4">
                          {cFilterActive ? "Aucun contact pour ces filtres." : "Aucun contact obtenu pour le moment via cette campagne."}
                        </Text>
                      </Card>
                    )}
                  </View>
                )
              ) : null}

              {tab === "config" ? (
                <Card>
                  {[
                    ["Objectif", d.objectiveLabel],
                    ["Sous-types", d.targeting.subTypes.length ? d.targeting.subTypes.join(", ") : "—"],
                    ["Paliers", d.targeting.tierLabels.join(", ") || "—"],
                    ["Zone", d.targeting.geoLabel],
                    ["Rayon", d.targeting.radiusKm != null ? `${d.targeting.radiusKm} km` : "—"],
                    ["Âges", ages],
                    ["Vérification", d.targeting.verifLabel],
                    ["Fiabilité minimum", fiabLabel(d.targeting.minFiabilite)],
                    ["Durée", d.targeting.days != null ? `${d.targeting.days} jour${d.targeting.days > 1 ? "s" : ""}` : (d.targeting.durationKey ?? "—")],
                    ["Mode", d.targeting.poolLabel || "—"],
                    ["Mots-clés", d.targeting.keywords.length ? d.targeting.keywords.join(", ") : "—"],
                    ["Mode mot-clé", d.targeting.keywords.length ? (d.targeting.kwFilter ? "Filtre exclusif" : "Signal de priorité") : "—"],
                    ["Exclure certifiés", d.targeting.excludeCertified ? "Oui" : "Non"],
                    ["Contacts souhaités", planned ? String(planned) : "—"],
                    ["Budget campagne", eur(d.budgetEur)],
                    ["Commission max. (10 %)", eur(d.budgetEur * 0.1)],
                    ["Coût max / contact", eur(d.costPerContactEur)],
                  ].map(([k, v], i) => (
                    <View key={i} className={`flex-row justify-between ${i > 0 ? "mt-2" : ""}`} style={{ gap: 12 }}>
                      <Text className="text-[13px] text-ink-4">{k}</Text>
                      <Text className="flex-1 text-right text-[13px] font-medium text-ink" numberOfLines={2}>{v}</Text>
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

              {tab === "billing" ? <BillingTab d={d} /> : null}

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

              <PauseCampaignSheet
                visible={pauseOpen}
                name={d.name}
                durationKey={d.durationKey ?? d.targeting.durationKey}
                busy={pauseToggle.isPending}
                onCancel={() => setPauseOpen(false)}
                onConfirm={confirmPause}
              />
              <ExtendCampaignSheet
                visible={extendOpen}
                name={d.name}
                durationKey={d.targeting.durationKey}
                endsAt={d.endsAt}
                busy={extend.isPending}
                onCancel={() => setExtendOpen(false)}
                onConfirm={confirmExtend}
              />
            </View>
          );
        }}
      </QueryGate>
    </ScrollScreen>
  );
}
