// Carrousel d'onboarding — 4 slides fidèles aux maquettes
// buupp-onboarding (1.png intro, 2.png pros, 3.png buuppers, 4.png notifs).
// "Passer" → marque vu + va à l'auth. "Activer les notifications" → idem + push.
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { GridBg } from "../../components/grid-bg";
import { Accent, BrandLogo, Eyebrow, PrimaryButton } from "../../components/ui";
import { markOnboardingSeen } from "../../lib/onboarding";
import { registerForPushNotifications } from "../../lib/push";

type Slide = {
  key: string;
  eyebrow?: string;
  title: React.ReactNode;
  subtitle: string;
  art: React.ReactNode;
};

function MiniCard({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <View
      className={`absolute rounded-2xl bg-paper p-3 ${className}`}
      style={{
        shadowColor: "#13235B",
        shadowOpacity: 0.12,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      {children}
    </View>
  );
}

// Slide 1 : le logo « tombe du ciel » et atterrit au centre avec un
// léger rebond doux (Reanimated).
function IntroArt() {
  const { height } = useWindowDimensions();
  const ty = useSharedValue(-height * 0.75);
  const op = useSharedValue(0);
  useEffect(() => {
    op.value = withTiming(1, { duration: 260 });
    ty.value = withSequence(
      // chute qui accélère (gravité), passe légèrement sous le centre
      withTiming(18, { duration: 560, easing: Easing.in(Easing.cubic) }),
      // remonte et se stabilise au centre avec un rebond doux
      withSpring(0, { damping: 8, stiffness: 130, mass: 0.7 }),
    );
  }, [ty, op]);
  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: ty.value }],
  }));
  return (
    <View className="h-64 w-full items-center justify-center">
      <Animated.View style={style}>
        <BrandLogo />
      </Animated.View>
    </View>
  );
}

// Mockup statique d'une notification BUUPP sur lockscreen — montre au
// prospect ce qu'il recevra. Pas d'animation : volontairement calme
// (la slide elle-même apparaît avec le fondu global de l'écran).
function PhonePushPreview() {
  return (
    <View className="h-64 w-full items-center justify-center">
      <View
        style={{
          width: 280,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 18,
          backgroundColor: "#FFFFFF",
          borderLeftWidth: 4,
          borderLeftColor: "#7C5CFC",
          shadowColor: "#0F1629",
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            backgroundColor: "#EDE9FE",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 22 }}>👋</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "600", fontSize: 14, color: "#0F1629" }}>
            Une nouvelle sollicitation
          </Text>
          <Text
            numberOfLines={2}
            style={{ fontSize: 13, marginTop: 2, color: "#5B6478" }}
          >
            Coiffure Lola · +3,40 € · expire dans 24h
          </Text>
        </View>
      </View>
    </View>
  );
}

const SLIDES: Slide[] = [
  {
    key: "intro",
    title: (
      <>
        La publicité, <Accent>équitable.</Accent>
      </>
    ),
    subtitle: "Votre temps, c'est de l'argent — et on vous le prouve.",
    art: <IntroArt />,
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
      "Des contacts qui ont déjà accepté de vous parler. Plus de cold call, payez seulement les acceptations.",
    art: (
      <View className="h-64 w-full">
        {/* Lignes violettes de connexion (sous la carte score) */}
        <View
          className="absolute left-7 top-40"
          style={{ transform: [{ rotate: "-8deg" }] }}
        >
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              className="mb-1 h-0.5 w-24 rounded-full bg-violet"
              style={{ opacity: 0.35 + i * 0.2 }}
            />
          ))}
        </View>

        {/* Carte Prospect — accepté + prix + barre */}
        <MiniCard className="left-2 top-4">
          <Text className="font-mono text-[9px] uppercase text-ink-4">
            Prospect
          </Text>
          <Text className="text-sm font-medium text-ink">
            Accepté <Text className="text-good">2×</Text>
          </Text>
          <Text className="mt-0.5 font-mono text-[10px] text-ink-4">5,40 €</Text>
          <View className="mt-1.5 h-1 w-16 rounded-full bg-violet" />
        </MiniCard>

        {/* Carte score navy — légèrement inclinée + sous-ligne */}
        <View
          className="absolute left-12 top-20 rounded-2xl bg-navy px-6 py-5"
          style={{
            shadowColor: "#13235B",
            shadowOpacity: 0.4,
            shadowRadius: 18,
            transform: [{ rotate: "-4deg" }],
          }}
        >
          <Text className="font-mono text-[9px] uppercase text-ink-5">
            BUUPP Score
          </Text>
          <Text className="font-serif text-4xl text-paper">742</Text>
          <Text className="mt-1 text-[10px] text-ink-5">
            Marie L. ·{" "}
            <Text className="font-serif-italic text-violet">Recherche</Text>
          </Text>
        </View>

        {/* Carte Ciblage — icône check + sous-titre */}
        <MiniCard className="right-3 top-10">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="checkmark-circle" size={14} color="#7C5CFC" />
            <Text className="text-xs font-semibold text-ink">
              Ciblage par paliers
            </Text>
          </View>
          <Text className="mt-0.5 font-mono text-[9px] text-ink-4">
            consentement clair
          </Text>
        </MiniCard>

        {/* Carte ROI — eyebrow puis valeur + moyenne */}
        <MiniCard className="left-3 bottom-3">
          <Text className="font-mono text-[9px] uppercase text-ink-4">ROI</Text>
          <Text className="font-serif text-lg text-violet">
            ×3.4{" "}
            <Text className="font-mono text-[9px] text-ink-4">en moy.</Text>
          </Text>
        </MiniCard>

        {/* Badge paiement vert */}
        <View
          className="absolute bottom-7 right-6 h-9 w-9 items-center justify-center rounded-full bg-good"
          style={{
            shadowColor: "#16A34A",
            shadowOpacity: 0.4,
            shadowRadius: 10,
          }}
        >
          <Text className="font-serif text-sm text-paper">€</Text>
        </View>
      </View>
    ),
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
    art: (
      <View className="h-64 w-full">
        {/* Notification — une agence */}
        <MiniCard className="left-2 top-3">
          <View className="flex-row items-start gap-2">
            <View className="h-5 w-5 items-center justify-center rounded-full bg-violet">
              <Text className="text-[11px] font-bold text-paper">!</Text>
            </View>
            <View>
              <Text className="text-xs font-medium text-ink">
                Une agence souhaite{"\n"}vous parler.
              </Text>
              <Text className="mt-0.5 font-mono text-[10px] text-ink-4">
                3,20 € · 8 min
              </Text>
            </View>
          </View>
        </MiniCard>

        {/* Gains du mois — carte claire + barres */}
        <View
          className="absolute right-2 top-[72px] rounded-2xl bg-paper px-5 py-4"
          style={{
            shadowColor: "#13235B",
            shadowOpacity: 0.12,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          <Text className="font-serif text-3xl text-ink">
            42<Text className="text-lg text-ink-3">,80 €</Text>
          </Text>
          <Text className="font-mono text-[9px] uppercase text-ink-4">
            ce mois-ci
          </Text>
          <View className="mt-2 flex-row items-end gap-1.5">
            {[10, 14, 11, 18, 13, 24].map((h, i) => (
              <View
                key={i}
                className={`w-2.5 rounded-sm ${
                  i === 5 ? "bg-violet" : "bg-violet-soft"
                }`}
                style={{ height: h }}
              />
            ))}
          </View>
        </View>

        {/* RGPD — carte navy inclinée */}
        <View
          className="absolute right-3 top-4 rounded-2xl bg-navy px-4 py-3"
          style={{
            shadowColor: "#13235B",
            shadowOpacity: 0.4,
            shadowRadius: 16,
            transform: [{ rotate: "5deg" }],
          }}
        >
          <Text className="font-mono text-[9px] uppercase text-ink-5">
            RGPD
          </Text>
          <Text className="text-sm font-medium text-paper">
            Vos données,{"\n"}
            <Text className="font-serif-italic text-violet">à vous.</Text>
          </Text>
        </View>

        {/* Accepté — gain encaissé */}
        <MiniCard className="left-3 bottom-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <View>
              <Text className="text-xs font-medium text-ink">Accepté,</Text>
              <Text className="font-mono text-[10px] text-good">+ 2,10 €</Text>
            </View>
          </View>
        </MiniCard>

        {/* Badge cœur — cercle pointillé */}
        <View
          pointerEvents="none"
          className="absolute bottom-9 right-7 h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-violet"
        >
          <Ionicons name="heart" size={18} color="#7C5CFC" />
        </View>
      </View>
    ),
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
      "On vous prévient dès qu'un pro accepte de vous payer. Pas de spam — uniquement les sollicitations qui rapportent.",
    art: <PhonePushPreview />,
  },
];

export default function Onboarding() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const last = SLIDES.length - 1;

  // Apparition synchronisée (au montage, en même temps que la chute du
  // logo) : fondu + léger glissement vers le haut, easing ease-out.
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [appear]);
  const appearStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: (1 - appear.value) * 12 }],
  }));

  async function finish() {
    await markOnboardingSeen();
    router.replace("/(auth)/sign-in");
  }

  async function activateThenFinish() {
    try {
      await registerForPushNotifications(getToken);
    } catch (e) {
      console.warn("[onboarding] register push failed (silent)", e);
    }
    await finish();
  }

  function next() {
    if (index >= last) return activateThenFinish();
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  return (
    <SafeAreaView className="flex-1 bg-ivory">
      <GridBg />
      <LinearGradient
        colors={["rgba(247,244,236,0)", "#EDE9FE"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "45%",
        }}
      />
      <Animated.View style={appearStyle}>
        <View className="flex-row justify-end px-6 pt-2">
          <Pressable onPress={finish} hitSlop={12}>
            <Text className="text-sm text-ink-4">Passer</Text>
          </Pressable>
        </View>
      </Animated.View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({
          length: width,
          offset: width * i,
          index: i,
        })}
        renderItem={({ item }) => (
          <View style={{ width }} className="flex-1 justify-end px-6 pb-4">
            <View className="flex-1 justify-center">{item.art}</View>
            <Animated.View style={appearStyle}>
              <View className="gap-3 pb-8">
                {item.eyebrow ? <Eyebrow>{item.eyebrow}</Eyebrow> : null}
                <Text className="text-center font-serif text-3xl leading-tight text-ink">
                  {item.title}
                </Text>
                <Text className="text-center text-lg leading-6 text-ink-3">
                  {item.subtitle}
                </Text>
              </View>
            </Animated.View>
          </View>
        )}
      />

      <Animated.View style={appearStyle}>
        <View className="flex-row items-center justify-between px-6 pb-2">
          <View className="flex-row gap-1.5">
            {SLIDES.map((s, i) => (
              <View
                key={s.key}
                className={`h-2 rounded-full ${
                  i === index ? "w-2 bg-ink" : "w-2 bg-ink-5"
                }`}
              />
            ))}
          </View>
          <View className="w-40">
            <PrimaryButton
              label={index >= last ? "Activer les notifications" : "Suivant"}
              arrow
              onPress={next}
            />
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
