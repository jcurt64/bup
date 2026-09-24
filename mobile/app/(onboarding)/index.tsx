// Carrousel d'onboarding — 4 slides (intro, pros, buuppers, notifications).
// Illustrations animées dans components/onboarding-art.tsx ; toutes les
// couleurs viennent du thème (BUUPP / Sombre / Forest / Light Fushia), que
// l'on peut d'ailleurs choisir dès ici (pastilles en haut à gauche).
// "Passer" → marque vu + va à l'auth. "Activer les notifications" → idem + push.
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { GridBg } from "../../components/grid-bg";
import {
  BuuppersArt,
  Glow,
  IntroArt,
  NotificationsArt,
  ProsArt,
  withAlpha,
} from "../../components/onboarding-art";
import { Accent, Eyebrow, PrimaryButton } from "../../components/ui";
import { markOnboardingSeen } from "../../lib/onboarding";
import { registerForPushNotifications } from "../../lib/push";
import { useTheme, type ThemeMode } from "../../lib/theme";

type Slide = {
  key: string;
  eyebrow?: string;
  title: React.ReactNode;
  subtitle: string;
  Art: (p: { active: boolean }) => React.ReactNode;
};

const SLIDES: Slide[] = [
  {
    key: "intro",
    eyebrow: "Bienvenue sur BUUPP",
    title: (
      <>
        La publicité, <Accent>équitable.</Accent>
      </>
    ),
    subtitle: "Votre temps, c'est de l'argent — et on vous le prouve.",
    Art: IntroArt,
  },
  {
    key: "pros",
    eyebrow: "Pour les pros",
    title: (
      <>
        Arrêtez de prospecter.{"\n"}
        <Accent>Laissez vos prospects venir.</Accent>
      </>
    ),
    subtitle:
      "Des contacts qui ont déjà accepté de vous parler. Plus de démarchage à froid : vous payez seulement les acceptations.",
    Art: ProsArt,
  },
  {
    key: "buuppers",
    eyebrow: "Pour les buuppers",
    title: (
      <>
        Enfin <Accent>rémunéré</Accent> pour votre attention.
      </>
    ),
    subtitle:
      "Vous choisissez qui peut vous contacter, à quel prix. Aucune donnée n'est transmise avant votre accord.",
    Art: BuuppersArt,
  },
  {
    key: "notifications",
    eyebrow: "Une dernière chose",
    title: (
      <>
        Restez connecté aux <Accent>opportunités.</Accent>
      </>
    ),
    subtitle:
      "On vous prévient dès qu'un pro souhaite vous parler. Pas de spam — uniquement les sollicitations qui rapportent.",
    Art: NotificationsArt,
  },
];

// Pastilles de choix du coloris (mêmes dégradés que le sélecteur de Réglages).
const THEME_SWATCHES: { mode: ThemeMode; label: string; colors: [string, string] }[] = [
  { mode: "light", label: "BUUPP", colors: ["#7C5CFF", "#5B3FE0"] },
  { mode: "dark", label: "Sombre", colors: ["#1A2238", "#0A1628"] },
  { mode: "forest", label: "Forest", colors: ["#2F8D5B", "#1D6B42"] },
  { mode: "fushia", label: "Light Fushia", colors: ["#F25AA0", "#D63B80"] },
];

function ThemeDots() {
  const { mode, setMode, c } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 6,
        padding: 5,
        borderRadius: 999,
        backgroundColor: withAlpha(c.surface, "CC"),
        borderWidth: 1,
        borderColor: c.borderSoft,
      }}
    >
      {THEME_SWATCHES.map((t) => {
        const on = t.mode === mode;
        return (
          <Pressable
            key={t.mode}
            onPress={() => setMode(t.mode)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Thème ${t.label}`}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                padding: 2,
                borderWidth: 2,
                borderColor: on ? c.text : "transparent",
              }}
            >
              <LinearGradient
                colors={t.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1, borderRadius: 999 }}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// Pastille de pagination : s'étire et prend la couleur d'accent quand
// sa slide est au centre (suit le doigt, pas seulement la fin du scroll).
function Dot({
  i,
  scrollX,
  width,
  on,
  off,
}: {
  i: number;
  scrollX: SharedValue<number>;
  width: number;
  on: string;
  off: string;
}) {
  const style = useAnimatedStyle(() => {
    const range = [(i - 1) * width, i * width, (i + 1) * width];
    return {
      width: interpolate(scrollX.value, range, [8, 26, 8], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(scrollX.value, range, [off, on, off]),
    };
  });
  return <Animated.View style={[{ height: 8, borderRadius: 4 }, style]} />;
}

function SlideView({
  item,
  i,
  scrollX,
  width,
  active,
}: {
  item: Slide;
  i: number;
  scrollX: SharedValue<number>;
  width: number;
  active: boolean;
}) {
  const range = [(i - 1) * width, i * width, (i + 1) * width];
  // Parallaxe : l'illustration glisse moins vite que la page et rétrécit
  // légèrement en sortant ; le texte se fond et remonte.
  const artStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(scrollX.value, range, [width * 0.35, 0, -width * 0.35], Extrapolation.CLAMP) },
      { scale: interpolate(scrollX.value, range, [0.9, 1, 0.9], Extrapolation.CLAMP) },
    ],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollX.value, range, [18, 0, 18], Extrapolation.CLAMP) },
    ],
  }));
  const { Art } = item;
  return (
    <View style={{ width }} className="flex-1 justify-end px-6 pb-2">
      <Animated.View style={[{ flex: 1, justifyContent: "center" }, artStyle]}>
        <Art active={active} />
      </Animated.View>
      <Animated.View style={textStyle}>
        <View className="gap-3 pb-6">
          {item.eyebrow ? <Eyebrow>{item.eyebrow}</Eyebrow> : null}
          <Text className="text-center font-serif text-3xl leading-tight text-ink">
            {item.title}
          </Text>
          <Text className="text-center text-lg leading-6 text-ink-3">{item.subtitle}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { c, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const listRef = useAnimatedRef<Animated.FlatList<Slide>>();
  const [index, setIndex] = useState(0);
  const last = SLIDES.length - 1;
  const scrollX = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  // Slide courante déduite de la position réelle (glissé, bouton, web) :
  // bascule dès qu'on a passé la moitié de la page.
  useAnimatedReaction(
    () => Math.round(scrollX.value / Math.max(width, 1)),
    (cur, prev) => {
      if (cur !== prev) runOnJS(setIndex)(cur);
    },
    [width],
  );

  // Apparition de l'écran : fondu + léger glissement, en même temps que la
  // chute du logo.
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [appear]);
  const appearStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: (1 - appear.value) * 12 }],
  }));

  // Halos de fond : dérivent en sens inverse du défilement.
  const total = width * last;
  const glowA = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(scrollX.value, [0, total || 1], [0, -width * 0.6]) },
      { translateY: interpolate(scrollX.value, [0, total || 1], [0, 120]) },
    ],
  }));
  const glowB = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(scrollX.value, [0, total || 1], [0, width * 0.5]) },
      { translateY: interpolate(scrollX.value, [0, total || 1], [0, -90]) },
    ],
  }));

  async function finish() {
    await markOnboardingSeen();
    router.replace("/(auth)/sign-in");
  }

  async function activateThenFinish() {
    // L'inscription push ne doit JAMAIS bloquer la navigation : on l'attend
    // au plus 6 s, puis on enchaîne sur l'écran de connexion quoi qu'il arrive.
    try {
      await Promise.race([
        registerForPushNotifications(getToken),
        new Promise<void>((resolve) => setTimeout(resolve, 6000)),
      ]);
    } catch (e) {
      console.warn("[onboarding] register push failed (silent)", e);
    }
    await finish();
  }

  function next() {
    if (index >= last) return activateThenFinish();
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  }

  const glowColorB = isDark ? c.accent : c.amber;

  return (
    <SafeAreaView className="flex-1 bg-ivory">
      <GridBg opacity={isDark ? 0.25 : 0.35} />
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -120, right: -140 }, glowA]}>
        <Glow size={420} color={c.violet} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 260, left: -170 }, glowB]}>
        <Glow size={380} color={glowColorB} />
      </Animated.View>
      <LinearGradient
        colors={[withAlpha(c.bg, "00"), withAlpha(c.violetSoft, isDark ? "CC" : "FF")]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "40%" }}
      />

      <Animated.View style={appearStyle}>
        <View className="flex-row items-center justify-between px-6 pt-2">
          <ThemeDots />
          {index < last ? (
            <Pressable
              onPress={finish}
              hitSlop={12}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: withAlpha(c.surface, "CC"),
                borderWidth: 1,
                borderColor: c.borderSoft,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: c.textSub }}>Passer</Text>
            </Pressable>
          ) : null}
        </View>
      </Animated.View>

      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: i }) => (
          <SlideView item={item} i={i} scrollX={scrollX} width={width} active={i === index} />
        )}
      />

      <Animated.View style={appearStyle}>
        <View className="px-6 pb-2">
          <View className="flex-row items-center justify-between pb-4">
            <View className="flex-row items-center gap-1.5">
              {SLIDES.map((s, i) => (
                <Dot key={s.key} i={i} scrollX={scrollX} width={width} on={c.violet} off={c.ink5} />
              ))}
            </View>
            <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1.5, color: c.textMuted }}>
              {String(index + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
            </Text>
          </View>
          <PrimaryButton
            label={index >= last ? "Activer les notifications" : index === 0 ? "Découvrir" : "Suivant"}
            arrow
            onPress={next}
          />
          {index >= last ? (
            <Pressable onPress={finish} hitSlop={8} className="items-center pt-3">
              <Text style={{ fontSize: 14, color: c.textSub }}>Plus tard</Text>
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
