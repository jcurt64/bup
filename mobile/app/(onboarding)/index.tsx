// Carrousel d'onboarding — 3 slides fidèles aux maquettes
// buupp-onboarding (1.png intro, 2.png pros, 3.png buuppers).
// "Passer" ou "Commencer" → marque vu + va à l'auth.
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { Accent, BrandPill, Eyebrow, PrimaryButton } from "../../components/ui";
import { markOnboardingSeen } from "../../lib/onboarding";

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

const SLIDES: Slide[] = [
  {
    key: "intro",
    title: (
      <>
        La publicité, <Accent>équitable.</Accent>
      </>
    ),
    subtitle: "Votre temps, c'est de l'argent — et vous le prouvez.",
    art: (
      <View className="h-64 items-center justify-center">
        <BrandPill />
      </View>
    ),
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
        <MiniCard className="left-2 top-4">
          <Text className="font-mono text-[9px] uppercase text-ink-4">
            Prospect
          </Text>
          <Text className="text-sm font-medium text-ink">Accepté · 2×</Text>
        </MiniCard>
        <View
          className="absolute left-12 top-20 rounded-2xl bg-navy px-6 py-5"
          style={{ shadowColor: "#13235B", shadowOpacity: 0.4, shadowRadius: 18 }}
        >
          <Text className="font-mono text-[9px] uppercase text-ink-5">
            BUUPP Score
          </Text>
          <Text className="font-serif text-4xl text-paper">742</Text>
        </View>
        <MiniCard className="right-3 top-10">
          <Text className="text-xs font-medium text-ink">
            Ciblage par filtres
          </Text>
        </MiniCard>
        <MiniCard className="left-3 bottom-3">
          <Text className="font-serif text-lg text-violet">×3.4</Text>
          <Text className="font-mono text-[9px] uppercase text-ink-4">ROI</Text>
        </MiniCard>
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
        <MiniCard className="left-2 top-3">
          <Text className="text-xs font-medium text-ink">
            Une agence souhaite vous parler
          </Text>
          <Text className="mt-0.5 font-mono text-[10px] text-violet">
            5,25 € · 8 min
          </Text>
        </MiniCard>
        <View
          className="absolute right-3 top-16 rounded-2xl bg-navy px-5 py-4"
          style={{ shadowColor: "#13235B", shadowOpacity: 0.4, shadowRadius: 18 }}
        >
          <Text className="font-serif text-2xl text-paper">42,80 €</Text>
          <View className="mt-2 flex-row items-end gap-1">
            {[10, 16, 12, 22, 18].map((h, i) => (
              <View
                key={i}
                className="w-2 rounded-sm bg-violet"
                style={{ height: h }}
              />
            ))}
          </View>
        </View>
        <MiniCard className="left-4 bottom-4">
          <Text className="text-xs font-medium text-ink">
            Vos données, à vous
          </Text>
          <Text className="mt-0.5 font-mono text-[10px] text-good">
            ✓ Accord requis
          </Text>
        </MiniCard>
      </View>
    ),
  },
];

export default function Onboarding() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const last = SLIDES.length - 1;

  async function finish() {
    await markOnboardingSeen();
    router.replace("/(auth)/sign-in");
  }

  function next() {
    if (index >= last) return finish();
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  return (
    <View className="flex-1 bg-ivory">
      <View className="flex-row justify-end px-6 pt-2">
        <Pressable onPress={finish} hitSlop={12}>
          <Text className="text-sm text-ink-4">Passer</Text>
        </Pressable>
      </View>

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
            <View className="gap-3 pb-8">
              {item.eyebrow ? <Eyebrow>{item.eyebrow}</Eyebrow> : null}
              <Text className="text-center font-serif text-3xl leading-tight text-ink">
                {item.title}
              </Text>
              <Text className="text-center text-sm leading-5 text-ink-3">
                {item.subtitle}
              </Text>
            </View>
          </View>
        )}
      />

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
            label={index >= last ? "Commencer" : "Suivant"}
            arrow
            onPress={next}
          />
        </View>
      </View>
    </View>
  );
}
