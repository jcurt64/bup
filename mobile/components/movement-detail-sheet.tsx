// Détail d'un mouvement Portefeuille — bottom-sheet ouverte au clic sur
// une ligne d'historique. Réplique RelationDetailModal du web (cf.
// public/prototype/components/Prospect.jsx fn RelationDetailModal) :
//   en-tête pro · brief campagne · objet · lancement/fin · récompense
//   + délai · bannière contextuelle (acceptée / encore ouverte / clos)
//   + actions Accepter/Refuser/Fermer mirror les conditions canAccept /
//   canRefuse côté web.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { useQueryClient } from "@tanstack/react-query";

import { BottomSheet } from "./bottom-sheet";
import { ReportProSheet } from "./report-pro-sheet";
import { ApiError } from "../lib/api";
import { useTheme } from "../lib/theme";
import {
  isMockDeal,
  isMockSollicitation,
  recordMockDealAccepted,
  recordMockDealRefused,
  recordMockSollicitationAccepted,
  recordMockSollicitationRefused,
  useDecideRelation,
  type MovementRelation,
} from "../lib/queries";

// Footer signature inversé — panneau navy (#0F1629, façon hero du site
// web) : le mot « buupp » et le slogan passent en clair pour contraster.
const SIGNATURE_COLOR = "#FBF8F1"; // « buupp » (Dancing Script) clair

// Slogan « BE USED · PAID & PROUD » adapté au fond sombre.
const SLOGAN_BLUE = "#C7D2FE"; // BE USED — indigo clair (glow hero web)
const SLOGAN_ORANGE = "#F2994A"; // PAID & — orange chaud
const SLOGAN_GRAY = "rgba(255,255,255,0.72)"; // PROUD
const SLOGAN_DOT = "rgba(255,255,255,0.35)"; // séparateur ·

// Fond du panneau footer (navy hero web).
const FOOTER_BG = "#0F1629";

// Délai initial avant que la 1ʳᵉ lettre démarre — laisse le temps à la
// modale de bottom-sheet de finir son slide-in (~250 ms) puis ~200 ms
// supplémentaires pour donner au regard le temps de se poser sur le
// footer avant que les lettres ne se déploient.
const SIGNATURE_INITIAL_DELAY = 450;
const SIGNATURE_STAGGER = 140;

// Lettre animée — fade-in + slide-up déclenché avec un délai croissant
// pour donner l'effet d'apparition lettre par lettre.
function BuuppLetter({ char, index }: { char: string; index: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);
  useEffect(() => {
    const delay = SIGNATURE_INITIAL_DELAY + index * SIGNATURE_STAGGER;
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 460, easing: Easing.out(Easing.quad) }),
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: 460, easing: Easing.out(Easing.cubic) }),
    );
  }, [index, opacity, translateY]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  return (
    <Animated.Text
      style={[
        {
          fontFamily: "DancingScript_700Bold",
          fontSize: 48,
          lineHeight: 56,
          color: SIGNATURE_COLOR,
        },
        style,
      ]}
    >
      {char}
    </Animated.Text>
  );
}

// Slogan animé — fade-in + slide-up déclenché APRÈS la fin du déploiement
// des lettres du logo (synchro avec SIGNATURE_INITIAL_DELAY + 4*STAGGER +
// duration des lettres + petit buffer pour un séquencement bien lisible).
function BuuppSlogan() {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);
  useEffect(() => {
    // Délai = fin de l'animation de la dernière lettre :
    // 450 (initial) + 4*140 (stagger) + 460 (duration lettre) = 1470 ms.
    // +120 ms de pause pour que l'œil enregistre le mot complet avant
    // l'arrivée du slogan.
    const delay =
      SIGNATURE_INITIAL_DELAY + 4 * SIGNATURE_STAGGER + 460 + 120;
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }),
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, [opacity, translateY]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  return (
    <Animated.Text
      className="mt-1 font-mono text-[11px] font-semibold uppercase"
      style={[{ letterSpacing: 2.2 }, style]}
    >
      <Text style={{ color: SLOGAN_BLUE }}>Be used</Text>
      <Text style={{ color: SLOGAN_DOT }}> · </Text>
      <Text style={{ color: SLOGAN_ORANGE }}>paid &amp; </Text>
      <Text style={{ color: SLOGAN_GRAY }}>proud</Text>
    </Animated.Text>
  );
}

// Quadrillage blanc pleine surface du panneau footer (façon grille du
// hero web, lignes blanches très discrètes). Clippé par l'overflow du
// panneau ; on dessine large pour couvrir toute hauteur/largeur.
function FooterGridDark() {
  const STEP = 24;
  const N = 36;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: N }).map((_, i) => (
        <View
          key={`h${i}`}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: i * STEP,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.06)",
          }}
        />
      ))}
      {Array.from({ length: N }).map((_, i) => (
        <View
          key={`v${i}`}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: i * STEP,
            width: 1,
            backgroundColor: "rgba(255,255,255,0.06)",
          }}
        />
      ))}
    </View>
  );
}

// Flash néon : un TRAIT lumineux horizontal (dégradé violet → blanc →
// violet, extrémités fondues + halo) balaie le footer de gauche à droite
// en faisant quelques montées/descentes, UNE SEULE FOIS. Aucune ligne
// statique tracée ; ce n'est pas une boule mais un éclat allongé.
// Retard avant le départ du néon : laisse à l'utilisateur le temps de
// regarder l'éclat d'étoiles de la récompense (qui démarre dès l'ouverture)
// avant de porter son attention sur le footer.
const NEON_START_DELAY = 1000;

function NeonTrace() {
  const [w, setW] = useState(0);
  const p = useSharedValue(0);
  useEffect(() => {
    if (w <= 0) return;
    p.value = 0;
    p.value = withDelay(
      NEON_START_DELAY,
      withTiming(1, { duration: 2200, easing: Easing.linear }),
    );
  }, [w, p]);
  const STREAK = 52;
  const yA = 30;
  const yB = 80;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.05, 0.9, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: interpolate(p.value, [0, 1], [-STREAK, w]) },
      // Trajectoire LINÉAIRE : descente régulière en ligne droite (pas
      // d'escalier).
      { translateY: interpolate(p.value, [0, 1], [yA, yB]) },
    ],
  }));
  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ position: "absolute", top: 0, left: 0, right: 0, height: 120 }}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            width: STREAK,
            height: 1,
            marginTop: -0.5,
            borderRadius: 999,
            shadowColor: "#A78BFA",
            shadowOpacity: 0.95,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 0 },
            elevation: 12,
          },
          style,
        ]}
      >
        <LinearGradient
          colors={[
            "rgba(167,139,250,0)",
            "rgba(167,139,250,0.85)",
            "#FFFFFF",
            "rgba(167,139,250,0.85)",
            "rgba(167,139,250,0)",
          ]}
          locations={[0, 0.3, 0.5, 0.7, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, borderRadius: 999 }}
        />
      </Animated.View>
    </View>
  );
}

// Footer signature de la modale détail — "buupp" en Dancing Script (navy)
// + slogan tri-couleur en mono caps qui apparaît à la fin de l'animation
// des lettres. La key sur le wrapper repose sur relation.id pour rejouer
// l'animation à chaque nouveau mouvement ouvert.
function BuuppSignature() {
  const insets = useSafeAreaInsets();
  const letters = "buupp".split("");
  return (
    // Bande footer navy PLEINE LARGEUR : marges négatives pour annuler le
    // px-5 de la sheet (→ bords gauche/droit) et la paddingBottom (→ bord
    // bas de l'écran), coins SUPÉRIEURS arrondis (harmonisés avec le haut
    // de la sheet).
    <View
      className="items-center overflow-hidden px-6 pt-7"
      style={{
        backgroundColor: FOOTER_BG,
        marginHorizontal: -20,
        marginBottom: -(insets.bottom + 16),
        paddingBottom: insets.bottom + 22,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
      }}
    >
      {/* Grille blanche (derrière le contenu). */}
      <FooterGridDark />
      {/* Glow indigo (haut-droite) + orange (bas-gauche), façon hero web. */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(165,180,252,0.16)", "rgba(165,180,252,0)"]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.25, y: 0.85 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(242,153,74,0)", "rgba(242,153,74,0.14)"]}
        start={{ x: 0.6, y: 0.1 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Néon qui trace le quadrillage en escalier (une seule fois). */}
      <NeonTrace />
      <View className="flex-row">
        {letters.map((c, i) => (
          <BuuppLetter key={`${c}-${i}`} char={c} index={i} />
        ))}
      </View>
      <BuuppSlogan />
    </View>
  );
}

// Initiales pour avatar (premier mot + premier mot suivant).
function initials(name: string): string {
  return (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

// "12 mai 2026" — format date long fr-FR pour les lignes Lancement / Fin.
function fmtLongDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

// "12,34 €" — montant fr-FR avec virgule.
function fmtEur(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

// "+1,50 €" / "−1,50 €" — montant signé (récompense en tête de la carte).
function fmtEurSigned(n: number): string {
  return `${n < 0 ? "−" : "+"}${fmtEur(Math.abs(n))}`;
}

// ── Éclat d'étoiles autour de la récompense ─────────────────────────────
// À l'ouverture de la sheet, une bordée d'étoiles dorées/violettes éclate
// autour du montant EN MÊME TEMPS qu'il apparaît, puis s'estompe tandis que
// le chiffre RESTE affiché. Thème « récompense » : étoiles + paillettes,
// tons or (#F4B740) et violet (#7C5CFC) pour coller à la palette de la carte.
const REWARD_GOLD = "#F4B740";
const REWARD_VIOLET = "#7C5CFC";

type SparkConf = {
  x: number; // position dans la zone (px, origine = coin haut-gauche du montant)
  y: number;
  size: number;
  delay: number; // décalage d'apparition (stagger)
  drift: number; // dérive verticale pendant la disparition (px, négatif = monte)
  rotateTo: number; // rotation finale (deg)
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
};

// Étoiles disposées autour du montant (≈ 175 × 50 px). Mélange d'étoiles
// pleines et de paillettes, tailles/délais variés pour un éclat organique.
// Délais ≤ ~220 ms → toutes là « en même temps » que le chiffre, puis
// disparition échelonnée.
const SPARKS: SparkConf[] = [
  { x: -6, y: 2, size: 13, delay: 40, drift: -10, rotateTo: -25, color: REWARD_GOLD, icon: "star" },
  { x: 150, y: -4, size: 16, delay: 0, drift: -14, rotateTo: 30, color: REWARD_GOLD, icon: "sparkles" },
  { x: 120, y: 34, size: 11, delay: 120, drift: 9, rotateTo: 20, color: REWARD_VIOLET, icon: "star" },
  { x: 40, y: -9, size: 10, delay: 90, drift: -12, rotateTo: -18, color: REWARD_VIOLET, icon: "sparkles" },
  { x: 172, y: 20, size: 12, delay: 180, drift: -8, rotateTo: 28, color: REWARD_GOLD, icon: "star" },
  { x: -2, y: 30, size: 10, delay: 150, drift: 10, rotateTo: -22, color: REWARD_GOLD, icon: "sparkles" },
  { x: 78, y: -10, size: 9, delay: 215, drift: -10, rotateTo: 15, color: REWARD_VIOLET, icon: "star" },
];

// Laisse la sheet finir son slide-in (~250 ms) avant l'éclat.
const SPARK_INITIAL_DELAY = 230;
// Durée de vie d'une étoile (apparition → disparition complète).
const SPARK_LIFE = 1100;

function Sparkle({ conf }: { conf: SparkConf }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      SPARK_INITIAL_DELAY + conf.delay,
      withTiming(1, { duration: SPARK_LIFE, easing: Easing.out(Easing.cubic) }),
    );
  }, [conf.delay, p]);
  const style = useAnimatedStyle(() => ({
    // Pop-in vif, plateau, fondu de sortie (le chiffre, lui, persiste).
    opacity: interpolate(p.value, [0, 0.15, 0.5, 1], [0, 1, 1, 0]),
    transform: [
      { translateY: interpolate(p.value, [0, 1], [0, conf.drift]) },
      { scale: interpolate(p.value, [0, 0.28, 0.7, 1], [0.2, 1.15, 1, 0.7]) },
      { rotate: `${interpolate(p.value, [0, 1], [0, conf.rotateTo])}deg` },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: conf.x, top: conf.y }, style]}
    >
      <Ionicons name={conf.icon} size={conf.size} color={conf.color} />
    </Animated.View>
  );
}

// Montant + éclat d'étoiles. Le chiffre fait un léger fade/scale-in
// synchronisé avec les étoiles, puis reste affiché en permanence. Remonté à
// chaque ouverture (key) pour rejouer l'animation.
function RewardAmount({ value }: { value: string }) {
  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.value = withDelay(
      SPARK_INITIAL_DELAY,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
  }, [reveal]);
  const numStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ scale: interpolate(reveal.value, [0, 1], [0.82, 1]) }],
  }));
  return (
    <View style={{ position: "relative" }}>
      <Animated.Text
        className="mt-0.5 font-serif-bold text-[34px] leading-10 text-violet"
        style={numStyle}
      >
        {value}
      </Animated.Text>
      {SPARKS.map((conf, i) => (
        <Sparkle key={i} conf={conf} />
      ))}
    </View>
  );
}

// Nom FR du palier (parité preferences.tsx / flash-deals-sheet.tsx).
const TIER_NAME_FR: Record<number, string> = {
  1: "Identification",
  2: "Localisation",
  3: "Style de vie",
  4: "Données pro",
  5: "Patrimoine",
};

// "BPP-2C8F-7A10" — fallback client (les relations issues de l'écran
// Relations n'ont pas de `reference` côté API). Même dérivation que la
// route movements : 8 premiers caractères hex de l'id, groupés 4-4.
function makeReference(id: string): string {
  const hex = (id || "").replace(/[^0-9a-fA-F]/g, "").slice(0, 8).toUpperCase();
  if (hex.length < 8) return `BPP-${hex || "—"}`;
  return `BPP-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

// Ligne du tableau récapitulatif (libellé gris à gauche · valeur à droite).
function DetailRow({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View
      className="flex-row items-center justify-between py-3"
      style={last ? undefined : { borderBottomWidth: 1, borderBottomColor: c.borderSoft }}
    >
      <Text className="text-[13.5px] text-ink-3">{label}</Text>
      <View className="ml-3 shrink-0">{children}</View>
    </View>
  );
}

// "dispo le 12/12/2026" — parité web (Prospect.jsx fn formatAvailableAt).
// Retourne null si l'iso est absent / invalide.
function formatAvailableAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (
    "dispo le " +
    d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  );
}

// Compacte [1,2,5] → "1-2,5" (idem helper Portefeuille). Inline pour
// éviter une dépendance circulaire écran ⇄ composant.
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
    if (cur === prev + 1) { prev = cur; continue; }
    groups.push(start === prev ? `${start}` : `${start}-${prev}`);
    if (cur !== undefined) { start = cur; prev = cur; }
  }
  return groups.join(",");
}

function tierChipLabel(r: MovementRelation): string {
  const list = Array.isArray(r.tiers) && r.tiers.length > 0
    ? r.tiers
    : (r.tier != null ? [r.tier] : null);
  if (!list) return "Palier —";
  const value = formatPaliers(list);
  if (!value) return "Palier —";
  return `${list.length > 1 ? "Paliers" : "Palier"} ${value}`;
}

// Petit composant : libellé en mono caps + valeur.
function LabelValue({
  icon,
  label,
  children,
  align = "left",
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      <View className="flex-row items-center gap-1">
        {icon ? <Ionicons name={icon} size={10} color={c.textMuted} /> : null}
        <Text
          className="font-mono text-[10px] uppercase text-ink-4"
          style={{ letterSpacing: 0.8 }}
        >
          {label}
        </Text>
      </View>
      <View className="mt-1">{children}</View>
    </View>
  );
}

export function MovementDetailSheet({
  visible,
  onClose,
  relation,
}: {
  visible: boolean;
  onClose: () => void;
  relation: MovementRelation | null;
}) {
  const { c } = useTheme();
  const decide = useDecideRelation();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"accept" | "refuse" | null>(null);
  // Sous-modale de signalement + état local « déjà signalé » pour
  // basculer immédiatement le footer sans refetch. Initialisé depuis
  // `relation.reported` (annoté côté serveur par reportedRelationIds)
  // pour qu'une relation déjà signalée — typiquement depuis le web —
  // affiche d'emblée le chip « déjà transmis ».
  const [reportOpen, setReportOpen] = useState(false);
  const [reportedLocal, setReportedLocal] = useState(false);

  useEffect(() => {
    setReportedLocal(!!relation?.reported);
  }, [relation?.id, relation?.reported]);

  if (!relation) {
    return <BottomSheet visible={visible} onClose={onClose}>{null}</BottomSheet>;
  }

  const r = relation;
  const alreadyAccepted =
    r.relationStatus === "accepted" || r.relationStatus === "settled";
  const alreadyRefused = r.relationStatus === "refused";
  // Cohérent avec la logique web (RelationDetailModal) : on autorise
  // l'acceptation rétroactive tant que la campagne est ouverte.
  const canAccept = !!r.campaignOpen;
  // Refus possible si déjà acceptée + campagne encore active (refund).
  const canRefuse = alreadyAccepted && !!r.campaignActive;

  async function act(action: "accept" | "refuse") {
    // Sollicitation fictive (id mock-soll-*) : décision simulée → la card du
    // carrousel Relations passe en « acceptée » (badge ✓) ou disparaît.
    if (isMockSollicitation(r.id)) {
      if (action === "accept") recordMockSollicitationAccepted(r.id);
      else recordMockSollicitationRefused(r.id);
      qc.invalidateQueries({ queryKey: ["prospect", "relations"] });
      onClose();
      return;
    }
    // Mouvement issu d'un flash deal fictif (id mock-*) : décision simulée
    // sans appel API (parité avec la sheet flash deals). Refuser retire le
    // mouvement injecté.
    if (isMockDeal(r.id)) {
      if (action === "accept") recordMockDealAccepted(r.id);
      else recordMockDealRefused(r.id);
      qc.invalidateQueries({ queryKey: ["prospect", "movements"] });
      qc.invalidateQueries({ queryKey: ["landing", "flash-deals"] });
      qc.invalidateQueries({ queryKey: ["prospect", "wallet"] });
      onClose();
      return;
    }
    setBusy(action);
    try {
      // refused → accepted : l'API n'autorise pas la transition directe
      // (table de transitions : refused → pending via undo, puis pending
      // → accepted via accept). Le serveur rate-limite TOUTES les actions
      // sur la clé `<userId>:<relationId>` avec fenêtre 5 min : l'undo
      // consomme le slot, l'accept immédiat reçoit donc 429. On capture
      // ce cas spécifiquement pour informer l'utilisateur que l'undo a
      // réussi et lui dire quand réessayer l'accept.
      if (action === "accept" && alreadyRefused) {
        await decide.mutateAsync({ id: r.id, action: "undo" });
        try {
          await decide.mutateAsync({ id: r.id, action: "accept" });
        } catch (acceptErr) {
          if (acceptErr instanceof ApiError && acceptErr.status === 429) {
            // Parse retryAfterSec pour humaniser le délai ("4 min" plutôt
            // que "237 s"). Fallback générique si le body est illisible.
            let waitMsg = "Réessayez dans quelques minutes";
            try {
              const j = JSON.parse(acceptErr.body) as {
                retryAfterSec?: number;
              };
              if (
                typeof j.retryAfterSec === "number" &&
                j.retryAfterSec > 0
              ) {
                const mins = Math.ceil(j.retryAfterSec / 60);
                waitMsg = `Réessayez dans ${mins} min`;
              }
            } catch {}
            Alert.alert(
              "Refus annulé",
              `Votre refus a été annulé — cette sollicitation est de nouveau en attente. Pour confirmer votre acceptation, ${waitMsg}.`,
            );
            onClose();
            return;
          }
          throw acceptErr;
        }
      } else {
        await decide.mutateAsync({ id: r.id, action });
      }
      onClose();
    } catch (e) {
      // Handler générique 429/402/410/409 (cf. commit e331ce8). Le body
      // 429 contient { message } rédigé côté serveur (« Pas trop vite 😊
      // … Réessayez dans X min Y s »).
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
      setBusy(null);
    }
  }

  // Couleurs de bannière selon état (parité web color-mix accent/good).
  // Fonds = tints de la palette (basculent clair/sombre) ; bordure neutre
  // borderSoft ; icône = accent vif. Lisible sur fond sombre.
  const bannerTone = alreadyAccepted
    ? { bg: c.tintGreen, border: c.borderSoft, icon: c.good, label: "Acceptée" }
    : canAccept
      ? { bg: c.accentSoft, border: c.borderSoft, icon: c.accent, label: "Encore ouverte" }
      : alreadyRefused
        ? { bg: c.tintCoral, border: c.borderSoft, icon: c.bad, label: "Refusée" }
        : { bg: c.field, border: c.borderSoft, icon: c.textMuted, label: "Clôturée" };

  // Pastille d'état affichée en regard de la récompense (carte d'en-tête).
  const rewardPill =
    r.relationStatus === "settled"
      ? { bg: c.tintGreen, border: c.borderSoft, color: c.good, icon: "checkmark-circle" as const, label: "Crédité" }
      : alreadyAccepted
        ? { bg: c.tintAmber, border: c.borderSoft, color: c.gold, icon: "lock-closed" as const, label: "En séquestre" }
        : alreadyRefused
          ? { bg: c.tintCoral, border: c.borderSoft, color: c.bad, icon: "close-circle" as const, label: "Refusée" }
          : canAccept
            ? { bg: c.accentSoft, border: c.borderSoft, color: c.accent, icon: "time-outline" as const, label: "Ouverte" }
            : { bg: c.field, border: c.borderSoft, color: c.textMuted, icon: "ellipse-outline" as const, label: "Clôturée" };

  // Lignes du tableau récapitulatif (toutes dérivées de la base).
  const statusCampaign =
    r.decision === "Acceptée"
      ? { label: "Acceptée", color: c.good }
      : r.decision === "Refusée"
        ? { label: "Refusée", color: c.bad }
        : { label: r.decision || "—", color: c.text };

  const primaryTier =
    Array.isArray(r.tiers) && r.tiers.length > 0
      ? Math.max(...r.tiers.filter((n) => Number.isFinite(n)))
      : r.tier;
  const tierName = TIER_NAME_FR[primaryTier] ?? null;
  const palierLabel = tierName ? `${tierChipLabel(r)} · ${tierName}` : tierChipLabel(r);

  const reference = r.reference ?? makeReference(r.id);
  const soldeApres = r.balanceAfterEur != null ? fmtEur(r.balanceAfterEur) : "—";

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPct={86} topRadius={32}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingBottom: 18 }}
      >
        {/* Carte d'en-tête combinée : pro + chip palier · séparateur ·
            récompense + pastille d'état (cf. det.pdf). */}
        <View
          className="rounded-3xl px-4 pb-4 pt-4"
          style={{ backgroundColor: c.tintViolet, borderWidth: 1, borderColor: c.violetSoft }}
        >
          <View className="flex-row items-start gap-3">
            <LinearGradient
              colors={["#7C5CFC", "#13235B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#13235B",
                shadowOpacity: 0.25,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 5 },
                elevation: 4,
              }}
            >
              <Text className="font-serif-bold text-base text-paper">
                {initials(r.pro)}
              </Text>
            </LinearGradient>
            <View className="flex-1">
              <Text className="font-serif-bold text-xl text-ink" numberOfLines={2}>
                {r.pro}
              </Text>
              {r.sector ? (
                <Text className="mt-0.5 text-[13px] text-ink-4" numberOfLines={1}>
                  {r.sector}
                </Text>
              ) : null}
            </View>
            <View
              className="rounded-full bg-paper px-3 py-1"
              style={{ borderWidth: 1, borderColor: c.violetSoft }}
            >
              <Text className="text-[11px] font-semibold text-violet">
                {tierChipLabel(r)}
              </Text>
            </View>
          </View>

          <View className="my-3.5 h-px" style={{ backgroundColor: c.violetSoft }} />

          <View className="flex-row items-center justify-between">
            <View>
              <Text
                className="font-mono text-[10px] uppercase text-ink-4"
                style={{ letterSpacing: 0.8 }}
              >
                Récompense
              </Text>
              <RewardAmount
                key={`reward-${r.id}-${visible ? "on" : "off"}`}
                value={fmtEurSigned(r.reward)}
              />
            </View>
            <View
              className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ backgroundColor: rewardPill.bg, borderWidth: 1, borderColor: rewardPill.border }}
            >
              <Ionicons name={rewardPill.icon} size={14} color={rewardPill.color} />
              <Text className="text-[12.5px] font-semibold" style={{ color: rewardPill.color }}>
                {rewardPill.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Bannière contextuelle */}
        <View
          className="flex-row items-center gap-2.5 rounded-2xl px-4 py-3"
          style={{ backgroundColor: bannerTone.bg, borderWidth: 1, borderColor: bannerTone.border }}
        >
          <Ionicons name="information-circle" size={18} color={bannerTone.icon} />
          <Text className="flex-1 text-[13px] leading-5 text-ink">
            {alreadyAccepted ? (
              r.relationStatus === "settled" ? (
                <>
                  <Text className="font-semibold">Déjà acceptée</Text> — votre récompense a été créditée sur votre portefeuille.
                </>
              ) : (() => {
                const avail = formatAvailableAt(r.availableAt);
                return (
                  <>
                    <Text className="font-semibold">Déjà acceptée</Text> — votre récompense est
                    {avail ? (
                      <>
                        {" en séquestre · "}
                        <Text className="font-semibold text-good">{avail}</Text>
                        {"."}
                      </>
                    ) : (
                      " en séquestre."
                    )}
                  </>
                );
              })()
            ) : canAccept ? (
              <>
                Cette campagne est <Text className="font-semibold">encore ouverte</Text> — vous pouvez l’accepter rétroactivement.
              </>
            ) : alreadyRefused ? (
              <>Vous avez <Text className="font-semibold">refusé</Text> cette demande.</>
            ) : (
              <>Cette campagne est <Text className="font-semibold">clôturée</Text> — l’acceptation n’est plus possible.</>
            )}
          </Text>
        </View>

        {/* Le mot du professionnel — label au-dessus, encart lavande avec
            grand guillemet + texte en italique. */}
        {r.brief ? (
          <View>
            <Text
              className="mb-1.5 font-mono text-[10px] uppercase text-ink-4"
              style={{ letterSpacing: 0.8 }}
            >
              Le mot du professionnel
            </Text>
            <View
              className="flex-row rounded-2xl px-4 py-3.5"
              style={{ backgroundColor: c.tintViolet, borderWidth: 1, borderColor: c.violetSoft }}
            >
              <Text
                className="font-serif-bold text-3xl text-violet"
                style={{ marginTop: -8, marginRight: 6, opacity: 0.55 }}
              >
                “
              </Text>
              <Text className="flex-1 font-serif-italic text-[15px] leading-7 text-ink">
                {r.brief}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Objet de la demande — titre de la campagne (campaigns.name),
            distinct du brief. Fallback sur motif tant que l'API prod
            n'expose pas campaignName. */}
        {(r.campaignName ?? r.motif) ? (
          <View>
            <Text
              className="mb-1 font-mono text-[10px] uppercase text-ink-4"
              style={{ letterSpacing: 0.8 }}
            >
              Objet de la demande
            </Text>
            <Text className="font-serif-bold text-[17px] leading-6 text-ink">
              {r.campaignName ?? r.motif}
            </Text>
          </View>
        ) : null}

        {/* Dates : Lancement / Fin */}
        <View className="flex-row gap-3">
          <View className="flex-1 rounded-2xl border border-line bg-paper px-3.5 py-3">
            <LabelValue icon="calendar-outline" label="Lancement">
              <Text className="font-serif-bold text-[15px] text-ink">
                {fmtLongDate(r.startDate)}
              </Text>
            </LabelValue>
          </View>
          <View className="flex-1 rounded-2xl border border-line bg-paper px-3.5 py-3">
            <LabelValue icon="flag-outline" label="Fin">
              <Text className="font-serif-bold text-[15px] text-ink">
                {fmtLongDate(r.endDate)}
              </Text>
            </LabelValue>
          </View>
        </View>

        {/* Tableau récapitulatif — statut · palier · référence · solde. */}
        <View
          className="rounded-2xl bg-paper px-4"
          style={{ borderWidth: 1, borderColor: c.borderSoft }}
        >
          <DetailRow label="Statut campagne">
            <Text className="text-[14px] font-semibold" style={{ color: statusCampaign.color }}>
              {statusCampaign.label}
            </Text>
          </DetailRow>
          <DetailRow label="Palier partagé">
            <Text className="text-[14px] font-semibold text-ink">{palierLabel}</Text>
          </DetailRow>
          <DetailRow label="Référence">
            <Text className="font-mono text-[13px] text-ink-2">{reference}</Text>
          </DetailRow>
          <DetailRow label="Solde après opération" last>
            <Text className="text-[14px] font-semibold text-ink">{soldeApres}</Text>
          </DetailRow>
        </View>

        {/* Actions — un seul bouton selon l'état :
            · acceptée → « Refuser » (fond clair, bordure navy fine). Passe
              en mode INACTIF/grisé si la campagne a expiré (plus de refund
              possible).
            · pas encore acceptée + ouverte → « Accepter ».
            · sinon → « Fermer ». */}
        <View className="mt-1 flex-row gap-3">
          {alreadyAccepted ? (
            <Pressable
              disabled={busy !== null || !canRefuse}
              onPress={canRefuse ? () => act("refuse") : undefined}
              className={`flex-1 items-center rounded-full border bg-paper py-3.5 ${
                canRefuse ? "border-navy active:opacity-70" : "border-ink-5"
              }`}
              style={canRefuse ? undefined : { opacity: 0.55 }}
              accessibilityState={{ disabled: !canRefuse }}
            >
              <Text
                className={`text-sm font-semibold ${canRefuse ? "text-navy" : "text-ink-4"}`}
              >
                {busy === "refuse" ? "…" : "Refuser"}
              </Text>
            </Pressable>
          ) : canAccept ? (
            <Pressable
              disabled={busy !== null}
              onPress={() => act("accept")}
              className="flex-1 items-center rounded-full bg-ink py-3.5 active:opacity-80"
            >
              <Text className="text-sm font-semibold text-paper">
                {busy === "accept" ? "…" : "Accepter"}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={onClose}
              className="flex-1 items-center rounded-full bg-ink py-3.5 active:opacity-80"
            >
              <Text className="text-sm font-semibold text-paper">Fermer</Text>
            </Pressable>
          )}
        </View>

        {/* Signaler ce professionnel — centré sous le bouton (cf. det.pdf). */}
        <View className="mt-0.5 items-center">
          {reportedLocal ? (
            <View className="flex-row items-center gap-1.5 rounded-full bg-ivory-2 px-3 py-1">
              <Ionicons name="flag" size={11} color={c.textMuted} />
              <Text className="text-[11px] text-ink-4">
                Signalement déjà transmis
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={() => setReportOpen(true)}
              className="flex-row items-center gap-1.5 py-1 active:opacity-60"
              accessibilityRole="button"
              accessibilityLabel="Signaler ce professionnel"
            >
              <Ionicons name="flag-outline" size={13} color={c.bad} />
              <Text className="text-[12.5px] font-medium text-bad">
                Signaler ce professionnel
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Bande signature « buupp » PLEINE LARGEUR, hors du ScrollView pour
          atteindre les bords de l'écran. `key` sur relation.id : force le
          remount pour rejouer l'animation à chaque mouvement consulté. */}
      <BuuppSignature key={`sig-${r.id}`} />

      <ReportProSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        relation={relation}
        onSubmitted={() => setReportedLocal(true)}
      />
    </BottomSheet>
  );
}
