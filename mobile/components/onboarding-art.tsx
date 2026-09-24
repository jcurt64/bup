// Illustrations animées du carrousel d'onboarding.
//
// Toutes les couleurs viennent de useTheme().c → les 4 coloris (BUUPP,
// Sombre, Forest, Light Fushia) sont couverts sans cas particulier, sauf
// les surfaces « héros » (cartes navy, écran du téléphone) où le texte est
// forcé en blanc : `text-paper` y deviendrait sombre en thème Sombre.
//
// Chaque illustration reçoit `active` : les éléments entrent en cascade
// quand la slide devient visible (et se rejouent à chaque retour), puis
// flottent doucement en boucle.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, type ReactNode } from "react";
import { Text, useWindowDimensions, View, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../lib/theme";
import { BrandLogo } from "./ui";

// Ajoute un canal alpha (« 33 ») à une couleur #RRGGBB.
export const withAlpha = (hex: string, aa: string) =>
  /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${aa}` : hex;

const WHITE_SOFT = "rgba(255,255,255,0.62)";

function useShadow(strength: "soft" | "strong" = "soft") {
  const { c, isDark } = useTheme();
  return {
    shadowColor: isDark ? "#000000" : c.navyDeep,
    shadowOpacity: isDark ? 0.5 : strength === "strong" ? 0.32 : 0.12,
    shadowRadius: strength === "strong" ? 18 : 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: strength === "strong" ? 7 : 4,
  } satisfies ViewStyle;
}

// ── Primitive : entrée en cascade + flottement continu ─────────────────
function Pop({
  active,
  delay = 0,
  float = 5,
  floatDuration = 2600,
  rotate = 0,
  style,
  children,
}: {
  active: boolean;
  delay?: number;
  float?: number;
  floatDuration?: number;
  rotate?: number;
  style?: ViewStyle;
  children: ReactNode;
}) {
  const enter = useSharedValue(0);
  const bob = useSharedValue(0);

  useEffect(() => {
    enter.value = active
      ? withDelay(delay, withSpring(1, { damping: 13, stiffness: 120 }))
      : withTiming(0, { duration: 160 });
  }, [active, delay, enter]);

  useEffect(() => {
    bob.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: floatDuration, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(bob);
  }, [bob, delay, floatDuration]);

  const anim = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: (1 - enter.value) * 28 - bob.value * float },
      { scale: 0.86 + enter.value * 0.14 },
      { rotate: `${rotate}deg` },
    ],
  }));

  return <Animated.View style={[{ position: "absolute" }, style, anim]}>{children}</Animated.View>;
}

function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { c } = useTheme();
  const shadow = useShadow();
  return (
    <View
      style={[
        {
          borderRadius: 18,
          padding: 12,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.borderSoft,
        },
        shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

function HeroCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { c } = useTheme();
  const shadow = useShadow("strong");
  return (
    <LinearGradient
      colors={[c.navy, c.navyDeep]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: 20, paddingHorizontal: 18, paddingVertical: 14 }, shadow, style]}
    >
      {children}
    </LinearGradient>
  );
}

function IconTile({
  name,
  bg,
  color,
  size = 28,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  bg: string;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 3,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={name} size={size * 0.55} color={color} />
    </View>
  );
}

// Onde qui se propage depuis le centre (anneaux concentriques).
function Ripple({ delay, size, color }: { delay: number; size: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 3200, easing: Easing.out(Easing.quad) }), -1, false),
    );
    return () => cancelAnimation(p);
  }, [p, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - p.value),
    transform: [{ scale: 0.45 + p.value * 1.1 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

// ── Slide 1 : le logo tombe, des ondes s'en échappent, trois promesses ──
export function IntroArt({ active }: { active: boolean }) {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  const ty = useSharedValue(-height * 0.75);
  const op = useSharedValue(0);
  useEffect(() => {
    op.value = withTiming(1, { duration: 260 });
    ty.value = withSequence(
      withTiming(18, { duration: 560, easing: Easing.in(Easing.cubic) }),
      withSpring(0, { damping: 8, stiffness: 130, mass: 0.7 }),
    );
  }, [ty, op]);
  const logoStyle = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: ty.value }],
  }));

  const chips: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
    bg: string;
    fg: string;
    style: ViewStyle;
    delay: number;
    rotate: number;
  }[] = [
    { icon: "hand-left", label: "Vous choisissez", bg: c.tintViolet, fg: c.accViolet, style: { left: 0, top: 8 }, delay: 900, rotate: -4 },
    { icon: "wallet", label: "Payé en euros", bg: c.tintGreen, fg: c.accGreen, style: { right: 0, top: 58 }, delay: 1050, rotate: 3 },
    { icon: "shield-checkmark", label: "Données protégées", bg: c.tintBlue, fg: c.accBlue, style: { left: 14, bottom: 6 }, delay: 1200, rotate: 2 },
  ];

  return (
    <View style={{ height: 300, width: "100%", alignItems: "center", justifyContent: "center" }}>
      <Ripple delay={900} size={220} color={c.violet} />
      <Ripple delay={1966} size={220} color={c.violet} />
      <Ripple delay={3033} size={220} color={c.violet} />
      <Animated.View style={logoStyle}>
        <BrandLogo />
      </Animated.View>
      {chips.map((ch) => (
        <Pop key={ch.label} active={active} delay={ch.delay} rotate={ch.rotate} style={ch.style} floatDuration={2400 + ch.delay}>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9 }}>
            <IconTile name={ch.icon} bg={ch.bg} color={ch.fg} />
            <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>{ch.label}</Text>
          </Card>
        </Pop>
      ))}
    </View>
  );
}

// Barres qui poussent (graphique de gains).
function GrowBar({ active, h, delay, color }: { active: boolean; h: number; delay: number; color: string }) {
  const g = useSharedValue(0);
  useEffect(() => {
    g.value = active
      ? withDelay(delay, withSpring(1, { damping: 12, stiffness: 110 }))
      : withTiming(0, { duration: 120 });
  }, [active, delay, g]);
  const style = useAnimatedStyle(() => ({ height: Math.max(2, h * g.value) }));
  return <Animated.View style={[{ width: 9, borderRadius: 3, backgroundColor: color }, style]} />;
}

// ── Slide 2 : pour les pros ─────────────────────────────────────────────
export function ProsArt({ active }: { active: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ height: 300, width: "100%" }}>
      <Pop active={active} delay={80} rotate={-5} style={{ left: 44, top: 88 }} float={4}>
        <HeroCard style={{ paddingHorizontal: 22, paddingVertical: 18 }}>
          <Text style={{ fontSize: 9, letterSpacing: 1.5, color: WHITE_SOFT, fontWeight: "700" }}>
            BUUPP SCORE
          </Text>
          <Text className="font-serif" style={{ fontSize: 40, color: "#FFFFFF", lineHeight: 46 }}>
            742
          </Text>
          <Text style={{ fontSize: 11, color: WHITE_SOFT }}>
            Exemple · <Text className="font-serif-italic" style={{ color: "#FFFFFF" }}>Recherché</Text>
          </Text>
        </HeroCard>
      </Pop>

      <Pop active={active} delay={260} style={{ left: 4, top: 6 }} float={6}>
        <Card>
          <Text style={{ fontSize: 9, letterSpacing: 1.2, color: c.textMuted, fontWeight: "700" }}>PROSPECT</Text>
          <Text style={{ fontSize: 14, fontWeight: "600", color: c.text, marginTop: 2 }}>
            A accepté <Text style={{ color: c.good }}>✓</Text>
          </Text>
          <Text style={{ fontSize: 11, color: c.textSub, marginTop: 2 }}>prêt à échanger</Text>
          <View style={{ marginTop: 7, height: 4, width: 70, borderRadius: 2, backgroundColor: c.violet }} />
        </Card>
      </Pop>

      <Pop active={active} delay={420} rotate={3} style={{ right: 2, top: 26 }} float={5}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <IconTile name="funnel" bg={c.tintViolet} color={c.accViolet} />
          <View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: c.text }}>Ciblage par paliers</Text>
            <Text style={{ fontSize: 10, color: c.textSub }}>consentement clair</Text>
          </View>
        </Card>
      </Pop>

      <Pop active={active} delay={580} style={{ left: 10, bottom: 8 }} float={4}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <IconTile name="card" bg={c.tintAmber} color={c.accAmber} />
          <View>
            <Text style={{ fontSize: 9, letterSpacing: 1.2, color: c.textMuted, fontWeight: "700" }}>VOUS PAYEZ</Text>
            <Text className="font-serif" style={{ fontSize: 17, color: c.violet }}>à l’acceptation</Text>
          </View>
        </Card>
      </Pop>

      <Pop active={active} delay={740} style={{ right: 22, bottom: 30 }} float={7} floatDuration={2000}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: c.good,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: c.good,
            shadowOpacity: 0.45,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <Ionicons name="checkmark" size={24} color="#FFFFFF" />
        </View>
      </Pop>
    </View>
  );
}

// ── Slide 3 : pour les buuppers ─────────────────────────────────────────
export function BuuppersArt({ active }: { active: boolean }) {
  const { c } = useTheme();
  const bars = [12, 18, 14, 24, 19, 34];
  return (
    <View style={{ height: 300, width: "100%" }}>
      <Pop active={active} delay={60} style={{ left: 4, top: 10 }} float={5}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <IconTile name="notifications" bg={c.tintViolet} color={c.accViolet} />
          <View>
            <Text style={{ fontSize: 12, fontWeight: "600", color: c.text }}>Une agence souhaite{"\n"}vous parler</Text>
            <Text style={{ fontSize: 10, color: c.textSub, marginTop: 2 }}>3,20 € · 8 min</Text>
          </View>
        </Card>
      </Pop>

      <Pop active={active} delay={200} rotate={5} style={{ right: 6, top: 0 }} float={4}>
        <HeroCard>
          <Text style={{ fontSize: 9, letterSpacing: 1.5, color: WHITE_SOFT, fontWeight: "700" }}>RGPD</Text>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF" }}>
            Vos données,{"\n"}
            <Text className="font-serif-italic" style={{ color: "#FFFFFF" }}>à vous.</Text>
          </Text>
        </HeroCard>
      </Pop>

      <Pop active={active} delay={340} style={{ right: 18, top: 104 }} float={6} floatDuration={3000}>
        <Card style={{ paddingHorizontal: 18, paddingVertical: 14 }}>
          <Text className="font-serif" style={{ fontSize: 30, color: c.text }}>
            42<Text style={{ fontSize: 17, color: c.textSub }}>,80 €</Text>
          </Text>
          <Text style={{ fontSize: 9, letterSpacing: 1.2, color: c.textMuted, fontWeight: "700" }}>CE MOIS-CI · EXEMPLE</Text>
          <View style={{ marginTop: 8, height: 36, flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
            {bars.map((h, i) => (
              <GrowBar
                key={i}
                active={active}
                h={h}
                delay={520 + i * 70}
                color={i === bars.length - 1 ? c.violet : c.violetSoft}
              />
            ))}
          </View>
        </Card>
      </Pop>

      <Pop active={active} delay={520} style={{ left: 12, bottom: 22 }} float={5}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <IconTile name="checkmark-circle" bg={c.goodSoft} color={c.good} />
          <View>
            <Text style={{ fontSize: 12, fontWeight: "600", color: c.text }}>Accepté</Text>
            <Text style={{ fontSize: 12, fontWeight: "700", color: c.good }}>+ 2,10 €</Text>
          </View>
        </Card>
      </Pop>

      <Pop active={active} delay={680} style={{ left: 150, bottom: 0 }} float={8} floatDuration={2200}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 2,
            borderStyle: "dashed",
            borderColor: c.violet,
            backgroundColor: withAlpha(c.violetSoft, "CC"),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="heart" size={18} color={c.violet} />
        </View>
      </Pop>
    </View>
  );
}

// Cloche qui tinte de temps en temps.
function RingingBell({ active }: { active: boolean }) {
  const { c } = useTheme();
  const shadow = useShadow("strong");
  const r = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(r);
      r.value = 0;
      return;
    }
    r.value = withDelay(
      700,
      withRepeat(
        withSequence(
          withTiming(14, { duration: 90 }),
          withTiming(-12, { duration: 90 }),
          withTiming(9, { duration: 90 }),
          withTiming(-6, { duration: 90 }),
          withTiming(0, { duration: 90 }),
          withTiming(0, { duration: 1800 }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(r);
  }, [active, r]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <Animated.View
      style={[
        {
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: c.btnBg,
          alignItems: "center",
          justifyContent: "center",
        },
        shadow,
        style,
      ]}
    >
      <Ionicons name="notifications" size={24} color={c.btnText} />
      <View
        style={{
          position: "absolute",
          top: 10,
          right: 11,
          width: 11,
          height: 11,
          borderRadius: 6,
          backgroundColor: c.coral,
          borderWidth: 2,
          borderColor: c.btnBg,
        }}
      />
    </Animated.View>
  );
}

// Notification de l'écran verrouillé (style iOS : carte claire translucide,
// lisible dans tous les thèmes car posée sur l'écran foncé du téléphone).
function LockNotif({
  active,
  delay,
  title,
  body,
  when,
}: {
  active: boolean;
  delay: number;
  title: string;
  body: string;
  when: string;
}) {
  const { c } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = active
      ? withDelay(delay, withSpring(1, { damping: 14, stiffness: 130 }))
      : withTiming(0, { duration: 120 });
  }, [active, delay, p]);
  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * -26 }, { scale: 0.92 + p.value * 0.08 }],
  }));
  return (
    <Animated.View
      style={[
        {
          flexDirection: "row",
          gap: 9,
          alignItems: "center",
          padding: 10,
          borderRadius: 16,
          backgroundColor: "rgba(255,255,255,0.93)",
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[c.violet, c.violetDeep]}
        style={{ width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" }}
      >
        <Text className="font-serif-bold" style={{ color: "#FFFFFF", fontSize: 15 }}>b</Text>
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#0F1629" }}>{title}</Text>
          <Text style={{ fontSize: 10, color: "#6B7384" }}>{when}</Text>
        </View>
        <Text numberOfLines={1} style={{ fontSize: 11, color: "#3B4356", marginTop: 1 }}>
          {body}
        </Text>
      </View>
    </Animated.View>
  );
}

// ── Slide 4 : notifications — téléphone verrouillé ──────────────────────
export function NotificationsArt({ active }: { active: boolean }) {
  const { c, isDark } = useTheme();
  const shadow = useShadow("strong");
  return (
    <View style={{ height: 300, width: "100%", alignItems: "center" }}>
      <View style={{ width: 236, height: 300, overflow: "hidden" }}>
        <View
          style={[
            {
              marginTop: 6,
              height: 360,
              borderRadius: 38,
              padding: 7,
              backgroundColor: isDark ? "#2A3148" : c.ink,
            },
            shadow,
          ]}
        >
          <LinearGradient
            colors={[c.navy, c.navyDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, borderRadius: 31, paddingHorizontal: 10, paddingTop: 12 }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 72,
                height: 20,
                borderRadius: 10,
                backgroundColor: "#000000",
              }}
            />
            <Text style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: WHITE_SOFT }}>
              mardi 24 septembre
            </Text>
            <Text
              style={{
                textAlign: "center",
                fontSize: 50,
                fontWeight: "300",
                color: "#FFFFFF",
                lineHeight: 58,
              }}
            >
              9:41
            </Text>
            <View style={{ gap: 7, marginTop: 10 }}>
              <LockNotif active={active} delay={500} title="BUUPP" when="maintenant" body="Un pro veut vous parler · +3,40 €" />
              <LockNotif active={active} delay={1300} title="BUUPP" when="il y a 2 min" body="Gains disponibles 🎉" />
              <LockNotif active={active} delay={2100} title="BUUPP" when="il y a 1 h" body="Flash deal près de chez vous" />
            </View>
          </LinearGradient>
        </View>
        {/* Fondu vers le fond : le téléphone « sort » du bas de l'écran. */}
        <LinearGradient
          colors={[withAlpha(c.bg, "00"), c.bg]}
          pointerEvents="none"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 70 }}
        />
      </View>
      <Pop active={active} delay={300} style={{ right: 18, top: 36 }} float={5}>
        <RingingBell active={active} />
      </Pop>
    </View>
  );
}

// Halo lumineux doux (faux dégradé radial par cercles concentriques —
// expo-linear-gradient n'a pas de radial et on évite une dépendance).
export function Glow({ size, color, style }: { size: number; color: string; style?: ViewStyle }) {
  const steps = 16;
  return (
    <View pointerEvents="none" style={[{ position: "absolute", width: size, height: size }, style]}>
      {Array.from({ length: steps }).map((_, i) => {
        const s = size * (1 - i / steps);
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: (size - s) / 2,
              top: (size - s) / 2,
              width: s,
              height: s,
              borderRadius: s / 2,
              backgroundColor: color,
              opacity: 0.022,
            }}
          />
        );
      })}
    </View>
  );
}
