// Mises en relation — /api/prospect/relations. Accept/refuse via la
// mutation useDecideRelation (body { action }) → invalidation des vues
// impactées (relations/wallet/score) = synchro web⇄mobile (§6.1).
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { router, useLocalSearchParams } from "expo-router";
import { MovementDetailSheet } from "../../components/movement-detail-sheet";
import { dateFr, eur, QueryGate, ScrollScreen } from "../../components/screen";
import { useProspectRelations } from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";
import type { MovementRelation, Relation } from "../../lib/queries";

// ── Filtre cyclique historique ──────────────────────────────────────
type HistoryFilter = "all" | "accepted" | "refused";

const HISTORY_FILTERS: { key: HistoryFilter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "accepted", label: "Acceptées" },
  { key: "refused", label: "Refusées" },
];

// Initiales pour avatar (pro). Mirror Shell.jsx fn Avatar du web.
function initials(name: string): string {
  return (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

// Palette du redesign Relations (cf. public/prototype/det.html).
const DV = "#7c5cff"; // violet
const DVD = "#5b3fe0"; // violet deep
const DVXL = "#f2edff"; // violet extra light
const DVL = "#e8e0ff"; // violet light
const DGREEN = "#5aa86a";
const DGREEN_TXT = "#2f6b3c";
const DGREENL = "#dcefdf";
const DCORAL = "#dd5f48";
const DCORALL = "#f9ddd5";
const DAMBER_TXT = "#8a5a12";
const DAMBERL = "#f8e8c9";
const DAMBER_BD = "#efd9a8";
const DNAVY = "#0a1628";
const DMUTED = "#6b7384";
const DMUTEDL = "#9aa1ad";
const DLINE = "#e7e1d2";

// Convertit un Relation (API /relations) vers le shape MovementRelation
// attendu par MovementDetailSheet. Les champs manquants côté Relation
// (availableAt, tiers détaillés) sont neutralisés — parité avec le modal
// web RelationDetailModal qui n'affiche pas non plus availableAt pour
// l'historique relations.
function toMovementRelation(r: Relation): MovementRelation {
  return {
    id: r.id,
    date: r.date ?? null,
    pro: r.pro,
    proName: r.proName ?? r.pro,
    sector: r.sector,
    motif: r.motif,
    brief: r.brief,
    reward: r.reward,
    tier: r.tier,
    tiers: [r.tier],
    timer: r.timer,
    startDate: r.startDate ?? null,
    endDate: r.endDate ?? null,
    decision: r.decision ?? "",
    status: r.status ?? "",
    availableAt: null,
    relationStatus: r.relationStatus ?? "",
    gain: r.gain ?? null,
    campaignStatus: r.campaignStatus ?? null,
    campaignOpen: !!r.campaignOpen,
    campaignActive: !!r.campaignActive,
    reported: r.reported,
  };
}

// ── Card historique (cf. det.html) ─────────────────────────────────
// Barre d'accent (vert accepté / corail refusé), avatar dégradé violet,
// nom + secteur, date, séparateur, chip palier + chip statut + gain.
function HistoryRow({
  r,
  onPress,
  focused,
}: {
  r: Relation;
  onPress: () => void;
  focused?: boolean;
}) {
  const isRefused = r.decision === "Refusée";
  const isAccepted = r.decision === "Acceptée";
  const accent = isAccepted ? DGREEN : isRefused ? DCORAL : DV;
  const gainPositive = r.gain != null && r.gain > 0;
  const gainStr = gainPositive ? "+" + eur(r.gain) : "—";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Détail de ${r.pro}`}
      className="active:opacity-80"
    >
      <View
        style={{
          borderRadius: 18,
          overflow: "hidden",
          backgroundColor: "#fff",
          borderWidth: focused ? 2 : 1,
          borderColor: focused ? DV : DLINE,
          shadowColor: "#0F1629",
          shadowOpacity: 0.05,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }}
      >
        {/* Barre d'accent colorée selon la décision */}
        <View style={{ height: 4, backgroundColor: accent }} />
        <View style={{ padding: 14 }}>
          {/* Avatar + nom/secteur + date */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <LinearGradient
              colors={[DV, DVD]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text className="font-serif-bold" style={{ fontSize: 15, color: "#fff" }}>
                {initials(r.pro)}
              </Text>
            </LinearGradient>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                className="font-serif"
                style={{ fontSize: 17, color: DNAVY }}
                numberOfLines={1}
              >
                {r.pro}
              </Text>
              {r.sector ? (
                <Text
                  style={{ fontSize: 13, color: DMUTED, marginTop: 1 }}
                  numberOfLines={1}
                >
                  {r.sector}
                </Text>
              ) : null}
            </View>
            <Text
              style={{ fontSize: 12.5, color: DMUTEDL, fontStyle: "italic" }}
              numberOfLines={1}
            >
              {dateFr(r.date)}
            </Text>
          </View>

          {/* Séparateur */}
          <View
            style={{ height: 1, backgroundColor: "#F0ECE2", marginTop: 12, marginBottom: 12 }}
          />

          {/* Palier · statut · gain */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingVertical: 5,
                paddingHorizontal: 9,
                borderRadius: 999,
                backgroundColor: DAMBERL,
                borderWidth: 1,
                borderColor: DAMBER_BD,
              }}
            >
              <Ionicons name="trending-up" size={12} color={DAMBER_TXT} />
              <Text style={{ fontSize: 12.5, fontWeight: "600", color: DAMBER_TXT }}>
                Palier {r.tier}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: isRefused ? DCORALL : DGREENL,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: isRefused ? DCORAL : DGREEN,
                }}
              />
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: "600",
                  color: isRefused ? DCORAL : DGREEN_TXT,
                }}
              >
                {r.decision || "—"}
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text
              className="font-serif-bold"
              style={{ fontSize: 17, color: gainPositive ? DVD : DMUTEDL }}
            >
              {gainStr}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// Largeur d'une card du carrousel sollicitations (peek de la suivante).
const REL_CARD_W = Math.min(300, Dimensions.get("window").width - 72);

// Card d'une sollicitation (demande en attente) dans le carrousel — modèle
// repris des flash deals, mais SANS les labels « Flash Deal »/« Gains ×N » :
// pill « Nouvelle demande » + badge palier. « Voir le détail » ouvre le détail
// (accepter / refuser).
function SollicitationCard({
  r,
  onOpen,
}: {
  r: Relation;
  onOpen: (r: Relation) => void;
}) {
  const start = r.startDate ? new Date(r.startDate).getTime() : 0;
  const end = r.expiresAt
    ? new Date(r.expiresAt).getTime()
    : r.endDate
      ? new Date(r.endDate).getTime()
      : 0;
  const now = Date.now();
  const left = end > start ? Math.max(0, Math.min(1, (end - now) / (end - start))) : 1;
  const expired = end > 0 && end <= now;
  // Sollicitation déjà acceptée → badge ✓ (cf. mécanisme flash deals).
  const accepted = r.relationStatus === "accepted" || r.decision === "Acceptée";
  return (
    <View
      style={{
        width: REL_CARD_W,
        flexShrink: 0,
        backgroundColor: "#fff",
        borderRadius: 22,
        borderWidth: 1,
        borderColor: DLINE,
        overflow: "hidden",
        shadowColor: DNAVY,
        shadowOpacity: 0.07,
        shadowRadius: 11,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
      }}
    >
      <LinearGradient
        colors={[DV, DVD]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: 4 }}
      />
      <View style={{ padding: 17 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 5,
              paddingHorizontal: 11,
              borderRadius: 999,
              backgroundColor: DNAVY,
            }}
          >
            <Ionicons name="sparkles" size={12} color="#fff" />
            <Text style={{ fontSize: 11.5, fontWeight: "600", color: "#fff" }}>
              Nouvelle demande
            </Text>
          </View>
          {accepted ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: "#E8F5EE",
              }}
            >
              <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#16A34A" }}>
                Acceptée
              </Text>
            </View>
          ) : (
            <View
              style={{
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: DVXL,
                borderWidth: 1,
                borderColor: DVL,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: DVD }}>
                Palier {r.tier}
              </Text>
            </View>
          )}
        </View>

        <View style={{ marginTop: 14 }}>
          <Text
            className="font-serif"
            numberOfLines={1}
            style={{ fontSize: 20, color: DNAVY }}
          >
            {r.pro}
          </Text>
          {r.sector ? (
            <Text
              numberOfLines={1}
              style={{ fontSize: 12.5, color: DMUTED, marginTop: 3 }}
            >
              {r.sector}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            marginTop: 14,
            paddingVertical: 13,
            paddingHorizontal: 15,
            borderRadius: 16,
            backgroundColor: "#f4f1e9",
            borderWidth: 1,
            borderColor: DLINE,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 10.5, fontWeight: "600", letterSpacing: 1.8, color: DMUTED }}>
              RÉCOMPENSE
            </Text>
            <Text style={{ fontSize: 10.5, fontWeight: "700", letterSpacing: 0.5, color: DV }}>
              À ACCEPTER
            </Text>
          </View>
          <Text className="font-serif" style={{ fontSize: 30, color: DNAVY, marginTop: 5 }}>
            {eur(r.reward)}
          </Text>
          <Text style={{ fontSize: 11.5, color: DMUTED, marginTop: 5 }}>
            Versée dès que vous acceptez
          </Text>
        </View>

        <View style={{ marginTop: 14 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Ionicons name="time-outline" size={15} color={DCORAL} />
              <Text
                className="font-mono"
                style={{
                  fontSize: 15.5,
                  fontWeight: "600",
                  color: expired ? DCORAL : DNAVY,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {expired ? "Expirée" : r.timer}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                letterSpacing: 0.4,
                color: DCORAL,
                textTransform: "uppercase",
              }}
            >
              Restant
            </Text>
          </View>
          <View
            style={{
              height: 5,
              borderRadius: 3,
              backgroundColor: "#ece7d9",
              overflow: "hidden",
              marginTop: 7,
            }}
          >
            <LinearGradient
              colors={["#e0972f", DCORAL]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: `${Math.round(left * 100)}%`, height: "100%", borderRadius: 3 }}
            />
          </View>
        </View>

        <Pressable
          onPress={() => onOpen(r)}
          style={{
            marginTop: 15,
            paddingVertical: 13,
            borderRadius: 13,
            backgroundColor: DNAVY,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#fbf9f4" }}>
            Voir le détail
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#fbf9f4" />
        </Pressable>
      </View>
    </View>
  );
}

export default function Relations() {
  const q = useProspectRelations();
  useRefetchOnFocus(q);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  // Relation sélectionnée pour ouverture du détail-sheet. Stocké
  // séparément du `visible` pour conserver le contenu pendant l'animation
  // de fermeture (sinon flash blanc).
  const [detail, setDetail] = useState<Relation | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  // Index actif du carrousel de sollicitations (pastilles de pagination).
  const [solIdx, setSolIdx] = useState(0);
  const SOL_GAP = 12;
  const onSolScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setSolIdx(Math.max(0, Math.round(x / (REL_CARD_W + SOL_GAP))));
  };

  const params = useLocalSearchParams<{ focusRelation?: string }>();
  const focusRelationId = typeof params.focusRelation === "string" ? params.focusRelation : null;

  useEffect(() => {
    if (!focusRelationId) return;
    const t = setTimeout(() => {
      router.setParams({ focusRelation: undefined });
    }, 2000);
    return () => clearTimeout(t);
  }, [focusRelationId]);

  const history: Relation[] = q.data?.history ?? [];

  const filteredHistory = history.filter(
    (h) =>
      historyFilter === "all" ||
      (historyFilter === "accepted" && h.decision === "Acceptée") ||
      (historyFilter === "refused" && h.decision === "Refusée"),
  );

  // Extras du header compact (visibles au scroll) : icône handshake
  // coral signature de la page + nombre en attente (ambre) + nombre
  // d'acceptées depuis l'ouverture du compte (vert). Les compteurs sont
  // dérivés des deux listes renvoyées par /api/prospect/relations.
  const pendingCount = q.data?.pending?.length ?? 0;
  const acceptedCount = useMemo(
    () => history.filter((h) => h.decision === "Acceptée").length,
    [history],
  );
  const compactExtras = useMemo(
    () => [
      {
        iconLib: "ionicons" as const,
        icon: "hourglass" as const,
        value: String(pendingCount),
        color: "#FF7A6B",
      },
      {
        iconLib: "ionicons" as const,
        icon: "checkmark-circle" as const,
        value: String(acceptedCount),
        color: "#16A34A",
      },
    ],
    [pendingCount, acceptedCount],
  );

  return (
    <ScrollScreen onRefresh={q.refetch} compactExtras={compactExtras}>
      {/* Hero « Demandes en attente » (cf. det.html). Le header de l'app est
          conservé (on ne reprend pas la barre « b Relations » de la maquette). */}
      <View style={{ borderRadius: 24, overflow: "hidden" }}>
        <LinearGradient
          colors={[DV, DVD]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 18 }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: -10,
              top: -10,
              width: 120,
              height: 120,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: "700",
                  letterSpacing: 1.3,
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.72)",
                }}
              >
                Mises en relation
              </Text>
              <Text
                className="font-serif"
                style={{ fontSize: 24, color: "#fff", marginTop: 4 }}
              >
                Demandes en attente
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 20,
                  color: "rgba(255,255,255,0.85)",
                  marginTop: 8,
                }}
              >
                Acceptez pour être rémunéré·e. Sans réponse à temps, la
                sollicitation expire.
              </Text>
            </View>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                backgroundColor: "rgba(255,255,255,0.16)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="swap-horizontal" size={24} color="#fff" />
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* ── Demandes en attente ──────────────────────────── */}
      <QueryGate query={q}>
        {(d) =>
          (d.pending?.length ?? 0) === 0 ? (
            // Empty state (cf. det.html) : radar violet + texte + pill.
            <View
              style={{
                borderRadius: 22,
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: DLINE,
                paddingVertical: 28,
                paddingHorizontal: 20,
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 999,
                  backgroundColor: DVXL,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    width: 50,
                    height: 50,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: DVL,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: DV,
                    opacity: 0.55,
                  }}
                />
                <View
                  style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: DV }}
                />
              </View>
              <Text
                className="font-serif"
                style={{ fontSize: 21, color: DNAVY, textAlign: "center" }}
              >
                Aucune demande pour l’instant
              </Text>
              <Text
                style={{
                  fontSize: 13.5,
                  color: DMUTED,
                  textAlign: "center",
                  lineHeight: 20,
                  marginTop: 6,
                  maxWidth: 300,
                }}
              >
                Mais ça ne saurait tarder… On vous prévient dès qu’une
                sollicitation arrive.
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                  marginTop: 16,
                  paddingVertical: 7,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: DVXL,
                }}
              >
                <View
                  style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: DV }}
                />
                <Text style={{ fontSize: 12.5, fontWeight: "600", color: DVD }}>
                  Notifications activées
                </Text>
              </View>
            </View>
          ) : (
            <View>
              <Text
                className="font-mono"
                style={{ fontSize: 13, color: DMUTED, marginBottom: 4 }}
              >
                {d.pending.length}{" "}
                {d.pending.length === 1
                  ? "demande en attente"
                  : "demandes en attente"}
              </Text>
              {/* Carrousel horizontal de sollicitations (modèle flash deals). */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={REL_CARD_W + SOL_GAP}
                snapToAlignment="start"
                onScroll={onSolScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{ gap: SOL_GAP, paddingTop: 10, paddingRight: 24 }}
              >
                {d.pending.map((r) => (
                  <SollicitationCard
                    key={r.id}
                    r={r}
                    onOpen={(rel) => {
                      setDetail(rel);
                      setDetailVisible(true);
                    }}
                  />
                ))}
              </ScrollView>
              {d.pending.length > 1 ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    marginTop: 14,
                  }}
                >
                  {d.pending.map((r, i) => {
                    const on = i === Math.min(solIdx, d.pending.length - 1);
                    return (
                      <View
                        key={r.id}
                        style={{
                          width: on ? 18 : 7,
                          height: 7,
                          borderRadius: 999,
                          backgroundColor: on ? DV : DLINE,
                        }}
                      />
                    );
                  })}
                </View>
              ) : null}
            </View>
          )
        }
      </QueryGate>

      {/* ── Historique (cf. det.html) ────────────────────── */}
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              backgroundColor: DVXL,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="time-outline" size={16} color={DV} />
          </View>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              letterSpacing: 1.3,
              textTransform: "uppercase",
              color: DMUTED,
            }}
          >
            Historique · {filteredHistory.length}
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          {HISTORY_FILTERS.map((f) => {
            const active = historyFilter === f.key;
            const isAcc = f.key === "accepted";
            const isRef = f.key === "refused";
            const on = isAcc
              ? { bg: DGREENL, bd: DGREENL, txt: DGREEN_TXT }
              : isRef
                ? { bg: DCORALL, bd: DCORALL, txt: DCORAL }
                : { bg: DNAVY, bd: DNAVY, txt: "#fff" };
            const off = isAcc
              ? { bg: "#fff", bd: DGREEN, txt: DGREEN_TXT }
              : isRef
                ? { bg: "#fff", bd: DCORAL, txt: DCORAL }
                : { bg: "#fff", bd: DLINE, txt: DNAVY };
            const s = active ? on : off;
            return (
              <Pressable
                key={f.key}
                onPress={() => setHistoryFilter(f.key)}
                style={{
                  paddingVertical: 9,
                  paddingHorizontal: 18,
                  borderRadius: 999,
                  backgroundColor: s.bg,
                  borderWidth: 1.5,
                  borderColor: s.bd,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: s.txt }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {q.isPending ? null : filteredHistory.length === 0 ? (
          <View
            style={{
              borderRadius: 18,
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: DLINE,
              paddingVertical: 28,
              paddingHorizontal: 20,
              alignItems: "center",
            }}
          >
            <Text className="font-serif" style={{ fontSize: 18, color: DNAVY }}>
              Rien à afficher
            </Text>
            <Text
              style={{ fontSize: 13, color: DMUTED, textAlign: "center", marginTop: 4 }}
            >
              {historyFilter === "accepted"
                ? "Vos sollicitations acceptées s’afficheront ici."
                : historyFilter === "refused"
                  ? "Vos sollicitations refusées s’afficheront ici."
                  : "Vos sollicitations traitées s’afficheront ici."}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {filteredHistory.map((r) => (
              <HistoryRow
                key={r.id}
                r={r}
                focused={focusRelationId === r.id}
                onPress={() => {
                  setDetail(r);
                  setDetailVisible(true);
                }}
              />
            ))}
          </View>
        )}
      </View>

      <MovementDetailSheet
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        relation={detail ? toMovementRelation(detail) : null}
      />
    </ScrollScreen>
  );
}
