// Niveaux de vérification — /api/prospect/verification.
// Parité Prospect.jsx fn VerifTiers (web) : on parle de « niveau » (et non
// de « palier ») pour éviter la confusion avec les paliers de données 1 à 5
// de « Mes données ». Bannière du niveau actuel (« X % débloqué »), frise
// 1-2-3, cartes par niveau avec avantages débloqués.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Card, dateFr, QueryGate, ScrollScreen } from "../../components/screen";
import { useProspectVerification } from "../../lib/queries";
import { useTheme } from "../../lib/theme";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

// Clés = valeurs renvoyées par /api/prospect/verification. Libellés, textes
// et avantages EXACTS = Prospect.jsx VERIF_TIERS + VERIF_META (web).
const TIERS = [
  {
    key: "basique",
    label: "Basique",
    done: "Compte créé",
    icon: "person-outline" as const,
    full: "Compte créé. Niveau attribué automatiquement à l'inscription.",
    perks: ["Accès aux campagnes standard", "Paliers 1 et 2"],
    soft: "#EEF2FF",
    fg: "#4F46E5",
    dark: ["#334155", "#1E293B"] as const,
    banner: "Niveau de départ — vérifiez votre téléphone pour débloquer plus de campagnes.",
  },
  {
    key: "verifie",
    label: "Vérifié",
    done: "Téléphone vérifié",
    icon: "call-outline" as const,
    full: "Numéro de téléphone vérifié par SMS.",
    perks: ["Demandes mieux rémunérées", "Paliers 1 à 4"],
    soft: "#ECFDF5",
    fg: "#15803D",
    dark: ["#4F46E5", "#4338CA"] as const,
    banner: "Votre téléphone est vérifié — la plupart des campagnes vous sont ouvertes.",
  },
  {
    key: "certifie_confiance",
    label: "Certifié confiance",
    done: "Rendez-vous physique accepté",
    icon: "shield-checkmark-outline" as const,
    full: "Rendez-vous physique accepté.",
    perks: ["Toutes les campagnes ouvertes", "Tous les paliers · 1 à 5"],
    soft: "#EEF2FF",
    fg: "#4F46E5",
    dark: ["#166534", "#143C1E"] as const,
    banner:
      "Vous bénéficiez du niveau de confiance maximal — toutes les campagnes vous sont ouvertes.",
  },
] as const;

export default function Verification() {
  const { c, isDark } = useTheme();
  const q = useProspectVerification();
  useRefetchOnFocus(q);
  return (
    <ScrollScreen
      onRefresh={q.refetch}
      hero={{
        eyebrow: "Niveau de vérification",
        title: "Vos niveaux",
        desc: "Trois niveaux : Basique (à la création), Vérifié (numéro de téléphone vérifié par SMS), Certifié confiance (rendez-vous physique accepté). Chaque niveau débloque des demandes plus exigeantes et mieux rémunérées.",
        nav: "drawer",
      }}
    >
      <QueryGate query={q}>
        {(d) => {
          const currentIdx = Math.max(0, TIERS.findIndex((t) => t.key === d.tier));
          const current = TIERS[currentIdx];
          const pct = Math.round(((currentIdx + 1) / TIERS.length) * 100);
          const fill = currentIdx / (TIERS.length - 1);
          return (
            <>
              {/* Bannière du niveau actuel (dégradé propre au niveau). */}
              <View style={{ borderRadius: 24, overflow: "hidden" }}>
                <LinearGradient
                  colors={current.dark}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ padding: 20 }}
                >
                  <View className="flex-row items-start gap-3.5">
                    <View
                      className="h-12 w-12 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
                    >
                      <Ionicons name="shield-checkmark-outline" size={24} color="#fff" />
                    </View>
                    <View className="flex-1">
                      <Text
                        className="font-mono text-[10px] uppercase"
                        style={{ letterSpacing: 1.4, color: "rgba(255,255,255,0.6)" }}
                      >
                        Votre niveau actuel
                      </Text>
                      <View className="mt-1 flex-row flex-wrap items-center gap-2">
                        <Text className="font-serif text-2xl text-white">{current.label}</Text>
                        <View
                          className="rounded-full px-2.5 py-1"
                          style={{ borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}
                        >
                          <Text
                            className="font-mono text-[12px]"
                            style={{ color: "rgba(255,255,255,0.85)" }}
                          >
                            Niveau {currentIdx + 1}/{TIERS.length}
                          </Text>
                        </View>
                      </View>
                      <Text
                        className="mt-1.5 text-[13.5px] leading-5"
                        style={{ color: "rgba(255,255,255,0.72)" }}
                      >
                        {current.banner}
                      </Text>
                    </View>
                  </View>
                  <View
                    className="mt-4 flex-row items-center justify-between pt-3"
                    style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.14)" }}
                  >
                    <Text
                      className="font-mono text-[10px] uppercase"
                      style={{ letterSpacing: 1.4, color: "rgba(255,255,255,0.6)" }}
                    >
                      Statut
                    </Text>
                    <Text className="font-serif text-xl text-white">{pct} % débloqué</Text>
                  </View>
                </LinearGradient>
              </View>

              {/* Frise 1 → 2 → 3 */}
              <Card>
                <View style={{ position: "relative" }}>
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: 18,
                      left: "16.66%",
                      right: "16.66%",
                      height: 3,
                      borderRadius: 999,
                      backgroundColor: c.track,
                    }}
                  />
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: 18,
                      left: "16.66%",
                      width: `${fill * 66.67}%`,
                      height: 3,
                      borderRadius: 999,
                      backgroundColor: c.accent,
                    }}
                  />
                  <View className="flex-row">
                    {TIERS.map((t, i) => {
                      const reached = i <= currentIdx;
                      return (
                        <View key={t.key} className="flex-1 items-center px-1">
                          <View
                            className="h-10 w-10 items-center justify-center rounded-full"
                            style={{
                              backgroundColor: reached ? c.accent : c.surface,
                              borderWidth: 2,
                              borderColor: reached ? c.accent : c.borderSoft,
                            }}
                          >
                            {i < currentIdx ? (
                              <Ionicons name="checkmark" size={17} color="#fff" />
                            ) : (
                              <Text
                                className="font-mono text-[13px] font-semibold"
                                style={{ color: reached ? "#fff" : c.textMuted }}
                              >
                                {i + 1}
                              </Text>
                            )}
                          </View>
                          <Text
                            className="mt-2.5 text-center text-[13px] font-semibold"
                            style={{ color: reached ? c.text : c.textMuted }}
                          >
                            {t.label}
                          </Text>
                          <Text className="mt-0.5 text-center font-mono text-[10.5px] text-ink-4">
                            {t.done}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </Card>

              {/* Les 3 niveaux en cartes */}
              {TIERS.map((t, i) => {
                const reached = i <= currentIdx;
                const isCurrent = i === currentIdx;
                return (
                  <View
                    key={t.key}
                    className="rounded-3xl bg-paper p-5"
                    style={{
                      borderWidth: isCurrent ? 1.5 : 0.7,
                      borderColor: isCurrent ? c.accent : c.borderSoft,
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text
                        className="font-mono text-[10px] uppercase text-ink-4"
                        style={{ letterSpacing: 1.4 }}
                      >
                        Niveau {i + 1}
                      </Text>
                      {reached ? (
                        <View
                          className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
                          style={{ backgroundColor: c.goodSoft }}
                        >
                          <Ionicons name="checkmark" size={11} color={c.good} />
                          <Text className="text-[11px] font-semibold" style={{ color: c.good }}>
                            Validé
                          </Text>
                        </View>
                      ) : (
                        <View className="rounded-full bg-ivory px-2.5 py-1">
                          <Text className="text-[11px] font-semibold text-ink-3">À venir</Text>
                        </View>
                      )}
                    </View>
                    <View
                      className="mt-3.5 h-11 w-11 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: isCurrent
                          ? c.accent
                          : isDark
                            ? "rgba(255,255,255,0.08)"
                            : t.soft,
                      }}
                    >
                      <Ionicons name={t.icon} size={21} color={isCurrent ? "#fff" : t.fg} />
                    </View>
                    <Text className="mt-3 font-serif text-2xl text-ink">{t.label}</Text>
                    <Text className="mt-1.5 text-[13px] leading-5 text-ink-3">{t.full}</Text>
                    <View
                      className="mt-3.5 gap-2 pt-3.5"
                      style={{ borderTopWidth: 1, borderTopColor: c.borderSoft }}
                    >
                      {t.perks.map((p) => (
                        <View key={p} className="flex-row items-center gap-2">
                          <Ionicons name="checkmark" size={15} color={c.good} />
                          <Text className="text-[13px] text-ink-2">{p}</Text>
                        </View>
                      ))}
                      {isCurrent ? (
                        <View className="mt-0.5 flex-row items-center gap-2">
                          <View
                            style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: c.accent }}
                          />
                          <Text
                            className="font-mono text-[11px] uppercase"
                            style={{ letterSpacing: 1.1, color: c.accent }}
                          >
                            Niveau actuel
                          </Text>
                        </View>
                      ) : null}
                      {/* CTA niveau Vérifié = vérification du téléphone par SMS,
                          qui se fait dans « Mes données » (palier Identification),
                          comme sur le web (bupp:goto-tab → donnees). */}
                      {!reached && t.key === "verifie" ? (
                        <Pressable
                          className="mt-1.5 flex-row items-center gap-1.5 self-start rounded-full bg-ink px-4 py-2.5 active:opacity-80"
                          onPress={() => router.push("/(prospect)/donnees")}
                        >
                          <Text className="text-[13px] font-semibold text-paper">
                            Vérifier mon téléphone
                          </Text>
                          <Ionicons name="arrow-forward" size={13} color={c.paper} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}

              {/* Coordonnées bancaires (affichage seul — le RIB n'intervient
                  pas dans le niveau de vérification). */}
              <Card badge={{ icon: "card-outline", tone: "teal" }}>
                <Text className="font-serif text-lg text-ink">Coordonnées bancaires</Text>
                {d.rib ? (
                  <View className="mt-1">
                    <Text className="text-sm text-ink-2">{d.rib.ibanMasked}</Text>
                    <Text className="text-xs text-ink-4">
                      {d.rib.holderName} · {d.rib.bic}
                    </Text>
                    <Text className="mt-1 text-xs text-ink-4">
                      {d.rib.validated
                        ? `Validé le ${dateFr(d.rib.validatedAt)}`
                        : "En attente de validation"}
                    </Text>
                  </View>
                ) : (
                  <Text className="mt-1 text-sm text-ink-4">
                    Aucun RIB enregistré — ajoutez-le dans Préférences.
                  </Text>
                )}
              </Card>

              {/* Acceptations physiques (niveau Certifié confiance) */}
              <Card badge={{ icon: "checkmark-circle-outline", tone: "teal" }}>
                <Text className="font-serif text-lg text-ink">
                  Acceptations physiques
                </Text>
                <Text className="mt-1 font-serif text-2xl text-violet">
                  {d.physicalAcceptances}
                </Text>
                <Text className="mt-0.5 text-[11px] text-ink-4">rendez-vous physiques acceptés</Text>
              </Card>
            </>
          );
        }}
      </QueryGate>
    </ScrollScreen>
  );
}
