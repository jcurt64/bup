// Card « Niveau de palier » version ludique (Mes données) : un rang avec
// emoji et nom de niveau, une barre d'XP (champs renseignés) et un chemin
// de 5 étapes façon carte de jeu — chaque palier est une pastille qu'on
// « débloque ». Tap sur une étape → défile jusqu'au palier et l'ouvre.
// Couleurs : accent du thème + couleurs propres à chaque palier (déjà
// déclinées clair/sombre par l'écran appelant).
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import { useTheme } from "../lib/theme";
import { withAlpha } from "./onboarding-art";

export type QuestStep = {
  key: string;
  short: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  tint: string;
  filled: number;
  total: number;
  reached: boolean;
  isHidden: boolean;
};

// Rang selon le nombre de paliers atteints (0 → 5).
const RANKS = [
  { emoji: "🌱", title: "Graine de buupper" },
  { emoji: "🔍", title: "Curieux" },
  { emoji: "🧭", title: "Explorateur" },
  { emoji: "🚀", title: "Aventurier" },
  { emoji: "💎", title: "Expert" },
  { emoji: "🏆", title: "Légende" },
];

export function TierQuest({
  steps,
  reached,
  visibleCount,
  filledFields,
  totalFields,
  onPressStep,
}: {
  steps: QuestStep[];
  reached: number;
  visibleCount: number;
  filledFields: number;
  totalFields: number;
  onPressStep: (key: string) => void;
}) {
  const { c, isDark } = useTheme();
  const rank = RANKS[Math.min(reached, RANKS.length - 1)];
  const allDone = visibleCount > 0 && reached >= visibleCount;
  const xpPct = totalFields === 0 ? 0 : Math.round((filledFields / totalFields) * 100);
  const nextIdx = steps.findIndex((s) => !s.reached && !s.isHidden);
  const next = nextIdx >= 0 ? steps[nextIdx] : null;

  return (
    <View
      style={{
        borderRadius: 24,
        borderWidth: 1,
        borderColor: c.borderSoft,
        backgroundColor: c.surface,
        shadowColor: isDark ? "#000000" : c.navyDeep,
        shadowOpacity: isDark ? 0.4 : 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
    >
      {/* Rognage des coins sur une vue interne : l'ombre de la vue externe reste visible sur iOS (overflow:hidden l'efface), comme sur Android. */}
      <View style={{ borderRadius: 23, overflow: "hidden" }}>
        {/* Voile coloré en haut de carte */}
        <LinearGradient
          colors={[withAlpha(c.violetSoft, isDark ? "CC" : "FF"), withAlpha(c.surface, "00")]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 150 }}
        />

        <View style={{ padding: 18 }}>
          {/* Rang */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Animated.View entering={ZoomIn.springify().damping(11)}>
              <LinearGradient
                colors={[c.violet, c.violetDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ rotate: "-6deg" }],
                }}
              >
                <Text style={{ fontSize: 32 }}>{rank.emoji}</Text>
              </LinearGradient>
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 10.5,
                  letterSpacing: 1.6,
                  fontWeight: "800",
                  color: c.violet,
                  textTransform: "uppercase",
                }}
              >
                Niveau {reached}/{visibleCount}
              </Text>
              <Text className="font-serif" style={{ fontSize: 24, color: c.text, marginTop: 1 }}>
                {rank.title}
              </Text>
              <Text style={{ fontSize: 13, color: c.textSub, marginTop: 2 }}>
                {filledFields}/{totalFields} infos renseignées
              </Text>
            </View>
          </View>

          {/* Barre d'XP */}
          <View style={{ marginTop: 16 }}>
            <View
              style={{
                height: 12,
                borderRadius: 6,
                backgroundColor: c.track,
                overflow: "hidden",
              }}
            >
              <LinearGradient
                colors={[c.violet, isDark ? c.accent : c.violetDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ width: `${Math.max(xpPct, 4)}%`, height: "100%", borderRadius: 6 }}
              />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: c.violet }}>{xpPct} % XP</Text>
              <Text style={{ fontSize: 12, color: c.textSub }}>
                {allDone ? "Tous les paliers débloqués 🎉" : "Plus vous remplissez, plus votre score monte"}
              </Text>
            </View>
          </View>

          {/* Chemin des paliers */}
          <View style={{ marginTop: 20 }}>
            {/* Rail derrière les pastilles (de la 1re à la dernière), rempli
                jusqu'au dernier palier atteint. */}
            <View
              style={{
                position: "absolute",
                top: 23,
                left: 32,
                right: 32,
                height: 3,
                borderRadius: 2,
                backgroundColor: c.track,
              }}
            >
              <View
                style={{
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: c.violet,
                  width:
                    steps.length > 1
                      ? `${(Math.max(0, lastReachedIndex(steps)) / (steps.length - 1)) * 100}%`
                      : 0,
                }}
              />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {steps.map((s, i) => {
                const isNext = i === nextIdx;
                const done = s.reached && s.filled >= s.total && s.total > 0;
                return (
                  <Animated.View
                    key={s.key}
                    entering={ZoomIn.delay(120 + i * 90).springify().damping(12)}
                    style={{ alignItems: "center", width: 64 }}
                  >
                    <Pressable
                      onPress={() => onPressStep(s.key)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Palier ${i + 1} ${s.short} : ${s.filled} sur ${s.total}`}
                      className="active:opacity-70"
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: s.isHidden
                            ? c.surface2
                            : s.reached
                              ? s.accent
                              : c.surface,
                          borderWidth: s.reached ? 0 : 2,
                          borderStyle: isNext ? "dashed" : "solid",
                          borderColor: isNext ? s.accent : c.borderSoft,
                          shadowColor: s.reached ? s.accent : "transparent",
                          shadowOpacity: s.reached ? 0.45 : 0,
                          shadowRadius: 8,
                          shadowOffset: { width: 0, height: 3 },
                          elevation: s.reached ? 4 : 0,
                        }}
                      >
                        <Ionicons
                          name={s.isHidden ? "eye-off-outline" : s.reached ? s.icon : "lock-closed"}
                          size={20}
                          color={s.isHidden ? c.textMuted : s.reached ? "#FFFFFF" : isNext ? s.accent : c.textMuted}
                        />
                      </View>
                      {done ? (
                        <View
                          style={{
                            position: "absolute",
                            top: -3,
                            right: -3,
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: "#F2B65A",
                            borderWidth: 2,
                            borderColor: c.surface,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons name="star" size={9} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </Pressable>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        fontWeight: "700",
                        color: s.reached || isNext ? c.text : c.textSub,
                      }}
                    >
                      {s.short}
                    </Text>
                    <Text style={{ fontSize: 10.5, color: s.reached ? s.accent : c.textMuted, fontWeight: "600" }}>
                      {s.filled}/{s.total}
                    </Text>
                  </Animated.View>
                );
              })}
            </View>
          </View>

          {/* Prochaine quête */}
          {next ? (
            <Animated.View entering={FadeInDown.delay(600)}>
              <Pressable
                onPress={() => onPressStep(next.key)}
                className="active:opacity-80"
                style={{
                  marginTop: 18,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: next.tint,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: c.surface,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={next.icon} size={18} color={next.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 1, color: next.accent }}>
                    PROCHAINE ÉTAPE
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: c.text, marginTop: 1 }}>
                    Débloquez « {next.short} »
                  </Text>
                </View>
                <Ionicons name="arrow-forward-circle" size={26} color={next.accent} />
              </Pressable>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function lastReachedIndex(steps: QuestStep[]) {
  let last = -1;
  steps.forEach((s, i) => {
    if (s.reached) last = i;
  });
  return last;
}
