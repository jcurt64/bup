// Campagnes (liste) — /api/pro/campaigns. Design aligné c.html : carte crédit
// (violet thémé) + ROI + stats (active / taux / réservé), filtres de statut,
// puis cartes campagne (statut, chips CODE🔒 / date📅, stats budget/touchés/
// contacts, barre budget consommé, Dupliquer / Voir le détail).
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { EditCampaignSheet } from "../../components/edit-campaign-sheet";
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

const matchesFilter = (status: string, f: Filter) =>
  f === "all" ||
  (f === "active" && status === "active") ||
  (f === "paused" && status === "paused") ||
  (f === "ended" && status !== "active" && status !== "paused" && status !== "draft");

const dateShort = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

/* ─── Liste premium — repris de la maquette
   public/prototype/Campagnes - Liste premium.html (palette fixe + couleur par
   type). Icônes = Ionicons (react-native-svg exclu du projet). ─── */
const LC = {
  paper: "#f4f1ea",
  paperWarm: "#efeadd",
  card: "#fffdf8",
  ink: "#161a1d",
  ink2: "#3c444b",
  ink3: "#757d83",
  ink4: "#9aa0a4",
  line: "rgba(22,26,29,0.10)",
  lineSoft: "rgba(22,26,29,0.055)",
  amberXsoft: "#faf4e6",
  codeBorder: "rgba(185,132,42,0.30)",
  ck: "#9a6c1f",
  cv: "#7c5414",
};
type TypeColor = "teal" | "indigo" | "amber" | "blue" | "coral" | "rose" | "green";
const TYPE_COLORS: Record<TypeColor, { c: string; soft: string; light: string }> = {
  teal:   { c: "#1c8a6e", soft: "#d9efe6", light: "#74b8a8" },
  indigo: { c: "#5a57d6", soft: "#ecebfb", light: "#9b99e6" },
  amber:  { c: "#b9842a", soft: "#f6ecd6", light: "#d6b277" },
  blue:   { c: "#2f72c4", soft: "#dbe9f8", light: "#82abdd" },
  coral:  { c: "#d6432f", soft: "#f7e0dd", light: "#e78a7c" },
  rose:   { c: "#c14d77", soft: "#f7e2ea", light: "#d894ac" },
  green:  { c: "#2e9e5b", soft: "#dcf0e3", light: "#84c79c" },
};
type IonName = keyof typeof Ionicons.glyphMap;
const TYPE_ION: Record<string, IonName> = {
  survey: "clipboard-outline",
  download: "download-outline",
  promo: "pricetag-outline",
  event: "calendar-outline",
  flash: "flash",
  contact: "person-outline",
};
// Couleur + icône par type d'objectif (clés = objectiveLabel de l'API).
const LC_TYPE_STYLE: Record<string, { color: TypeColor; icon: string }> = {
  "Études & collecte d’avis": { color: "teal", icon: "survey" },
  "Études & collecte d'avis": { color: "teal", icon: "survey" },
  "Contenus à télécharger": { color: "indigo", icon: "download" },
  "Promotions & fidélisation": { color: "amber", icon: "promo" },
  "Événementiel & inscription": { color: "blue", icon: "event" },
  "Prise de contact direct": { color: "rose", icon: "contact" },
  "Prise de rendez-vous": { color: "teal", icon: "contact" },
  "Publicité digitale": { color: "indigo", icon: "promo" },
};
function lcStyleFor(camp: Campaign): { color: TypeColor; icon: string } {
  if (camp.durationKey === "1h") return { color: "coral", icon: "flash" };
  return LC_TYPE_STYLE[camp.objectiveLabel] || { color: "indigo", icon: "contact" };
}
function lcStatus(status: string) {
  if (status === "active") return { label: "Active", bg: "#dcf0e3", color: "#1d7a44", dot: "#2e9e5b" };
  if (status === "paused") return { label: "En pause", bg: "#f6ecd6", color: "#9a6c1f", dot: "#b9842a" };
  return { label: "Terminée", bg: "rgba(22,26,29,0.06)", color: LC.ink3, dot: LC.ink4 };
}

function LcStatTile({ icon, color, soft, label, value }: { icon: IonName; color: string; soft: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 13, backgroundColor: LC.paper, borderWidth: 1, borderColor: LC.lineSoft }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: soft }}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 9.5, letterSpacing: 1.2, textTransform: "uppercase", color: LC.ink4, fontWeight: "700" }}>{label}</Text>
        <Text className="font-serif" style={{ fontSize: 18, color: LC.ink, marginTop: 2 }} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function LcAct({ icon, label, onPress, primary }: { icon: IonName; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="active:opacity-80"
      style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 11, borderWidth: 1, borderColor: primary ? LC.ink : LC.line, backgroundColor: primary ? LC.ink : LC.card }}
    >
      <Ionicons name={icon} size={14} color={primary ? "#fff" : LC.ink2} />
      <Text style={{ fontSize: 13.5, fontWeight: "600", color: primary ? "#fff" : LC.ink2 }}>{label}</Text>
    </Pressable>
  );
}

function CampaignCard({ camp, onEdit }: { camp: Campaign; onEdit: (id: string) => void }) {
  const sty = lcStyleFor(camp);
  const tc = TYPE_COLORS[sty.color];
  const st = lcStatus(camp.status);
  const editable = camp.status === "active" || camp.status === "paused";
  // Budget effectif = budget + 10 % commission BUUPP (parité web).
  const budgetTotal = camp.budgetEur * 1.1;
  const spentTotal = camp.spentEur * 1.1;
  const pct = budgetTotal > 0 ? Math.min(100, Math.round((spentTotal / budgetTotal) * 100)) : 0;
  const reached = Number(camp.reachedCount ?? 0);
  const ar = reached > 0 ? Math.round((Number(camp.contactsCount ?? 0) / reached) * 100) : 0;
  const code = camp.code ?? camp.authCode ?? null;

  return (
    <View
      style={{
        position: "relative", backgroundColor: LC.card, borderRadius: 20, borderWidth: 1, borderColor: LC.line,
        shadowColor: "#161a1d", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2,
      }}
    >
      {/* Rognage des coins sur une vue interne : l'ombre de la vue externe reste visible sur iOS (overflow:hidden l'efface), comme sur Android. */}
      <View style={{ borderRadius: 19, overflow: "hidden", padding: 18 }}>
        {/* Barre d'accent + halo (couleur du type) */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: tc.c }} />
        <View pointerEvents="none" style={{ position: "absolute", top: -40, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: tc.c, opacity: 0.05 }} />

        {/* En-tête : tuile d'icône + nom + statut + code */}
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: tc.soft }}>
            <Ionicons name={TYPE_ION[sty.icon] ?? "ellipse-outline"} size={23} color={tc.c} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <Text className="font-serif" style={{ fontSize: 19, color: LC.ink, flexShrink: 1 }} numberOfLines={1}>{camp.name}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: st.bg }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: st.dot }} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: st.color }}>{st.label}</Text>
              </View>
            </View>

          </View>
        </View>

        {/* Code buupp, infos et brief : pleine largeur, centrés dans la carte
            (hors de la colonne décalée par la tuile d'icône). */}
        {code ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center", marginTop: 14, paddingLeft: 10, paddingRight: 6, paddingVertical: 5, borderRadius: 10, backgroundColor: LC.amberXsoft, borderWidth: 1, borderColor: LC.codeBorder }}>
            <Ionicons name="lock-closed" size={11} color={LC.ck} />
            <Text style={{ fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase", color: LC.ck, fontWeight: "600" }}>Code buupp</Text>
            <Text style={{ fontSize: 12.5, fontWeight: "700", letterSpacing: 1, color: LC.cv }}>{code}</Text>
            <Pressable
              onPress={() => Clipboard.setStringAsync(String(code))}
              hitSlop={6}
              style={{ width: 24, height: 24, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: LC.codeBorder }}
            >
              <Ionicons name="copy-outline" size={12} color={LC.ck} />
            </Pressable>
          </View>
        ) : null}

        <Text style={{ marginTop: 10, fontSize: 12.5, lineHeight: 18, color: LC.ink3, textAlign: "center" }} numberOfLines={2}>
          {camp.objectiveLabel} · créée le <Text style={{ color: LC.ink2, fontWeight: "600" }}>{dateShort(camp.createdAt)}</Text> · coût moyen <Text style={{ color: LC.ink2, fontWeight: "600" }}>{eur(camp.avgCostEur)}</Text>
        </Text>

        {camp.brief ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 }}>
            <Ionicons name="pricetag-outline" size={13} color={tc.c} />
            <Text className="font-serif-italic" style={{ fontSize: 14, color: tc.c, flexShrink: 1 }} numberOfLines={1}>« {camp.brief} »</Text>
          </View>
        ) : null}

        {/* Séparateur */}
        <View style={{ marginTop: 18, borderTopWidth: 1, borderColor: LC.line }} />

        {/* Tuiles de stats */}
        <View style={{ marginTop: 16, gap: 10 }}>
          <LcStatTile icon="cash-outline" color={tc.c} soft={tc.soft} label="Budget" value={`${eur(spentTotal)} / ${eur(budgetTotal)}`} />
          <LcStatTile icon="people-outline" color="#2f72c4" soft="#dbe9f8" label="Touchés" value={String(reached)} />
          <LcStatTile icon="checkmark-circle-outline" color="#2e9e5b" soft="#dcf0e3" label="Contacts" value={`${Number(camp.contactsCount ?? 0)} · ${ar}%`} />
        </View>

        {/* Barre budget consommé — dégradée par couleur du type */}
        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <Text style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: LC.ink3 }}>Budget consommé</Text>
            <Text style={{ fontSize: 12.5, fontWeight: "700", color: LC.ink }}>{pct}%</Text>
          </View>
          <View style={{ height: 8, borderRadius: 999, backgroundColor: LC.paperWarm, overflow: "hidden" }}>
            <View style={{ width: `${Math.max(pct, 3)}%`, height: "100%" }}>
              <LinearGradient colors={[tc.c, tc.light]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, borderRadius: 999 }} />
            </View>
          </View>
          <Text style={{ marginTop: 7, fontSize: 11, color: LC.ink4 }}>
            Commission incluse · acquise sur les acceptations · {eur(spentTotal)} engagés sur {eur(budgetTotal)}
          </Text>
        </View>

        {/* Actions */}
        <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {editable ? <LcAct icon="create-outline" label="Modifier" onPress={() => onEdit(camp.id)} /> : null}
          <LcAct icon="copy-outline" label="Dupliquer" onPress={() => router.push(`/(pro)/objectif?duplicate=${camp.id}` as never)} />
          <LcAct icon="arrow-forward" label="Détails" primary onPress={() => router.push(`/(pro)/campagne?id=${camp.id}` as never)} />
        </View>
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
  // Campagne en cours d'édition (sheet « Modifier ») ; null = fermé.
  const [editingId, setEditingId] = useState<string | null>(null);
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
                <CampaignCard key={camp.id} camp={camp} onEdit={setEditingId} />
              ))}
            </View>
          );
        }}
      </QueryGate>

      <EditCampaignSheet
        campId={editingId ?? ""}
        visible={!!editingId}
        onClose={() => setEditingId(null)}
      />
    </ScrollScreen>
  );
}
