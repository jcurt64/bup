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
import { useTheme } from "../lib/theme";
import { HERO_GRADIENT } from "../lib/pro-theme";
import { getDrawerOrigin } from "../lib/drawer-origin";
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
  /** "menu" ouvre le drawer, "back" revient en arrière, "drawer" réouvre le
   *  drawer sur la page d'origine (pages issues du drawer), undefined = rien */
  nav?: "menu" | "back" | "drawer";
  /** Décoration absolument positionnée en haut à droite (signature visuelle
   *  de la page — ex. icône handshake sur Relations). */
  topRight?: ReactNode;
  /** Dégradé custom (sinon violet → navy par défaut). */
  gradient?: readonly [string, string, ...string[]];
  children?: ReactNode;
};

export function GradientHero({ title, eyebrow, desc, nav, topRight, gradient, children }: HeroProps) {
  const { c, mode } = useTheme();
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

  const goBack = () => {
    if (nav === "drawer") {
      // Réouvre le drawer SUR la page d'où il avait été ouvert.
      const o = getDrawerOrigin();
      if (o) {
        router.replace(o.path as never);
        router.push(o.drawer as never);
        return;
      }
    }
    router.back();
  };

  const hasBack = nav === "back" || nav === "drawer";

  const card = (
    <LinearGradient
      colors={gradient ?? HERO_GRADIENT[mode]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        flex: hasBack ? 1 : undefined,
        borderRadius: 28,
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: 22,
      }}
    >
      {nav === "menu" ? (
        <View className="mb-3 flex-row items-center justify-between gap-3">
          <Text
            className="flex-1 font-serif text-xl text-white"
            numberOfLines={1}
          >
            {greeting}
          </Text>
          {tier ? (
            <View className="flex-row items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
              <Ionicons name="trophy" size={14} color={tier.color} />
              <Text className="text-xs font-semibold text-white">
                {tier.label}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {eyebrow ? (
        <Text
          className="text-[11px] font-bold uppercase text-white/70"
          style={{ letterSpacing: 1.5 }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text className="mt-1 font-serif text-2xl text-white">{title}</Text>
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

  if (!hasBack) return card;

  // Bouton retour À L'EXTÉRIEUR du gradient (dans la marge gauche), aligné
  // au top de la carte (items-start). Le gradient occupe le reste (flex-1).
  return (
    <View className="flex-row items-start" style={{ gap: 10 }}>
      <Pressable
        onPress={goBack}
        hitSlop={12}
        accessibilityLabel="Retour"
        className="items-center justify-center rounded-full active:opacity-70"
        style={{
          width: 40,
          height: 40,
          backgroundColor: c.accentSoft,
          borderWidth: 1,
          borderColor: c.accent,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 1,
        }}
      >
        <Ionicons name="chevron-back" size={20} color={c.accentInk} />
      </Pressable>
      {card}
    </View>
  );
}

export function ScrollScreen({
  children,
  onRefresh,
  hero,
  compactExtras,
  headerVariant = "prospect",
}: {
  children: ReactNode;
  onRefresh?: () => Promise<unknown>;
  hero?: HeroProps;
  /** Informations supplémentaires (icône + valeur) affichées à droite
   *  du header une fois passé en mode compact. Ex. sur Portefeuille :
   *  total cumulé + séquestre. Optionnel par page. */
  compactExtras?: CompactExtra[];
  /** "pro" → header avec boutons lancer/recharger + drawer pro. */
  headerVariant?: "prospect" | "pro";
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
        <AppHeader variant={headerVariant} />
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
    // 401 = session expirée (rouge). Toute autre erreur = vraie erreur de
    // chargement → message honnête mais discret + invite à réessayer (la
    // plupart des écrans ont le pull-to-refresh). On NE masque PAS l'erreur
    // en « pas encore de données » (les états vides passent par `isEmpty`).
    if (unauth) {
      return (
        <View className="rounded-2xl border-l-4 border-bad bg-paper p-4">
          <Text className="text-sm text-bad">
            Session expirée — reconnectez-vous.
          </Text>
        </View>
      );
    }
    return (
      <View className="items-center rounded-2xl border border-line bg-paper p-6">
        <Text className="text-center text-sm font-medium text-ink-2">
          Chargement impossible pour le moment.
        </Text>
        <Text className="mt-1 text-center text-[12px] text-ink-4">
          Tirez vers le bas pour réessayer.
        </Text>
      </View>
    );
  }
  const d = query.data as T;
  if (isEmpty && isEmpty(d)) {
    return (
      <View className="items-center rounded-2xl border border-line bg-paper p-8">
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
// Dégradé diagonal pastel → blanc en fond de Card/Stat (thèmes clairs :
// buupp/forest/fushia) quand `tone` est défini. Teintes soutenues pour bien
// marquer le contraste carte/page — on intensifie la couleur PROPRE de la
// carte (le jaune reste jaune…), jamais avec la couleur du thème.
const TONE_GRADIENT: Record<Tone, [string, string]> = {
  violet: ["#DAD0FB", "#FFFFFF"],
  coral: ["#FFD2C9", "#FFFFFF"],
  teal: ["#C4EDE6", "#FFFFFF"],
  amber: ["#FAE2B0", "#FFFFFF"],
  sky: ["#D0DFFB", "#FFFFFF"],
};
// Départ de dégradé RENFORCÉ pour le DARK MODE — mêmes teintes que les dark
// tints de la palette mais plus soutenues, pour mieux marquer le contraste
// carte/fond (le dégradé fond toujours vers la surface sombre). Local au
// composant : ne touche pas les pastilles d'icônes qui utilisent c.tint*.
const TONE_TINT_DARK: Record<Tone, string> = {
  violet: "#3A3275",
  coral: "#552E22",
  teal: "#1E5040",
  amber: "#50401C",
  sky: "#284468",
};

export function Card({
  children,
  dark = false,
  className = "",
  badge,
  tone,
  gradient,
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
  badge?: {
    icon: keyof typeof Ionicons.glyphMap;
    tone?: Tone;
    /** Rend la pastille en tuile blanche carrée arrondie (parité
     *  redesign.png) au lieu du cercle pastel par défaut. */
    square?: boolean;
    /** Couleur d'icône explicite (sinon dérivée du `tone`). */
    color?: string;
  };
  /** Teinte pastel du fond de carte (différenciation visuelle). */
  tone?: Tone;
  /** Dégradé de fond custom — surcharge TONE_GRADIENT quand `tone` est
   *  défini (ex. card Portefeuille éclaircie sur la home). */
  gradient?: [string, string];
}) {
  const { c, isDark } = useTheme();
  const bg = dark ? "bg-ink" : tone ? TONE_BG[tone] : "bg-paper";
  const shadow = dark
    ? undefined
    : {
        shadowColor: "#0F1629",
        shadowOpacity: 0.05,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      };
  const badgeColor = badge ? badge.color ?? TONE_FG[badge.tone ?? "violet"] : undefined;
  const inner = (
    <>
      {badge ? (
        badge.square ? (
          <View
            className={`mb-3 h-10 w-10 items-center justify-center rounded-2xl ${isDark ? "" : "bg-paper"}`}
            style={{
              backgroundColor: isDark ? "rgba(255,255,255,0.12)" : undefined,
              shadowColor: "#0F1629",
              shadowOpacity: 0.06,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 2,
            }}
          >
            <Ionicons name={badge.icon} size={20} color={badgeColor} />
          </View>
        ) : (
          <View
            className={`mb-3 h-10 w-10 items-center justify-center rounded-full ${
              TONE_BADGE_BG[badge.tone ?? "violet"]
            }`}
          >
            <Ionicons name={badge.icon} size={20} color={badgeColor} />
          </View>
        )
      ) : null}
      {children}
    </>
  );
  if (!dark && tone) {
    return (
      <LinearGradient
        colors={
          gradient ??
          // sombre → pastel sombre → surface sombre. thèmes clairs → pastel
          // soutenu → blanc (contraste renforcé, sans couleur du thème).
          (isDark ? [TONE_TINT_DARK[tone], c.surface] : TONE_GRADIENT[tone])
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          { borderRadius: 24, padding: 20, borderWidth: 0.7, borderColor: c.borderSoft },
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
        dark ? null : { borderWidth: 0.7, borderColor: c.borderSoft },
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
  squareIcon = false,
  iconColor,
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
  /** Rend l'icône en tuile blanche carrée arrondie (parité redesign.png)
   *  au lieu du cercle pastel par défaut. */
  squareIcon?: boolean;
  /** Couleur d'icône explicite (sinon dérivée du `tone`). */
  iconColor?: string;
}) {
  const { c, isDark } = useTheme();
  const bg = tone ? TONE_BG[tone] : "bg-paper";
  const fg = iconColor ?? (tone ? TONE_FG[tone] : c.violet);
  const inner = (
    <>
      {icon ? (
        squareIcon ? (
          <View
            className={`mb-2 h-9 w-9 items-center justify-center rounded-xl ${isDark ? "" : "bg-paper"}`}
            style={{
              backgroundColor: isDark ? "rgba(255,255,255,0.12)" : undefined,
              shadowColor: "#0F1629",
              shadowOpacity: 0.06,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
            <Ionicons name={icon} size={17} color={fg} />
          </View>
        ) : (
          <View
            className={`mb-2 h-8 w-8 items-center justify-center rounded-full ${
              tone ? "bg-paper/70" : "bg-ivory"
            }`}
          >
            <Ionicons name={icon} size={16} color={fg} />
          </View>
        )
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
        colors={
          isDark ? [TONE_TINT_DARK[tone], c.surface] : TONE_GRADIENT[tone]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flex: 1,
          borderRadius: 24,
          padding: 16,
          borderWidth: 0.7,
          borderColor: c.borderSoft,
        }}
      >
        {inner}
      </LinearGradient>
    );
  }
  return (
    <View
      className={`flex-1 rounded-3xl p-4 ${bg}`}
      style={{ borderWidth: 0.7, borderColor: c.borderSoft }}
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
