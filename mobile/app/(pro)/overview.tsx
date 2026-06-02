// Accueil pro (vue d'ensemble) — /api/pro/overview. Deux états :
//   • VIDE (aucune campagne/acceptation) : carte héros « Lancez votre
//     première campagne » + CTA, indicateurs à 0, acceptations vides.
//   • DONNÉES : carte héros ROI estimé (investi / valeur estimée), grille
//     d'indicateurs, dernières acceptations + « Voir toutes ».
// Carte héros = dégradé thémé (violet buupp ; variantes sombre/forest/fushia).
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

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
function RoiHero({ d, colors }: { d: ProOverview; colors: readonly [string, string] }) {
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
    </LinearGradient>
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

export default function ProOverviewScreen() {
  const q = useProOverview();
  const { c, mode } = useTheme();
  const heroColors = HERO_GRADIENT[mode];

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
                <RoiHero d={d} colors={heroColors} />
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
              <Text
                className="mt-2 font-mono uppercase"
                style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1.2, color: c.textSub }}
              >
                Dernières acceptations
              </Text>
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
                <View
                  className="rounded-2xl border"
                  style={{ borderColor: c.borderSoft, backgroundColor: c.surface }}
                >
                  {d.lastAcceptances.map((a, i) => (
                    <View
                      key={i}
                      className="flex-row items-center justify-between px-4 py-3"
                      style={i > 0 ? { borderTopWidth: 1, borderTopColor: c.borderSoft } : undefined}
                    >
                      <View className="flex-1 pr-3">
                        <Text className="text-[14px] text-ink" numberOfLines={1}>
                          {a.name}
                        </Text>
                        <Text className="text-[11.5px] text-ink-4" numberOfLines={1}>
                          {a.campaign} · Palier {a.tier}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="font-mono text-[12px] text-ink-3">
                          −{eur(a.costCents / 100)}
                        </Text>
                        <Text className="font-mono text-[10px] text-ink-4">
                          {dateShort(a.receivedAt)}
                        </Text>
                      </View>
                    </View>
                  ))}
                  <Pressable
                    onPress={() => router.push("/(pro)/contacts")}
                    accessibilityRole="button"
                    className="flex-row items-center justify-center gap-1.5 px-4 py-3 active:opacity-70"
                    style={{ borderTopWidth: 1, borderTopColor: c.borderSoft }}
                  >
                    <Text className="text-[13px] font-semibold" style={{ color: c.accent }}>
                      Voir toutes les acceptations
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color={c.accent} />
                  </Pressable>
                </View>
              )}
            </>
          );
        }}
      </QueryGate>
    </ScrollScreen>
  );
}
