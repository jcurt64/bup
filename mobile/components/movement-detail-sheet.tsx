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

import { BottomSheet } from "./bottom-sheet";
import { ReportProSheet } from "./report-pro-sheet";
import { ApiError } from "../lib/api";
import { useDecideRelation, type MovementRelation } from "../lib/queries";

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
function NeonTrace() {
  const [w, setW] = useState(0);
  const p = useSharedValue(0);
  useEffect(() => {
    if (w <= 0) return;
    p.value = 0;
    p.value = withTiming(1, { duration: 2200, easing: Easing.linear });
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
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      <View className="flex-row items-center gap-1">
        {icon ? <Ionicons name={icon} size={10} color="#8A91A1" /> : null}
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
  const decide = useDecideRelation();
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
  const bannerTone = alreadyAccepted
    ? { bg: "#E8F5EE", border: "#B8DDC4", icon: "#16A34A" as const, label: "Acceptée" }
    : canAccept
      ? { bg: "#EEF2FF", border: "#C7D2FE", icon: "#4F46E5" as const, label: "Encore ouverte" }
      : alreadyRefused
        ? { bg: "#FEF2F2", border: "#FECACA", icon: "#DC2626" as const, label: "Refusée" }
        : { bg: "#F7F4EC", border: "#E6E3DA", icon: "#8A91A1" as const, label: "Clôturée" };

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPct={80} topRadius={32}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingBottom: 18 }}
      >
        {/* Bannière contextuelle */}
        <View
          className="flex-row items-center gap-2.5 rounded-2xl px-4 py-3"
          style={{ backgroundColor: bannerTone.bg, borderWidth: 1, borderColor: bannerTone.border }}
        >
          <Ionicons name="information-circle" size={18} color={bannerTone.icon} />
          <Text className="flex-1 text-[13px] leading-5 text-ink">
            {alreadyAccepted ? (
              <>
                <Text className="font-semibold">Déjà acceptée</Text> — votre récompense est
                {r.relationStatus === "settled" ? (
                  " créditée."
                ) : (() => {
                  const avail = formatAvailableAt(r.availableAt);
                  return avail ? (
                    <>
                      {" en séquestre · "}
                      <Text className="font-semibold text-good">{avail}</Text>
                      {"."}
                    </>
                  ) : (
                    " en séquestre."
                  );
                })()}
              </>
            ) : canAccept ? (
              <>
                Cette campagne est <Text className="font-semibold">encore ouverte</Text> — vous pouvez l'accepter rétroactivement.
              </>
            ) : alreadyRefused ? (
              <>Vous avez <Text className="font-semibold">refusé</Text> cette demande.</>
            ) : (
              <>Cette campagne est <Text className="font-semibold">clôturée</Text> — l'acceptation n'est plus possible.</>
            )}
          </Text>
        </View>

        {/* En-tête : avatar pastel + raison sociale + secteur + chip palier */}
        <View className="flex-row items-start gap-3">
          <LinearGradient
            colors={["#7C5CFC", "#13235B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
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
            <Text className="font-serif text-xl text-ink" numberOfLines={2}>
              {r.pro}
            </Text>
            {r.sector ? (
              <Text className="mt-0.5 text-[13px] text-ink-4" numberOfLines={1}>
                {r.sector}
              </Text>
            ) : null}
          </View>
          <View className="rounded-full bg-accent-soft px-3 py-1">
            <Text className="text-[11px] font-semibold text-accent-ink">
              {tierChipLabel(r)}
            </Text>
          </View>
        </View>

        {/* Brief campagne (le mot du pro) — encart accent doux, italique */}
        {r.brief ? (
          <View
            className="rounded-2xl px-4 py-3"
            style={{ backgroundColor: "#F4F1FB", borderWidth: 1, borderColor: "#E4DEF5" }}
          >
            <Text
              className="font-mono text-[10px] uppercase text-violet"
              style={{ letterSpacing: 0.8 }}
            >
              Le mot du professionnel
            </Text>
            <Text className="mt-1.5 font-serif-italic text-[14px] leading-6 text-ink">
              « {r.brief} »
            </Text>
          </View>
        ) : null}

        {/* Motif */}
        {r.motif ? (
          <View>
            <Text
              className="font-mono text-[10px] uppercase text-ink-4"
              style={{ letterSpacing: 0.8 }}
            >
              Objet de la demande
            </Text>
            <Text className="mt-1 text-[14px] leading-6 text-ink-2">
              {r.motif}
            </Text>
          </View>
        ) : null}

        {/* Dates : Lancement / Fin */}
        <View className="flex-row gap-3">
          <View className="flex-1 rounded-2xl border border-line bg-ivory px-3.5 py-3">
            <LabelValue icon="calendar-outline" label="Lancement">
              <Text className="text-[13px] font-medium text-ink">
                {fmtLongDate(r.startDate)}
              </Text>
            </LabelValue>
          </View>
          <View className="flex-1 rounded-2xl border border-line bg-ivory px-3.5 py-3">
            <LabelValue icon="flag-outline" label="Fin">
              <Text className="text-[13px] font-medium text-ink">
                {fmtLongDate(r.endDate)}
              </Text>
            </LabelValue>
          </View>
        </View>

        {/* Récompense + délai — carte mise en valeur (dégradé violet doux). */}
        <LinearGradient
          colors={["#EDE9FE", "#FFFFFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "#E4DEF5",
            paddingHorizontal: 16,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <LabelValue label="Récompense">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="gift" size={18} color="#7C5CFC" />
              <Text className="font-serif text-2xl text-violet">
                {fmtEur(r.reward)}
              </Text>
            </View>
          </LabelValue>
          <LabelValue
            icon="flash-outline"
            label={canAccept && !alreadyAccepted ? "Ouverte jusqu'au" : "Campagne"}
            align="right"
          >
            <Text className="font-mono text-[13px] font-medium text-ink">
              {canAccept && !alreadyAccepted
                ? fmtLongDate(r.endDate)
                : alreadyAccepted
                  ? "Acceptée"
                  : "Clôturée"}
            </Text>
          </LabelValue>
        </LinearGradient>

        {/* Footer secondaire — signalement (parité web : action discrète
            placée au-dessus des actions principales). Bascule sur un
            chip « déjà transmis » après envoi. */}
        <View className="border-t border-line pt-3">
          {reportedLocal ? (
            <View className="flex-row items-center gap-1.5 self-start rounded-full bg-ivory-2 px-3 py-1">
              <Ionicons name="flag" size={11} color="#8A91A1" />
              <Text className="text-[11px] text-ink-4">
                Signalement déjà transmis
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={() => setReportOpen(true)}
              className="flex-row items-center gap-1.5 self-start py-1 active:opacity-60"
              accessibilityRole="button"
              accessibilityLabel="Signaler ce professionnel"
            >
              <Ionicons name="flag-outline" size={13} color="#DC2626" />
              <Text className="text-[12.5px] font-medium text-bad">
                Signaler ce professionnel
              </Text>
            </Pressable>
          )}
        </View>

        {/* Actions — mirror web (cf. RelationDetailModal action block) */}
        <View className="mt-1 flex-row gap-3">
          {canRefuse ? (
            <Pressable
              disabled={busy !== null}
              onPress={() => act("refuse")}
              className="flex-1 items-center rounded-full border border-line bg-paper py-3.5 active:opacity-70"
            >
              <Text className="text-sm font-semibold text-bad">
                {busy === "refuse" ? "…" : "Refuser"}
              </Text>
            </Pressable>
          ) : null}
          {!alreadyAccepted && canAccept ? (
            <Pressable
              disabled={busy !== null}
              onPress={() => act("accept")}
              className="flex-1 items-center rounded-full bg-ink py-3.5 active:opacity-80"
            >
              <Text className="text-sm font-semibold text-paper">
                {busy === "accept" ? "…" : "Accepter"}
              </Text>
            </Pressable>
          ) : null}
          {/* Fermer : seul bouton si aucune action métier possible */}
          {!canRefuse && (alreadyAccepted || !canAccept) ? (
            <Pressable
              onPress={onClose}
              className="flex-1 items-center rounded-full bg-ink py-3.5 active:opacity-80"
            >
              <Text className="text-sm font-semibold text-paper">Fermer</Text>
            </Pressable>
          ) : null}
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
