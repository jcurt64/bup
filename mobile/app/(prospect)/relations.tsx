// Mises en relation — /api/prospect/relations. Accept/refuse via le flux
// partagé useRelationDecision (garde données complètes, consentement
// téléphone, erreurs 422/429/403) → invalidation des vues impactées
// (relations/wallet/score) = synchro web⇄mobile (§6.1). Parité web
// (Prospect.jsx fn Relations) : 4 cartes de stats, barre de filtres
// (Montant / Date / Palier / Autour de moi / Flash deals), cartes avec tous
// les paliers requis + motif + Accepter/Refuser directs, historique avec
// badge FLASH, statut séquestre/crédité et « Total accepté ».
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
import { EmptyRequestsCard } from "../../components/empty-requests-card";
import { MovementDetailSheet } from "../../components/movement-detail-sheet";
import { RelationFilterBar } from "../../components/relation-filter-bar";
import { useRelationDecision, type DecisionAction } from "../../components/relation-decision";
import { dateFr, eur, QueryGate, ScrollScreen } from "../../components/screen";
import { VitrineLeaveSheet } from "../../components/vitrine-leave-sheet";
import { VitrinePreview } from "../../components/vitrine-preview";
import { useProspectRelations } from "../../lib/queries";
import {
  applyRelFilters,
  REL_FILTER_DEFAULTS,
  tierListLabel,
  type RelFilterValues,
} from "../../lib/relation-filters";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";
import type { MovementRelation, Relation } from "../../lib/queries";
import { useTheme } from "../../lib/theme";
import { shade, withAlpha } from "../../lib/color";
import { Motif } from "../../components/motif";
import { HERO_GRADIENT } from "../../lib/pro-theme";

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

// Palette du redesign Relations (cf. public/prototype/det.html), désormais
// thématisée clair/sombre. Chaque composant fait `const R = useRel()` et
// référence R.DV, R.DNAVY, etc. (accents vifs conservés, neutres/tints
// basculés via le thème).
function useRel() {
  const { c, isDark } = useTheme();
  return {
    DV: c.accViolet,
    DVD: c.accVioletDeep,
    DVXL: c.tintViolet,
    DVL: c.violetSoft,
    DGREEN: c.accGreen,
    DGREEN_TXT: c.good,
    DGREENL: c.tintGreen,
    DCORAL: c.accCoral,
    DCORALL: c.tintCoral,
    DAMBER_TXT: isDark ? c.accAmber : "#8a5a12",
    DAMBERL: c.tintAmber,
    DAMBER_BD: c.borderSoft,
    DNAVY: c.text,
    DMUTED: c.textSub,
    DMUTEDL: c.textMuted,
    DLINE: c.borderSoft,
    surface: c.surface,
    field: c.field,
    track: c.track,
    // Bouton/pille primaire : fond sombre + texte clair en mode clair, qui
    // s'INVERSENT en sombre (fond clair + texte sombre). À utiliser pour les
    // surfaces « pleines » — DNAVY (= c.text) ne convient pas car il bascule
    // en clair et rend un texte clair illisible par-dessus.
    btnBg: c.btnBg,
    btnText: c.btnText,
  };
}

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
    // Propage les vrais paliers exigés par la campagne (pour le garde-fou
    // « données complètes » à l'acceptation) ; repli sur [r.tier] si absent.
    tiers: r.tiers && r.tiers.length > 0 ? r.tiers : [r.tier],
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
    websiteUrl: r.websiteUrl ?? null,
  };
}

// Une sollicitation « en attente de décision » = encore ni acceptée ni
// refusée. Les sollicitations décidées restent dans `pending` (carrousel
// avec pastille ✓ « Acceptée » ou « Refusée »), mais ne doivent PAS être
// comptées dans « X demandes en attente ». Même condition que le badge de
// la tab bar (floating-tab-bar).
const isAwaitingDecision = (r: Relation) =>
  !(
    r.relationStatus === "accepted" ||
    r.decision === "Acceptée" ||
    r.relationStatus === "refused" ||
    r.decision === "Refusée"
  );

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
  const R = useRel();
  const isRefused = r.decision === "Refusée";
  const isAccepted = r.decision === "Acceptée";
  const accent = isAccepted ? R.DGREEN : isRefused ? R.DCORAL : R.DV;
  const gainPositive = r.gain != null && r.gain > 0;
  const isEscrow = /séquestre/i.test(r.status ?? "");
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
          backgroundColor: R.surface,
          borderWidth: focused ? 2 : 1,
          borderColor: focused ? R.DV : withAlpha(accent, "40"),
          shadowColor: accent,
          shadowOpacity: 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }}
      >
        {/* Fond teinté de la couleur de la décision + motif + filigrane */}
        <LinearGradient
          colors={[withAlpha(accent, "24"), withAlpha(R.surface, "00")]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <Motif variant="dots" color={withAlpha(accent, "66")} style={{ top: 10, right: 10 }} />
        <View
          pointerEvents="none"
          style={{ position: "absolute", right: -16, bottom: -20, opacity: 0.07, transform: [{ rotate: "-14deg" }] }}
        >
          <Ionicons
            name={isAccepted ? "checkmark-circle" : isRefused ? "close-circle" : "hourglass"}
            size={110}
            color={accent}
          />
        </View>
        <View style={{ padding: 14 }}>
          {/* Avatar + nom/secteur + date */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <LinearGradient
              colors={[R.DV, R.DVD]}
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
                style={{ fontSize: 17, color: R.DNAVY }}
                numberOfLines={1}
              >
                {r.pro}
              </Text>
              {r.sector ? (
                <Text
                  style={{ fontSize: 13, color: R.DMUTED, marginTop: 1 }}
                  numberOfLines={1}
                >
                  {r.sector}
                </Text>
              ) : null}
              {r.isFlashDeal ? <FlashBadge /> : null}
            </View>
            <Text
              style={{ fontSize: 12.5, color: R.DMUTEDL, fontStyle: "italic" }}
              numberOfLines={1}
            >
              {dateFr(r.date)}
            </Text>
          </View>

          {/* Séparateur */}
          <View
            style={{ height: 1, backgroundColor: R.DLINE, marginTop: 12, marginBottom: 12 }}
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
                backgroundColor: R.DAMBERL,
                borderWidth: 1,
                borderColor: R.DAMBER_BD,
              }}
            >
              <Ionicons name="trending-up" size={12} color={R.DAMBER_TXT} />
              <Text
                numberOfLines={1}
                style={{ fontSize: 12.5, fontWeight: "600", color: R.DAMBER_TXT }}
              >
                {tierListLabel(r)}
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
                backgroundColor: isRefused ? R.DCORALL : R.DGREENL,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: isRefused ? R.DCORAL : R.DGREEN,
                }}
              />
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: "600",
                  color: isRefused ? R.DCORAL : R.DGREEN_TXT,
                }}
              >
                {r.decision || "—"}
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text
              className="font-serif-bold"
              style={{ fontSize: 17, color: gainPositive ? R.DVD : R.DMUTEDL }}
            >
              {gainStr}
            </Text>
          </View>

          {/* Statut des fonds : séquestre (cadenas ambre) ou crédité. */}
          {isAccepted && isEscrow ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
              <Ionicons name="lock-closed-outline" size={13} color="#B45309" />
              <Text style={{ fontSize: 13, color: R.DMUTED }}>En séquestre</Text>
            </View>
          ) : r.status && r.status !== "—" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
              <Ionicons name="checkmark-circle-outline" size={13} color={R.DGREEN_TXT} />
              <Text style={{ fontSize: 13, color: R.DMUTED }}>{r.status}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

// Badge « FLASH » (sollicitation Flash Deal — gains multipliés), parité web.
function FlashBadge() {
  return (
    <LinearGradient
      colors={["#B91C1C", "#EF4444"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        marginTop: 4,
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 999,
      }}
    >
      <Ionicons name="flash" size={9} color="#fff" />
      <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.6, color: "#fff" }}>
        FLASH
      </Text>
    </LinearGradient>
  );
}

// Carte de statistique (4 en grille 2×2) — parité RelationStat du web :
// gains acceptés (carte primaire indigo), acceptées, refusées, séquestre.
function RelationStat({
  primary,
  tone = "good",
  icon,
  label,
  value,
  sub,
}: {
  primary?: boolean;
  tone?: "good" | "danger" | "warn";
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub?: string;
}) {
  const R = useRel();
  const { c, isDark } = useTheme();
  const tones = {
    good: { bg: isDark ? "rgba(22,163,74,0.18)" : "#ECFDF5", fg: isDark ? "#4ADE80" : "#15803D" },
    danger: { bg: isDark ? "rgba(220,38,38,0.18)" : "#FDECEC", fg: isDark ? "#F87171" : "#DC2626" },
    warn: { bg: isDark ? "rgba(180,83,9,0.22)" : "#FBEFD6", fg: isDark ? "#FBBF24" : "#B45309" },
  } as const;
  const t = tones[tone];
  const inner = (
    <>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          marginBottom: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: primary ? "rgba(255,255,255,0.16)" : t.bg,
        }}
      >
        <Ionicons name={icon} size={17} color={primary ? "#fff" : t.fg} />
      </View>
      <Text
        className="font-mono"
        numberOfLines={2}
        style={{
          fontSize: 9.5,
          letterSpacing: 1.1,
          textTransform: "uppercase",
          marginBottom: 6,
          color: primary ? "rgba(255,255,255,0.65)" : R.DMUTEDL,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
        <Text
          className="font-serif-bold"
          style={{ fontSize: 24, lineHeight: 28, color: primary ? "#fff" : R.DNAVY }}
        >
          {value}
        </Text>
        {sub ? (
          <Text style={{ fontSize: 12, color: primary ? "rgba(255,255,255,0.65)" : R.DMUTEDL }}>
            {sub}
          </Text>
        ) : null}
      </View>
    </>
  );
  const box = {
    flex: 1,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
  } as const;
  // Filigrane : l'icône de la stat en grand, dans le coin bas-droit.
  const watermark = (
    <View
      pointerEvents="none"
      style={{ position: "absolute", right: -12, bottom: -14, opacity: primary ? 0.14 : 0.1, transform: [{ rotate: "-12deg" }] }}
    >
      <Ionicons name={icon} size={78} color={primary ? "#FFFFFF" : t.fg} />
    </View>
  );
  return primary ? (
    // Carte primaire aux couleurs du thème (était indigo fixe) + cercles.
    <LinearGradient
      colors={[shade(c.violet, isDark ? -0.25 : 0.05), shade(c.violet, isDark ? -0.6 : -0.35)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ ...box, borderColor: "transparent", overflow: "hidden" }}
    >
      <Motif variant="rings" color="rgba(255,255,255,0.14)" style={{ top: -110, right: -110 }} />
      {watermark}
      {inner}
    </LinearGradient>
  ) : (
    <LinearGradient
      colors={[t.bg, R.surface]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ ...box, borderColor: withAlpha(t.fg, "33"), overflow: "hidden" }}
    >
      {watermark}
      {inner}
    </LinearGradient>
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
  onVitrine,
  onDecide,
  busyAction,
  disabled,
}: {
  r: Relation;
  onOpen: (r: Relation) => void;
  onVitrine: (r: Relation) => void;
  onDecide: (action: DecisionAction, r: Relation) => void;
  /** Décision en cours sur CETTE carte (libellé « … »). */
  busyAction: DecisionAction | null;
  /** Une décision est en cours (n'importe quelle carte). */
  disabled: boolean;
}) {
  const R = useRel();
  const start = r.startDate ? new Date(r.startDate).getTime() : 0;
  const end = r.expiresAt
    ? new Date(r.expiresAt).getTime()
    : r.endDate
      ? new Date(r.endDate).getTime()
      : 0;
  const now = Date.now();
  const left = end > start ? Math.max(0, Math.min(1, (end - now) / (end - start))) : 1;
  const expired = end > 0 && end <= now;
  // Sollicitation déjà décidée → pastille « Acceptée » (✓) ou « Refusée »
  // (cf. mécanisme flash deals), à la place du badge palier.
  const accepted = r.relationStatus === "accepted" || r.decision === "Acceptée";
  const refused = r.relationStatus === "refused" || r.decision === "Refusée";
  return (
    <View
      style={{
        width: REL_CARD_W,
        flexShrink: 0,
        backgroundColor: R.surface,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: R.DLINE,
        overflow: "hidden",
        shadowColor: R.DNAVY,
        shadowOpacity: 0.07,
        shadowRadius: 11,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
      }}
    >
      {/* Voile violet en haut + confettis + filigrane mégaphone */}
      <LinearGradient
        colors={[R.DVXL, withAlpha(R.surface, "00")]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 0.7 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 220 }}
      />
      <Motif variant="confetti" color={withAlpha(R.DV, "99")} style={{ top: 40 }} />
      <View
        pointerEvents="none"
        style={{ position: "absolute", right: -18, top: 70, opacity: 0.06, transform: [{ rotate: "-16deg" }] }}
      >
        <Ionicons name="megaphone" size={130} color={R.DV} />
      </View>
      <LinearGradient
        colors={[R.DV, R.DVD]}
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
              backgroundColor: R.btnBg,
            }}
          >
            <Ionicons name="sparkles" size={12} color={R.btnText} />
            <Text style={{ fontSize: 11.5, fontWeight: "600", color: R.btnText }}>
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
                backgroundColor: R.DGREENL,
              }}
            >
              <Ionicons name="checkmark-circle" size={14} color={R.DGREEN_TXT} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: R.DGREEN_TXT }}>
                Acceptée
              </Text>
            </View>
          ) : refused ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: R.DCORALL,
              }}
            >
              <Ionicons name="close-circle" size={14} color={R.DCORAL} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: R.DCORAL }}>
                Refusée
              </Text>
            </View>
          ) : (
            <View
              style={{
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: R.DVXL,
                borderWidth: 1,
                borderColor: R.DVL,
              }}
            >
              <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", color: R.DVD }}>
                {tierListLabel(r)}
              </Text>
            </View>
          )}
        </View>

        <View style={{ marginTop: 14 }}>
          <Text
            className="font-serif"
            numberOfLines={1}
            style={{ fontSize: 20, color: R.DNAVY }}
          >
            {r.pro}
          </Text>
          {r.sector ? (
            <Text
              numberOfLines={1}
              style={{ fontSize: 12.5, color: R.DMUTED, marginTop: 3 }}
            >
              {r.sector}
            </Text>
          ) : null}
          {/* Motif de la campagne (parité web). */}
          {r.motif ? (
            <Text
              numberOfLines={4}
              style={{ fontSize: 13, lineHeight: 19, color: R.DMUTED, marginTop: 10 }}
            >
              {r.motif}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            marginTop: 14,
            paddingVertical: 13,
            paddingHorizontal: 15,
            borderRadius: 16,
            backgroundColor: R.track,
            borderWidth: 1,
            borderColor: R.DLINE,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 10.5, fontWeight: "600", letterSpacing: 1.8, color: R.DMUTED }}>
              RÉCOMPENSE
            </Text>
            <Text style={{ fontSize: 10.5, fontWeight: "700", letterSpacing: 0.5, color: R.DV }}>
              À ACCEPTER
            </Text>
          </View>
          <Text className="font-serif" style={{ fontSize: 30, color: R.DNAVY, marginTop: 5 }}>
            {eur(r.reward)}
          </Text>
          <Text style={{ fontSize: 11.5, color: R.DMUTED, marginTop: 5 }}>
            En séquestre, créditée à la clôture de la campagne
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
              <Ionicons name="time-outline" size={15} color={R.DCORAL} />
              <Text
                className="font-mono"
                style={{
                  fontSize: 15.5,
                  fontWeight: "600",
                  color: expired ? R.DCORAL : R.DNAVY,
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
                color: R.DCORAL,
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
              backgroundColor: R.track,
              overflow: "hidden",
              marginTop: 7,
            }}
          >
            <LinearGradient
              colors={["#e0972f", R.DCORAL]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: `${Math.round(left * 100)}%`, height: "100%", borderRadius: 3 }}
            />
          </View>
        </View>

        {/* « La Vitrine » — miniature du site du pro (capture
            /api/campaign/[id]/preview) ; au tap → interstitiel de sortie.
            Affichée seulement si l'option a été prise (r.websiteUrl). */}
        {r.websiteUrl ? (
          <View style={{ marginTop: 14 }}>
            <VitrinePreview campaignId={r.campaignId} proName={r.pro} onVisit={() => onVitrine(r)} />
          </View>
        ) : null}

        {/* Accepter / Refuser directs (même flux que le détail). */}
        {!accepted && !refused && !expired ? (
          <View style={{ flexDirection: "row", gap: 10, marginTop: 15 }}>
            <Pressable
              disabled={disabled}
              onPress={() => onDecide("accept", r)}
              accessibilityRole="button"
              accessibilityLabel={`Accepter la sollicitation de ${r.pro}`}
              className="active:opacity-85"
              style={{ flex: 1, borderRadius: 13, overflow: "hidden", opacity: disabled && !busyAction ? 0.6 : 1 }}
            >
              <LinearGradient
                colors={["#22C55E", "#16A34A"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Ionicons name="checkmark" size={15} color="#fff" />
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
                  {busyAction === "accept" ? "…" : "Accepter"}
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              disabled={disabled}
              onPress={() => onDecide("refuse", r)}
              accessibilityRole="button"
              accessibilityLabel={`Refuser la sollicitation de ${r.pro}`}
              className="active:opacity-70"
              style={{
                flex: 1,
                paddingVertical: 13,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: R.DLINE,
                backgroundColor: R.surface,
                alignItems: "center",
                justifyContent: "center",
                opacity: disabled && !busyAction ? 0.6 : 1,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: R.DNAVY }}>
                {busyAction === "refuse" ? "…" : "Refuser"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          onPress={() => onOpen(r)}
          className="active:opacity-70"
          style={{
            marginTop: 10,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 13.5, fontWeight: "600", color: R.DV }}>
            Voir le détail de l’offre
          </Text>
          <Ionicons name="chevron-forward" size={15} color={R.DV} />
        </Pressable>
      </View>
    </View>
  );
}

export default function Relations() {
  const R = useRel();
  const { mode } = useTheme();
  const q = useProspectRelations();
  useRefetchOnFocus(q);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  // Filtres des sollicitations en attente (parité web RelFilterBar).
  const [relFilters, setRelFilters] = useState<RelFilterValues>(REL_FILTER_DEFAULTS);
  // Flux de décision partagé avec le détail (boutons directs des cartes).
  const decision = useRelationDecision();
  // Relation sélectionnée pour ouverture du détail-sheet. Stocké
  // séparément du `visible` pour conserver le contenu pendant l'animation
  // de fermeture (sinon flash blanc).
  const [detail, setDetail] = useState<Relation | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  // `true` quand le détail ouvert vient de l'HISTORIQUE (accept rétroactif /
  // refus-annulation), `false` quand il vient du carrousel des demandes EN
  // ATTENTE (Accepter + Refuser proposés). Cf. logique web RelationDetailModal.
  const [detailIsHistory, setDetailIsHistory] = useState(false);
  // « La Vitrine » — interstitiel de sortie ouvert depuis la carte de
  // sollicitation ({proName, websiteUrl} ou null).
  const [vitrineLeave, setVitrineLeave] = useState<{ proName: string; websiteUrl: string } | null>(null);
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

  const history: Relation[] = useMemo(() => q.data?.history ?? [], [q.data?.history]);
  const pendingAll: Relation[] = useMemo(() => q.data?.pending ?? [], [q.data?.pending]);
  const filteredPending = useMemo(
    () => applyRelFilters(pendingAll, relFilters),
    [pendingAll, relFilters],
  );

  // Statistiques dérivées de l'historique (cartes du haut + total du pied),
  // mêmes calculs que le web.
  const stats = useMemo(() => {
    const acc = history.filter((h) => h.decision === "Acceptée");
    const ref = history.filter((h) => h.decision === "Refusée");
    return {
      accepted: acc.length,
      refused: ref.length,
      total: history.length,
      gains: acc.reduce((sum, h) => sum + (Number(h.gain) || 0), 0),
      escrow: acc
        .filter((h) => /séquestre/i.test(h.status ?? ""))
        .reduce((sum, h) => sum + (Number(h.gain) || 0), 0),
    };
  }, [history]);

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
  const pendingCount = (q.data?.pending ?? []).filter(isAwaitingDecision).length;
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
        color: R.DCORAL,
        bg: R.DCORALL,
      },
      {
        iconLib: "ionicons" as const,
        icon: "checkmark-circle" as const,
        value: String(acceptedCount),
        color: R.DGREEN_TXT,
        bg: R.DGREENL,
      },
    ],
    [pendingCount, acceptedCount, R.DCORAL, R.DCORALL, R.DGREEN_TXT, R.DGREENL],
  );

  return (
    <ScrollScreen onRefresh={q.refetch} compactExtras={compactExtras}>
      {/* Hero « Demandes en attente » (cf. det.html). Le header de l'app est
          conservé (on ne reprend pas la barre « b Relations » de la maquette). */}
      <View style={{ borderRadius: 24, overflow: "hidden" }}>
        {/* Dégradé violet vif FIGÉ (mêmes valeurs dans les 2 modes) : les
            tokens d'accent (DV/DVD) s'éclaircissent en sombre, ce qui rendrait
            le texte blanc du héros illisible. On garde donc un violet soutenu
            pour préserver le contraste du titre dans les deux thèmes. */}
        <LinearGradient
          colors={HERO_GRADIENT[mode]}
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

      {/* ── Statistiques (4 cartes, grille 2×2) ──────────── */}
      {q.data ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <RelationStat primary icon="cash-outline" label="Gains acceptés cumulés" value={eur(stats.gains)} />
            <RelationStat
              tone="good"
              icon="checkmark"
              label="Acceptées"
              value={String(stats.accepted)}
              sub={`/ ${stats.total} demande${stats.total > 1 ? "s" : ""}`}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <RelationStat
              tone="danger"
              icon="close"
              label="Refusées"
              value={String(stats.refused)}
              sub={`/ ${stats.total} demande${stats.total > 1 ? "s" : ""}`}
            />
            <RelationStat tone="warn" icon="lock-closed-outline" label="En séquestre" value={eur(stats.escrow)} />
          </View>
        </View>
      ) : null}

      {/* ── Demandes en attente ──────────────────────────── */}
      <QueryGate query={q}>
        {(d) =>
          (d.pending?.length ?? 0) === 0 ? (
            // État vide : radar animé + raccourcis (components/empty-requests-card).
            <EmptyRequestsCard />
          ) : (
            <View style={{ gap: 12 }}>
              <RelationFilterBar
                values={relFilters}
                onChange={(next) => {
                  setRelFilters(next);
                  setSolIdx(0);
                }}
                pending={d.pending}
                filteredCount={filteredPending.length}
              />
              <Text
                className="font-mono"
                style={{ fontSize: 13, color: R.DMUTED }}
              >
                {d.pending.filter(isAwaitingDecision).length}{" "}
                {d.pending.filter(isAwaitingDecision).length === 1
                  ? "demande en attente"
                  : "demandes en attente"}
              </Text>
              {filteredPending.length === 0 ? (
                <View
                  style={{
                    borderRadius: 18,
                    backgroundColor: R.surface,
                    borderWidth: 1,
                    borderColor: R.DLINE,
                    paddingVertical: 24,
                    paddingHorizontal: 20,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 13, color: R.DMUTED, textAlign: "center" }}>
                    Aucune sollicitation ne correspond à vos filtres.
                  </Text>
                  <Pressable
                    onPress={() => setRelFilters(REL_FILTER_DEFAULTS)}
                    className="active:opacity-70"
                    style={{
                      marginTop: 10,
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: R.DLINE,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: R.DNAVY }}>
                      Réinitialiser les filtres
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View>
                  {/* Carrousel horizontal de sollicitations (modèle flash deals). */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="fast"
                    snapToInterval={REL_CARD_W + SOL_GAP}
                    snapToAlignment="start"
                    onScroll={onSolScroll}
                    scrollEventThrottle={16}
                    contentContainerStyle={{ gap: SOL_GAP, paddingTop: 4, paddingRight: 24 }}
                  >
                    {filteredPending.map((r) => (
                      <SollicitationCard
                        key={r.id}
                        r={r}
                        onOpen={(rel) => {
                          setDetail(rel);
                          setDetailIsHistory(false);
                          setDetailVisible(true);
                        }}
                        onVitrine={(rel) =>
                          setVitrineLeave({ proName: rel.pro, websiteUrl: rel.websiteUrl ?? "" })
                        }
                        onDecide={(action, rel) =>
                          decision.request(action, {
                            id: rel.id,
                            tier: rel.tier,
                            tiers: rel.tiers,
                            relationStatus: rel.relationStatus,
                          })
                        }
                        busyAction={decision.busyFor(r.id)}
                        disabled={decision.busy}
                      />
                    ))}
                  </ScrollView>
                  {filteredPending.length > 1 ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        marginTop: 14,
                      }}
                    >
                      {filteredPending.map((r, i) => {
                        const on = i === Math.min(solIdx, filteredPending.length - 1);
                        return (
                          <View
                            key={r.id}
                            style={{
                              width: on ? 18 : 7,
                              height: 7,
                              borderRadius: 999,
                              backgroundColor: on ? R.DV : R.DLINE,
                            }}
                          />
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              )}
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
              backgroundColor: R.DVXL,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="time-outline" size={16} color={R.DV} />
          </View>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              letterSpacing: 1.3,
              textTransform: "uppercase",
              color: R.DMUTED,
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
              ? { bg: R.DGREENL, bd: R.DGREENL, txt: R.DGREEN_TXT }
              : isRef
                ? { bg: R.DCORALL, bd: R.DCORALL, txt: R.DCORAL }
                : { bg: R.DNAVY, bd: R.DNAVY, txt: R.surface };
            const off = isAcc
              ? { bg: R.surface, bd: R.DGREEN, txt: R.DGREEN_TXT }
              : isRef
                ? { bg: R.surface, bd: R.DCORAL, txt: R.DCORAL }
                : { bg: R.surface, bd: R.DLINE, txt: R.DNAVY };
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
              backgroundColor: R.surface,
              borderWidth: 1,
              borderColor: R.DLINE,
              paddingVertical: 28,
              paddingHorizontal: 20,
              alignItems: "center",
            }}
          >
            <Text className="font-serif" style={{ fontSize: 18, color: R.DNAVY }}>
              Rien à afficher
            </Text>
            <Text
              style={{ fontSize: 13, color: R.DMUTED, textAlign: "center", marginTop: 4 }}
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
                  setDetailIsHistory(true);
                  setDetailVisible(true);
                }}
              />
            ))}
          </View>
        )}

        {/* Pied : légende + total accepté (parité web). */}
        {history.length > 0 ? (
          <View
            style={{
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: R.DLINE,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              {[
                { label: "Acceptée", color: "#15803D" },
                { label: "Refusée", color: "#DC2626" },
                { label: "En séquestre", color: "#B45309" },
              ].map((l) => (
                <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: l.color }} />
                  <Text style={{ fontSize: 12.5, color: R.DMUTEDL }}>{l.label}</Text>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 13, color: R.DMUTEDL }}>
              Total accepté :{" "}
              <Text className="font-mono" style={{ fontWeight: "700", color: R.DGREEN_TXT }}>
                +{eur(stats.gains)}
              </Text>
            </Text>
          </View>
        ) : null}
      </View>

      <MovementDetailSheet
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        relation={detail ? toMovementRelation(detail) : null}
        isHistory={detailIsHistory}
      />
      {decision.sheet}
      <VitrineLeaveSheet
        visible={!!vitrineLeave}
        proName={vitrineLeave?.proName ?? ""}
        websiteUrl={vitrineLeave?.websiteUrl ?? null}
        onClose={() => setVitrineLeave(null)}
      />
    </ScrollScreen>
  );
}
