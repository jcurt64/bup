// Helpers d'écran réutilisables : conteneur scrollable + pull-to-refresh
// (fraîcheur active §6.2), porte d'état React Query (loading/erreur 401/
// vide), carte et ligne de stat. Évite la répétition sur tous les
// onglets prospect/pro.
import { type ReactNode, useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { AppHeader } from "./app-header";
import { GridBg } from "./grid-bg";
import { BuuppLoader } from "./loader";
import { ApiError } from "../lib/api";
import {
  type CompactExtra,
  HEADER_BASE_HEIGHT,
  HeaderScrollContext,
} from "../lib/header-scroll";
import { useMeTyped, useProspectVerification } from "../lib/queries";

// Palier "certifié confiance" → trophée coloré (ordre demandé :
// argent → bronze → or).
const TIER_META: Record<string, { label: string; color: string }> = {
  basique: { label: "Basique", color: "#D8DBE2" }, // argent
  verifie: { label: "Vérifié", color: "#E0915A" }, // bronze
  certifie_confiance: { label: "Certifié confiance", color: "#F4C84B" }, // or
};

type HeroProps = {
  title: string;
  eyebrow?: string;
  desc?: string;
  /** "menu" ouvre le drawer, "back" revient en arrière, undefined = rien */
  nav?: "menu" | "back";
  /** Décoration absolument positionnée en haut à droite (signature visuelle
   *  de la page — ex. icône handshake sur Relations). */
  topRight?: ReactNode;
  children?: ReactNode;
};

export function GradientHero({ title, eyebrow, desc, nav, topRight, children }: HeroProps) {
  const me = useMeTyped();
  const verif = useProspectVerification();
  const hour = new Date().getHours();
  const hello = hour >= 19 ? "Bonsoir" : "Bonjour";
  const firstName = me.data?.prenom?.trim() || null;
  const greeting = firstName ? `${hello} ${firstName}` : hello;
  const tier =
    verif.data?.tier && me.data?.role === "prospect"
      ? TIER_META[verif.data.tier]
      : undefined;

  return (
    <LinearGradient
      colors={["#7C5CFC", "#13235B"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 28, padding: 20, paddingTop: 22 }}
    >
      {nav === "menu" ? (
        <View className="mb-3 flex-row items-center justify-between gap-3">
          <Text
            className="flex-1 font-serif text-xl text-paper"
            numberOfLines={1}
          >
            {greeting}
          </Text>
          {tier ? (
            <View className="flex-row items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
              <Ionicons name="trophy" size={14} color={tier.color} />
              <Text className="text-xs font-semibold text-paper">
                {tier.label}
              </Text>
            </View>
          ) : null}
        </View>
      ) : nav === "back" ? (
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="Retour"
          className="mb-3 h-9 w-9 items-center justify-center rounded-full bg-white/15"
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </Pressable>
      ) : null}
      {eyebrow ? (
        <Text
          className="text-[11px] font-bold uppercase text-white/70"
          style={{ letterSpacing: 1.5 }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text className="mt-1 font-serif text-2xl text-paper">{title}</Text>
      {desc ? (
        <Text className="mt-1 text-lg leading-6 text-white/75">{desc}</Text>
      ) : null}
      {children ? <View className="mt-3">{children}</View> : null}
      {topRight ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 18, right: 20 }}
        >
          {topRight}
        </View>
      ) : null}
    </LinearGradient>
  );
}

export function ScrollScreen({
  children,
  onRefresh,
  hero,
  compactExtras,
}: {
  children: ReactNode;
  onRefresh?: () => Promise<unknown>;
  hero?: HeroProps;
  /** Informations supplémentaires (icône + valeur) affichées à droite
   *  du header une fois passé en mode compact. Ex. sur Portefeuille :
   *  total cumulé + séquestre. Optionnel par page. */
  compactExtras?: CompactExtra[];
}) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  // SharedValue mise à jour côté UI thread par le scrollHandler — lue
  // par AppHeader pour interpoler l'opacité de ses deux layouts.
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // Header rendu en position absolute par-dessus le ScrollView (pour
  // que le contenu défile derrière son fond translucide) → on compense
  // avec un paddingTop sur la ScrollView qui réserve la hauteur du
  // header (safe area top + 84 px de contenu).
  const headerHeight = insets.top + HEADER_BASE_HEIGHT;

  return (
    <HeaderScrollContext.Provider value={{ scrollY, compactExtras }}>
      <SafeAreaView className="flex-1 bg-ivory" edges={["bottom"]}>
        <GridBg />
        <Animated.ScrollView
          className="flex-1"
          contentContainerStyle={{
            padding: 20,
            paddingTop: headerHeight + 16,
            paddingBottom: 120,
            gap: 16,
          }}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                progressViewOffset={headerHeight}
              />
            ) : undefined
          }
        >
          {hero ? <GradientHero {...hero} /> : null}
          {children}
        </Animated.ScrollView>
        <AppHeader />
      </SafeAreaView>
    </HeaderScrollContext.Provider>
  );
}

/** Affiche loading / erreur (401 explicite) / vide, sinon le contenu. */
export function QueryGate<T>({
  query,
  isEmpty,
  emptyLabel = "Rien à afficher pour le moment.",
  children,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; data: T | undefined };
  isEmpty?: (d: T) => boolean;
  emptyLabel?: string;
  children: (d: T) => ReactNode;
}) {
  if (query.isPending) {
    return (
      <View className="items-center py-16">
        <BuuppLoader />
      </View>
    );
  }
  if (query.isError) {
    const unauth = query.error instanceof ApiError && query.error.status === 401;
    return (
      <View className="rounded-2xl border-l-4 border-bad bg-paper p-4">
        <Text className="text-sm text-bad">
          {unauth
            ? "Session expirée — reconnectez-vous."
            : "Impossible de charger ces données."}
        </Text>
      </View>
    );
  }
  const d = query.data as T;
  if (isEmpty && isEmpty(d)) {
    return (
      <View
        className="items-center rounded-2xl bg-paper p-8"
        style={{ borderWidth: 0.7, borderColor: "#CBC7B9" }}
      >
        <Text className="text-center text-sm text-ink-4">{emptyLabel}</Text>
      </View>
    );
  }
  return <>{children(d)}</>;
}

type Tone = "violet" | "coral" | "teal" | "amber" | "sky";
// Fond des cartes / Stats teintés (Portefeuille). Désaturé pour rester
// discret à côté du GradientHero ; le badge interne garde la teinte vive
// via TONE_FG.
const TONE_BG: Record<Tone, string> = {
  violet: "bg-violet-muted",
  coral: "bg-coral-muted",
  teal: "bg-teal-muted",
  amber: "bg-amber-muted",
  sky: "bg-sky-muted",
};
// Pastels plus saturés conservés pour les badges (pastille icône) afin
// de garder du contraste avec le fond de carte désaturé (TONE_BG).
const TONE_BADGE_BG: Record<Tone, string> = {
  violet: "bg-violet-soft",
  coral: "bg-coral-soft",
  teal: "bg-teal-soft",
  amber: "bg-amber-soft",
  sky: "bg-sky-soft",
};
const TONE_FG: Record<Tone, string> = {
  violet: "#7C5CFC",
  coral: "#FF7A6B",
  teal: "#2FB8A6",
  amber: "#F2B65A",
  sky: "#5B8DEF",
};
// Dégradé diagonal soft → paper appliqué en fond de Card/Stat quand `tone`
// est défini. Donne de la profondeur sans saturer la teinte.
const TONE_GRADIENT: Record<Tone, [string, string]> = {
  violet: ["#EDE9FE", "#FFFFFF"],
  coral: ["#FFE7E3", "#FFFFFF"],
  teal: ["#DCF4F0", "#FFFFFF"],
  amber: ["#FCEFD6", "#FFFFFF"],
  sky: ["#E4ECFD", "#FFFFFF"],
};

export function Card({
  children,
  dark = false,
  className = "",
  badge,
  tone,
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
  badge?: { icon: keyof typeof Ionicons.glyphMap; tone?: Tone };
  /** Teinte pastel du fond de carte (différenciation visuelle). */
  tone?: Tone;
}) {
  const bg = dark ? "bg-ink" : tone ? TONE_BG[tone] : "bg-paper";
  const shadow = dark
    ? undefined
    : {
        shadowColor: "#0F1629",
        shadowOpacity: 0.05,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      };
  const inner = (
    <>
      {badge ? (
        <View
          className={`mb-3 h-10 w-10 items-center justify-center rounded-full ${
            TONE_BADGE_BG[badge.tone ?? "violet"]
          }`}
        >
          <Ionicons
            name={badge.icon}
            size={20}
            color={TONE_FG[badge.tone ?? "violet"]}
          />
        </View>
      ) : null}
      {children}
    </>
  );
  if (!dark && tone) {
    return (
      <LinearGradient
        colors={TONE_GRADIENT[tone]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          { borderRadius: 24, padding: 20, borderWidth: 0.7, borderColor: "#CBC7B9" },
          shadow,
        ]}
      >
        {inner}
      </LinearGradient>
    );
  }
  return (
    <View
      className={`rounded-3xl p-5 ${bg} ${className}`}
      style={[
        shadow,
        dark ? null : { borderWidth: 0.7, borderColor: "#CBC7B9" },
      ]}
    >
      {inner}
    </View>
  );
}

export function Stat({
  label,
  value,
  hint,
  accent = false,
  icon,
  tone,
  coins,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Teinte pastel du fond + de l'icône. */
  tone?: Tone;
  /** Si fourni : ligne pastille dorée "{coins} BUUPP Coins". */
  coins?: string;
}) {
  const bg = tone ? TONE_BG[tone] : "bg-paper";
  const inner = (
    <>
      {icon ? (
        <View
          className={`mb-2 h-8 w-8 items-center justify-center rounded-full ${
            tone ? "bg-white/70" : "bg-ivory"
          }`}
        >
          <Ionicons
            name={icon}
            size={16}
            color={tone ? TONE_FG[tone] : "#7C5CFC"}
          />
        </View>
      ) : null}
      <Text
        className="text-[10px] font-bold uppercase text-ink-4"
        style={{ letterSpacing: 0.8 }}
      >
        {label}
      </Text>
      <Text
        className={`mt-1 font-serif text-2xl ${accent ? "text-violet" : "text-ink"}`}
      >
        {value}
      </Text>
      {coins ? <CoinsLine coins={coins} /> : null}
      {hint ? (
        <Text className="mt-0.5 text-[11px] text-ink-4">{hint}</Text>
      ) : null}
    </>
  );
  if (tone) {
    return (
      <LinearGradient
        colors={TONE_GRADIENT[tone]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flex: 1,
          borderRadius: 24,
          padding: 16,
          borderWidth: 0.7,
          borderColor: "#CBC7B9",
        }}
      >
        {inner}
      </LinearGradient>
    );
  }
  return (
    <View
      className={`flex-1 rounded-3xl p-4 ${bg}`}
      style={{ borderWidth: 0.7, borderColor: "#CBC7B9" }}
    >
      {inner}
    </View>
  );
}

// Pastille "BUUPP Coin" — réplique du .coin web (styles.css) :
// rond doré dégradé + "B" serif. Affiché devant "{n} BUUPP Coins".
export function CoinBadge({ size = 16 }: { size?: number }) {
  return (
    <LinearGradient
      colors={["#E8C767", "#B8860B"]}
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
      <Text
        className="font-serif-bold"
        style={{ color: "#3A2B00", fontSize: size * 0.58 }}
      >
        B
      </Text>
    </LinearGradient>
  );
}

/** Ligne "🅑 {n} BUUPP Coins" (pastille dorée + libellé mono). */
export function CoinsLine({ coins }: { coins: string }) {
  return (
    <View className="mt-1 flex-row items-center gap-1.5">
      <CoinBadge />
      <Text className="font-mono text-xs text-ink-4">{coins} BUUPP Coins</Text>
    </View>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
}) {
  return (
    <View className="gap-1">
      <Text
        className="text-[11px] font-bold uppercase text-violet"
        style={{ letterSpacing: 1.5 }}
      >
        {eyebrow}
      </Text>
      <Text className="font-serif text-2xl text-ink">{title}</Text>
      {desc ? (
        <Text className="text-lg leading-6 text-ink-3">{desc}</Text>
      ) : null}
    </View>
  );
}

export const eur = (n: unknown) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(n ?? 0));

export const dateFr = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR") : "—";
