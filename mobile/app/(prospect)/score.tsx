// BUUPP Score — /api/prospect/score (indice de désirabilité /1000 :
// complétude + fraîcheur + fiabilité). Présentation « épurée / mode » :
// carte score sombre à motifs, échelle des paliers, 3 anneaux crantés pour
// les pourcentages, mini-graphe d'évolution, cartes claires à motifs.
// Toutes les couleurs viennent du thème (4 coloris) ; la logique de calcul
// (paliers, pts, wording des conseils) est inchangée (parité web).
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Motif, type MotifVariant } from "../../components/motif";
import { QueryGate, ScrollScreen } from "../../components/screen";
import { withAlpha } from "../../lib/color";
import { getDrawerOrigin } from "../../lib/drawer-origin";
import { HOME_HERO } from "../../lib/hero-palette";
import { useProspectScore, useProspectScoreHistory } from "../../lib/queries";
import { useTheme } from "../../lib/theme";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

// ── Paliers (alignés sur le web ScorePanel) ──────────────────────────────────
const TIER_THRESHOLDS = [
  { min: 0, label: "Découverte" },
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

const SCORE_RANGES = ["1M", "3M", "6M", "12M"] as const;
type Range = (typeof SCORE_RANGES)[number];

// Carte claire épurée : fond surface, filet, ombre douce, motif optionnel.
function ChicCard({
  children,
  motif,
  motifColor,
}: {
  children: ReactNode;
  motif?: MotifVariant;
  motifColor?: string;
}) {
  const { c, isDark } = useTheme();
  return (
    <View
      style={{
        borderRadius: 26,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.borderSoft,
        shadowColor: isDark ? "#000000" : c.navyDeep,
        shadowOpacity: isDark ? 0.35 : 0.07,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
    >
      <View style={{ borderRadius: 25, overflow: "hidden", padding: 20 }}>
        {motif ? <Motif variant={motif} color={motifColor ?? withAlpha(c.violet, "55")} /> : null}
        {children}
      </View>
    </View>
  );
}

function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  const { c } = useTheme();
  return (
    <Text
      style={{
        fontSize: 10.5,
        fontWeight: "800",
        letterSpacing: 2,
        textTransform: "uppercase",
        color: color ?? c.textSub,
      }}
    >
      {children}
    </Text>
  );
}

// ── Anneau cranté (pourcentage) — 48 crans répartis en cercle, les crans
// « atteints » à la couleur de la dimension. Pas de react-native-svg.
function TickRing({
  pct,
  color,
  track,
  size = 94,
  children,
}: {
  pct: number;
  color: string;
  track: string;
  size?: number;
  children?: ReactNode;
}) {
  const N = 48;
  const on = Math.round((Math.max(0, Math.min(100, pct)) / 100) * N);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {Array.from({ length: N }).map((_, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: size,
            height: size,
            alignItems: "center",
            transform: [{ rotate: `${(i * 360) / N}deg` }],
          }}
        >
          <View
            style={{
              width: 3,
              height: i % 4 === 0 ? 10 : 7,
              borderRadius: 2,
              backgroundColor: i < on ? color : track,
            }}
          />
        </View>
      ))}
      {children}
    </View>
  );
}

function Pct({ value, color, size = 26 }: { value: number; color: string; size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
      <Text className="font-serif" style={{ fontSize: size, lineHeight: size * 1.1, color }}>
        {Math.round(value)}
      </Text>
      <Text style={{ fontSize: size * 0.42, fontWeight: "700", color, marginTop: 3, marginLeft: 1 }}>
        %
      </Text>
    </View>
  );
}

// ── Écran principal ───────────────────────────────────────────────────────────
export default function ScoreScreen() {
  const { c, mode, isDark } = useTheme();
  const hero = HOME_HERO[mode];
  const [range, setRange] = useState<Range>("6M");

  const q = useProspectScore();
  const h = useProspectScoreHistory(range);
  useRefetchOnFocus(q, h);

  // Retour : réouvre le menu sur la page d'origine (page issue du drawer).
  const goBack = () => {
    const o = getDrawerOrigin();
    if (o) {
      router.replace(o.path as never);
      router.push(o.drawer as never);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(prospect)/portefeuille");
  };

  return (
    <ScrollScreen
      onRefresh={() => Promise.all([q.refetch(), h.refetch()])}
    >
      {/* En-tête épuré (pas de carte) : retour vers le menu + titre. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          onPress={goBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          className="active:opacity-70"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.borderSoft,
          }}
        >
          <Ionicons name="chevron-back" size={20} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Eyebrow color={c.violet}>BUUPP Score</Eyebrow>
          <Text className="font-serif" style={{ fontSize: 26, lineHeight: 30, color: c.text }}>
            Indice de <Text className="font-serif-italic" style={{ color: c.violet }}>désirabilité</Text>
          </Text>
        </View>
      </View>
      <Text style={{ fontSize: 13.5, lineHeight: 20, color: c.textSub, marginTop: -4 }}>
        Un score sur 1000 : complétude de vos paliers, fraîcheur de vos données et fiabilité
        (la note des professionnels).
      </Text>

      <QueryGate query={q}>
        {(d) => {
          const value = d.score;
          const tier = getTier(value);
          const nextTier =
            tier.idx + 1 < TIER_THRESHOLDS.length ? TIER_THRESHOLDS[tier.idx + 1] : null;
          const ptsToNextTier = nextTier ? Math.max(0, nextTier.min - value) : 0;

          // ── Formule pts (web : ptsPerPct = 10/3) ────────────────────────
          const ptsPerPct = 10 / 3;
          const ptsToFull = (pct: number) =>
            Math.round(Math.max(0, (100 - (pct ?? 0)) * ptsPerPct));

          const completeness = d.breakdown.completeness;
          const freshness = d.breakdown.freshness;
          const fiabilite = d.breakdown.fiabilite ?? null;
          const fiabPct = fiabilite?.pct ?? 60;
          const fiabCount = fiabilite?.count ?? 0;

          const completenessGap = ptsToFull(completeness.pct);
          const freshnessGap = ptsToFull(freshness.pct);
          const fiabiliteGap = fiabCount === 0 ? 0 : ptsToFull(fiabPct);

          // ── Hints (wording identique au web) ────────────────────────────
          const completenessHint =
            completeness.filled >= completeness.total
              ? "Tous vos paliers sont validés — bravo !"
              : `Renseignez ${
                  completeness.total - completeness.filled === 1
                    ? "votre dernier palier"
                    : `les ${completeness.total - completeness.filled} paliers manquants`
                } dans Mes données pour gagner ${completenessGap} pts.`;
          const freshnessHint =
            freshness.pct >= 100
              ? "Vos données sont à jour (moins d’un an)."
              : freshness.lastUpdate || (freshness.ageDays ?? 0) > 0
                ? `Ré-éditez un champ dans Mes données pour repasser à 100 % et gagner ${freshnessGap} pts.`
                : `Renseignez au moins un champ pour amorcer la fraîcheur et débloquer ${freshnessGap} pts.`;
          const fiabiliteHint =
            fiabCount === 0
              ? "Vous partez d'une fiabilité neutre (60). Les notes des professionnels la feront monter (Haute) ou baisser (Basse)."
              : fiabPct >= 100
                ? "Note maximale des professionnels — au top."
                : `Honorez vos mises en relation : une note « Haute » des professionnels fait grimper votre fiabilité (jusqu'à ${fiabiliteGap} pts).`;

          const DIMS = [
            {
              key: "completeness",
              label: "Complétude",
              pct: completeness.pct,
              sub: `${completeness.filled}/${completeness.total} paliers`,
              color: c.violet,
              icon: "layers-outline" as const,
              gap: completenessGap,
              hint: completenessHint,
            },
            {
              key: "freshness",
              label: "Fraîcheur",
              pct: freshness.pct,
              sub:
                freshness.ageDays != null ? `MAJ il y a ${freshness.ageDays} j` : "Aucune MAJ",
              color: c.accBlue,
              icon: "leaf-outline" as const,
              gap: freshnessGap,
              hint: freshnessHint,
            },
            {
              key: "fiabilite",
              label: "Fiabilité",
              pct: fiabPct,
              sub: fiabCount > 0 ? `${fiabCount} note${fiabCount > 1 ? "s" : ""} pro` : "Valeur neutre",
              color: c.good,
              icon: "shield-checkmark-outline" as const,
              gap: fiabiliteGap,
              hint: fiabiliteHint,
            },
          ];

          // Fiabilité détaillée
          const levels = fiabilite?.levels ?? { haute: 0, moyenne: 0, basse: 0 };
          const totalNotes = fiabilite?.count ?? levels.haute + levels.moyenne + levels.basse;
          const fTier =
            fiabPct >= 80
              ? { label: "Excellente", color: c.good }
              : fiabPct >= 65
                ? { label: "Bonne", color: c.good }
                : fiabPct >= 45
                  ? { label: "Valeur neutre", color: c.warn }
                  : { label: "Vigilance", color: c.bad };
          const LEVELS: {
            key: string;
            label: string;
            color: string;
            icon: keyof typeof Ionicons.glyphMap;
            n: number;
          }[] = [
            { key: "haute", label: "Haute", color: c.good, icon: "shield-checkmark", n: levels.haute },
            { key: "moyenne", label: "Moyenne", color: c.warn, icon: "shield-half", n: levels.moyenne },
            { key: "basse", label: "Basse", color: c.bad, icon: "alert-circle", n: levels.basse },
          ];

          const points = h.data?.points ?? [];
          const maxPts = Math.max(1000, ...points.map((p) => p.score));

          return (
            <>
              {/* ── 1. Carte score : sombre, motifs, échelle des paliers ── */}
              <View
                style={{
                  borderRadius: 28,
                  overflow: "hidden",
                  shadowColor: `rgb(${hero.glow})`,
                  shadowOpacity: isDark ? 0 : 0.3,
                  shadowRadius: 22,
                  shadowOffset: { width: 0, height: 10 },
                }}
              >
                <LinearGradient
                  colors={hero.base}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.6, y: 1 }}
                  style={{ padding: 22 }}
                >
                  <LinearGradient
                    colors={[`rgba(${hero.glow},0.55)`, `rgba(${hero.glow},0)`]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0.2, y: 0.9 }}
                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                  />
                  <Motif variant="rings" color="rgba(255,255,255,0.10)" />
                  <Motif
                    variant="stripes"
                    color="rgba(255,255,255,0.05)"
                    style={{ top: 90, right: undefined, left: -60 }}
                  />

                  <Eyebrow color="rgba(255,255,255,0.65)">Score actuel</Eyebrow>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 6 }}>
                    <Text
                      className="font-serif"
                      style={{ fontSize: 76, lineHeight: 80, color: "#FFFFFF", letterSpacing: -2 }}
                    >
                      {value}
                    </Text>
                    <Text
                      style={{
                        fontSize: 15,
                        color: "rgba(255,255,255,0.55)",
                        marginBottom: 14,
                        marginLeft: 6,
                        fontWeight: "600",
                      }}
                    >
                      / 1000
                    </Text>
                  </View>
                  <View
                    style={{
                      alignSelf: "flex-start",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 4,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 999,
                      backgroundColor: "rgba(255,255,255,0.12)",
                      borderWidth: 1,
                      borderColor: `rgba(${hero.pastelRgb},0.45)`,
                    }}
                  >
                    <Ionicons name="sparkles" size={13} color={hero.pastel} />
                    <Text className="font-serif-italic" style={{ fontSize: 16, color: hero.pastelText }}>
                      {tier.label}
                    </Text>
                  </View>

                  {/* Échelle des paliers : 4 segments égaux, remplis selon le score */}
                  <View style={{ marginTop: 22, flexDirection: "row", gap: 5 }}>
                    {TIER_THRESHOLDS.map((t, i) => {
                      const max = TIER_THRESHOLDS[i + 1]?.min ?? 1000;
                      const fill =
                        value >= max ? 1 : value <= t.min ? 0 : (value - t.min) / (max - t.min);
                      return (
                        <View key={t.label} style={{ flex: 1 }}>
                          <View
                            style={{
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: "rgba(255,255,255,0.14)",
                              overflow: "hidden",
                            }}
                          >
                            <View
                              style={{
                                width: `${fill * 100}%`,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: hero.pastel,
                              }}
                            />
                          </View>
                          <Text
                            numberOfLines={1}
                            style={{
                              marginTop: 6,
                              fontSize: 10,
                              fontWeight: i === tier.idx ? "800" : "500",
                              color: i === tier.idx ? "#FFFFFF" : "rgba(255,255,255,0.5)",
                            }}
                          >
                            {t.label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  <Text style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
                    {nextTier ? (
                      <>
                        Encore <Text style={{ fontWeight: "800", color: "#FFFFFF" }}>{ptsToNextTier} pts</Text>{" "}
                        pour atteindre{" "}
                        <Text className="font-serif-italic" style={{ color: "#FFFFFF" }}>
                          {nextTier.label}
                        </Text>
                      </>
                    ) : (
                      "Palier maximal atteint — bravo !"
                    )}
                  </Text>
                </LinearGradient>
              </View>

              {/* ── 2. Les 3 piliers en anneaux crantés ─────────────────── */}
              <ChicCard motif="dots">
                <Eyebrow>Vos 3 piliers</Eyebrow>
                <Text className="font-serif" style={{ fontSize: 22, color: c.text, marginTop: 2 }}>
                  Ce qui compose votre score
                </Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 18 }}>
                  {DIMS.map((dim) => (
                    <View key={dim.key} style={{ alignItems: "center", width: "32%" }}>
                      <TickRing pct={dim.pct} color={dim.color} track={c.track}>
                        <Pct value={dim.pct} color={c.text} />
                      </TickRing>
                      <Text style={{ marginTop: 10, fontSize: 13, fontWeight: "700", color: c.text }}>
                        {dim.label}
                      </Text>
                      <Text style={{ fontSize: 11, color: c.textSub, marginTop: 1 }} numberOfLines={1}>
                        {dim.sub}
                      </Text>
                    </View>
                  ))}
                </View>
              </ChicCard>

              {/* ── 3. Évolution : mini-graphe en barres ─────────────────── */}
              <ChicCard motif="stripes" motifColor={withAlpha(c.accBlue, "14")}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View>
                    <Eyebrow>Évolution</Eyebrow>
                    <Text className="font-serif" style={{ fontSize: 22, color: c.text, marginTop: 2 }}>
                      Sur {range}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      padding: 3,
                      borderRadius: 999,
                      backgroundColor: c.surface2,
                      borderWidth: 1,
                      borderColor: c.borderSoft,
                    }}
                  >
                    {SCORE_RANGES.map((r) => {
                      const active = range === r;
                      return (
                        <Pressable
                          key={r}
                          onPress={() => setRange(r)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 999,
                            backgroundColor: active ? c.btnBg : "transparent",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11.5,
                              fontWeight: "700",
                              color: active ? c.btnText : c.textSub,
                            }}
                          >
                            {r}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                {points.length > 0 ? (
                  <View style={{ marginTop: 18 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-end", height: 110, gap: 6 }}>
                      {points.slice(-12).map((p, i, arr) => {
                        const last = i === arr.length - 1;
                        return (
                          <View key={p.date} style={{ flex: 1, alignItems: "center" }}>
                            {last ? (
                              <Text style={{ fontSize: 10.5, fontWeight: "800", color: c.violet, marginBottom: 4 }}>
                                {p.score}
                              </Text>
                            ) : null}
                            <LinearGradient
                              colors={
                                last
                                  ? [c.violet, withAlpha(c.violet, "99")]
                                  : [withAlpha(c.violet, "55"), withAlpha(c.violet, "22")]
                              }
                              style={{
                                width: "100%",
                                maxWidth: 22,
                                height: Math.max(6, (p.score / maxPts) * 90),
                                borderRadius: 7,
                              }}
                            />
                          </View>
                        );
                      })}
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                      <Text style={{ fontSize: 10.5, color: c.textMuted }}>
                        {points.slice(-12)[0]?.date}
                      </Text>
                      <Text style={{ fontSize: 10.5, color: c.textMuted }}>
                        {points[points.length - 1]?.date}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View
                    style={{
                      marginTop: 16,
                      padding: 14,
                      borderRadius: 16,
                      backgroundColor: c.surface2,
                      flexDirection: "row",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <Ionicons name="analytics-outline" size={20} color={c.textSub} />
                    <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: c.textSub }}>
                      Pas encore d&apos;historique sur {range}. Votre score est enregistré à chaque
                      consultation de cet onglet.
                    </Text>
                  </View>
                )}
              </ChicCard>

              {/* ── 4. Fiabilité : note des pros ─────────────────────────── */}
              <ChicCard motif="rings" motifColor={withAlpha(c.good, "22")}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Eyebrow>Indice cross-pro</Eyebrow>
                    <Text className="font-serif" style={{ fontSize: 22, color: c.text, marginTop: 2 }}>
                      Mon taux de fiabilité
                    </Text>
                    <View
                      style={{
                        alignSelf: "flex-start",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        marginTop: 8,
                        paddingHorizontal: 9,
                        paddingVertical: 3,
                        borderRadius: 999,
                        backgroundColor: withAlpha(fTier.color, "1F"),
                      }}
                    >
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fTier.color }} />
                      <Text style={{ fontSize: 10.5, fontWeight: "800", letterSpacing: 1, color: fTier.color }}>
                        {fTier.label.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <TickRing pct={fiabPct} color={fTier.color} track={c.track} size={84}>
                    <Pct value={fiabPct} color={c.text} size={22} />
                  </TickRing>
                </View>
                <Text style={{ marginTop: 14, fontSize: 12.5, lineHeight: 19, color: c.textSub }}>
                  Reflète les notes des professionnels après vos mises en relation — leur identité
                  reste anonyme. Honorez vos rendez-vous pour la faire monter.
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                  {LEVELS.map((t) => (
                    <View
                      key={t.key}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 18,
                        alignItems: "center",
                        backgroundColor: withAlpha(t.color, isDark ? "1F" : "12"),
                      }}
                    >
                      <Ionicons name={t.icon} size={16} color={t.color} />
                      <Text className="font-serif" style={{ fontSize: 24, color: c.text, marginTop: 2 }}>
                        {t.n}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: t.color }}>{t.label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={{ marginTop: 10, fontSize: 11, color: c.textMuted, textAlign: "center" }}>
                  {totalNotes} note{totalNotes > 1 ? "s" : ""} reçue{totalNotes > 1 ? "s" : ""}
                </Text>
              </ChicCard>

              {/* ── 5. Conseils ─────────────────────────────────────────── */}
              <ChicCard motif="dots" motifColor={withAlpha(c.accAmber, "66")}>
                <Eyebrow>Conseils</Eyebrow>
                <Text className="font-serif" style={{ fontSize: 22, color: c.text, marginTop: 2 }}>
                  Faire grimper votre score
                </Text>
                <Text style={{ fontSize: 11.5, color: c.textMuted, marginTop: 3 }}>
                  1 % ≈ {ptsPerPct.toFixed(1).replace(".", ",")} pts
                </Text>
                <View style={{ marginTop: 14, gap: 10 }}>
                  {DIMS.map((dim) => {
                    const done = dim.gap === 0;
                    return (
                      <View
                        key={dim.key}
                        style={{
                          flexDirection: "row",
                          gap: 12,
                          padding: 14,
                          borderRadius: 18,
                          backgroundColor: c.surface2,
                        }}
                      >
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: withAlpha(dim.color, "1F"),
                          }}
                        >
                          <Ionicons name={dim.icon} size={19} color={dim.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: c.text }}>{dim.label}</Text>
                            <View
                              style={{
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 999,
                                backgroundColor: done ? withAlpha(c.good, "1F") : withAlpha(c.violet, "1F"),
                              }}
                            >
                              <Text
                                style={{ fontSize: 11, fontWeight: "800", color: done ? c.good : c.violet }}
                              >
                                {done ? "✓ Optimal" : `+${dim.gap} pts`}
                              </Text>
                            </View>
                          </View>
                          <Text style={{ fontSize: 12.5, lineHeight: 18, color: c.textSub, marginTop: 4 }}>
                            {dim.hint}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ChicCard>
            </>
          );
        }}
      </QueryGate>
    </ScrollScreen>
  );
}
