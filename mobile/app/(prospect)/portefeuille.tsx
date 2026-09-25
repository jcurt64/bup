// Portefeuille prospect — /api/prospect/wallet + /api/prospect/movements.
// Champs & formats alignés sur Prospect.jsx fn Portefeuille (web) :
// 3 soldes (Disponible / En séquestre / Cumulé depuis ouverture), chacun
// avec sa ligne "BUUPP Coins" (= Math.round(cents)), sous-titre cumulé
// "{X} mois · {Y} mise(s) en relation", et colonne Palier sur les
// mouvements. Le mobile omet l'action "Retirer" et l'export CSV (hors
// périmètre — parité de données uniquement).
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useFlashSheet } from "../../components/flash-sheet-context";
import { MovementDetailSheet } from "../../components/movement-detail-sheet";
import {
  Card,
  CoinsLine,
  dateFr,
  eur,
  QueryGate,
  ScrollScreen,
  Stat,
} from "../../components/screen";
import {
  useClaimFounderBonus,
  useMeTyped,
  useParrainage,
  useProspectMovements,
  useProspectRelations,
  useProspectScore,
  useProspectScoreHistory,
  useProspectVerification,
  useProspectWallet,
  type Movement,
  type MovementRelation,
  type ProspectWallet,
} from "../../lib/queries";
import { ReferralBadge } from "../../components/referral-badge";
import { ApiError } from "../../lib/api";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";
import { useTheme, type ThemeMode } from "../../lib/theme";
import { WithdrawSheet } from "../../components/withdraw-sheet";

// Illustration 3D thiings.co (Empty Wallet) — empty state mouvements.
const EMPTY_WALLET = require("../../assets/images/empty-wallet.png");

// "dispo le 12/12/2026" — parité web (Prospect.jsx fn formatAvailableAt).
function formatAvailableAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (
    "dispo le " +
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
  );
}

// BUUPP Score → libellé d'indice de désirabilité (seuils identiques au web,
// cf. Prospect.jsx ProspectHeader).
function desirabiliteLabel(score: number | null): string {
  if (score == null) return "…";
  if (score >= 850) return "Excellente désirabilité";
  if (score >= 600) return "Bonne désirabilité";
  if (score >= 350) return "Désirabilité correcte";
  return "Désirabilité à renforcer";
}

// Niveaux de fiabilité (notes des pros) — libellés, couleurs et icônes
// alignés sur la carte « Taux de fiabilité » du web.
const FIAB_LEVELS = [
  { key: "haute", label: "Confiance haute", color: "#16A34A", icon: "shield-checkmark" },
  { key: "moyenne", label: "Confiance moyenne", color: "#D97706", icon: "shield-half" },
  { key: "basse", label: "Confiance basse", color: "#DC2626", icon: "alert-circle" },
] as const;

// Message serveur (body.message) d'une ApiError, sinon null.
function apiErrorMessage(e: unknown): string | null {
  if (!(e instanceof ApiError)) return null;
  try {
    const j = JSON.parse(e.body) as { message?: string };
    return typeof j.message === "string" && j.message ? j.message : null;
  } catch {
    return null;
  }
}

// Mirror Prospect.jsx — libellés affichés pour chaque tier de vérif.
const VERIF_LABELS: Record<string, string> = {
  basique: "Basique",
  verifie: "Vérifié",
  certifie_confiance: "Certifié confiance",
};
// 1-based : "Niveau 1/3" / "2/3" / "3/3" (parité fn verifTierPosition web).
function verifTierPosition(tier: string | undefined): number {
  if (tier === "verifie") return 2;
  if (tier === "certifie_confiance") return 3;
  return 1;
}

// Entier "coins" affiché : Math.round(cents) puis séparateur fr-FR
// (identique à `coins.toLocaleString('fr-FR')` du web).
const coins = (cents: unknown) =>
  Math.round(Number(cents ?? 0)).toLocaleString("fr-FR");

// Sérialise un ensemble de paliers en notation compacte :
//   [3]          → "3"
//   [1,2,3]      → "1-3"
//   [1,3,5]      → "1,3,5"
//   [1,2,5]      → "1-2,5"
//   [1,2,4,5]    → "1-2,4-5"
// Renvoie « null » si rien à afficher.
function formatPaliers(tiers: number[]): string | null {
  const uniq = [...new Set(tiers.filter((n) => Number.isFinite(n)))].sort(
    (a, b) => a - b,
  );
  if (uniq.length === 0) return null;
  const groups: string[] = [];
  let start = uniq[0];
  let prev = uniq[0];
  for (let i = 1; i <= uniq.length; i++) {
    const cur = uniq[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    groups.push(start === prev ? `${start}` : `${start}-${prev}`);
    if (cur !== undefined) {
      start = cur;
      prev = cur;
    }
  }
  return groups.join(",");
}

// Tire la liste des paliers depuis un Movement (priorité à `tiers[]`,
// fallback sur l'unique `tier` rétrocompatible).
function movementTiers(mv: { tier: number | null; tiers?: number[] | null }) {
  if (Array.isArray(mv.tiers) && mv.tiers.length > 0) return mv.tiers;
  if (mv.tier != null) return [mv.tier];
  return null;
}

// Sous-titre "Cumulé depuis ouverture" : nombre de mois écoulés depuis la
// création du compte + nombre réel de mises en relation. Reproduit à
// l'identique la fonction `lifetimeSub` du web (Prospect.jsx).
function lifetimeSub(accountCreatedAt: string | null, relationsCount: number) {
  const rel = `${relationsCount} mise${relationsCount > 1 ? "s" : ""} en relation`;
  if (!accountCreatedAt) return rel;
  const created = new Date(accountCreatedAt);
  if (Number.isNaN(created.getTime())) return rel;
  const now = new Date();
  const months = Math.max(
    0,
    (now.getFullYear() - created.getFullYear()) * 12 +
      (now.getMonth() - created.getMonth()),
  );
  return `${months} mois · ${rel}`;
}

// Anneau « sonar » animé : un cercle qui grandit et s'estompe en boucle,
// émanant du centre (empty state Mouvements). `delay` décale les vagues
// successives pour un effet radar continu.
function PulseRing({ delay }: { delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, [p, delay]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.45 + p.value * 0.95 }],
    opacity: (1 - p.value) * 0.45,
  }));
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { alignItems: "center", justifyContent: "center" },
      ]}
    >
      <Animated.View
        style={[
          {
            width: 120,
            height: 120,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: "#7FA8F0",
          },
          style,
        ]}
      />
    </View>
  );
}

/**
 * État affichable du bonus fondateur (parité web, cf. Prospect.jsx).
 *
 * Le bonus est provisionné VERROUILLÉ à l'ouverture du compte : il figure
 * dans le solde disponible (la somme appartient au prospect) mais n'est ni
 * retirable, ni comptabilisé pour atteindre le minimum de retrait. Il se
 * débloque quand les deux conditions sont réunies — 3 mois d'ancienneté du
 * compte ET au moins une sollicitation acceptée — et **sur action du
 * prospect**, jamais automatiquement.
 *
 * Renvoie `null` si aucun bonus n'est à signaler (ni verrouillé, ni déjà
 * crédité), ou si le backend déployé n'expose pas encore les champs.
 */
function founderBonusState(d: ProspectWallet | undefined) {
  if (!d) return null;
  const locked = d.signupBonusLocked === true;
  const pendingEur = d.signupBonusPendingEur ?? 0;
  const creditedEur = d.signupBonusEur ?? 0;

  if (!locked) {
    return creditedEur > 0
      ? { locked: false as const, note: `dont ${eur(creditedEur)} de bonus fondateur` }
      : null;
  }

  const unlockAt = d.signupBonusUnlockAt ? new Date(d.signupBonusUnlockAt) : null;
  const dateReached = unlockAt ? unlockAt <= new Date() : false;
  // Jours pleins arrondis au supérieur : tant qu'il reste des heures, on
  // affiche « 1 jour », jamais « 0 ».
  const daysLeft = unlockAt
    ? Math.max(0, Math.ceil((unlockAt.getTime() - Date.now()) / 86_400_000))
    : null;
  const daysLabel =
    daysLeft === 0 ? "aujourd'hui" : daysLeft === 1 ? "dans 1 jour" : `dans ${daysLeft} jours`;
  const claimable = d.signupBonusClaimable === true;

  return {
    locked: true as const,
    claimable,
    dateReached,
    daysLeft,
    amountEur: pendingEur,
    unlockLabel: unlockAt
      ? unlockAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : "—",
    hasAcceptance: d.signupBonusHasAcceptance === true,
    note: claimable
      ? `dont ${eur(pendingEur)} de bonus fondateur à débloquer`
      : !dateReached
        ? `dont ${eur(pendingEur)} de bonus fondateur retirable ${daysLabel}`
        : `dont ${eur(pendingEur)} de bonus fondateur retirable dès une 1ʳᵉ sollicitation acceptée`,
  };
}

/** Ligne de condition du bonus fondateur : cochée verte, ou grise en attente. */
function BonusCondition({ done, children }: { done: boolean; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View className="flex-row items-center gap-2">
      <View
        className="h-[18px] w-[18px] items-center justify-center rounded-full"
        style={{ backgroundColor: done ? `${c.good}22` : "rgba(120,120,120,0.14)" }}
      >
        <Ionicons
          name={done ? "checkmark" : "ellipse-outline"}
          size={11}
          color={done ? c.good : c.ink5}
        />
      </View>
      <Text className="flex-1 text-sm" style={{ color: done ? c.good : c.ink4 }}>
        {children}
      </Text>
    </View>
  );
}

// Carte d'accueil : base très sombre + halo diagonal, déclinés par thème
// (indigo pour BUUPP/Sombre, vert profond Forest, prune Fushia).
// `pastel` / `pastelRgb` / `pastelText` : teinte claire des détails
// (barre du score, pastilles) posés sur la carte.
const HOME_HERO: Record<
  ThemeMode,
  { base: [string, string]; glow: string; pastel: string; pastelRgb: string; pastelText: string }
> = {
  light: { base: ["#1E1646", "#0A0820"], glow: "124,92,252", pastel: "#C4B5FD", pastelRgb: "196,181,253", pastelText: "#DDD6FE" },
  dark: { base: ["#1E1646", "#0A0820"], glow: "124,92,252", pastel: "#C4B5FD", pastelRgb: "196,181,253", pastelText: "#DDD6FE" },
  forest: { base: ["#14452D", "#06170E"], glow: "52,168,106", pastel: "#A7E8C3", pastelRgb: "167,232,195", pastelText: "#D1F5E0" },
  fushia: { base: ["#4E1535", "#1A0511"], glow: "232,79,152", pastel: "#F9A8D4", pastelRgb: "249,168,212", pastelText: "#FCE7F3" },
};

export default function Portefeuille() {
  const { isDark, c, mode } = useTheme();
  const hero = HOME_HERO[mode];
  // Tuile icône blanche : givrée (translucide) en sombre pour ressortir sur
  // la carte teintée foncée.
  const tileBg = isDark ? "rgba(255,255,255,0.12)" : "#FFFFFF";
  const w = useProspectWallet();
  const [showWithdraw, setShowWithdraw] = useState(false);
  const m = useProspectMovements();
  const me = useMeTyped();
  const verif = useProspectVerification();
  const score = useProspectScore();
  const parrainage = useParrainage();
  const relations = useProspectRelations();
  const scoreHist = useProspectScoreHistory("1M");
  const badgeTier = parrainage.data?.badgeTier ?? null;
  const founderNumber = parrainage.data?.founderNumber ?? null;
  useRefetchOnFocus(w, m, verif, score, parrainage, relations, scoreHist);
  // Relation sélectionnée pour la modale de détail (parité web :
  // RelationDetailModal ouverte au clic sur une ligne d'historique).
  const [detail, setDetail] = useState<MovementRelation | null>(null);

  // ─── Bonus fondateur ───────────────────────────────────────────────
  // Le bonus verrouillé est compté dans `availableEur` mais n'est pas
  // retirable : `withdrawableEur` porte la part réellement retirable. Repli
  // sur `availableEur` tant que le backend déployé n'expose pas le champ.
  const bonus = founderBonusState(w.data);
  const withdrawableEur = w.data?.withdrawableEur ?? w.data?.availableEur ?? 0;
  const bonusNote = bonus?.note ?? null;
  const claimBonus = useClaimFounderBonus();

  // « Solde après opération » affiché dans la modale détail. L'API prod
  // (bup-rouge) ne renvoie pas encore ce champ : on le calcule ici à partir
  // des données déjà chargées (liste des mouvements + solde disponible du
  // wallet). Même définition que /api/prospect/wallet : solde disponible =
  // crédits/parrainages encaissés − retraits exécutés (les séquestres en
  // attente ne comptent pas). On ancre sur le solde disponible courant puis
  // on remonte la liste triée du plus récent au plus ancien.
  const balanceAfterById = useMemo(() => {
    const map = new Map<string, number>();
    const available = w.data?.availableCents;
    if (available == null) return map;
    let running = available;
    for (const mv of m.data?.movements ?? []) {
      map.set(mv.id, running);
      // Contribution de la ligne au solde disponible : +crédit, −retrait,
      // 0 sinon (séquestre, annulé, remboursé…).
      const delta =
        mv.statusLabel === "Crédité" ? mv.amountCents
        : mv.statusLabel === "Exécuté" ? -mv.amountCents
        : 0;
      running -= delta;
    }
    return map;
  }, [m.data?.movements, w.data?.availableCents]);

  // Ouvre la modale détail en injectant le solde après opération calculé.
  function openDetail(mv: Movement) {
    if (!mv.relation) return;
    const cents = balanceAfterById.get(mv.id);
    setDetail(
      cents != null
        ? { ...mv.relation, balanceAfterCents: cents, balanceAfterEur: Math.round(cents) / 100 }
        : mv.relation,
    );
  }

  // Deep-link push : ?openFlash=<dealId> → ouvre le FlashDealsSheet.
  // V1 : on ignore la valeur de dealId (l'user voit la liste complète).
  const params = useLocalSearchParams<{ openFlash?: string }>();
  const flashSheet = useFlashSheet();
  useEffect(() => {
    if (typeof params.openFlash !== "string") return;
    flashSheet.open();
    router.setParams({ openFlash: undefined });
  }, [params.openFlash, flashSheet]);

  // Hero (LinearGradient) — remplace le titre « Votre portefeuille » par
  // les deux pastilles Vérification + BUUPP Score (parité avec les
  // StatusPills du ProspectHeader web).
  const hour = new Date().getHours();
  const hello = hour >= 19 ? "Bonsoir" : "Bonjour";
  const firstName = me.data?.prenom?.trim() || null;
  // Pastille Vérification (haut-droite du hero) — format compact
  // « Basique · 1/3 » (parité redesign.png).
  const verifPill = verif.data
    ? `${VERIF_LABELS[verif.data.tier] ?? "Basique"} · ${verifTierPosition(verif.data.tier)}/3`
    : "…";
  // Score affiché en hero : nombre brut + barre de progression /1000.
  // La borne haute (1000) est explicitée dans l'API (/api/prospect/score)
  // et la page Score (« {p.score} / 1000 »).
  const scoreNum = score.data?.score ?? null;
  const scorePct =
    scoreNum != null ? Math.max(0, Math.min(1, scoreNum / 1000)) : 0;
  // Variation du score sur le mois glissant (1er vs dernier point 1M).
  const scoreDelta = useMemo(() => {
    const pts = scoreHist.data?.points;
    if (!Array.isArray(pts) || pts.length < 2) return null;
    const first = Number(pts[0]?.score);
    const last = Number(pts[pts.length - 1]?.score);
    return Number.isFinite(first) && Number.isFinite(last) ? last - first : null;
  }, [scoreHist.data?.points]);

  // Taux de fiabilité (notes des pros) — /api/prospect/score → breakdown.fiabilite.
  const fiab = score.data?.breakdown?.fiabilite ?? null;
  const fiabPct = fiab?.pct ?? null;
  const fiabLevels = fiab?.levels ?? { haute: 0, moyenne: 0, basse: 0 };
  const fiabCount = score.data
    ? (fiab?.count ?? fiabLevels.haute + fiabLevels.moyenne + fiabLevels.basse)
    : null;

  // « N mises en relation en attente · prochaine échéance dans X » (parité
  // sous-titre du ProspectHeader web). Tick 60 s pour le décompte.
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const pendingSubtitle = useMemo(() => {
    const pending = relations.data?.pending;
    if (!pending) return "Chargement de vos sollicitations…";
    const n = pending.length;
    if (n === 0) return "Aucune mise en relation en attente";
    let soonest: number | null = null;
    for (const r of pending) {
      if (!r.expiresAt) continue;
      const t = new Date(r.expiresAt).getTime();
      if (Number.isNaN(t) || t <= nowTs) continue;
      if (soonest == null || t < soonest) soonest = t;
    }
    let deadline: string | null = null;
    if (soonest != null) {
      const ms = soonest - nowTs;
      const h = Math.floor(ms / 3_600_000);
      const mn = Math.floor((ms % 3_600_000) / 60_000);
      deadline = h > 0 ? `${h} h ${String(mn).padStart(2, "0")} min` : `${mn} min`;
    }
    return (
      `${n} mise${n > 1 ? "s" : ""} en relation en attente` +
      (deadline ? ` · prochaine échéance dans ${deadline}` : "")
    );
  }, [relations.data?.pending, nowTs]);

  // Extras du header compact (visibles quand la page est scrollée vers
  // le bas) : disponible + séquestre, chacun précédé d'une petite
  // icône colorée (mêmes teintes que les cards : violet pour le
  // portefeuille, ambre pour le séquestre). Montant complet (avec
  // centimes), strictement identique à celui affiché sur les cards.
  const compactExtras = useMemo(
    () =>
      w.data
        ? [
            {
              icon: "card-outline" as const,
              value: eur(w.data.availableEur),
              color: "#7C5CFC",
              bg: "#F2EDFF",
            },
            {
              icon: "lock-closed-outline" as const,
              value: eur(w.data.escrowEur),
              color: "#F2B65A",
              bg: "#F6ECD8",
            },
          ]
        : undefined,
    [w.data],
  );

  return (
    <ScrollScreen
      onRefresh={() =>
        Promise.all([
          w.refetch(),
          m.refetch(),
          verif.refetch(),
          score.refetch(),
          parrainage.refetch(),
          relations.refetch(),
          scoreHist.refetch(),
        ])
      }
      compactExtras={compactExtras}
    >
      {/* Hero — fond indigo très sombre + glow violet diagonal depuis le
          coin haut-droit (parité redesign.png, échantillons : TR #3E2E83,
          BR #0C091F). Deux LinearGradient superposés car expo-linear-
          gradient ne fait pas de radial : base verticale sombre + halo
          violet semi-transparent du coin haut-droit. */}
      <View style={{ borderRadius: 28, overflow: "hidden" }}>
        <LinearGradient
          colors={hero.base}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[`rgba(${hero.glow},0.5)`, `rgba(${hero.glow},0)`]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.1, y: 0.95 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Décor : deux orbites fines qui débordent du coin haut-droit. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -90,
            right: -70,
            width: 240,
            height: 240,
            borderRadius: 120,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: `rgba(${hero.glow},0.45)`,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -40,
            right: -20,
            width: 140,
            height: 140,
            borderRadius: 70,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
          }}
        />
        <View style={{ padding: 20, paddingTop: 22 }}>
        {/* Ligne haute : salutation (+ prénom) à gauche ; badge parrainage
            éventuel + pastille Vérification à droite. */}
        <View className="flex-row items-start justify-between gap-3">
          <View style={{ flex: 1, minWidth: 0 }}>
            {firstName ? (
              <>
                <Text className="font-serif text-base text-white/80">
                  {hello},
                </Text>
                <Text
                  className="font-serif-italic text-2xl text-white"
                  numberOfLines={1}
                >
                  {firstName}
                </Text>
              </>
            ) : (
              <Text className="font-serif text-2xl text-white">{hello}</Text>
            )}
            <Pressable
              onPress={() => router.push("/(prospect)/relations")}
              accessibilityRole="link"
              className="mt-1.5 active:opacity-70"
            >
              <Text className="text-[12.5px] leading-[18px] text-white/70">
                {pendingSubtitle}
              </Text>
            </Pressable>
          </View>
          <View className="flex-row items-center gap-2">
            {badgeTier ? (
              <ReferralBadge
                tier={badgeTier}
                founderNumber={founderNumber}
                filleulCount={parrainage.data?.count ?? 0}
              />
            ) : null}
            <View className="flex-row items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
              <Ionicons name="shield-checkmark" size={13} color={hero.pastel} />
              <Text
                className="text-[12px] font-semibold text-white"
                numberOfLines={1}
              >
                {verifPill}
              </Text>
            </View>
          </View>
        </View>

        {/* BUUPP Score — eyebrow : icône jauge (= icône de l'onglet BUUPP
            Score du web, `gauge` lucide → speedometer-outline côté mobile,
            faute de react-native-svg) sur pastille claire ronde, + gros
            nombre /1000 + barre de progression. */}
        <View className="mt-5 flex-row items-center gap-2">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-white/15">
            <Ionicons name="speedometer-outline" size={15} color="#FFFFFF" />
          </View>
          <Text
            className="font-mono text-[11px] uppercase text-white/60"
            style={{ letterSpacing: 1.5 }}
          >
            BUUPP Score
          </Text>
        </View>
        <View className="mt-1 flex-row items-end gap-1">
          <Text className="font-serif text-5xl text-white">
            {scoreNum != null ? scoreNum : "…"}
          </Text>
          <Text className="mb-1.5 font-mono text-sm text-white/55">/ 1000</Text>
        </View>
        <View className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
          <View
            className="h-full rounded-full"
            style={{ width: `${scorePct * 100}%`, backgroundColor: hero.pastel }}
          />
        </View>
        {/* Indice de désirabilité + variation du mois (parité web). */}
        <Text className="mt-2.5 text-[12.5px] text-white/70">
          Votre indice de <Text className="font-semibold text-white/90">désirabilité</Text>
        </Text>
        <View className="mt-2 flex-row flex-wrap items-center justify-between gap-2">
          <View
            className="rounded-full px-2.5 py-1"
            style={{
              backgroundColor: `rgba(${hero.pastelRgb},0.16)`,
              borderWidth: 1,
              borderColor: `rgba(${hero.pastelRgb},0.4)`,
            }}
          >
            <Text className="text-[12px] font-semibold" style={{ color: hero.pastelText }}>
              {desirabiliteLabel(scoreNum)}
            </Text>
          </View>
          {scoreDelta != null && scoreDelta !== 0 ? (
            <View className="flex-row items-center gap-1">
              <Ionicons
                name={scoreDelta > 0 ? "trending-up" : "trending-down"}
                size={13}
                color={scoreDelta > 0 ? "#86EFAC" : "#FCA5A5"}
              />
              <Text
                className="text-[12.5px] font-semibold"
                style={{ color: scoreDelta > 0 ? "#86EFAC" : "#FCA5A5" }}
              >
                {scoreDelta > 0 ? "+" : ""}
                {scoreDelta} ce mois
              </Text>
            </View>
          ) : null}
        </View>
        </View>
      </View>

      {/* Taux de fiabilité — note des professionnels (parité 1re carte du
          ProspectHeader web) : %, nombre de notations, barre, répartition
          par niveau (icône teintée + badge chiffré). */}
      <Pressable
        onPress={() => router.push("/(prospect)/score")}
        accessibilityRole="button"
        accessibilityLabel="Taux de fiabilité — voir le BUUPP Score"
        className="active:opacity-90"
      >
        <Card tone="teal">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View
                className="h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: tileBg }}
              >
                <Ionicons name="speedometer-outline" size={18} color="#16A34A" />
              </View>
              <Text
                className="font-mono text-[11px] uppercase text-ink-4"
                style={{ letterSpacing: 1.2 }}
              >
                Taux de fiabilité
              </Text>
            </View>
            <Ionicons name="information-circle-outline" size={18} color={c.ink4} />
          </View>
          <View className="mt-3 flex-row items-baseline gap-0.5">
            <Text className="font-serif-bold text-[38px] leading-[42px] text-ink">
              {fiabPct == null ? "…" : fiabPct}
            </Text>
            <Text className="font-serif text-lg text-ink-4">%</Text>
          </View>
          <Text className="mt-1 text-[12.5px] text-ink-3">
            {fiabCount == null ? (
              <>
                Noté <Text className="font-semibold text-ink-2">…</Text> par les professionnels
              </>
            ) : fiabCount === 0 ? (
              "Pas encore noté par les professionnels"
            ) : (
              <>
                Noté <Text className="font-semibold text-ink-2">{fiabCount} fois</Text> par les
                professionnels
              </>
            )}
          </Text>
          <View
            className="mt-3 h-[7px] overflow-hidden rounded-full"
            style={{ backgroundColor: c.track }}
          >
            <LinearGradient
              colors={["#86D6A6", "#2EA15C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: `${fiabPct ?? 0}%`, height: "100%", borderRadius: 999 }}
            />
          </View>
          <View className="mt-3">
            {FIAB_LEVELS.map((lv, i) => (
              <View
                key={lv.key}
                className="flex-row items-center justify-between py-2"
                style={i > 0 ? { borderTopWidth: 1, borderTopColor: c.borderSoft } : undefined}
              >
                <View className="flex-row items-center gap-2.5">
                  <View
                    className="h-6 w-6 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${lv.color}26` }}
                  >
                    <Ionicons name={lv.icon} size={13} color={lv.color} />
                  </View>
                  <Text className="text-[13px] text-ink-2">{lv.label}</Text>
                </View>
                <View
                  className="min-w-[28px] items-center rounded-md px-2 py-0.5"
                  style={{
                    backgroundColor: `${lv.color}21`,
                    borderWidth: 1,
                    borderColor: `${lv.color}3D`,
                  }}
                >
                  <Text className="text-[14px] font-bold" style={{ color: lv.color }}>
                    {fiabLevels[lv.key] ?? 0}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      </Pressable>

      <QueryGate query={w}>
        {(d) => (
          <>
            <Card tone="violet">
              {/* Header : label + tuile icône carte (carré arrondi blanc,
                  parité redesign.png). */}
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="font-serif text-xl text-ink">
                  Votre portefeuille
                </Text>
                <View
                  className="h-10 w-10 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor: tileBg,
                    shadowColor: "#0F1629",
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: 2,
                  }}
                >
                  <Ionicons name="card-outline" size={20} color="#7C5CFC" />
                </View>
              </View>
              <Text className="font-mono text-[13px] uppercase text-ink-4">
                Disponible
              </Text>
              <Text className="mt-1 font-serif text-4xl text-violet">
                {eur(d.availableEur)}
              </Text>
              <CoinsLine coins={coins(d.availableCents)} />

              {/* UNE SEULE ligne « bonus fondateur », en vert avec icône
                  cadeau (parité web). Le bonus verrouillé est compté dans le
                  disponible — « dont » est donc exact — mais il n'est pas
                  retirable, d'où la mention du délai. */}
              {bonusNote && (
                <View className="mt-1.5 flex-row items-start gap-1.5">
                  <Ionicons name="gift" size={13} color={c.good} style={{ marginTop: 2 }} />
                  {/* flexShrink : le texte revient à la ligne au lieu de
                      déborder de la carte (constaté sur Android). */}
                  <Text
                    className="font-mono text-[12px] leading-[17px]"
                    style={{ color: c.good, flexShrink: 1 }}
                  >
                    {bonusNote}
                  </Text>
                </View>
              )}

              {/* Progression vers le seuil de retrait — barre + « X / Y € »
                  (parité redesign.png). Données dérivées (aucun back). */}
              <View className="mt-3 h-px bg-line" />
              <View className="mt-3 flex-row items-end justify-between">
                <Text className="flex-1 pr-3 text-sm text-ink-4">
                  {d.canWithdraw
                    ? "Retirable immédiatement · minimum de 5 €"
                    : d.signupBonusLocked
                      ? `Retirable à partir de ${eur(d.withdrawThresholdEur)} de gains, hors bonus fondateur`
                      : `Retirable à partir de ${eur(d.withdrawThresholdEur)}`}
                </Text>
                <Text className="font-mono text-[12px] text-ink-3">
                  {`${Math.round(withdrawableEur)} / ${Math.round(d.withdrawThresholdEur)} €`}
                </Text>
              </View>
              <View
                className="mt-2 h-2 overflow-hidden rounded-full"
                style={{
                  backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#C4B5FD",
                }}
              >
                <View
                  className="h-full rounded-full"
                  style={{
                    // Progression vers le SEUIL : basée sur la part réellement
                    // retirable, bonus verrouillé exclu — sinon la barre
                    // serait pleine alors que le retrait reste bloqué.
                    width: `${
                      d.withdrawThresholdEur > 0
                        ? Math.max(
                            0,
                            Math.min(1, withdrawableEur / d.withdrawThresholdEur),
                          ) * 100
                        : 0
                    }%`,
                    backgroundColor: "#7C5CFC",
                  }}
                />
              </View>

              {/* Retrait des gains (parité web « Retirer mes gains ») : actif
                  seulement quand une somme est réellement retirable. */}
              {(() => {
                const enabled = d.canWithdraw && withdrawableEur > 0;
                return (
                  <Pressable
                    onPress={() => setShowWithdraw(true)}
                    disabled={!enabled}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !enabled }}
                    className="mt-4 flex-row items-center justify-center rounded-full py-3.5 active:opacity-85"
                    style={{
                      gap: 8,
                      backgroundColor: enabled ? "#7C5CFC" : isDark ? "rgba(255,255,255,0.10)" : "#EDE9FE",
                    }}
                  >
                    <Ionicons
                      name="arrow-down-circle-outline"
                      size={18}
                      color={enabled ? "#FFFFFF" : "#A78BFA"}
                    />
                    <Text
                      className="text-[15px] font-semibold"
                      style={{ color: enabled ? "#FFFFFF" : "#A78BFA" }}
                    >
                      Retirer mes gains
                    </Text>
                  </Pressable>
                );
              })()}
            </Card>

            <View className="flex-row gap-3">
              {/* Icônes en tuiles blanches carrées (parité redesign.png) :
                  cadenas ambre / flèche trending-up verte. */}
              <Stat
                label="En séquestre"
                value={eur(d.escrowEur)}
                coins={coins(d.escrowCents)}
                hint="Déblocage à la clôture de la campagne"
                icon="lock-closed-outline"
                tone="amber"
                squareIcon
                iconColor="#F2B65A"
              />
              <Stat
                label="Ce mois"
                value={eur(d.monthGainsEur)}
                icon="trending-up"
                tone="teal"
                squareIcon
                iconColor="#5AA86A"
              />
            </View>

            <Card tone="amber">
              {/* Tuile icône (carré arrondi blanc) au-dessus du label,
                  même style que les cards Portefeuille / Mouvements. */}
              <View
                className="mb-3 h-10 w-10 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor: tileBg,
                  shadowColor: "#0F1629",
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 2,
                }}
              >
                <Ionicons name="trophy-outline" size={20} color="#F2B65A" />
              </View>
              <Text
                className="text-[12px] font-bold uppercase text-ink-4"
                style={{ letterSpacing: 0.8 }}
              >
                Cumulé depuis ouverture
              </Text>
              <Text className="mt-1 font-serif text-3xl text-ink">
                {eur(d.lifetimeGainsEur)}
              </Text>
              <CoinsLine coins={coins(d.lifetimeGainsCents)} />
              <Text className="mt-2 text-sm text-ink-4">
                {lifetimeSub(d.accountCreatedAt, d.relationsCount)}
              </Text>
            </Card>

            {/* Bonus fondateur verrouillé : décompte J-XX, les deux
                conditions et leur état, et le bouton de déblocage dès
                qu'elles sont réunies (parité web FounderBonusLockCard). */}
            {bonus?.locked && (
              <Card>
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 flex-row items-start gap-2.5">
                    <Ionicons name="gift" size={18} color={c.ink} />
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-ink">
                        Bonus fondateur — {eur(bonus.amountEur)}
                      </Text>
                      <Text
                        className="mt-0.5 font-mono text-[11px] uppercase text-ink-5"
                        style={{ letterSpacing: 1 }}
                      >
                        {bonus.claimable ? "Prêt à être débloqué" : "En attente de déblocage"}
                      </Text>
                    </View>
                  </View>
                  {bonus.claimable ? (
                    <View
                      className="rounded-full px-2.5 py-1"
                      style={{ backgroundColor: `${c.good}22` }}
                    >
                      <Text className="text-[12px] font-semibold" style={{ color: c.good }}>
                        Débloquable
                      </Text>
                    </View>
                  ) : bonus.dateReached ? (
                    <View
                      className="rounded-full px-2.5 py-1"
                      style={{ backgroundColor: "#F6ECD8" }}
                    >
                      <Text className="text-[12px] font-semibold" style={{ color: "#8A6516" }}>
                        Verrouillé
                      </Text>
                    </View>
                  ) : (
                    <View className="items-end">
                      <Text className="font-serif text-2xl text-ink">J-{bonus.daysLeft}</Text>
                      <Text
                        className="font-mono text-[10px] uppercase text-ink-5"
                        style={{ letterSpacing: 1 }}
                      >
                        {(bonus.daysLeft ?? 0) > 1 ? "jours restants" : "jour restant"}
                      </Text>
                    </View>
                  )}
                </View>

                <View className="mt-3 gap-2">
                  <BonusCondition done={bonus.dateReached}>
                    {bonus.dateReached
                      ? "Compte de plus de 3 mois"
                      : `Compte de plus de 3 mois — le ${bonus.unlockLabel}`}
                  </BonusCondition>
                  <BonusCondition done={bonus.hasAcceptance}>
                    Au moins une sollicitation acceptée
                  </BonusCondition>
                </View>

                {bonus.claimable && (
                  <Pressable
                    onPress={() => claimBonus.mutate()}
                    disabled={claimBonus.isPending}
                    className="mt-4 items-center rounded-full px-5 py-3"
                    style={{
                      backgroundColor: "#7C5CFC",
                      opacity: claimBonus.isPending ? 0.6 : 1,
                    }}
                  >
                    <Text className="text-base font-semibold text-white">
                      {claimBonus.isPending
                        ? "Déblocage…"
                        : `Débloquer mes ${eur(bonus.amountEur)}`}
                    </Text>
                  </Pressable>
                )}
                {claimBonus.isError && (
                  <Text className="mt-2 text-sm" style={{ color: c.bad }}>
                    {apiErrorMessage(claimBonus.error) ??
                      "Le déblocage a échoué. Réessayez dans un instant."}
                  </Text>
                )}
              </Card>
            )}
          </>
        )}
      </QueryGate>

      <Card tone="sky">
        {/* En-tête raffiné : tuile icône (swap-vertical miroité = flèches
            gauche ↓ / droite ↑, faute de lucide/SVG côté mobile) + eyebrow
            « Activité » et titre serif « Mouvements ». */}
        <View className="mb-1 flex-row items-center gap-3">
          <View
            className="h-11 w-11 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: tileBg,
              shadowColor: "#1B3A8F",
              shadowOpacity: 0.1,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 3,
            }}
          >
            <MaterialCommunityIcons
              name="swap-vertical"
              size={21}
              color="#3F7FD6"
              style={{ transform: [{ scaleX: -1 }] }}
            />
          </View>
          <View className="flex-1">
            <Text
              className="font-mono text-[10px] uppercase"
              style={{ letterSpacing: 1.6, color: "#5B8DEF" }}
            >
              Activité
            </Text>
            <Text
              className="font-serif text-xl text-ink"
              style={{ lineHeight: 24 }}
            >
              Mouvements
            </Text>
          </View>
        </View>
        <QueryGate query={m}>
          {(d) => (
            (d.movements?.length ?? 0) === 0 ? (
              // Empty state premium — composition « radar » : anneaux
              // concentriques (effet sonar « en attente d'activité ») + halo
              // teinté + disque blanc flottant portant l'illustration 3D
              // (thiings.co Empty Wallet, conservée), titre serif, sous-titre
              // et indicateur d'état discret.
              <View className="mt-4 items-center pb-1">
                <View
                  className="mb-5 items-center justify-center rounded-full"
                  style={{
                    width: 190,
                    height: 190,
                    borderWidth: 1,
                    borderColor: "rgba(91,141,239,0.10)",
                  }}
                >
                  {/* Vagues sonar animées (derrière le disque). */}
                  <PulseRing delay={0} />
                  <PulseRing delay={870} />
                  <PulseRing delay={1740} />
                  <View
                    className="items-center justify-center rounded-full"
                    style={{
                      width: 150,
                      height: 150,
                      borderWidth: 1,
                      borderColor: "rgba(91,141,239,0.18)",
                      backgroundColor: "rgba(91,141,239,0.05)",
                    }}
                  >
                    <View
                      className="items-center justify-center rounded-full bg-paper"
                      style={{
                        width: 116,
                        height: 116,
                        shadowColor: "#1B3A8F",
                        shadowOpacity: 0.16,
                        shadowRadius: 18,
                        shadowOffset: { width: 0, height: 10 },
                        elevation: 6,
                      }}
                    >
                      <Image
                        source={EMPTY_WALLET}
                        style={{ width: 84, height: 84 }}
                        contentFit="contain"
                        accessibilityLabel="Aucun mouvement"
                      />
                    </View>
                  </View>
                </View>
                <Text className="font-serif text-2xl text-ink">
                  Aucun mouvement
                </Text>
                <Text
                  className="mt-2 text-center text-[14px] leading-5 text-ink-4"
                  style={{ maxWidth: 264 }}
                >
                  Vos mises en relation, gains et retraits apparaîtront ici dès
                  votre première activité.
                </Text>
                <View
                  className="mt-4 flex-row items-center gap-2 rounded-full px-3 py-1.5"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.7)",
                    borderWidth: 0.7,
                    borderColor: "#E6E3DA",
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: "#5B8DEF",
                    }}
                  />
                  <Text className="font-mono text-[11px] text-ink-3">
                    En attente de votre première activité
                  </Text>
                </View>
              </View>
            ) : (
            <View className="mt-4 gap-2.5">
              {d.movements.map((mv) => {
                const tList = movementTiers(mv);
                const tStr = tList ? formatPaliers(tList) : null;
                const tLabel =
                  tList && tList.length > 1 ? "Paliers" : "Palier";
                // Cliquable uniquement quand le mouvement est lié à une
                // relation (escrow/credit issu d'une mise en relation).
                // Retraits IBAN / parrainages sans campagne restent
                // non interactifs — parité avec le tableau web.
                const clickable = !!mv.relation;
                // Crédit (entrée, +) → violet, flèche entrante ; sinon
                // (séquestre/retrait) → ambre, flèche sortante.
                const positive = mv.amountCents > 0;
                // Bonus fondateur (signup_bonus) : ligne mise en valeur en vert
                // (parité web : fond accentué + pastille « Bonus fondateur »).
                // Tant qu'il est verrouillé, le serveur renvoie statusChip
                // 'warn' — on garde alors la ligne neutre plutôt que verte, le
                // montant n'étant pas encore acquis.
                const isSignupBonus =
                  mv.kind === "signup_bonus" && mv.statusChip !== "warn";
                const isSignupBonusLocked =
                  mv.kind === "signup_bonus" && mv.statusChip === "warn";
                return (
                <Pressable
                  key={mv.id}
                  onPress={clickable ? () => openDetail(mv) : undefined}
                  disabled={!clickable}
                  accessibilityRole={clickable ? "button" : undefined}
                  accessibilityLabel={
                    clickable ? `Détail de ${mv.origin}` : undefined
                  }
                  className={`flex-row items-center gap-3 rounded-2xl border-line bg-paper px-4 py-3.5 ${
                    clickable ? "active:opacity-70" : ""
                  }`}
                  style={{
                    borderWidth: 0.7,
                    ...(isSignupBonus
                      ? { backgroundColor: c.goodSoft, borderColor: c.good }
                      : isSignupBonusLocked
                        ? { borderColor: c.warn }
                        : null),
                    shadowColor: "#0F1629",
                    shadowOpacity: 0.04,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                  }}
                >
                  {/* Avatar de direction. */}
                  <View
                    className="h-11 w-11 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: isSignupBonus
                        ? c.goodSoft
                        : isSignupBonusLocked
                          ? "rgba(224,145,90,0.14)"
                          : positive
                            ? "rgba(124,92,252,0.12)"
                            : "rgba(224,145,90,0.14)",
                    }}
                  >
                    <Ionicons
                      name={
                        isSignupBonus || isSignupBonusLocked
                          ? "gift"
                          : positive
                            ? "arrow-down"
                            : "arrow-up"
                      }
                      size={20}
                      color={
                        isSignupBonus
                          ? c.good
                          : isSignupBonusLocked
                            ? c.warn
                            : positive
                              ? "#7C5CFC"
                              : "#E0915A"
                      }
                    />
                  </View>

                  {/* Libellé + méta (date · statut) sur deux lignes. */}
                  <View className="flex-1">
                    <Text className="text-[15px] text-ink" numberOfLines={1}>
                      {mv.origin}
                    </Text>
                    {/* Nom de la campagne sous l'origine (parité web). */}
                    {mv.relation?.campaignName ? (
                      <Text
                        className="mt-0.5 font-mono text-[10.5px] uppercase text-ink-5"
                        style={{ letterSpacing: 0.8 }}
                        numberOfLines={1}
                      >
                        {mv.relation.campaignName}
                      </Text>
                    ) : null}
                    <Text
                      className="mt-1 font-mono text-[12px] text-ink-4"
                      numberOfLines={1}
                    >
                      {dateFr(mv.date)} · {mv.statusLabel}
                    </Text>
                    {(() => {
                      const avail = formatAvailableAt(mv.availableAt);
                      return avail ? (
                        <Text className="mt-0.5 text-[11px] text-good" numberOfLines={1}>
                          {avail}
                        </Text>
                      ) : null;
                    })()}
                  </View>

                  {/* Montant (proéminent) + chip palier empilé. */}
                  <View className="items-end gap-1">
                    <Text
                      className={`font-serif text-lg ${
                        positive ? "text-violet" : "text-ink-3"
                      }`}
                    >
                      {mv.sign}
                      {eur(Math.abs(mv.amountEur))}
                    </Text>
                    {isSignupBonus ? (
                      <View
                        className="rounded-full px-2 py-0.5"
                        style={{ backgroundColor: c.goodSoft }}
                      >
                        <Text
                          className="font-mono text-[10.5px]"
                          style={{ color: c.good }}
                        >
                          Bonus fondateur
                        </Text>
                      </View>
                    ) : tStr ? (
                      <View className="rounded-full border border-line bg-ivory px-2 py-0.5">
                        <Text className="font-mono text-[10.5px] text-ink-3">
                          {tLabel} {tStr}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {clickable ? (
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#C5C0B2"
                    />
                  ) : null}
                </Pressable>
                );
              })}
              {/* Pied : nombre de mouvements affichés + total crédité du
                  cycle (somme des montants positifs — parité web). */}
              {(() => {
                const n = d.movements.length;
                const totalCredited = d.movements.reduce(
                  (sum, mv) => sum + (Number(mv.amountCents) > 0 ? Number(mv.amountEur || 0) : 0),
                  0,
                );
                return (
                  <View
                    className="mt-1.5 gap-1 pt-3"
                    style={{ borderTopWidth: 1, borderTopColor: c.borderSoft }}
                  >
                    <Text className="text-[13px] text-ink-4">
                      Affichage des {n} dernier{n > 1 ? "s" : ""} mouvement{n > 1 ? "s" : ""}
                    </Text>
                    <Text className="text-[13px] text-ink-4">
                      Total crédité ce cycle :{" "}
                      <Text className="font-mono font-bold text-good">+{eur(totalCredited)}</Text>
                    </Text>
                  </View>
                );
              })()}
            </View>
            )
          )}
        </QueryGate>
      </Card>

      <MovementDetailSheet
        visible={detail !== null}
        onClose={() => setDetail(null)}
        relation={detail}
      />
      <WithdrawSheet
        visible={showWithdraw}
        onClose={() => {
          setShowWithdraw(false);
          void w.refetch();
        }}
      />
    </ScrollScreen>
  );
}
