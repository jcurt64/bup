// Accueil pro (vue d'ensemble) — /api/pro/overview. Deux états :
//   • VIDE (aucune campagne/acceptation) : carte héros « Lancez votre
//     première campagne » + CTA, indicateurs à 0, acceptations vides.
//   • DONNÉES : carte héros ROI estimé (investi / valeur estimée), grille
//     d'indicateurs, dernières acceptations + « Voir toutes ».
// Carte héros = dégradé thémé (violet buupp ; variantes sombre/forest/fushia).
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { BottomSheet } from "../../components/bottom-sheet";
import { eur, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import { useProOverview, type ProOverview } from "../../lib/queries";
import { useTheme, type ThemeMode } from "../../lib/theme";

// Dégradé de la carte héros par thème (buupp = violet de l'image proto).
const HERO_GRADIENT: Record<ThemeMode, readonly [string, string]> = {
  light: ["#5B3FE0", "#7C5CFF"],
  dark: ["#2E2A55", "#14192B"],
  forest: ["#15583A", "#2F8D5B"],
  fushia: ["#7A2350", "#D63B80"],
};

const fmtPct = (pct: number | null | undefined) =>
  pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct} %`;
const dateShort = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = new Date();
  const days = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};

function IndicatorCell({
  icon,
  tintBg,
  iconColor,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tintBg: string;
  iconColor: string;
  label: string;
  value: string;
}) {
  const { c } = useTheme();
  return (
    <View
      style={{
        width: "48%",
        marginBottom: 10,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: c.borderSoft,
        backgroundColor: c.surface,
        padding: 14,
      }}
    >
      <View
        className="items-center justify-center"
        style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: tintBg }}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text
        className="mt-2.5 font-mono uppercase"
        style={{ fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6, color: c.textSub }}
        numberOfLines={2}
      >
        {label}
      </Text>
      <Text className="mt-1 font-serif" style={{ fontSize: 24, color: c.text }}>
        {value}
      </Text>
    </View>
  );
}

// Carte héros « ROI estimé » (état données) — dégradé thémé, texte blanc.
// Icône info à droite (centrée verticalement) → ouvre le popup explicatif.
function RoiHero({ d, colors, onInfo }: { d: ProOverview; colors: readonly [string, string]; onInfo: () => void }) {
  const invested = (d.roi?.spentCents ?? d.spent30dCents ?? 0) / 100;
  const estValue = (d.roi?.potentialRevenueCents ?? 0) / 100;
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 24, padding: 20, overflow: "hidden" }}
    >
      <View
        pointerEvents="none"
        style={{ position: "absolute", right: 24, bottom: -30, width: 90, height: 90, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)" }}
      />
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <View
          className="items-center justify-center"
          style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.16)" }}
        >
          <Ionicons name="trending-up" size={16} color="#FFFFFF" />
        </View>
        <Text
          className="font-mono uppercase"
          style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.4, color: "rgba(255,255,255,0.78)" }}
        >
          ROI estimé · 30 jours
        </Text>
      </View>
      <Text className="mt-3 font-serif" style={{ fontSize: 44, lineHeight: 48, color: "#FFFFFF" }}>
        {fmtPct(d.roi?.pct)}
      </Text>
      <View className="mt-3 flex-row" style={{ gap: 28 }}>
        <View>
          <Text className="font-mono uppercase" style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.8, color: "rgba(255,255,255,0.7)" }}>
            Investi
          </Text>
          <Text className="mt-0.5 font-mono" style={{ fontSize: 15, color: "#FFFFFF" }}>
            {eur(invested)}
          </Text>
        </View>
        <View>
          <Text className="font-mono uppercase" style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.8, color: "rgba(255,255,255,0.7)" }}>
            Valeur estimée
          </Text>
          <Text className="mt-0.5 font-mono" style={{ fontSize: 15, color: "#FFFFFF" }}>
            {eur(estValue)}
          </Text>
        </View>
      </View>
      {/* Icône info — rendue en DERNIER (donc au-dessus pour le tactile) ;
          wrapper plein-hauteur à droite qui centre verticalement le bouton
          par rapport à l'ensemble des éléments de la carte. */}
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", top: 0, bottom: 0, right: 22, justifyContent: "center", zIndex: 2 }}
      >
        <Pressable
          onPress={onInfo}
          accessibilityRole="button"
          accessibilityLabel="Comment ce ROI est-il calculé ?"
          hitSlop={12}
          className="items-center justify-center active:opacity-70"
          style={{ width: 34, height: 34, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.16)" }}
        >
          <Ionicons name="information-circle-outline" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </LinearGradient>
  );
}

// Popup d'explication du calcul du ROI — port fidèle de la modale web
// (Pro.jsx → RoiInfoModal) : formule en clair, hypothèses, application aux
// chiffres réels du pro, avertissement honnête.
function RoiInfoModal({ d, visible, onClose }: { d: ProOverview; visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const pct = d.roi?.pct ?? null;
  const convPct = d.roi?.assumedConversionPct ?? 10;
  const valueEur = (d.roi?.assumedValuePerClientCents ?? 10_000) / 100;
  const spentEur = (d.roi?.spentCents ?? 0) / 100;
  const potentialEur = (d.roi?.potentialRevenueCents ?? 0) / 100;
  const acceptedCount = d.contactsAccepted30d;

  const Label = ({ children, accent }: { children: string; accent?: boolean }) => (
    <Text
      className="font-mono uppercase"
      style={{ fontSize: 10, letterSpacing: 1.4, color: accent ? c.accVioletDeep : c.textSub, marginBottom: 8 }}
    >
      {children}
    </Text>
  );
  const Row = ({ left, right }: { left: string; right: React.ReactNode }) => (
    <View className="flex-row items-center justify-between" style={{ paddingVertical: 2 }}>
      <Text style={{ fontSize: 13.5, color: c.ink4, flexShrink: 1, paddingRight: 10 }}>{left}</Text>
      <Text style={{ fontSize: 13.5, fontWeight: "500", color: c.text, textAlign: "right" }}>{right}</Text>
    </View>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* En-tête : titre + fermer */}
        <View className="flex-row items-start justify-between" style={{ marginBottom: 4 }}>
          <Text className="font-serif" style={{ flex: 1, fontSize: 22, lineHeight: 28, color: c.text, paddingRight: 12 }}>
            Comment on calcule votre ROI ?
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={10} className="active:opacity-60" style={{ padding: 4 }}>
            <Ionicons name="close" size={22} color={c.ink4} />
          </Pressable>
        </View>
        <Text style={{ fontSize: 13, lineHeight: 20, color: c.textSub, marginBottom: 18 }}>
          Une estimation honnête de la rentabilité de vos campagnes BUUPP sur les 30 derniers jours.
        </Text>

        {/* Étape 1 — la formule en mots simples */}
        <View
          style={{ padding: 16, borderRadius: 12, marginBottom: 14, backgroundColor: c.tintViolet, borderWidth: 1, borderColor: c.violetSoft }}
        >
          <Label accent>La formule en clair</Label>
          <Text style={{ fontSize: 14, lineHeight: 22, color: c.text }}>
            <Text style={{ fontWeight: "700" }}>ROI</Text> = (ce que les contacts pourraient vous rapporter{" "}
            <Text style={{ fontWeight: "700" }}>−</Text> ce que vous avez dépensé){" "}
            <Text style={{ fontWeight: "700" }}>÷</Text> ce que vous avez dépensé.
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 20, color: c.textSub, marginTop: 8 }}>
            Le résultat est exprimé en pourcentage. <Text style={{ fontWeight: "700", color: c.text }}>+100 %</Text> veut
            dire que vous gagnez le double de ce que vous avez investi.
          </Text>
        </View>

        {/* Étape 2 — les hypothèses */}
        <View style={{ marginBottom: 14 }}>
          <Label>Nos deux hypothèses</Label>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13.5, lineHeight: 21, color: c.text }}>
              {"•  "}
              <Text style={{ fontWeight: "700" }}>{convPct} %</Text> des contacts acceptés deviennent vraiment clients
              <Text style={{ color: c.textSub }}> — moyenne tous secteurs confondus.</Text>
            </Text>
            <Text style={{ fontSize: 13.5, lineHeight: 21, color: c.text }}>
              {"•  "}Un client vous rapporte en moyenne <Text style={{ fontWeight: "700" }}>{eur(valueEur)}</Text>
              <Text style={{ color: c.textSub }}> — panier moyen générique.</Text>
            </Text>
          </View>
        </View>

        {/* Étape 3 — application aux chiffres du pro */}
        <View
          style={{ padding: 16, borderRadius: 12, marginBottom: 14, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.borderSoft }}
        >
          <Label>Appliqué à vos chiffres (30 derniers jours)</Label>
          {acceptedCount === 0 ? (
            <Text style={{ fontSize: 13, lineHeight: 20, color: c.textSub }}>
              Vous n&apos;avez pas encore d&apos;acceptation sur les 30 derniers jours — le ROI sera affiché dès la première.
            </Text>
          ) : (
            <View>
              <Row left="Contacts acceptés" right={String(acceptedCount)} />
              <Row
                left="Gains potentiels estimés"
                right={
                  <Text style={{ fontSize: 13.5, color: c.text }}>
                    {acceptedCount} × {convPct} % × {eur(valueEur)} ={" "}
                    <Text style={{ fontWeight: "700" }}>{eur(potentialEur)}</Text>
                  </Text>
                }
              />
              <Row left="Dépense réelle" right={eur(spentEur)} />
              <View
                className="flex-row items-center justify-between"
                style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.borderSoft }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: c.text }}>ROI</Text>
                <Text
                  className="font-serif"
                  style={{ fontSize: 22, color: pct === null ? c.ink4 : pct >= 0 ? c.accGreen : c.bad }}
                >
                  {pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct} %`}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Étape 4 — honnêteté */}
        <Text style={{ fontSize: 12, lineHeight: 19, color: c.ink4, marginBottom: 18 }}>
          <Text style={{ fontWeight: "700", color: c.textSub }}>À garder en tête : </Text>
          c&apos;est une estimation. Si votre secteur convertit plus que la moyenne (services premium, immobilier…),
          votre ROI réel sera meilleur. À l&apos;inverse en e-commerce, il sera plus faible. Bientôt vous pourrez
          personnaliser ces deux hypothèses dans vos paramètres.
        </Text>

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          className="items-center justify-center rounded-full active:opacity-80"
          style={{ backgroundColor: c.btnBg, paddingVertical: 14 }}
        >
          <Text style={{ fontSize: 15, fontWeight: "600", color: c.btnText }}>J&apos;ai compris</Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

// Carte héros « première campagne » (état vide) — dégradé thémé.
function EmptyHero({ colors }: { colors: readonly [string, string] }) {
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 24, padding: 22, overflow: "hidden" }}
    >
      <View
        pointerEvents="none"
        style={{ position: "absolute", right: -20, top: -20, width: 120, height: 120, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" }}
      />
      <View
        className="items-center justify-center"
        style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.16)" }}
      >
        <Ionicons name="megaphone" size={26} color="#FFFFFF" />
      </View>
      <Text className="mt-4 font-serif" style={{ fontSize: 23, lineHeight: 26, color: "#FFFFFF" }}>
        Lancez votre première campagne
      </Text>
      <Text className="mt-1.5 text-[13.5px] leading-5" style={{ color: "rgba(255,255,255,0.8)" }}>
        Ciblez des prospects qualifiés et ne payez que les acceptations.
      </Text>
      <Pressable
        onPress={() => router.push("/(pro)/creation")}
        accessibilityRole="button"
        className="mt-4 flex-row items-center justify-center gap-2 rounded-full py-3 active:opacity-80"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        <Ionicons name="add" size={18} color="#5B3FE0" />
        <Text className="text-[15px] font-semibold" style={{ color: "#5B3FE0" }}>
          Créer une campagne
        </Text>
      </Pressable>
    </LinearGradient>
  );
}

// ── Section « Dernières acceptations » — port fidèle de la maquette
// public/prototype/ok.html (buupp-acceptances.jsx) : bandeau de stats,
// carte liste (avatar dégradé, campagne + icône, badge palier, date,
// coût, jauge de score), légende BUUPP SCORE. ─────────────────────────

// Couleur de la jauge / pastille selon le score (sur 1000). Couleurs
// sémantiques fixes (identiques à la maquette) quel que soit le thème :
// vert ≥ 800, violet 600–799, ambre < 600.
const scoreColor = (s: number) => (s >= 800 ? "#3F9056" : s >= 600 ? "#7C5CFF" : "#E0972F");

// Initiales d'après le nom (« Prospect anonyme » → « PA », « Jqy C. » → « JC »).
const initialsOf = (name: string) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
};

// Icône de la campagne d'après son intitulé (campaigns.name est libre →
// heuristique par mots-clés alignée sur les 7 objectifs du catalogue).
const iconForCampaign = (camp: string): keyof typeof Ionicons.glyphMap => {
  const s = (camp || "").toLowerCase();
  if (/(promo|fidél|fidel|coupon|réduc|reduc|remise|flash|concours|solde|offre|cadeau)/.test(s)) return "pricetags-outline";
  if (/(télécharg|telecharg|livre|guide|ebook|contenu|pdf|catalogue|checklist|template|étude|etude|rapport|infographie|replay)/.test(s)) return "download-outline";
  if (/(rendez|rdv|devis|consult|essai|démo|demo)/.test(s)) return "calendar-outline";
  if (/(événement|evenement|event|webinar|atelier|conf|porte|lancement|soirée|soiree|inscription|tournoi|salon)/.test(s)) return "flag-outline";
  if (/(sondage|avis|enquête|enquete|nps|csat|satisfaction|interview|vote|panel|focus)/.test(s)) return "clipboard-outline";
  if (/(pub|ads|meta|facebook|instagram|google|tiktok|linkedin|audience|digital|publicit)/.test(s)) return "megaphone-outline";
  if (/(contact|email|e-mail|sms|mms|appel|phoning|whatsapp|push|mailing|courrier|newsletter)/.test(s)) return "mail-outline";
  return "megaphone-outline";
};

// Jauge de score 38 px SANS react-native-svg (exclu du projet) : deux
// demi-disques pivotants clippés + trou central, technique reprise de
// l'écran « données » prospect. Chiffre du score au centre.
function ScoreRing({ score }: { score: number }) {
  const { c } = useTheme();
  const size = 38;
  const stroke = 4;
  const color = scoreColor(score);
  const p = Math.max(0, Math.min(100, (score / 1000) * 100));
  const half = size / 2;
  const rightDeg = p <= 50 ? (p / 50) * 180 : 180;
  const leftDeg = p > 50 ? ((p - 50) / 50) * 180 : 0;
  const Sweep = ({ clip, rotate }: { clip: "right" | "left"; rotate: number }) => (
    <View
      style={{ position: "absolute", top: 0, left: clip === "right" ? half : 0, width: half, height: size, overflow: "hidden" }}
    >
      <View
        style={{ position: "absolute", top: 0, left: clip === "right" ? -half : 0, width: size, height: size, transform: [{ rotate: `${rotate}deg` }] }}
      >
        <View
          style={{
            position: "absolute",
            top: 0,
            left: clip === "right" ? 0 : half,
            width: half,
            height: size,
            backgroundColor: color,
            borderTopLeftRadius: clip === "right" ? half : 0,
            borderBottomLeftRadius: clip === "right" ? half : 0,
            borderTopRightRadius: clip === "left" ? half : 0,
            borderBottomRightRadius: clip === "left" ? half : 0,
          }}
        />
      </View>
    </View>
  );
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", width: size, height: size, borderRadius: half, backgroundColor: c.track }} />
      <Sweep clip="right" rotate={rightDeg} />
      {p > 50 ? <Sweep clip="left" rotate={leftDeg} /> : null}
      <View
        style={{ position: "absolute", width: size - 2 * stroke, height: size - 2 * stroke, borderRadius: (size - 2 * stroke) / 2, backgroundColor: c.surface }}
      />
      <Text className="font-serif" style={{ fontSize: 12, fontWeight: "600", color: c.text }}>
        {score}
      </Text>
    </View>
  );
}

type Acceptance = ProOverview["lastAcceptances"][number];

// Une ligne d'acceptation : avatar initiales (dégradé thémé), nom,
// campagne + icône, badge palier + date de réception, coût, jauge.
function AccRow({ a, last, colors }: { a: Acceptance; last: boolean; colors: readonly [string, string] }) {
  const { c } = useTheme();
  return (
    <View
      className="flex-row items-center"
      style={{
        gap: 13,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.borderSoft,
      }}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}
      >
        <Text className="font-serif" style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF", letterSpacing: 0.3 }}>
          {initialsOf(a.name)}
        </Text>
      </LinearGradient>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text className="font-serif" numberOfLines={1} style={{ fontSize: 16, fontWeight: "600", color: c.text, lineHeight: 18 }}>
          {a.name}
        </Text>
        <View className="flex-row items-center" style={{ gap: 6, marginTop: 4 }}>
          <Ionicons name={iconForCampaign(a.campaign)} size={13} color={c.accViolet} />
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, color: c.textSub }}>
            {a.campaign}
          </Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 8, marginTop: 8 }}>
          <Text
            style={{
              fontSize: 10.5,
              fontWeight: "600",
              color: c.accVioletDeep,
              backgroundColor: c.tintViolet,
              borderWidth: 1,
              borderColor: c.violetSoft,
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 2,
              overflow: "hidden",
            }}
          >
            Palier {a.tier}
          </Text>
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <Ionicons name="time-outline" size={12} color={c.ink4} />
            <Text style={{ fontSize: 11, color: c.ink4 }}>{dateShort(a.receivedAt)}</Text>
          </View>
        </View>
      </View>
      <View className="items-end" style={{ gap: 8 }}>
        <Text className="font-serif" style={{ fontSize: 16, fontWeight: "600", color: c.text, lineHeight: 16 }}>
          −{eur(a.costCents / 100)}
        </Text>
        <ScoreRing score={a.score} />
      </View>
    </View>
  );
}

// Bandeau récapitulatif (dégradé thémé) : Acceptés · Score moyen · Dépensé.
function AccSummary({ items, colors }: { items: Acceptance[]; colors: readonly [string, string] }) {
  const total = items.length;
  const avgScore = total ? Math.round(items.reduce((s, a) => s + a.score, 0) / total) : 0;
  const spent = items.reduce((s, a) => s + a.costCents, 0) / 100;
  const stats: [string, string | number][] = [
    ["Acceptés", total],
    ["Score moyen", avgScore],
    ["Dépensé", eur(spent)],
  ];
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 22, padding: 17, overflow: "hidden" }}
    >
      <View
        pointerEvents="none"
        style={{ position: "absolute", right: -16, top: -20, width: 110, height: 110, borderRadius: 55, backgroundColor: "rgba(255,255,255,0.08)" }}
      />
      <View className="flex-row" style={{ gap: 10 }}>
        {stats.map(([label, value], i) => (
          <View
            key={i}
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.12)" }}
          >
            <Text
              className="font-mono uppercase"
              numberOfLines={1}
              style={{ fontSize: 9.5, fontWeight: "700", letterSpacing: 0.6, color: "rgba(255,255,255,0.72)" }}
            >
              {label}
            </Text>
            <Text className="font-serif" style={{ fontSize: 21, fontWeight: "600", color: "#FFFFFF", marginTop: 4 }}>
              {value}
            </Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

// Légende des paliers de score (BUUPP SCORE) — pastilles colorées.
function ScoreLegend() {
  const { c } = useTheme();
  const items: readonly [string, string][] = [
    ["#3F9056", "≥ 800"],
    ["#7C5CFF", "600–799"],
    ["#E0972F", "< 600"],
  ];
  return (
    <View className="flex-row flex-wrap items-center" style={{ gap: 16, paddingHorizontal: 4 }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color: c.ink4 }}>BUUPP SCORE</Text>
      {items.map(([col, label], i) => (
        <View key={i} className="flex-row items-center" style={{ gap: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: col }} />
          <Text style={{ fontSize: 11.5, color: c.textSub }}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ProOverviewScreen() {
  const q = useProOverview();
  const { c, mode } = useTheme();
  const heroColors = HERO_GRADIENT[mode];
  const [roiInfoOpen, setRoiInfoOpen] = useState(false);

  return (
    <ScrollScreen onRefresh={q.refetch} headerVariant="pro">
      <SectionTitle
        eyebrow="Vue d'ensemble"
        title="Vos 30 derniers jours"
        desc="Contacts acquis, performance et rentabilité estimée de vos campagnes."
      />
      <QueryGate query={q}>
        {(d) => {
          const hasData = d.contactsAccepted30d > 0 || d.activeCampaignsCount > 0;
          const reach =
            d.acceptanceRate > 0
              ? Math.round(d.contactsAccepted30d / (d.acceptanceRate / 100))
              : 0;
          return (
            <>
              {hasData ? (
                <>
                  <RoiHero d={d} colors={heroColors} onInfo={() => setRoiInfoOpen(true)} />
                  <RoiInfoModal d={d} visible={roiInfoOpen} onClose={() => setRoiInfoOpen(false)} />
                </>
              ) : (
                <EmptyHero colors={heroColors} />
              )}

              {/* INDICATEURS */}
              <Text
                className="mt-2 font-mono uppercase"
                style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1.2, color: c.textSub }}
              >
                Indicateurs
              </Text>
              <View className="flex-row flex-wrap justify-between">
                <IndicatorCell
                  icon="people-outline"
                  tintBg={c.tintViolet}
                  iconColor={c.accVioletDeep}
                  label="Contacts acceptés (30j)"
                  value={String(d.contactsAccepted30d)}
                />
                <IndicatorCell
                  icon="trending-up"
                  tintBg={c.tintBlue}
                  iconColor={c.accBlue}
                  label="Taux d'acceptation"
                  value={`${d.acceptanceRate} %`}
                />
                <IndicatorCell
                  icon="pricetag-outline"
                  tintBg={c.tintAmber}
                  iconColor={c.accAmber}
                  label="Coût moyen / contact"
                  value={eur((d.avgCostCents ?? 0) / 100)}
                />
                <IndicatorCell
                  icon="megaphone-outline"
                  tintBg={c.tintCoral}
                  iconColor={c.accCoral}
                  label="Campagnes actives"
                  value={String(d.activeCampaignsCount)}
                />
                <IndicatorCell
                  icon="calendar-outline"
                  tintBg={c.tintGreen}
                  iconColor={c.accGreen}
                  label="Acceptés ce mois"
                  value={String(d.contactsAcceptedThisMonth)}
                />
                <IndicatorCell
                  icon="eye-outline"
                  tintBg={c.tintViolet}
                  iconColor={c.accVioletDeep}
                  label="Vues estimées"
                  value={String(reach)}
                />
              </View>

              {/* DERNIÈRES ACCEPTATIONS */}
              <SectionTitle
                eyebrow="Activité pro"
                title="Dernières acceptations"
                desc="Les prospects qui ont accepté vos campagnes — vous n'êtes débité qu'à l'acceptation."
              />
              {d.lastAcceptances.length === 0 ? (
                <View
                  className="items-center rounded-2xl border p-6"
                  style={{ borderColor: c.borderSoft, backgroundColor: c.surface }}
                >
                  <Ionicons name="people-outline" size={26} color={c.ink4} />
                  <Text className="mt-2 text-center text-sm font-medium text-ink-2">
                    Aucun contact pour l&apos;instant
                  </Text>
                  <Text className="mt-0.5 text-center text-[12px] text-ink-4">
                    Les prospects qui acceptent vos campagnes s&apos;afficheront ici.
                  </Text>
                </View>
              ) : (
                <>
                  <AccSummary items={d.lastAcceptances} colors={heroColors} />
                  <View
                    style={{
                      backgroundColor: c.surface,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: c.borderSoft,
                      overflow: "hidden",
                    }}
                  >
                    {/* En-tête de la carte : nombre + « Voir tout » */}
                    <View
                      className="flex-row items-center justify-between"
                      style={{ paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: c.borderSoft }}
                    >
                      <Text
                        className="uppercase"
                        style={{ fontSize: 11.5, fontWeight: "700", letterSpacing: 1, color: c.textSub }}
                      >
                        Prospects · {d.lastAcceptances.length}
                      </Text>
                      <Pressable
                        onPress={() => router.push("/(pro)/contacts")}
                        accessibilityRole="button"
                        className="flex-row items-center active:opacity-70"
                        style={{ gap: 4 }}
                      >
                        <Text style={{ fontSize: 12.5, fontWeight: "600", color: c.accVioletDeep }}>
                          Voir tout
                        </Text>
                        <Ionicons name="arrow-forward" size={14} color={c.accVioletDeep} />
                      </Pressable>
                    </View>
                    {d.lastAcceptances.map((a, i) => (
                      <AccRow
                        key={i}
                        a={a}
                        last={i === d.lastAcceptances.length - 1}
                        colors={heroColors}
                      />
                    ))}
                  </View>
                  <ScoreLegend />
                </>
              )}
            </>
          );
        }}
      </QueryGate>
    </ScrollScreen>
  );
}
