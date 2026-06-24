// BUUPP Score — /api/prospect/score (score /1000 + 3 composantes + fiabilité).
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Card, QueryGate, ScrollScreen } from "../../components/screen";
import { useProspectScore, useProspectScoreHistory } from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

// ── Paliers (alignés sur le web ScorePanel) ──────────────────────────────────
const TIER_THRESHOLDS = [
  { min: 0,   label: "Découverte" },
  { min: 400, label: "Solide" },
  { min: 700, label: "Recherchée" },
  { min: 900, label: "Prestige" },
] as const;

function getTier(score: number) {
  let idx = 0;
  for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (score >= TIER_THRESHOLDS[i].min) idx = i;
  }
  return { ...TIER_THRESHOLDS[idx], idx };
}

// ── Sélecteur de plage ────────────────────────────────────────────────────────
const SCORE_RANGES = ["1M", "3M", "6M", "12M"] as const;
type Range = (typeof SCORE_RANGES)[number];

function RangeSelector({
  range,
  setRange,
}: {
  range: Range;
  setRange: (r: Range) => void;
}) {
  return (
    <View className="flex-row gap-2">
      {SCORE_RANGES.map((r) => {
        const active = range === r;
        return (
          <Pressable
            key={r}
            onPress={() => setRange(r)}
            className={`rounded-full px-3 py-1 ${
              active ? "bg-ink" : "bg-ivory-2"
            }`}
          >
            <Text
              className={`font-mono text-xs ${
                active ? "font-semibold text-paper" : "text-ink-3"
              }`}
            >
              {r}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Barre de progression ──────────────────────────────────────────────────────
function Bar({ label, pct, hint }: { label: string; pct: number; hint: string }) {
  return (
    <View className="gap-1.5">
      <View className="flex-row justify-between">
        <Text className="text-sm text-ink-2">{label}</Text>
        <Text className="font-mono text-xs text-ink-4">{Math.round(pct)}%</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-ivory-2">
        <View
          className="h-2 rounded-full bg-violet"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </View>
      <Text className="text-[11px] text-ink-4">{hint}</Text>
    </View>
  );
}

// ── Écran principal ───────────────────────────────────────────────────────────
export default function ScoreScreen() {
  // Web default range is "6M" (from ScoreEvolution useState('6M'))
  const [range, setRange] = useState<Range>("6M");

  const q = useProspectScore();
  const h = useProspectScoreHistory(range);
  useRefetchOnFocus(q, h);

  return (
    <ScrollScreen
      onRefresh={() => Promise.all([q.refetch(), h.refetch()])}
      hero={{
        eyebrow: "BUUPP Score",
        title: "Votre cote de confiance",
        desc: "Calculé sur 1000 à partir de la complétude, la fraîcheur de vos données et votre taux d'acceptation.",
        nav: "drawer",
      }}
    >
      <QueryGate query={q}>
        {(d) => {
          const value = d.score;
          const tier = getTier(value);
          const nextTier =
            tier.idx + 1 < TIER_THRESHOLDS.length
              ? TIER_THRESHOLDS[tier.idx + 1]
              : null;
          const ptsToNextTier = nextTier ? Math.max(0, nextTier.min - value) : 0;
          const segMin = TIER_THRESHOLDS[tier.idx].min;
          const segMax = nextTier?.min ?? 1000;
          const segPct =
            segMax === segMin
              ? 100
              : Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round(((value - segMin) / (segMax - segMin)) * 100),
                  ),
                );

          // ── Formule pts (web : ptsPerPct = 10/3) ────────────────────────
          const ptsPerPct = 10 / 3;
          const ptsToFull = (pct: number) =>
            Math.round(Math.max(0, (100 - (pct ?? 0)) * ptsPerPct));

          const completeness = d.breakdown.completeness;
          const freshness = d.breakdown.freshness;
          const acceptance = d.breakdown.acceptance;

          const completenessGap = ptsToFull(completeness.pct);
          const freshnessGap = ptsToFull(freshness.pct);
          // Acceptation : si aucune sollicitation, gain = 0 (même logique web)
          const acceptanceGap =
            acceptance.total === 0 ? 0 : ptsToFull(acceptance.pct);

          // ── Hints (wording identique au web) ────────────────────────────
          const completenessHint =
            completeness.filled >= completeness.total
              ? "Tous vos paliers sont validés — bravo !"
              : `Renseignez ${
                  completeness.total - completeness.filled === 1
                    ? "votre dernier palier"
                    : `les ${completeness.total - completeness.filled} paliers manquants`
                } dans Mes données pour gagner ${completenessGap} pts.`;

          // freshness.lastUpdate n'est pas exposé dans le type mobile :
          // on utilise ageDays > 0 comme proxy (ageDays > 0 ⟹ il y a eu
          // au moins une mise à jour, donc on peut "ré-éditer").
          const freshnessHint =
            freshness.pct >= 100
              ? "Vos données sont à jour (moins d’un an)."
              : freshness.ageDays > 0
              ? `Ré-éditez un champ dans Mes données pour repasser à 100 % et gagner ${freshnessGap} pts.`
              : `Renseignez au moins un champ pour amorcer la fraîcheur et débloquer ${freshnessGap} pts.`;

          const acceptanceHint =
            acceptance.total === 0
              ? "Le taux d’acceptation entrera en jeu dès votre première mise en relation."
              : acceptance.pct >= 100
              ? "Vous acceptez 100 % des mises en relation — au maximum."
              : `Acceptez plus de mises en relation depuis votre Inbox pour gagner jusqu’à ${acceptanceGap} pts.`;

          return (
            <>
              {/* ── Carte score principal ────────────────────────────── */}
              <Card dark>
                <Text className="font-mono text-[11px] uppercase text-ink-5">
                  Score actuel
                </Text>
                <Text className="mt-1 font-serif text-5xl text-paper">
                  {value}
                  <Text className="text-xl text-ink-5"> / 1000</Text>
                </Text>
                {/* Palier qualitatif */}
                <Text className="mt-2 font-serif italic text-violet">
                  {tier.label}
                </Text>
              </Card>

              {/* ── Barres par dimension ────────────────────────────── */}
              <Card className="gap-5" badge={{ icon: "speedometer-outline", tone: "violet" }}>
                <Bar
                  label="Complétude des paliers"
                  pct={completeness.pct}
                  hint={`${completeness.filled}/${completeness.total} paliers validés`}
                />
                <Bar
                  label="Fraîcheur des données"
                  pct={freshness.pct}
                  hint={`Dernière MAJ il y a ${freshness.ageDays} j`}
                />
                <Bar
                  label="Taux d’acceptation"
                  pct={acceptance.pct}
                  hint={
                    acceptance.total > 0
                      ? `${acceptance.accepted}/${acceptance.total} acceptées`
                      : "Aucune sollicitation reçue"
                  }
                />
              </Card>

              {/* ── Historique avec sélecteur de plage ──────────────── */}
              <Card badge={{ icon: "trending-up-outline", tone: "sky" }}>
                <View className="flex-row items-center justify-between">
                  <Text className="font-serif text-lg text-ink">
                    Évolution sur {range}
                  </Text>
                  <RangeSelector range={range} setRange={setRange} />
                </View>
                {h.data && h.data.points.length > 0 ? (
                  <View className="mt-2 gap-1">
                    {h.data.points.map((p) => (
                      <View key={p.date} className="flex-row justify-between">
                        <Text className="font-mono text-xs text-ink-4">
                          {p.date}
                        </Text>
                        <Text className="text-xs text-ink-2">
                          {p.score} / 1000
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="mt-1 text-xs text-ink-4">
                    Pas encore d&apos;historique sur {range}. Votre score sera
                    enregistré à chaque consultation de cet onglet.
                  </Text>
                )}
              </Card>

              {/* ── Mon taux de fiabilité (parité web : avant les Conseils) ── */}
              {(() => {
                const fiab = d.breakdown.fiabilite;
                const levels = fiab?.levels ?? { haute: 0, moyenne: 0, basse: 0 };
                const total =
                  fiab?.count ?? levels.haute + levels.moyenne + levels.basse;
                const pct = fiab ? fiab.pct : 60;
                const fTier =
                  pct >= 80
                    ? { label: "Excellente", color: "#16A34A" }
                    : pct >= 65
                      ? { label: "Bonne", color: "#16A34A" }
                      : pct >= 45
                        ? { label: "Valeur neutre", color: "#D97706" }
                        : { label: "Vigilance", color: "#DC2626" };
                const TILES: {
                  key: string;
                  label: string;
                  color: string;
                  icon: keyof typeof Ionicons.glyphMap;
                  n: number;
                }[] = [
                  { key: "haute", label: "Haute", color: "#16A34A", icon: "shield-checkmark", n: levels.haute },
                  { key: "moyenne", label: "Moyenne", color: "#D97706", icon: "shield-half", n: levels.moyenne },
                  { key: "basse", label: "Basse", color: "#DC2626", icon: "alert-circle", n: levels.basse },
                ];
                return (
                  <Card badge={{ icon: "shield-checkmark-outline", tone: "teal" }}>
                    <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text className="font-mono text-[11px] uppercase text-ink-5">
                          Indice cross-pro
                        </Text>
                        <Text className="font-serif text-xl text-ink">
                          Mon taux de fiabilité
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="font-serif text-3xl text-ink">
                          {pct}
                          <Text className="text-base text-ink-4">/100</Text>
                        </Text>
                        <View
                          className="mt-1 flex-row items-center rounded-full px-2 py-0.5"
                          style={{
                            backgroundColor: fTier.color + "1F",
                            borderWidth: 1,
                            borderColor: fTier.color + "4D",
                          }}
                        >
                          <View
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: fTier.color,
                              marginRight: 5,
                            }}
                          />
                          <Text
                            className="font-mono text-[10px]"
                            style={{ color: fTier.color, fontWeight: "700" }}
                          >
                            {fTier.label.toUpperCase()}
                          </Text>
                        </View>
                        <Text className="mt-1 text-[11px] text-ink-4">
                          {total} note{total > 1 ? "s" : ""} pro
                        </Text>
                      </View>
                    </View>

                    <Text className="mt-3 text-xs leading-5 text-ink-3">
                      Votre fiabilité reflète les notes des professionnels après
                      vos mises en relation — leur identité reste anonyme. Honorez
                      vos rendez-vous pour la faire monter.
                    </Text>

                    <Text className="mt-4 font-mono text-[10px] uppercase text-ink-4">
                      Répartition des notes reçues
                    </Text>
                    <View className="mt-2 flex-row" style={{ gap: 8 }}>
                      {TILES.map((t) => (
                        <View
                          key={t.key}
                          className="flex-1 rounded-xl p-3"
                          style={{
                            backgroundColor: t.color + "14",
                            borderWidth: 1,
                            borderColor: t.color + "33",
                          }}
                        >
                          <View className="flex-row items-center" style={{ gap: 5 }}>
                            <Ionicons name={t.icon} size={14} color={t.color} />
                            <Text
                              className="text-[12.5px]"
                              style={{ color: t.color, fontWeight: "700" }}
                            >
                              {t.label}
                            </Text>
                          </View>
                          <Text className="mt-1 font-serif text-xl text-ink">
                            {t.n}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Card>
                );
              })()}

              {/* ── Conseils pour améliorer votre score ─────────────── */}
              <Card badge={{ icon: "bulb-outline", tone: "amber" }}>
                <View className="mb-3 flex-row items-baseline justify-between">
                  <Text className="font-serif text-lg text-ink">
                    Conseils pour améliorer votre score
                  </Text>
                  <Text className="font-mono text-[11px] text-ink-4">
                    1&nbsp;%&nbsp;=&nbsp;~{ptsPerPct.toFixed(1).replace(".", ",")} pts
                  </Text>
                </View>

                {/* Bandeau palier + progression ──────────────────────── */}
                <View className="mb-4 rounded-xl border border-line bg-ivory p-3">
                  <View className="flex-row items-baseline justify-between">
                    <View className="flex-row items-baseline gap-2">
                      <Text className="font-serif text-2xl text-ink">
                        {value}
                      </Text>
                      <Text className="font-mono text-xs text-ink-4">
                        / 1000 pts
                      </Text>
                      <Text className="rounded-full bg-ivory-2 px-2 py-0.5 font-mono text-[11px] text-ink-3">
                        {tier.label}
                      </Text>
                    </View>
                  </View>
                  {nextTier ? (
                    <>
                      <Text className="mt-1 text-xs text-ink-3">
                        Encore{" "}
                        <Text className="font-semibold text-ink">
                          {ptsToNextTier} pts
                        </Text>{" "}
                        pour atteindre{" "}
                        <Text className="font-semibold text-ink">
                          {nextTier.label}
                        </Text>
                      </Text>
                      {/* Barre de progression dans le segment courant */}
                      <View className="mt-2 h-2 overflow-hidden rounded-full bg-ivory-2">
                        <View
                          className="h-2 rounded-full bg-violet"
                          style={{ width: `${segPct}%` }}
                        />
                      </View>
                      <View className="mt-1 flex-row justify-between">
                        <Text className="font-mono text-[10px] text-ink-4">
                          {segMin}
                        </Text>
                        <Text className="font-mono text-[10px] text-ink-4">
                          {segMax}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <Text className="mt-1 text-xs text-ink-3">
                      Vous avez atteint le palier maximal — bravo&nbsp;!
                    </Text>
                  )}
                </View>

                {/* 3 blocs dimension ──────────────────────────────────── */}
                <View className="gap-3">
                  {/* Complétude */}
                  <View className="rounded-xl border border-line bg-ivory p-3">
                    <View className="mb-1 flex-row items-center justify-between">
                      <Text className="font-serif text-base text-ink">
                        Complétude des paliers
                      </Text>
                      <Text
                        className={`font-mono text-[11px] ${
                          completenessGap === 0 ? "text-good" : "text-violet"
                        }`}
                      >
                        {completenessGap === 0
                          ? "✓ optimal"
                          : `+${completenessGap} pts max`}
                      </Text>
                    </View>
                    <Text className="font-mono text-lg text-ink">
                      {completeness.pct}%
                      <Text className="font-mono text-[11px] text-ink-4">
                        {" "}
                        · {completeness.filled}/{completeness.total} paliers
                        validés
                      </Text>
                    </Text>
                    <View className="mt-1 h-1.5 overflow-hidden rounded-full bg-ivory-2">
                      <View
                        className={`h-1.5 rounded-full ${
                          completenessGap === 0 ? "bg-good" : "bg-violet"
                        }`}
                        style={{
                          width: `${Math.max(0, Math.min(100, completeness.pct))}%`,
                        }}
                      />
                    </View>
                    <Text className="mt-2 text-[11px] leading-4 text-ink-4">
                      {completenessHint}
                    </Text>
                  </View>

                  {/* Fraîcheur */}
                  <View className="rounded-xl border border-line bg-ivory p-3">
                    <View className="mb-1 flex-row items-center justify-between">
                      <Text className="font-serif text-base text-ink">
                        Fraîcheur des données
                      </Text>
                      <Text
                        className={`font-mono text-[11px] ${
                          freshnessGap === 0 ? "text-good" : "text-violet"
                        }`}
                      >
                        {freshnessGap === 0
                          ? "✓ optimal"
                          : `+${freshnessGap} pts max`}
                      </Text>
                    </View>
                    <Text className="font-mono text-lg text-ink">
                      {freshness.pct}%
                      <Text className="font-mono text-[11px] text-ink-4">
                        {freshness.ageDays != null
                          ? ` · Dernière MAJ il y a ${freshness.ageDays} j`
                          : ""}
                      </Text>
                    </Text>
                    <View className="mt-1 h-1.5 overflow-hidden rounded-full bg-ivory-2">
                      <View
                        className={`h-1.5 rounded-full ${
                          freshnessGap === 0 ? "bg-good" : "bg-violet"
                        }`}
                        style={{
                          width: `${Math.max(0, Math.min(100, freshness.pct))}%`,
                        }}
                      />
                    </View>
                    <Text className="mt-2 text-[11px] leading-4 text-ink-4">
                      {freshnessHint}
                    </Text>
                  </View>

                  {/* Acceptation */}
                  <View className="rounded-xl border border-line bg-ivory p-3">
                    <View className="mb-1 flex-row items-center justify-between">
                      <Text className="font-serif text-base text-ink">
                        Taux d&apos;acceptation
                      </Text>
                      <Text
                        className={`font-mono text-[11px] ${
                          acceptanceGap === 0 ? "text-good" : "text-violet"
                        }`}
                      >
                        {acceptanceGap === 0
                          ? "✓ optimal"
                          : `+${acceptanceGap} pts max`}
                      </Text>
                    </View>
                    <Text className="font-mono text-lg text-ink">
                      {acceptance.pct}%
                      <Text className="font-mono text-[11px] text-ink-4">
                        {acceptance.total > 0
                          ? ` · ${acceptance.accepted}/${acceptance.total} acceptées`
                          : " · Aucune sollicitation reçue"}
                      </Text>
                    </Text>
                    <View className="mt-1 h-1.5 overflow-hidden rounded-full bg-ivory-2">
                      <View
                        className={`h-1.5 rounded-full ${
                          acceptanceGap === 0 ? "bg-good" : "bg-violet"
                        }`}
                        style={{
                          width: `${Math.max(0, Math.min(100, acceptance.pct))}%`,
                        }}
                      />
                    </View>
                    <Text className="mt-2 text-[11px] leading-4 text-ink-4">
                      {acceptanceHint}
                    </Text>
                  </View>
                </View>
              </Card>
            </>
          );
        }}
      </QueryGate>
    </ScrollScreen>
  );
}
