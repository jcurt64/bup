// Mises en relation — /api/prospect/relations. Accept/refuse via la
// mutation useDecideRelation (body { action }) → invalidation des vues
// impactées (relations/wallet/score) = synchro web⇄mobile (§6.1).
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { MovementDetailSheet } from "../../components/movement-detail-sheet";
import {
  Card,
  dateFr,
  eur,
  QueryGate,
  ScrollScreen,
} from "../../components/screen";
import { ApiError } from "../../lib/api";
import { useDecideRelation, useProspectRelations } from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";
import type { MovementRelation, Relation } from "../../lib/queries";

const EMPTY_PENDING = require("../../assets/images/peace-sign.png");

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

// Thème unique violet — gradient bg très doux (fading vers paper) +
// accent deep pour la chip date et les initiales avatar.
const CARD_THEME = {
  gradient: ["#F4EFFE", "#FFFFFF"] as [string, string],
  accent: "#5B3FD6",
  avatarBg: "#EDE9FE",
};

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

// ── Pastille info ──────────────────────────────────────────────────
// Petite ligne « icône colorée dans un cercle pastel + label ». Réutilisée
// pour chacune des 5 infos affichées sur la card historique.
function InfoLine({
  icon,
  bg,
  fg,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  fg: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <View
        className="h-6 w-6 items-center justify-center rounded-full"
        style={{ backgroundColor: bg }}
      >
        <Ionicons name={icon} size={12} color={fg} />
      </View>
      <View className="flex-1">{children}</View>
    </View>
  );
}

// ── Card historique ────────────────────────────────────────────────
// Layout :
//   - gradient bg très soft (thème déterministe par hash de r.id)
//   - chip date en demi-pill, collée à la bordure droite, top-right
//   - header : avatar + raison sociale en row (paddingRight pour laisser
//     respirer la chip date)
//   - corps : 2 colonnes × 2 lignes (palier/décision puis statut/gain),
//     chaque info = pastille iconographiée + label
function HistoryRow({
  r,
  onPress,
}: {
  r: Relation;
  onPress: () => void;
}) {
  const isAccepted = r.decision === "Acceptée";
  const isRefused = r.decision === "Refusée";
  const isEscrow = r.status === "En séquestre";
  const isCredited = r.status === "Crédité";
  const gainPositive = r.gain != null && r.gain > 0;
  const gainStr = r.gain != null ? "+" + eur(r.gain) : "—";
  // Les sollicitations refusées n'ont ni séquestre ni rémunération à
  // afficher (la décision « Refusée » suffit comme info terminale).
  const showStatusAndGain = !isRefused;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Détail de ${r.pro}`}
      className="active:opacity-80"
    >
      <LinearGradient
        colors={CARD_THEME.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 18,
          padding: 14,
          position: "relative",
          borderWidth: 0.1,
          borderColor: "#E6E3DA",
          shadowColor: "#0F1629",
          shadowOpacity: 0.04,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        }}
      >
        {/* Chip date — demi-pill collée à la bordure droite, top-right. */}
        <View
          style={{
            position: "absolute",
            top: 14,
            right: 0,
            backgroundColor: CARD_THEME.accent,
            paddingLeft: 12,
            paddingRight: 14,
            paddingVertical: 4,
            borderTopLeftRadius: 999,
            borderBottomLeftRadius: 999,
          }}
        >
          <Text className="text-[11px] font-bold text-paper">
            {dateFr(r.date)}
          </Text>
        </View>

        {/* Header : avatar + raison sociale (paddingR = largeur estimée de
            la chip date + marge pour que le texte ne passe pas dessous). */}
        <View
          className="flex-row items-center gap-3"
          style={{ paddingRight: 96 }}
        >
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: CARD_THEME.avatarBg }}
          >
            <Text
              className="font-serif-bold text-sm"
              style={{ color: CARD_THEME.accent }}
            >
              {initials(r.pro)}
            </Text>
          </View>
          <Text
            className="flex-1 font-serif text-[15px] text-ink"
            numberOfLines={1}
          >
            {r.pro}
          </Text>
        </View>

        {/* Corps : 2 colonnes × 1-2 lignes (la seconde ligne est masquée
            pour les refusées). */}
        <View className="mt-3.5 gap-2">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <InfoLine icon="trophy-outline" bg="#FCEFD6" fg="#B45309">
                <Text
                  className="text-[12.5px] text-ink-2"
                  numberOfLines={1}
                >
                  Palier {r.tier}
                </Text>
              </InfoLine>
            </View>
            <View className="flex-1">
              <InfoLine
                icon={
                  isAccepted
                    ? "checkmark-circle-outline"
                    : isRefused
                      ? "close-circle-outline"
                      : "ellipsis-horizontal-circle-outline"
                }
                bg={isAccepted ? "#E8F5EE" : isRefused ? "#FEF2F2" : "#F0F1F4"}
                fg={isAccepted ? "#16A34A" : isRefused ? "#DC2626" : "#8A91A1"}
              >
                <Text
                  className={`text-[12.5px] font-medium ${
                    isAccepted
                      ? "text-good"
                      : isRefused
                        ? "text-bad"
                        : "text-ink-3"
                  }`}
                  numberOfLines={1}
                >
                  {r.decision ?? "—"}
                </Text>
              </InfoLine>
            </View>
          </View>
          {showStatusAndGain ? (
            <View className="flex-row gap-3">
              <View className="flex-1">
                <InfoLine
                  icon={
                    isEscrow
                      ? "lock-closed-outline"
                      : isCredited
                        ? "wallet-outline"
                        : "remove-circle-outline"
                  }
                  bg={isEscrow ? "#DCF4F0" : isCredited ? "#EDE9FE" : "#F0F1F4"}
                  fg={isEscrow ? "#2FB8A6" : isCredited ? "#7C5CFC" : "#8A91A1"}
                >
                  <Text
                    className="text-[12.5px] text-ink-2"
                    numberOfLines={1}
                  >
                    {r.status && r.status !== "—" ? r.status : "—"}
                  </Text>
                </InfoLine>
              </View>
              <View className="flex-1">
                {/* Pastille rémunération — pictogramme € (MaterialCommunityIcons
                    currency-eur) à la place de l'ancien trending-up. */}
                <View className="flex-row items-center gap-2">
                  <View
                    className="h-6 w-6 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: gainPositive ? "#E8F5EE" : "#F0F1F4",
                    }}
                  >
                    <MaterialCommunityIcons
                      name="currency-eur"
                      size={13}
                      color={gainPositive ? "#16A34A" : "#8A91A1"}
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`font-mono text-[12.5px] font-semibold ${
                        gainPositive ? "text-good" : "text-ink-4"
                      }`}
                      numberOfLines={1}
                    >
                      {gainStr}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

// ── Écran principal ─────────────────────────────────────────────────
export default function Relations() {
  const q = useProspectRelations();
  const decide = useDecideRelation();
  useRefetchOnFocus(q);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  // Relation sélectionnée pour ouverture du détail-sheet. Stocké
  // séparément du `visible` pour conserver le contenu pendant l'animation
  // de fermeture (sinon flash blanc).
  const [detail, setDetail] = useState<Relation | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  async function act(id: string, action: "accept" | "refuse") {
    setBusyId(id);
    try {
      await decide.mutateAsync({ id, action });
    } catch (e) {
      // Mirror du handler 429/402/410/409 de flash-deals-sheet (cf. commit
      // e331ce8). Sans catch, le mutateAsync rejette en promise non-traitée.
      const status = e instanceof ApiError ? e.status : 0;
      let serverMsg: string | null = null;
      if (e instanceof ApiError) {
        try {
          const j = JSON.parse(e.body) as { message?: string };
          if (typeof j.message === "string") serverMsg = j.message;
        } catch {}
      }
      const msg =
        status === 429 && serverMsg
          ? serverMsg
          : status === 402
            ? "Le professionnel n'a plus assez de budget sur sa campagne. Réessayez plus tard."
            : status === 410
              ? "Cette campagne a expiré."
              : status === 409
                ? "Cette sollicitation n'est plus dans un état modifiable. Rafraîchissez la liste."
                : "Action impossible. Réessayez dans un instant.";
      Alert.alert(
        status === 429 ? "Patientez un instant" : "Action impossible",
        msg,
      );
    } finally {
      setBusyId(null);
    }
  }

  const history: Relation[] = q.data?.history ?? [];

  const filteredHistory = history.filter(
    (h) =>
      historyFilter === "all" ||
      (historyFilter === "accepted" && h.decision === "Acceptée") ||
      (historyFilter === "refused" && h.decision === "Refusée"),
  );

  return (
    <ScrollScreen
      onRefresh={q.refetch}
      hero={{
        eyebrow: "Mises en relation",
        title: "Demandes en attente",
        desc: "Acceptez pour être rémunéré·e. Sans réponse à temps, la sollicitation expire.",
        // Signature visuelle de la page Relations — handshake coral à 85%
        // d'opacité : contraste chaud sur le dégradé violet→navy.
        topRight: (
          <MaterialCommunityIcons
            name="handshake"
            size={56}
            color="#FF7A6B"
            style={{ opacity: 0.85 }}
          />
        ),
      }}
    >
      {/* ── Demandes en attente ──────────────────────────── */}
      <QueryGate query={q}>
        {(d) => (
          (d.pending?.length ?? 0) === 0 ? (
            // Empty state — peace-sign sur cercle pastel coral (teinte
            // Relations), même langage visuel que Portefeuille/Mouvements
            // et messages-sheet.
            <View className="items-center rounded-2xl border border-line bg-paper px-4 py-8">
              <View
                className="mb-3 h-40 w-40 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(255, 122, 107, 0.10)" }}
              >
                <Image
                  source={EMPTY_PENDING}
                  style={{ width: 128, height: 128 }}
                  contentFit="contain"
                  accessibilityLabel="Aucune demande pour l'instant"
                />
              </View>
              <Text className="font-serif text-xl text-ink">
                {"Aucune demande pour l'instant"}
              </Text>
              <Text className="mt-1.5 text-center text-[14px] leading-5 text-ink-4">
                {"Mais ça ne saurait tarder…\nOn vous prévient dès qu'une sollicitation arrive."}
              </Text>
            </View>
          ) : (
          <View className="gap-3">
            {/* Compteur de demandes en attente */}
            <Text className="text-[11px] text-ink-4 font-mono">
              {d.pending.length}{" "}
              {d.pending.length === 1
                ? "demande en attente"
                : "demandes en attente"}
            </Text>
            {d.pending.map((r) => (
              <Card key={r.id} badge={{ icon: "people-outline", tone: "coral" }}>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="font-serif text-lg text-ink">
                      {r.pro}
                    </Text>
                    <Text className="text-xs text-ink-4">{r.sector}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="font-serif text-lg text-violet">
                      {eur(r.reward)}
                    </Text>
                    <Text className="font-mono text-[10px] text-ink-4">
                      Palier {r.tier} · {r.timer}
                    </Text>
                  </View>
                </View>
                {r.motif ? (
                  <Text className="mt-2 text-sm text-ink-3">{r.motif}</Text>
                ) : null}
                {r.brief ? (
                  <Text className="mt-1 text-xs text-ink-4">{r.brief}</Text>
                ) : null}
                <View className="mt-4 flex-row gap-3">
                  <Pressable
                    disabled={busyId === r.id}
                    onPress={() => act(r.id, "refuse")}
                    className="flex-1 items-center rounded-full border border-line py-3 active:opacity-70"
                  >
                    <Text className="text-sm font-medium text-ink-3">
                      Refuser
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={busyId === r.id}
                    onPress={() => act(r.id, "accept")}
                    className="flex-1 items-center rounded-full bg-ink py-3 active:opacity-80"
                  >
                    <Text className="text-sm font-semibold text-paper">
                      {busyId === r.id ? "…" : "Accepter"}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
          )
        )}
      </QueryGate>

      {/* ── Historique (toujours affiché) ────────────────── */}
      {/* Section aérée : 3 blocs empilés (label / filtres / cartes), 16 px
          d'espace entre chaque bloc — alignement avec la respiration de la
          page Accueil. */}
      <View className="gap-4">
        {/* Bloc 1 : pastille time-outline + label (font calibré sur la
            section "Mouvements" de la page Accueil). */}
        <View className="flex-row items-center gap-2">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-sky-soft">
            <Ionicons name="time-outline" size={15} color="#5B8DEF" />
          </View>
          <Text
            className="text-[13px] font-bold uppercase text-ink-4"
            style={{ letterSpacing: 1.2 }}
          >
            {`Historique · ${filteredHistory.length}`}
          </Text>
        </View>

        {/* Bloc 2 : chips filtres — couleur sémantique par décision
            (acceptées vert / refusées rouge / toutes neutre). Bordure
            colorée quand inactif, fond pastel sans bordure (border
            transparente pour éviter le shift de taille) quand actif —
            tons doux pour ne pas crier. */}
        <View className="flex-row gap-2">
          {HISTORY_FILTERS.map((f) => {
            const active = historyFilter === f.key;
            const isAccepted = f.key === "accepted";
            const isRefused = f.key === "refused";
            const colorClasses = isAccepted
              ? active
                ? "bg-good/15 border border-transparent"
                : "bg-paper border border-good/50"
              : isRefused
                ? active
                  ? "bg-bad/15 border border-transparent"
                  : "bg-paper border border-bad/50"
                : active
                  ? "bg-ink border border-ink"
                  : "bg-ivory border border-line";
            const textClasses = isAccepted
              ? "text-good"
              : isRefused
                ? "text-bad"
                : active
                  ? "text-paper"
                  : "text-ink-3";
            return (
              <Pressable
                key={f.key}
                onPress={() => setHistoryFilter(f.key)}
                className={`rounded-full px-3.5 py-1 ${colorClasses}`}
              >
                <Text
                  className={`text-[11px] ${active ? "font-semibold" : "font-medium"} ${textClasses}`}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Bloc 3 : contenu historique (empty state ou liste de cartes,
            cartes espacées de 12 px entre elles). */}
        {q.isPending ? null : filteredHistory.length === 0 ? (
          <View className="items-center rounded-2xl border border-line bg-paper p-8">
            <Text className="text-center text-sm text-ink-4">
              {historyFilter === "accepted"
                ? "Aucune demande acceptée."
                : historyFilter === "refused"
                  ? "Aucune demande refusée."
                  : "Aucun historique."}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {filteredHistory.map((r) => (
              <HistoryRow
                key={r.id}
                r={r}
                onPress={() => {
                  setDetail(r);
                  setDetailVisible(true);
                }}
              />
            ))}
          </View>
        )}
      </View>

      {/* Détail-sheet réutilise MovementDetailSheet (parité visuelle web
          RelationDetailModal). Le Relation est adapté en MovementRelation
          via toMovementRelation (availableAt=null comme côté web). */}
      <MovementDetailSheet
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        relation={detail ? toMovementRelation(detail) : null}
      />
    </ScrollScreen>
  );
}
