// Créer une campagne — point d'entrée. Si un brouillon de campagne existe,
// on REDIRIGE directement vers le wizard à l'étape sauvegardée (le pro
// retombe là où il s'était arrêté). Sinon : grille des 7 objectifs (2 col.).
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { BuuppLoader } from "../../components/loader";
import { Card, eur, QueryGate, ScrollScreen } from "../../components/screen";
import { loadDraft } from "../../lib/campaign-draft";
import { shade, withAlpha } from "../../lib/color";
import { OBJECTIVES } from "../../lib/pro-objectives";
import { useProPlan, useProWallet } from "../../lib/queries";
import { useTheme } from "../../lib/theme";

export default function ProCreation() {
  const { c, isDark } = useTheme();
  // Une couleur par objectif (familles de la palette du thème).
  const palette = [c.accViolet, c.accBlue, c.accCoral, c.accGreen, c.accAmber, c.accVioletDeep, c.accBlue];
  const wallet = useProWallet();
  const plan = useProPlan();
  // `checking` : on attend la lecture du brouillon avant de décider quoi
  // afficher (évite un flash de la grille avant la redirection).
  const [checking, setChecking] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setChecking(true);
      loadDraft().then((d) => {
        if (!alive) return;
        if (d) {
          // Brouillon en cours → on reprend à l'étape mémorisée.
          router.replace(`/(pro)/objectif?id=${d.objectiveId}` as never);
        } else {
          setChecking(false);
        }
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  if (checking) {
    return (
      <ScrollScreen headerVariant="pro" hero={{ eyebrow: "Nouvelle campagne", title: "Créer une campagne" }}>
        <View className="items-center py-16">
          <BuuppLoader />
        </View>
      </ScrollScreen>
    );
  }

  return (
    <ScrollScreen
      headerVariant="pro"
      hero={{
        eyebrow: "Nouvelle campagne",
        title: "Créer une campagne",
        desc: "Ciblez des prospects qualifiés — vous ne payez que les acceptations.",
      }}
    >
      {/* Contexte réel : crédit + plan. */}
      <View className="flex-row gap-3">
        <QueryGate query={wallet}>
          {(w) => (
            <Card className="flex-1">
              <Text className="font-mono text-[11px] uppercase text-ink-4" style={{ letterSpacing: 1 }}>
                Crédit disponible
              </Text>
              <Text className="mt-1 font-serif text-2xl text-ink">
                {eur(w.walletAvailableEur)}
              </Text>
            </Card>
          )}
        </QueryGate>
        <QueryGate query={plan}>
          {(p) => (
            <Card className="flex-1">
              <Text className="font-mono text-[11px] uppercase text-ink-4" style={{ letterSpacing: 1 }}>
                Plan {p.label}
              </Text>
              <Text className="mt-1 font-serif text-2xl text-ink">
                {p.cycleCount}/{p.cap}
              </Text>
              <Text className="text-[11px] text-ink-4">campagnes ce cycle</Text>
            </Card>
          )}
        </QueryGate>
      </View>

      <Text className="mt-2 text-[11px] font-bold uppercase text-ink-4" style={{ letterSpacing: 1.2 }}>
        Choisissez un objectif
      </Text>

      {/* Grille 2 colonnes — tuiles colorées (1 couleur par objectif),
          pictogramme en filigrane, apparition en cascade. */}
      <View className="flex-row flex-wrap justify-between">
        {OBJECTIVES.map((o, i) => {
          const col = palette[i % palette.length];
          return (
            <Animated.View
              key={o.id}
              entering={ZoomIn.delay(120 + i * 60).springify().damping(14)}
              style={{ width: "48%", marginBottom: 12 }}
            >
              <Pressable
                onPress={() => router.push(`/(pro)/objectif?id=${o.id}` as never)}
                accessibilityRole="button"
                accessibilityLabel={o.name}
                className="active:opacity-80"
                style={{
                  borderRadius: 24,
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: withAlpha(col, "38"),
                  shadowColor: isDark ? "#000000" : col,
                  shadowOpacity: isDark ? 0.3 : 0.12,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 3,
                }}
              >
                <View style={{ borderRadius: 23, overflow: "hidden", padding: 16, minHeight: 150 }}>
                  <LinearGradient
                    colors={[withAlpha(col, isDark ? "33" : "22"), withAlpha(c.surface, "00")]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                  />
                  <View
                    pointerEvents="none"
                    style={{ position: "absolute", right: -16, bottom: -18, opacity: 0.1, transform: [{ rotate: "-14deg" }] }}
                  >
                    <Ionicons name={o.icon} size={92} color={col} />
                  </View>
                  <LinearGradient
                    colors={[shade(col, 0.1), shade(col, -0.25)]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 15,
                      alignItems: "center",
                      justifyContent: "center",
                      transform: [{ rotate: "-6deg" }],
                    }}
                  >
                    <Ionicons name={o.icon} size={22} color="#FFFFFF" />
                  </LinearGradient>
                  <Text className="mt-3 font-serif text-[16px] leading-5 text-ink">{o.name}</Text>
                  <View
                    className="mt-2 flex-row items-center self-start"
                    style={{ gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: withAlpha(col, "1F") }}
                  >
                    <Ionicons name="apps" size={10} color={col} />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: col }}>
                      {o.sub.length} opération{o.sub.length > 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </ScrollScreen>
  );
}
