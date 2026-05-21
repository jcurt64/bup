// Mises en relation — /api/prospect/relations. Accept/refuse via la
// mutation useDecideRelation (body { action }) → invalidation des vues
// impactées (relations/wallet/score) = synchro web⇄mobile (§6.1).
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  Card,
  dateFr,
  eur,
  QueryGate,
  ScrollScreen,
} from "../../components/screen";
import { useDecideRelation, useProspectRelations } from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";
import type { Relation } from "../../lib/queries";

const EMPTY_PENDING = require("../../assets/images/peace-sign.png");

// ── Filtre cyclique historique ──────────────────────────────────────
type HistoryFilter = "all" | "accepted" | "refused";

const HISTORY_FILTERS: { key: HistoryFilter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "accepted", label: "Acceptées" },
  { key: "refused", label: "Refusées" },
];

// ── Chip décision coloré ────────────────────────────────────────────
function DecisionChip({ decision }: { decision: string | undefined }) {
  if (!decision) return null;
  const isAccepted = decision === "Acceptée";
  const isRefused = decision === "Refusée";
  return (
    <View
      className={`rounded-full px-2 py-0.5 ${
        isAccepted
          ? "bg-good/10 border border-good/30"
          : isRefused
            ? "bg-bad/10 border border-bad/30"
            : "bg-line border border-line"
      }`}
    >
      <Text
        className={`text-[10px] font-semibold ${
          isAccepted ? "text-good" : isRefused ? "text-bad" : "text-ink-4"
        }`}
      >
        {decision}
      </Text>
    </View>
  );
}

// ── Ligne d'historique ──────────────────────────────────────────────
function HistoryRow({ r }: { r: Relation }) {
  const gainStr =
    r.gain != null ? "+" + eur(r.gain) : "—";
  const gainPositive = r.gain != null && r.gain > 0;

  return (
    <View className="rounded-2xl border border-line bg-paper p-3 gap-2">
      {/* Ligne 1 : Date + Professionnel */}
      <View className="flex-row justify-between items-center">
        <Text className="font-mono text-[11px] text-ink-4">
          {dateFr(r.date)}
        </Text>
        <Text className="text-sm text-ink font-medium flex-1 text-right ml-2" numberOfLines={1}>
          {r.pro}
        </Text>
      </View>
      {/* Ligne 2 : Palier + Décision */}
      <View className="flex-row items-center gap-2">
        <View className="rounded-full border border-line bg-ivory px-2 py-0.5">
          <Text className="text-[10px] font-medium text-ink-3">
            Palier {r.tier}
          </Text>
        </View>
        <DecisionChip decision={r.decision} />
      </View>
      {/* Ligne 3 : Statut + Gain */}
      <View className="flex-row justify-between items-center">
        <Text className="text-xs text-ink-4">{r.status ?? ""}</Text>
        <Text
          className={`font-mono text-xs font-semibold ${
            gainPositive ? "text-good" : "text-ink-5"
          }`}
        >
          {gainStr === "—" ? "—" : gainStr}
        </Text>
      </View>
    </View>
  );
}

// ── Écran principal ─────────────────────────────────────────────────
export default function Relations() {
  const q = useProspectRelations();
  const decide = useDecideRelation();
  useRefetchOnFocus(q);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");

  async function act(id: string, action: "accept" | "refuse") {
    setBusyId(id);
    try {
      await decide.mutateAsync({ id, action });
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
                Aucune demande pour l'instant
              </Text>
              <Text className="mt-1.5 text-center text-[14px] leading-5 text-ink-4">
                Mais ça ne saurait tarder…{"\n"}On vous prévient dès qu'une sollicitation arrive.
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
              <HistoryRow key={r.id} r={r} />
            ))}
          </View>
        )}
      </View>
    </ScrollScreen>
  );
}
