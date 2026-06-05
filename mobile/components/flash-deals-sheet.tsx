// Bottom-sheet « Flash deals » — ouvert depuis le bouton éclair du
// header. Liste les campagnes durationKey='1h' actuellement actives
// renvoyées par /api/landing/flash-deals, chacune dans sa propre card.
// Parité conceptuelle avec la bannière marquee web (sans le défilement
// horizontal — sur mobile on empile verticalement pour la lisibilité).
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";

import { BottomSheet } from "./bottom-sheet";
import { DecisionFeedback } from "./decision-feedback";
import { BuuppLoader } from "./loader";
import { ApiError } from "../lib/api";
import { useTheme } from "../lib/theme";
import {
  isMockDeal,
  recordMockDealAccepted,
  recordMockDealRefused,
  useDecideRelation,
  useFlashDeals,
  useProspectScore,
  type FlashDeal,
} from "../lib/queries";

// DEV : simule une décision sur un flash deal fictif (pas d'appel API) — le
// deal accepté apparaît dans les Mouvements. Renvoie true si géré (mock).
function simulateMockDecision(
  d: FlashDeal,
  action: "accept" | "refuse",
  qc: ReturnType<typeof useQueryClient>,
  onFeedback: (a: "accept" | "refuse") => void,
): boolean {
  if (!isMockDeal(d.id)) return false;
  if (action === "accept") recordMockDealAccepted(d.id);
  else recordMockDealRefused(d.id);
  onFeedback(action);
  setTimeout(() => {
    qc.invalidateQueries({ queryKey: ["landing", "flash-deals"] });
    qc.invalidateQueries({ queryKey: ["prospect", "movements"] });
    qc.invalidateQueries({ queryKey: ["prospect", "wallet"] });
  }, 2500);
  return true;
}

// Palette du design « Flash deals · radar en veille » (cf.
// public/prototype/fl.html). Reprend les tokens exacts de la maquette.
const B = {
  navy: "#0a1628",
  navy2: "#11233f",
  ivory: "#f4f1e9",
  ivoryW: "#fbf9f4",
  ivoryD: "#ece7d9",
  violet: "#7c5cff",
  violetD: "#5b3fe0",
  violetS: "#a78dff",
  violetL: "#e8e0ff",
  violetXL: "#f2edff",
  green: "#5aa86a",
  greenL: "#dcefdf",
  greenTxt: "#2f6b3c",
  amber: "#e0972f",
  amberL: "#f8e8c9",
  amberBorder: "#efd9a8",
  amberTxt: "#8a5a12",
  coral: "#dd5f48",
  coralL: "#f9ddd5",
  muted: "#6b7384",
  mutedL: "#9aa1ad",
  line: "#e7e1d2",
  lineD: "#d8d1c0",
} as const;

// Mirror Prospect.jsx/HomeClient.tsx — libellés FR des catégories
// de données utilisés dans les chips « paliers requis ».
const TIER_KEY_LABEL_FR: Record<string, string> = {
  identity: "Identification",
  localisation: "Localisation",
  vie: "Style de vie",
  pro: "Données professionnelles",
  patrimoine: "Patrimoine & projets",
};

// "HH:MM:SS" depuis un endsAt ISO et un nowTs courant (passé en arg
// pour forcer le re-render à chaque tick du parent). "Expirée" si négatif.
function fmtHms(endsAt: string, nowTs: number): string {
  const ms = new Date(endsAt).getTime() - nowTs;
  if (ms <= 0) return "Expirée";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// "12,50 €" — montant fr-FR.
function fmtEur(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

// Teinte du multiplicateur : le standard flash deal (×3) reste ambre —
// couleur identité du sheet ; un éventuel bonus au-delà (×4+) passe en
// corail. Utilisée par la barre d'accent de la card et le badge
// « Gains ×N » (cf. d1.html).
function multTint(m: number) {
  return m >= 4
    ? { fg: B.coral, bg: B.coralL, bd: "#f0c6bb", accent: [B.coral, "#e8836f"] as const }
    : { fg: "#8a5a12", bg: B.amberL, bd: "#efd9a8", accent: [B.amber, "#f0b860"] as const };
}

// Multiplicateur numérique affiché (« Gains ×N »). Un flash deal
// (durationKey '1h') vaut ×3 par défaut (cf. web DURATION_MULTIPLIERS :
// 1h→3, 24h→2, 48h→1.5, 7d→1) ; on lit la valeur réelle de la campagne.
function dealMultNum(d: FlashDeal): number {
  return Math.max(1, Math.round(d.multiplier || 3));
}

// Fraction de temps restant [0..1] pour la barre de progression. Sans
// startsAt (anciens payloads), on suppose une fenêtre d'1 h.
function progressLeft(d: FlashDeal, nowTs: number): number {
  const end = new Date(d.endsAt).getTime();
  const start = d.startsAt ? new Date(d.startsAt).getTime() : end - 3600_000;
  const total = Math.max(1, end - start);
  return Math.max(0, Math.min(1, (end - nowTs) / total));
}

// Pilule « ⚡ Flash Deal » navy (cf. d1/d2).
function FlashPill({ small }: { small?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: small ? 5 : 7,
        paddingHorizontal: small ? 11 : 13,
        borderRadius: 999,
        backgroundColor: B.navy,
      }}
    >
      <Ionicons name="flash" size={small ? 12 : 14} color="#fff" />
      <Text style={{ fontSize: small ? 11.5 : 13, fontWeight: "600", color: "#fff" }}>
        Flash Deal
      </Text>
    </View>
  );
}

// Badge « Gains ×N » teinté (ambre pour le standard ×3, corail au-delà).
function MultBadge({ m }: { m: number }) {
  const t = multTint(m);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: t.bg,
        borderWidth: 1.5,
        borderColor: t.bd,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "700", color: t.fg }}>Gains ×{m}</Text>
    </View>
  );
}

// Compte à rebours + barre de progression (cf. d1/d2). `left` = fraction
// de temps restant.
function Countdown({
  hms,
  left,
  label,
}: {
  hms: string;
  left: number;
  label?: string;
}) {
  const { c } = useTheme();
  const expired = hms === "Expirée";
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Ionicons name="time-outline" size={15} color={B.coral} />
          <Text
            className="font-mono"
            style={{
              fontSize: 15.5,
              fontWeight: "600",
              color: expired ? B.coral : c.text,
              letterSpacing: 0.5,
              fontVariant: ["tabular-nums"],
            }}
          >
            {hms}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            letterSpacing: 0.4,
            color: B.coral,
            textTransform: "uppercase",
          }}
        >
          {label ?? "Restant"}
        </Text>
      </View>
      <View
        style={{
          height: 5,
          borderRadius: 3,
          backgroundColor: c.track,
          overflow: "hidden",
          marginTop: 7,
        }}
      >
        <LinearGradient
          colors={[B.amber, B.coral]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: `${Math.round(left * 100)}%`, height: "100%", borderRadius: 3 }}
        />
      </View>
    </View>
  );
}

// Largeur d'une card du carrousel : laisse dépasser la suivante (peek).
const CARD_W = Math.min(300, Dimensions.get("window").width - 72);

// Card résumé d'un flash deal dans le carrousel (cf. d1.html). Affichage
// pur — l'action se fait dans la sheet de détail ouverte via `onOpen`.
function FlashDealCard({
  d,
  nowTs,
  onOpen,
  active,
}: {
  d: FlashDeal;
  nowTs: number;
  onOpen: (d: FlashDeal) => void;
  active: boolean;
}) {
  const { c, isDark } = useTheme();
  const hms = fmtHms(d.endsAt, nowTs);
  const left = progressLeft(d, nowTs);
  const m = dealMultNum(d);
  const tint = multTint(m);
  // Deal déjà accepté → on stoppe la pulse et on affiche un badge « Accepté ».
  const accepted =
    d.relationStatus === "accepted" || d.relationStatus === "settled";
  // Pulse (léger scale) UNIQUEMENT sur la card affichée à l'écran (active)
  // ET pas encore acceptée.
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!active || accepted) {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 200 });
      return;
    }
    pulse.value = withRepeat(
      withTiming(1.025, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [active, accepted, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  return (
    <Animated.View style={[{ width: CARD_W, flexShrink: 0 }, pulseStyle]}>
      <View
        style={{
          backgroundColor: c.surface,
          borderRadius: 22,
        borderWidth: 1,
        borderColor: c.borderSoft,
        overflow: "hidden",
        shadowColor: B.navy,
        shadowOpacity: 0.07,
        shadowRadius: 11,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
      }}
    >
      <LinearGradient
        colors={tint.accent}
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
          <FlashPill small />
          {accepted ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: isDark ? c.goodSoft : "#E8F5EE",
              }}
            >
              <Ionicons name="checkmark-circle" size={14} color={c.good} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: c.good }}>
                Accepté
              </Text>
            </View>
          ) : (
            <MultBadge m={m} />
          )}
        </View>

        <View style={{ marginTop: 14 }}>
          <Text
            className="font-serif"
            numberOfLines={1}
            style={{ fontSize: 20, color: c.text }}
          >
            {d.proName ?? "Un professionnel"}
          </Text>
          {d.proSector ? (
            <Text
              numberOfLines={1}
              style={{ fontSize: 12.5, color: c.textSub, marginTop: 3 }}
            >
              {d.proSector}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            marginTop: 14,
            paddingVertical: 13,
            paddingHorizontal: 15,
            borderRadius: 16,
            backgroundColor: c.surface2,
            borderWidth: 1,
            borderColor: c.borderSoft,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{ fontSize: 10.5, fontWeight: "600", letterSpacing: 1.8, color: c.textSub }}
            >
              RÉCOMPENSE
            </Text>
            <Text
              style={{ fontSize: 10.5, fontWeight: "700", letterSpacing: 0.5, color: m >= 3 ? tint.fg : isDark ? c.gold : tint.fg }}
            >
              ×{m} GAINS
            </Text>
          </View>
          <Text className="font-serif" style={{ fontSize: 30, color: c.text, marginTop: 5 }}>
            {fmtEur(d.costPerContactCents)}
          </Text>
          <Text style={{ fontSize: 11.5, color: c.textSub, marginTop: 5 }}>
            Gains multipliés ×{m} — fenêtre éclair
          </Text>
        </View>

        <View style={{ marginTop: 14 }}>
          <Countdown hms={hms} left={left} />
        </View>

        <Pressable
          onPress={() => onOpen(d)}
          style={{
            marginTop: 15,
            paddingVertical: 13,
            borderRadius: 13,
            backgroundColor: c.btnBg,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: c.btnText }}>
            Voir le détail
          </Text>
          <Ionicons name="chevron-forward" size={16} color={c.btnText} />
        </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

// Sheet de détail d'un flash deal (cf. d2.html) : pills + nom + objet,
// encart récompense navy, compte à rebours, mot du pro, données demandées,
// puis le bloc d'actions (accepter / refuser / états) identique à la logique
// web (decision + 429/undo). `deal` peut être null tant qu'aucun deal n'est
// ouvert (le Modal reste monté).
function FlashDealDetailSheet({
  deal,
  visible,
  onClose,
  nowTs,
}: {
  deal: FlashDeal | null;
  visible: boolean;
  onClose: () => void;
  nowTs: number;
}) {
  const { c, isDark } = useTheme();
  const decide = useDecideRelation();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"accept" | "refuse" | null>(null);
  const [showFillData, setShowFillData] = useState(false);
  const [justDecided, setJustDecided] = useState<"accept" | "refuse" | null>(null);
  // Réinitialise l'état transitoire à chaque nouveau deal ouvert.
  useEffect(() => {
    setBusy(null);
    setShowFillData(false);
    setJustDecided(null);
  }, [deal?.id]);

  const d = deal;
  const missing = d?.missingTierKeys ?? [];
  const hasMissing = missing.length > 0;
  const hms = d ? fmtHms(d.endsAt, nowTs) : "";
  const expired = hms === "Expirée";
  const m = d ? dealMultNum(d) : 3;
  const canDecide =
    !!d && d.relationStatus === "pending" && !!d.relationId && !expired;

  async function decideRelation(action: "accept" | "refuse") {
    if (!d?.relationId || busy) return;
    if (action === "accept" && hasMissing) {
      setShowFillData(true);
      return;
    }
    // Deals fictifs : décision simulée (pas d'appel API) + mouvement injecté.
    if (simulateMockDecision(d, action, qc, setJustDecided)) return;
    setBusy(action);
    try {
      await decide.mutateAsync({ id: d.relationId, action });
      setJustDecided(action);
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["landing", "flash-deals"] });
      }, 2500);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      let serverMsg: string | null = null;
      if (e instanceof ApiError) {
        try {
          const j = JSON.parse(e.body) as { message?: string };
          if (typeof j.message === "string") serverMsg = j.message;
        } catch {}
      }
      // 403 accept_restricted : compte en pause 2 mois (4 sollicitations
      // acceptées sans réponse) — le serveur fournit un message courtois.
      const msg =
        (status === 429 || status === 403) && serverMsg
          ? serverMsg
          : status === 402
            ? "Le professionnel n'a plus assez de budget sur sa campagne. Réessayez plus tard."
            : status === 410
              ? "Cette campagne a expiré."
              : status === 409
                ? "Cette sollicitation n'est plus dans un état modifiable. Rafraîchissez la liste."
                : "Action impossible. Réessayez dans un instant.";
      Alert.alert(
        status === 429
          ? "Patientez un instant"
          : status === 403 && serverMsg
            ? "Acceptation en pause"
            : "Action impossible",
        msg,
      );
    } finally {
      setBusy(null);
    }
  }

  // Bascule refused → accepted via undo puis accept enchaînés (cf. logique
  // web : le serveur rate-limite la clé relation, l'undo consomme le slot).
  async function acceptAfterRefused() {
    if (!d?.relationId || busy) return;
    if (hasMissing) {
      setShowFillData(true);
      return;
    }
    if (simulateMockDecision(d, "accept", qc, setJustDecided)) return;
    setBusy("accept");
    try {
      await decide.mutateAsync({ id: d.relationId, action: "undo" });
      try {
        await decide.mutateAsync({ id: d.relationId, action: "accept" });
      } catch (acceptErr) {
        if (acceptErr instanceof ApiError && acceptErr.status === 429) {
          let waitMsg = "Réessayez dans quelques minutes";
          try {
            const j = JSON.parse(acceptErr.body) as { retryAfterSec?: number };
            if (typeof j.retryAfterSec === "number" && j.retryAfterSec > 0) {
              const mins = Math.ceil(j.retryAfterSec / 60);
              waitMsg = `Réessayez dans ${mins} min`;
            }
          } catch {}
          qc.invalidateQueries({ queryKey: ["landing", "flash-deals"] });
          Alert.alert(
            "Refus annulé",
            `Votre refus a été annulé — cette sollicitation est de nouveau en attente. Pour confirmer votre acceptation, ${waitMsg}.`,
          );
          return;
        }
        throw acceptErr;
      }
      setJustDecided("accept");
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["landing", "flash-deals"] });
      }, 2500);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      let serverMsg: string | null = null;
      if (e instanceof ApiError) {
        try {
          const j = JSON.parse(e.body) as { message?: string };
          if (typeof j.message === "string") serverMsg = j.message;
        } catch {}
      }
      // 403 accept_restricted : compte en pause 2 mois (4 sollicitations
      // acceptées sans réponse) — le serveur fournit un message courtois.
      const msg =
        (status === 429 || status === 403) && serverMsg
          ? serverMsg
          : status === 402
            ? "Le professionnel n'a plus assez de budget sur sa campagne. Réessayez plus tard."
            : status === 410
              ? "Cette campagne a expiré."
              : status === 409
                ? "Cette sollicitation n'est plus dans un état modifiable. Rafraîchissez la liste."
                : "Action impossible. Réessayez dans un instant.";
      Alert.alert(
        status === 429
          ? "Patientez un instant"
          : status === 403 && serverMsg
            ? "Acceptation en pause"
            : "Action impossible",
        msg,
      );
    } finally {
      setBusy(null);
    }
  }

  // accepted → refused : direct via /decision action=refuse.
  async function refuseAfterAccepted() {
    if (!d?.relationId || busy) return;
    if (simulateMockDecision(d, "refuse", qc, setJustDecided)) return;
    setBusy("refuse");
    try {
      await decide.mutateAsync({ id: d.relationId, action: "refuse" });
      setJustDecided("refuse");
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["landing", "flash-deals"] });
      }, 2500);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      let serverMsg: string | null = null;
      if (e instanceof ApiError) {
        try {
          const j = JSON.parse(e.body) as { message?: string };
          if (typeof j.message === "string") serverMsg = j.message;
        } catch {}
      }
      // 403 accept_restricted : compte en pause 2 mois (4 sollicitations
      // acceptées sans réponse) — le serveur fournit un message courtois.
      const msg =
        (status === 429 || status === 403) && serverMsg
          ? serverMsg
          : status === 402
            ? "Le professionnel n'a plus assez de budget sur sa campagne. Réessayez plus tard."
            : status === 410
              ? "Cette campagne a expiré."
              : status === 409
                ? "Cette sollicitation n'est plus dans un état modifiable. Rafraîchissez la liste."
                : "Action impossible. Réessayez dans un instant.";
      Alert.alert(
        status === 429
          ? "Patientez un instant"
          : status === 403 && serverMsg
            ? "Acceptation en pause"
            : "Action impossible",
        msg,
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPct={86} topRadius={28}>
      {!d ? null : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 18 }}
        >
          {/* Pills + fermeture */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <FlashPill />
              <MultBadge m={m} />
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Fermer"
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.borderSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={16} color={c.textSub} />
            </Pressable>
          </View>

          <Text className="font-serif" style={{ fontSize: 26, color: c.text, marginTop: 14 }}>
            {d.proName ?? "Un professionnel"}
          </Text>
          <Text style={{ fontSize: 14, color: c.textSub, marginTop: 4 }}>
            {[d.proSector, d.name].filter(Boolean).join(" · ")}
          </Text>

          {/* Encart récompense navy */}
          <LinearGradient
            colors={[B.navy, B.navy2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ marginTop: 16, borderRadius: 18, padding: 18 }}
          >
            <Text
              style={{
                fontSize: 10.5,
                fontWeight: "600",
                letterSpacing: 1.8,
                color: "rgba(255,255,255,0.55)",
              }}
            >
              RÉCOMPENSE
            </Text>
            <Text className="font-serif" style={{ fontSize: 44, color: B.ivoryW, marginTop: 7 }}>
              {fmtEur(d.costPerContactCents)}
            </Text>
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 6 }}>
              Gains multipliés{" "}
              <Text style={{ color: B.coral, fontWeight: "700" }}>×{m}</Text> — fenêtre
              éclair
            </Text>
          </LinearGradient>

          {/* Compte à rebours inline */}
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }}
          >
            <Ionicons name="time-outline" size={15} color={B.coral} />
            {expired ? (
              <Text style={{ fontSize: 13.5, color: c.text }}>Cette offre a expiré.</Text>
            ) : (
              <Text style={{ fontSize: 13.5, color: c.text }}>
                Plus que{" "}
                <Text
                  className="font-mono"
                  style={{ fontWeight: "700", fontVariant: ["tabular-nums"] }}
                >
                  {hms}
                </Text>{" "}
                pour décider.
              </Text>
            )}
          </View>

          {/* Mot du professionnel */}
          {d.brief ? (
            <View
              style={{
                marginTop: 16,
                paddingVertical: 15,
                paddingHorizontal: 17,
                borderRadius: 16,
                backgroundColor: c.surface2,
                borderWidth: 1,
                borderColor: c.borderSoft,
              }}
            >
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: "700",
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: c.textSub,
                }}
              >
                Le mot du professionnel
              </Text>
              <Text
                className="font-serif-italic"
                style={{ fontSize: 16, color: c.text, lineHeight: 22, marginTop: 8 }}
              >
                « {d.brief} »
              </Text>
            </View>
          ) : null}

          {/* Données demandées */}
          {d.requiredTierKeys?.length > 0 ? (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 13, color: c.textSub, marginBottom: 9 }}>
                Données demandées
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {d.requiredTierKeys.map((k) => {
                  const miss = (d.missingTierKeys ?? []).includes(k);
                  return (
                    <View
                      key={k}
                      style={{
                        paddingVertical: 7,
                        paddingHorizontal: 11,
                        borderRadius: 9,
                        backgroundColor: miss ? (isDark ? c.tintAmber : "#FEF6E7") : c.surface,
                        borderWidth: 1,
                        borderColor: miss ? (isDark ? c.warn : "#F5C57A") : c.borderSoft,
                      }}
                    >
                      <Text
                        className="font-mono"
                        style={{ fontSize: 12.5, color: miss ? (isDark ? c.gold : "#92400E") : c.text }}
                      >
                        {TIER_KEY_LABEL_FR[k] ?? k}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Bloc d'actions (mirror web FlashDealModal). */}
          <View style={{ marginTop: 18 }}>
            {justDecided ? (
              <DecisionFeedback decision={justDecided} />
            ) : canDecide && showFillData && hasMissing ? (
              <View className="gap-2">
                <View
                  className="rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: isDark ? c.tintAmber : "#FEF6E7", borderWidth: 1, borderColor: isDark ? c.warn : "#F5C57A" }}
                >
                  <Text className="text-[13px] leading-5" style={{ color: isDark ? c.gold : "#92400E" }}>
                    Pour accepter ce deal, complétez d’abord{" "}
                    <Text className="font-semibold">
                      {missing.map((k) => TIER_KEY_LABEL_FR[k] ?? k).join(", ")}
                    </Text>
                    .
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setShowFillData(false)}
                    className="items-center rounded-full border border-line bg-paper px-4 py-3 active:opacity-70"
                  >
                    <Text className="text-sm font-medium text-ink-3">Annuler</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push("/(prospect)/donnees")}
                    className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-ink py-3 active:opacity-80"
                  >
                    <Text className="text-sm font-semibold text-paper">
                      Compléter mes données
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color={c.btnText} />
                  </Pressable>
                </View>
              </View>
            ) : canDecide ? (
              <View className="flex-row gap-3">
                <Pressable
                  disabled={busy !== null}
                  onPress={() => decideRelation("refuse")}
                  className="flex-1 items-center rounded-full border border-line bg-paper py-3 active:opacity-70"
                >
                  <Text className="text-sm font-medium text-ink-3">
                    {busy === "refuse" ? "…" : "Refuser"}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={busy !== null}
                  onPress={() => decideRelation("accept")}
                  className="flex-1 items-center rounded-full bg-ink py-3 active:opacity-80"
                >
                  <Text className="text-sm font-semibold text-paper">
                    {busy === "accept" ? "…" : "Accepter"}
                  </Text>
                </Pressable>
              </View>
            ) : d.relationStatus === "accepted" && !expired ? (
              <View className="gap-2">
                <View
                  className="rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: isDark ? c.goodSoft : "#E8F5EE", borderWidth: 1, borderColor: isDark ? c.good : "#B8DDC4" }}
                >
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name="checkmark-circle" size={14} color={c.good} />
                    <Text className="text-[13px] font-semibold" style={{ color: c.text }}>
                      Sollicitation déjà acceptée.
                    </Text>
                  </View>
                  <Text className="mt-1 text-[12px] leading-4 text-ink-4">
                    La campagne est encore active : vous pouvez changer d’avis et refuser
                    tant qu’elle n’est pas clôturée.
                  </Text>
                </View>
                <Pressable
                  disabled={busy !== null}
                  onPress={refuseAfterAccepted}
                  className="items-center rounded-full border border-line bg-paper py-3 active:opacity-70"
                >
                  <Text className="text-sm font-medium text-ink">
                    {busy === "refuse" ? "Refus en cours…" : "Refuser finalement"}
                  </Text>
                </Pressable>
              </View>
            ) : d.relationStatus === "settled" ? (
              <View className="flex-row items-center justify-center gap-1.5 rounded-full bg-good/10 py-2.5">
                <Ionicons name="checkmark-done-circle" size={14} color={c.good} />
                <Text className="text-[13px] font-medium text-good">
                  Sollicitation acceptée · créditée
                </Text>
              </View>
            ) : d.relationStatus === "refused" && !expired ? (
              <View className="gap-2">
                <View
                  className="rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: c.ivory2, borderWidth: 1, borderColor: c.line }}
                >
                  <Text className="text-[13px] font-semibold" style={{ color: c.text }}>
                    Vous avez refusé cette sollicitation.
                  </Text>
                  <Text className="mt-1 text-[12px] leading-4 text-ink-4">
                    La campagne est encore active : vous pouvez changer d’avis et accepter
                    tant qu’elle n’est pas clôturée.
                  </Text>
                </View>
                <Pressable
                  disabled={busy !== null}
                  onPress={acceptAfterRefused}
                  className="flex-row items-center justify-center gap-2 rounded-full bg-ink py-3 active:opacity-80"
                >
                  <Text className="text-sm font-semibold text-paper">
                    {busy === "accept" ? "Acceptation en cours…" : "Accepter finalement"}
                  </Text>
                  {busy === "accept" ? null : (
                    <Ionicons name="checkmark" size={14} color={c.btnText} />
                  )}
                </Pressable>
              </View>
            ) : d.relationStatus === "refused" ? (
              <View className="flex-row items-center justify-center gap-1.5 rounded-full bg-bad/10 py-2.5">
                <Ionicons name="close-circle" size={14} color={c.bad} />
                <Text className="text-[13px] font-medium text-bad">
                  Sollicitation refusée
                </Text>
              </View>
            ) : expired ? null : (d.missingTierKeys?.length ?? 0) > 0 ? (
              <Pressable
                onPress={() => router.push("/(prospect)/donnees")}
                className="flex-row items-center justify-center gap-2 rounded-full py-3 active:opacity-80"
                style={{ backgroundColor: c.amber }}
              >
                <Ionicons name="document-text-outline" size={16} color="#0F1629" />
                <Text className="text-sm font-semibold" style={{ color: "#0F1629" }}>Compléter mes données</Text>
              </Pressable>
            ) : (
              <View className="gap-2">
                <View
                  className="rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: c.ivory2, borderWidth: 1, borderColor: c.line }}
                >
                  <Text className="text-[12.5px] leading-5 text-ink-2">
                    Cette campagne ne correspond pas à votre profil (zone géographique,
                    tranche d’âge ou centres d’intérêt). Complétez vos données pour
                    augmenter vos chances d’être éligible.
                  </Text>
                </View>
                <Pressable
                  onPress={() => router.push("/(prospect)/donnees")}
                  className="flex-row items-center justify-center gap-2 rounded-full bg-ink py-3 active:opacity-80"
                >
                  <Text className="text-sm font-semibold text-paper">
                    Compléter mes données pour accepter le deal
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={c.btnText} />
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </BottomSheet>
  );
}

// ── En-tête du sheet (cf. fl.html) — éclair violet dégradé + eyebrow
// « RÉMUNÉRATION ×3 » + titre + pill ambre « Bonus ×3 » + intro. Partagé
// par l'état vide et la liste de deals.
function FlashSheetHeader({ hasDeals }: { hasDeals: boolean }) {
  const { c, isDark } = useTheme();
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
        <LinearGradient
          colors={[B.violet, B.violetD]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 46,
            height: 46,
            borderRadius: 15,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: B.violet,
            shadowOpacity: 0.34,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 8 },
            elevation: 6,
          }}
        >
          <Ionicons name="flash" size={22} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: 10.5,
              fontWeight: "700",
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: c.violet,
            }}
          >
            Rémunération ×3
          </Text>
          <Text
            className="font-serif"
            style={{ fontSize: 25, color: c.text, marginTop: 2 }}
          >
            Flash deals
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingVertical: 6,
            paddingHorizontal: 11,
            borderRadius: 999,
            backgroundColor: c.tintAmber,
            borderWidth: 1,
            borderColor: isDark ? c.warn : B.amberBorder,
          }}
        >
          <Ionicons name="flash" size={12} color={isDark ? c.gold : B.amber} />
          <Text style={{ fontSize: 11.5, fontWeight: "700", color: isDark ? c.gold : B.amberTxt }}>
            Bonus ×3
          </Text>
        </View>
      </View>
      <Text
        style={{ marginTop: 14, fontSize: 14.5, lineHeight: 22, color: c.textSub }}
      >
        {hasDeals ? (
          <>
            Les sollicitations les{" "}
            <Text style={{ color: c.text, fontWeight: "600" }}>
              mieux rémunérées
            </Text>{" "}
            du moment, avec un{" "}
            <Text style={{ color: c.violetDeep, fontWeight: "600" }}>
              bonus ×3 immédiat
            </Text>
            . Elles partent vite — sautez sur l’occasion ! ⚡
          </>
        ) : (
          <>
            Les sollicitations les{" "}
            <Text style={{ color: c.text, fontWeight: "600" }}>
              mieux rémunérées
            </Text>{" "}
            de buupp, avec un{" "}
            <Text style={{ color: c.violetDeep, fontWeight: "600" }}>
              bonus ×3 immédiat
            </Text>
            . Elles partent vite — soyez prêt·e à saisir la prochaine.
          </>
        )}
      </Text>
    </View>
  );
}

// Radar en veille — 3 anneaux concentriques violets, un faisceau qui balaie
// en rotation continue (≈ conic-gradient fdsweep de la maquette), deux échos
// et l'éclair central. Pas de react-native-svg dans le projet → le balayage
// est approché par un faisceau dégradé en rotation.
function FlashRadar({ active }: { active: boolean }) {
  const rot = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(rot);
      return;
    }
    rot.value = withRepeat(
      withTiming(360, { duration: 6000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(rot);
  }, [active, rot]);
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  return (
    <View
      style={{
        width: "100%",
        height: 168,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Anneaux concentriques */}
      {([168, 126, 86] as const).map((s, i) => (
        <View
          key={s}
          style={{
            position: "absolute",
            width: s,
            height: s,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: B.violet,
            opacity: [0.16, 0.26, 0.4][i],
          }}
        />
      ))}

      {/* Faisceau de balayage en rotation */}
      <Animated.View
        pointerEvents="none"
        style={[
          { position: "absolute", width: 168, height: 168, alignItems: "center" },
          sweepStyle,
        ]}
      >
        <LinearGradient
          colors={["rgba(124,92,255,0)", "rgba(124,92,255,0.5)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            position: "absolute",
            top: 0,
            width: 3,
            height: 84,
            borderRadius: 2,
          }}
        />
      </Animated.View>

      {/* Échos (dots) avec halo (boxShadow maquette → anneau plein violetL) */}
      <View
        style={{
          position: "absolute",
          top: 24,
          left: "64%",
          width: 15,
          height: 15,
          borderRadius: 999,
          backgroundColor: B.violetL,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: B.violet }}
        />
      </View>
      <View
        style={{
          position: "absolute",
          bottom: 30,
          left: "30%",
          width: 11,
          height: 11,
          borderRadius: 999,
          backgroundColor: B.violetL,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: B.violetS }}
        />
      </View>

      {/* Halo diffus + éclair central */}
      <View
        style={{
          position: "absolute",
          width: 78,
          height: 78,
          borderRadius: 999,
          backgroundColor: "rgba(124,92,255,0.08)",
        }}
      />
      <LinearGradient
        colors={[B.violet, B.violetD]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 62,
          height: 62,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: B.violet,
          shadowOpacity: 0.4,
          shadowRadius: 13,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
        }}
      >
        <Ionicons name="flash" size={28} color="#fff" />
      </LinearGradient>
    </View>
  );
}

// Pastille « Scan actif · en veille » — point vert avec halo pulsant (fdpulse
// de la maquette : scale 1→2.4, opacité 1→0).
function ScanPill({ active }: { active: boolean }) {
  const { c, isDark } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(p);
      return;
    }
    p.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
    return () => cancelAnimation(p);
  }, [active, p]);
  const halo = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(p.value, [0, 0.7, 1], [1, 2.4, 2.4]) }],
    opacity: interpolate(p.value, [0, 0.7, 1], [0.9, 0, 0]),
  }));
  return (
    <View
      style={{
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        marginTop: 13,
        paddingVertical: 6,
        paddingHorizontal: 13,
        borderRadius: 999,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: isDark ? c.good : B.greenL,
      }}
    >
      <View
        style={{ width: 7, height: 7, alignItems: "center", justifyContent: "center" }}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              width: 7,
              height: 7,
              borderRadius: 999,
              backgroundColor: B.green,
            },
            halo,
          ]}
        />
        <View
          style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: B.green }}
        />
      </View>
      <Text style={{ fontSize: 11.5, fontWeight: "600", color: c.good }}>
        Scan actif · en veille
      </Text>
    </View>
  );
}

// État vide « radar en veille » complet (cf. fl.html) : radar + carte astuce
// + carte stat (flash deals acceptés sur 7 j) + barre de complétude profil +
// CTA. `acceptedCount` vient de l'API ; `profilePct` du score prospect.
function RadarEmptyState({
  acceptedCount,
  profilePct,
  onCompleteData,
  active,
}: {
  acceptedCount: number;
  profilePct: number;
  onCompleteData: () => void;
  active: boolean;
}) {
  const { c, isDark } = useTheme();
  const bars = [6, 9, 5, 28, 7, 5, 8];
  const pct = Math.max(0, Math.min(100, Math.round(profilePct)));
  return (
    <View>
      {/* Carte radar (fond dégradé violet clair → ivoire ≈ radial maquette) */}
      <LinearGradient
        colors={isDark ? [c.tintViolet, c.surface] : [B.violetXL, B.ivoryW]}
        locations={[0, 0.72]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          overflow: "hidden",
          marginTop: 18,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: isDark ? c.violetSoft : B.violetL,
          paddingTop: 26,
          paddingHorizontal: 20,
          paddingBottom: 22,
        }}
      >
        <FlashRadar active={active} />
        <View style={{ alignItems: "center", marginTop: 4 }}>
          <Text
            className="font-serif"
            style={{ fontSize: 21, color: c.text, textAlign: "center" }}
          >
            Aucun flash deal en cours
          </Text>
          <Text
            style={{
              fontSize: 13.5,
              color: c.textSub,
              lineHeight: 20,
              marginTop: 6,
              maxWidth: 280,
              textAlign: "center",
            }}
          >
            Les campagnes éclair apparaissent ici dès leur lancement.
          </Text>
          <ScanPill active={active} />
        </View>
      </LinearGradient>

      {/* Astuce */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
          marginTop: 14,
          paddingVertical: 14,
          paddingHorizontal: 15,
          borderRadius: 18,
          backgroundColor: c.tintViolet,
          borderWidth: 1,
          borderColor: isDark ? c.violetSoft : B.violetL,
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: isDark ? c.violetSoft : B.violetL,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="bulb-outline" size={17} color={c.violet} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 10.5,
              fontWeight: "700",
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: c.violetDeep,
            }}
          >
            Astuce
          </Text>
          <Text
            style={{ marginTop: 5, fontSize: 13, lineHeight: 20, color: c.text }}
          >
            Plus votre profil est complet, plus vous matchez de flash deals. La
            plupart partent en{" "}
            <Text style={{ fontWeight: "600" }}>moins d&apos;une heure</Text>.
          </Text>
        </View>
      </View>

      {/* Stat : flash deals acceptés sur 7 jours + mini bar-chart */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          marginTop: 11,
          paddingVertical: 13,
          paddingHorizontal: 16,
          borderRadius: 18,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.borderSoft,
        }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 7 }}>
            <Text
              className="font-serif"
              style={{ fontSize: 26, color: c.text }}
            >
              {acceptedCount}
            </Text>
            <Text style={{ fontSize: 13.5, fontWeight: "600", color: c.text }}>
              {acceptedCount <= 1 ? "flash deal accepté" : "flash deals acceptés"}
            </Text>
          </View>
          <Text style={{ fontSize: 11.5, color: c.textMuted, marginTop: 3 }}>
            sur les 7 derniers jours
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 4,
            height: 30,
          }}
        >
          {bars.map((h, i) => (
            <View
              key={i}
              style={{
                width: 5,
                height: h,
                borderRadius: 2,
                backgroundColor: h > 20 ? c.violet : c.track,
              }}
            />
          ))}
        </View>
      </View>

      {/* Complétude du profil (vrai % depuis le score prospect) */}
      <View style={{ marginTop: 18 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <Text style={{ fontSize: 12.5, color: c.textSub }}>Profil complété</Text>
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: c.violetDeep }}>
            {pct} %
          </Text>
        </View>
        <View
          style={{
            height: 7,
            borderRadius: 4,
            backgroundColor: c.track,
            overflow: "hidden",
          }}
        >
          <LinearGradient
            colors={[B.violet, B.violetS]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: `${pct}%`, height: "100%", borderRadius: 4 }}
          />
        </View>
      </View>

      {/* CTA */}
      <Pressable
        onPress={onCompleteData}
        style={{
          marginTop: 14,
          paddingVertical: 16,
          borderRadius: 16,
          backgroundColor: c.btnBg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          shadowColor: B.navy,
          shadowOpacity: 0.26,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 10 },
          elevation: 6,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: "600", color: c.btnText }}>
          Compléter mes données
        </Text>
        <Ionicons name="chevron-forward" size={17} color={c.btnText} />
      </Pressable>
      <Text
        style={{
          textAlign: "center",
          marginTop: 9,
          fontSize: 11.5,
          color: c.textMuted,
        }}
      >
        Débloquez davantage de flash deals à fort bonus
      </Text>
    </View>
  );
}

// Grille blanche discrète (clippée par l'overflow du footer) — façon
// quadrillage du hero web.
function FooterGrid() {
  const STEP = 22;
  const N = 14;
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
            backgroundColor: "rgba(255,255,255,0.05)",
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
            backgroundColor: "rgba(255,255,255,0.05)",
          }}
        />
      ))}
    </View>
  );
}

// Éclair dégradé qui clignote façon néon (longue tenue + brefs scintillements).
function FlashFooterBolt({ active }: { active: boolean }) {
  const o = useSharedValue(1);
  useEffect(() => {
    if (!active) {
      cancelAnimation(o);
      o.value = 1;
      return;
    }
    o.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500 }),
        withTiming(0.3, { duration: 70 }),
        withTiming(1, { duration: 90 }),
        withTiming(0.5, { duration: 60 }),
        withTiming(1, { duration: 130 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(o);
  }, [active, o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={st}>
      <LinearGradient
        colors={[B.violet, B.violetD]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: B.violet,
          shadowOpacity: 0.7,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
          elevation: 8,
        }}
      >
        <Ionicons name="flash" size={24} color="#fff" />
      </LinearGradient>
    </Animated.View>
  );
}

// Footer stylé du carrousel — bandeau navy, thème flash deal : grille
// blanche + glow elliptique violet au centre, éclair clignotant + message
// un brin taquin. Animation gelée quand la sheet est fermée (`active`).
function FlashDealsFooter({ active }: { active: boolean }) {
  return (
    <View
      style={{
        marginTop: 18,
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: B.navy,
        paddingVertical: 22,
        paddingHorizontal: 18,
        alignItems: "center",
      }}
    >
      <FooterGrid />
      {/* Glow elliptique violet au centre, par-dessus la grille. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { alignItems: "center", justifyContent: "center" },
        ]}
      >
        <View
          style={{
            width: 220,
            height: 96,
            borderRadius: 999,
            backgroundColor: "rgba(124,92,255,0.20)",
            shadowColor: B.violet,
            shadowOpacity: 0.8,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      </View>

      <FlashFooterBolt active={active} />
      <Text
        className="font-serif"
        style={{ fontSize: 18, color: "#fff", marginTop: 12, textAlign: "center" }}
      >
        Plus rapides que l’éclair.
      </Text>
      <Text
        style={{
          fontSize: 12.5,
          color: "rgba(255,255,255,0.6)",
          marginTop: 5,
          textAlign: "center",
          lineHeight: 18,
        }}
      >
        Littéralement. Ne clignez pas des yeux — ces offres filent à toute
        vitesse.
      </Text>
    </View>
  );
}

export function FlashDealsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const q = useFlashDeals();
  const deals = q.data?.deals ?? [];
  // Flash deals que CE prospect a acceptés sur les 7 derniers jours
  // (compteur perso de l'empty state — cf. /api/landing/flash-deals).
  const acceptedLast7DaysCount = q.data?.stats?.acceptedLast7DaysCount ?? 0;
  // Complétude réelle du profil pour la barre de progression de l'empty
  // state (réutilise le score prospect : breakdown.completeness.pct).
  const score = useProspectScore();
  const profilePct = score.data?.breakdown.completeness.pct ?? 0;

  // Deal ouvert dans la sheet de détail (null = aucune) + index actif du
  // carrousel (pour les pastilles de pagination).
  const [openDeal, setOpenDeal] = useState<FlashDeal | null>(null);
  // Version « live » du deal ouvert : relue depuis la query (statut à jour
  // après accept/refuse) — sinon la sheet garderait le snapshot capturé au
  // clic et n'afficherait pas le bon bouton (« Refuser/Accepter finalement »).
  const openDealLive = openDeal
    ? (deals.find((x) => x.id === openDeal.id) ?? openDeal)
    : null;
  const [activeIdx, setActiveIdx] = useState(0);
  const GAP = 12;
  const onCarouselScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setActiveIdx(Math.max(0, Math.round(x / (CARD_W + GAP))));
  };

  // Refetch à l'ouverture (pour ne pas laisser le user voir des deals
  // figés/expirés si la sheet est restée fermée longtemps).
  useEffect(() => {
    if (visible) q.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Tick 1 s pour rafraîchir les timers HH:MM:SS visibles. Reset au
  // mount pour ne pas afficher une horloge figée si la sheet a été
  // refermée puis rouverte longtemps après.
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    if (!visible) return;
    setNowTs(Date.now());
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [visible]);

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPct={86}>
      <FlashSheetHeader hasDeals={deals.length > 0} />

      {q.isPending ? (
        <View className="mt-4 flex-1 items-center justify-center">
          <BuuppLoader />
        </View>
      ) : q.isError ? (
        <View className="mt-4 rounded-2xl border-l-4 border-bad bg-paper p-4">
          <Text className="text-sm text-bad">
            Impossible de charger les flash deals.
          </Text>
        </View>
      ) : deals.length === 0 ? (
        // État vide « radar en veille » (cf. public/prototype/fl.html).
        // Wrappé dans ScrollView pour les petits écrans (SE 1ʳᵉ gen).
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-4"
          showsVerticalScrollIndicator={false}
        >
          <RadarEmptyState
            acceptedCount={acceptedLast7DaysCount}
            profilePct={profilePct}
            active={visible}
            onCompleteData={() => {
              onClose();
              router.push("/(prospect)/donnees");
            }}
          />
        </ScrollView>
      ) : (
        // Rendu conditionnel : dès qu'il y a au moins un flash deal, la card
        // radar « aucun flash deal » est remplacée par ce carrousel horizontal
        // de cards (cf. d1.html). Chaque card ouvre la sheet de détail
        // (cf. d2.html). Top-aligné — le header/intro de la page sont
        // inchangés. ScrollView vertical pour que dots + footer restent
        // accessibles sur les petits écrans.
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={CARD_W + GAP}
            snapToAlignment="start"
            onScroll={onCarouselScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ gap: GAP, paddingTop: 28, paddingRight: 24 }}
          >
            {deals.map((d, i) => (
              <FlashDealCard
                key={d.id}
                d={d}
                nowTs={nowTs}
                onOpen={setOpenDeal}
                active={i === Math.min(activeIdx, deals.length - 1)}
              />
            ))}
          </ScrollView>

          {deals.length > 1 ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginTop: 16,
              }}
            >
              {deals.map((d, i) => {
                const on = i === Math.min(activeIdx, deals.length - 1);
                return (
                  <View
                    key={d.id}
                    style={{
                      width: on ? 18 : 7,
                      height: 7,
                      borderRadius: 999,
                      backgroundColor: on ? c.violet : c.track,
                    }}
                  />
                );
              })}
            </View>
          ) : null}

          <FlashDealsFooter active={visible} />
        </ScrollView>
      )}

      <FlashDealDetailSheet
        deal={openDealLive}
        visible={openDeal !== null}
        onClose={() => setOpenDeal(null)}
        nowTs={nowTs}
      />
    </BottomSheet>
  );
}

// Indique au header s'il faut afficher la pastille rouge (au moins 1
// deal actif). Hook léger, partagé avec le bouton flash du header.
export function useFlashDealsCount() {
  const q = useFlashDeals();
  return q.data?.deals.length ?? 0;
}

