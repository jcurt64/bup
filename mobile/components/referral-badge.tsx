// components/referral-badge.tsx
// Badge couronne de parrainage (pastille LinearGradient cliquable sur le hero)
// + popup « Programme parrainage » (cf. public/prototype/pa.pdf) :
// en-tête fondateur + stepper Bronze/Argent/Or + 3 cards paliers (palier
// courant mis en avant) + carte CTA + bouton Fermer. Design only — aucune
// donnée backend changée (réutilise tier / founderNumber / filleulCount).
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useTheme } from "../lib/theme";

export type BadgeTier = "cuivre" | "argent" | "or";

const TIER_GRADIENT: Record<BadgeTier, [string, string]> = {
  cuivre: ["#D08B4F", "#8C5A2B"],
  argent: ["#D9DCE1", "#8A8F98"],
  or: ["#E8C767", "#B8860B"],
};

// Palette du popup (cf. pa.pdf).
const VIOLET = "#7C5CFC";
const VIOLET_DEEP = "#5B3FE0";
// Bordure lavande du popup en mode clair (basculée sur c.violetSoft en sombre).
const VIOLET_BORDER = "#D5C8F7";
// Pastille navy de l'en-tête (couleur de marque, identique dans les 2 modes).
const NAVY = "#0F1629";
// Doré « Golden Buupper » en mode clair (basculé sur c.gold en sombre).
const GOLD = "#E0972F";

const TIER_ORDER: BadgeTier[] = ["cuivre", "argent", "or"];

type TierInfo = {
  tier: BadgeTier;
  n: number;
  label: string;
  range: string;
  eyebrow: string;
  body: string;
  grad: [string, string];
  num: string;
};

const TIER_INFO: TierInfo[] = [
  {
    tier: "cuivre",
    n: 1,
    label: "Bronze",
    range: "1–2 filleuls",
    eyebrow: "BONUS PARRAIN",
    body: "50 % des BUUPP coins à chaque acceptation de chaque filleul, sans limite de durée.",
    grad: ["#DBA463", "#9A6630"],
    num: "#7A4A12",
  },
  {
    tier: "argent",
    n: 2,
    label: "Argent",
    range: "3–9 filleuls",
    eyebrow: "ACCÈS PRIORITAIRE",
    body: "Tous les avantages Bronze, plus l’accès aux offres flash 20 min avant tout le monde.",
    grad: ["#E4E7EC", "#A7AEB8"],
    num: "#5A6068",
  },
  {
    tier: "or",
    n: 3,
    label: "Or",
    range: "10 filleuls",
    eyebrow: "GOVERNOR · DROIT DE VOTE",
    body: "Tous les avantages, et vous êtes consulté·e par BUUPP sur les nouveautés.",
    grad: ["#EFCB69", "#C08A2A"],
    num: "#7A5310",
  },
];

// Pastille couronne (déclencheur sur le hero + petit usage).
function CrownPill({ tier, size = 22 }: { tier: BadgeTier; size?: number }) {
  return (
    <LinearGradient
      colors={TIER_GRADIENT[tier]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.55 }}>👑</Text>
    </LinearGradient>
  );
}

// Stepper Bronze → Argent → Or : nœud passé = pastille pleine + ✓, nœud
// courant = cercle blanc à liseré violet + numéro, nœud à venir = cercle vide.
function Stepper({ currentIndex }: { currentIndex: number }) {
  const { c } = useTheme();
  return (
    <View>
      <View style={{ height: 34, justifyContent: "center" }}>
        {/* Track derrière les nœuds (2 segments). */}
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            flexDirection: "row",
            gap: 0,
          }}
        >
          <View
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: currentIndex >= 1 ? VIOLET : c.track,
            }}
          />
          <View
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: currentIndex >= 2 ? VIOLET : c.track,
            }}
          />
        </View>
        {/* Nœuds */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {TIER_INFO.map((info, i) => {
            if (i < currentIndex) {
              return (
                <LinearGradient
                  key={info.tier}
                  colors={info.grad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="checkmark" size={17} color="#fff" />
                </LinearGradient>
              );
            }
            if (i === currentIndex) {
              return (
                <View
                  key={info.tier}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    backgroundColor: c.surface,
                    borderWidth: 2.5,
                    borderColor: VIOLET,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: VIOLET,
                    shadowOpacity: 0.25,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 2,
                  }}
                >
                  <Text style={{ fontSize: 13.5, fontWeight: "700", color: VIOLET }}>
                    {info.n}
                  </Text>
                </View>
              );
            }
            return (
              <View
                key={info.tier}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  backgroundColor: c.surface,
                  borderWidth: 2,
                  borderColor: c.track,
                }}
              />
            );
          })}
        </View>
      </View>
      {/* Libellés */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 8,
        }}
      >
        {TIER_INFO.map((info, i) => (
          <Text
            key={info.tier}
            style={{
              fontSize: 13,
              fontWeight: i === currentIndex ? "700" : "500",
              color: i === currentIndex ? VIOLET : c.textMuted,
            }}
          >
            {info.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

// Médaillon numéroté d'une card palier.
function Medallion({ info }: { info: TierInfo }) {
  return (
    <LinearGradient
      colors={info.grad}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: 44,
        height: 44,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#0F1629",
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
      }}
    >
      <Text className="font-serif" style={{ fontSize: 19, fontWeight: "700", color: info.num }}>
        {info.n}
      </Text>
    </LinearGradient>
  );
}

export function ReferralBadge({
  tier,
  founderNumber,
  filleulCount = 0,
}: {
  tier: BadgeTier;
  founderNumber: number | null;
  filleulCount?: number;
}) {
  const { c, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const currentIndex = Math.max(0, TIER_ORDER.indexOf(tier));
  const remainingToOr = Math.max(0, 10 - filleulCount);
  const isOr = tier === "or";

  return (
    <>
      <Pressable
        accessibilityLabel="Votre badge de parrainage"
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        hitSlop={8}
      >
        <CrownPill tier={tier} size={22} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
        >
          {/* Scrim : calque absolu DERRIÈRE la card (frère, pas parent) — un
              tap/scroll sur la card ne peut donc jamais déclencher la
              fermeture ; seul un tap sur le fond sombre ferme. */}
          <Pressable
            onPress={() => setOpen(false)}
            accessibilityLabel="Fermer"
            style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,22,40,0.45)" }]}
          />
          <View
            style={{
              width: "100%",
              maxWidth: 440,
              // Hauteur DÉFINIE (pas maxHeight) : indispensable pour qu'une
              // ScrollView en flex:1 soit bornée et scrolle (même pattern que
              // BottomSheet). maxHeight seul laisse la ScrollView prendre la
              // hauteur de son contenu → pas de scroll.
              height: "90%",
              borderRadius: 26,
              overflow: "hidden",
            }}
          >
            {/* Dégradé en fond absolu (n'influe pas sur la layout). */}
            <LinearGradient
              colors={isDark ? [c.surface, c.bg] : ["#EDE9F8", "#F7F4EC"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 18, gap: 14 }}
            >
                {/* En-tête : icône navy + couronne or, eyebrow + titre, pill filleuls */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      backgroundColor: NAVY,
                      alignItems: "center",
                      justifyContent: "center",
                      shadowColor: NAVY,
                      shadowOpacity: 0.25,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 6 },
                      elevation: 5,
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>👑</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontSize: 10.5,
                        fontWeight: "700",
                        letterSpacing: 1.3,
                        textTransform: "uppercase",
                        color: VIOLET,
                      }}
                    >
                      Programme parrainage
                    </Text>
                    <Text className="font-serif" style={{ fontSize: 24, color: c.text, marginTop: 1 }}>
                      {founderNumber != null ? `Fondateur #${founderNumber}` : "Parrainage"}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingVertical: 7,
                      paddingHorizontal: 13,
                      borderRadius: 999,
                      backgroundColor: c.tintViolet,
                      borderWidth: 1,
                      borderColor: isDark ? c.violetSoft : VIOLET_BORDER,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: VIOLET }}>
                      <Text style={{ fontWeight: "700" }}>{filleulCount}</Text> filleuls
                    </Text>
                  </View>
                </View>

                {/* Carte progression : stepper + message */}
                <View
                  style={{
                    backgroundColor: c.tintViolet,
                    borderRadius: 22,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: isDark ? c.violetSoft : "#E5DDF8",
                  }}
                >
                  <Stepper currentIndex={currentIndex} />
                  <View
                    style={{
                      marginTop: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 11,
                      backgroundColor: c.surface,
                      borderRadius: 14,
                      padding: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        backgroundColor: c.tintViolet,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="trending-up" size={16} color={VIOLET} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: c.text }}>
                      {isOr ? (
                        <>
                          Vous avez atteint le palier{" "}
                          <Text style={{ fontWeight: "700" }}>Or</Text> — vous êtes{" "}
                          <Text style={{ fontWeight: "700" }}>Governor</Text>.
                        </>
                      ) : (
                        <>
                          Plus que{" "}
                          <Text style={{ fontWeight: "700", color: VIOLET }}>
                            {remainingToOr} filleuls
                          </Text>{" "}
                          pour atteindre le palier{" "}
                          <Text style={{ fontWeight: "700" }}>Or</Text> et devenir{" "}
                          <Text style={{ fontWeight: "700" }}>Governor</Text>.
                        </>
                      )}
                    </Text>
                  </View>
                </View>

                {/* Cards paliers */}
                {TIER_INFO.map((info) => {
                  const isCurrent = info.tier === tier;
                  return (
                    <View
                      key={info.tier}
                      style={{
                        position: "relative",
                        borderRadius: 18,
                        padding: 16,
                        backgroundColor: isCurrent ? c.tintViolet : c.surface,
                        borderWidth: isCurrent ? 1.5 : 1,
                        borderColor: isCurrent ? (isDark ? c.violetSoft : VIOLET_BORDER) : c.borderSoft,
                        ...(isCurrent
                          ? {}
                          : {
                              shadowColor: "#0F1629",
                              shadowOpacity: 0.05,
                              shadowRadius: 10,
                              shadowOffset: { width: 0, height: 4 },
                              elevation: 2,
                            }),
                      }}
                    >
                      {isCurrent ? (
                        <View
                          style={{
                            position: "absolute",
                            top: -11,
                            right: 14,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5,
                            paddingVertical: 4,
                            paddingHorizontal: 10,
                            borderRadius: 999,
                            backgroundColor: VIOLET,
                          }}
                        >
                          <View
                            style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: "#fff" }}
                          />
                          <Text
                            style={{
                              fontSize: 10.5,
                              fontWeight: "700",
                              letterSpacing: 0.4,
                              color: "#fff",
                            }}
                          >
                            VOTRE PALIER
                          </Text>
                        </View>
                      ) : null}

                      <View style={{ flexDirection: "row", gap: 13 }}>
                        <Medallion info={info} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View
                            style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}
                          >
                            <Text className="font-serif" style={{ fontSize: 19, color: c.text }}>
                              {info.label}
                            </Text>
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: "600",
                                color: isCurrent ? VIOLET : c.textMuted,
                              }}
                            >
                              {info.range}
                            </Text>
                          </View>
                          <Text
                            style={{
                              marginTop: 5,
                              fontSize: 11,
                              fontWeight: "700",
                              letterSpacing: 0.6,
                              color: isCurrent ? VIOLET : c.text,
                            }}
                          >
                            {info.eyebrow}
                          </Text>
                          <Text
                            style={{ marginTop: 6, fontSize: 13.5, lineHeight: 19, color: c.textSub }}
                          >
                            {info.body}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}

                {/* CTA */}
                <View
                  style={{
                    backgroundColor: c.tintViolet,
                    borderRadius: 18,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: isDark ? c.violetSoft : "#E5DDF8",
                  }}
                >
                  <Text style={{ fontSize: 14, lineHeight: 21, color: c.text }}>
                    Parrainez des prospects pour monter de palier et devenir un{" "}
                    <Text style={{ fontWeight: "700", color: isDark ? c.gold : GOLD }}>Golden Buupper</Text>.
                    Votre lien se trouve dans l’onglet Parrainage.
                  </Text>
                  <Pressable
                    onPress={() => {
                      setOpen(false);
                      router.push("/(prospect)/parrainage");
                    }}
                    style={{ marginTop: 14, borderRadius: 14, overflow: "hidden" }}
                  >
                    <LinearGradient
                      colors={[VIOLET, VIOLET_DEEP]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        paddingVertical: 15,
                      }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
                        Voir mon lien de parrainage
                      </Text>
                      <Ionicons name="chevron-forward" size={17} color="#fff" />
                    </LinearGradient>
                  </Pressable>
                </View>

                {/* Fermer */}
                <Pressable
                  onPress={() => setOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Fermer"
                  style={{
                    alignItems: "center",
                    borderRadius: 16,
                    paddingVertical: 16,
                    backgroundColor: c.surface,
                    borderWidth: 1,
                    borderColor: c.borderSoft,
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>Fermer</Text>
                </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
