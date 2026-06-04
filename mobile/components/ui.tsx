// Primitives UI partagées — fidèles aux maquettes buupp-onboarding
// (fond ivoire, chip "buupp" navy, boutons pill ink, accents violets
// italiques serif, eyebrow capitales espacées).
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { type ReactNode } from "react";
import {
  Pressable,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BuuppLoader } from "./loader";
import { useTheme } from "../lib/theme";

export function ScreenBg({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <SafeAreaView className="flex-1 bg-ivory">
      <View className={`flex-1 px-6 ${className}`}>{children}</View>
    </SafeAreaView>
  );
}

/** Logo "buupp" — pill dégradé serif blanc (cf. maquettes). Navy→bleu buupp
 *  par défaut (light/dark) ; en forest/fushia suit la couleur du thème
 *  (ton profond → accent vif), ombre teintée pour rester cohérente. */
export function BrandLogo({ small = false }: { small?: boolean }) {
  const { mode, c } = useTheme();
  const themed = mode === "forest" || mode === "fushia";
  const colors: [string, string] = themed
    ? [c.navyDeep, c.accent]
    : ["#13235B", "#2F44C0"];
  const shadow = themed ? c.navyDeep : "#13235B";
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        alignSelf: "center",
        borderRadius: 999,
        paddingHorizontal: small ? 20 : 32,
        paddingVertical: small ? 8 : 14,
        shadowColor: shadow,
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}
    >
      <Text
        className={`font-serif-bold text-paper ${small ? "text-base" : "text-2xl"}`}
      >
        buupp
      </Text>
    </LinearGradient>
  );
}

/** Compat : ancien nom. */
export function BrandPill({ small = false }: { small?: boolean }) {
  return <BrandLogo small={small} />;
}

/** Petit label capitales espacées (violet par défaut). */
export function Eyebrow({
  children,
  tone = "violet",
}: {
  children: ReactNode;
  tone?: "violet" | "muted";
}) {
  return (
    <Text
      className={`text-center text-[11px] font-bold uppercase ${
        tone === "violet" ? "text-violet" : "text-ink-4"
      }`}
      style={{ letterSpacing: 2 }}
    >
      {children}
    </Text>
  );
}

/** Titre serif. Passez `accent` pour le mot en violet italique. */
export function H1({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Text
      className={`text-center font-serif text-3xl leading-tight text-ink ${className}`}
    >
      {children}
    </Text>
  );
}

/** Fragment violet italique serif (mots accentués des maquettes). */
export function Accent({ children }: { children: ReactNode }) {
  return (
    <Text className="font-serif-italic text-violet">{children}</Text>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  arrow = false,
}: {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  arrow?: boolean;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      className={`flex-row items-center justify-center gap-2 rounded-full py-4 ${
        off ? "bg-ink-5" : "bg-ink active:opacity-80"
      }`}
      style={
        off
          ? undefined
          : {
              shadowColor: "#0F1629",
              shadowOpacity: 0.18,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 5,
            }
      }
    >
      {loading ? (
        <BuuppLoader size="xs" color="#fff" />
      ) : (
        <Text className="text-base font-semibold text-paper">
          {label}
          {arrow ? "  →" : ""}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & TextInputProps) {
  return (
    <View className="gap-1.5">
      <Text
        className="text-[11px] font-bold uppercase text-ink-4"
        style={{ letterSpacing: 1.2 }}
      >
        {label}
      </Text>
      <TextInput
        placeholderTextColor="#8A91A1"
        className="rounded-2xl border border-line bg-paper px-4 py-3.5 text-base text-ink"
        {...props}
      />
    </View>
  );
}

// Base web (= prod que pointe le mobile). Les pages légales sont servies
// par l'app web : /cgv, /rgpd, /cookies (mêmes slugs que le footer web).
const WEB_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://buupp.com";

// iOS : on ouvre les pages légales dans SFSafariViewController via
// expo-web-browser (navigateur in-app, URL visible, conforme App Review)
// — pas de WebView "wrapper", pas de saut brut hors application.
// On appose `?from=mobile-app` pour que la RouteNav web s'auto-masque
// (les utilisateurs mobiles ont leur propre nav, pas besoin d'être
// redirigés vers l'écosystème web).
function openLegal(path: string) {
  const sep = path.includes("?") ? "&" : "?";
  void WebBrowser.openBrowserAsync(`${WEB_BASE}${path}${sep}from=mobile-app`, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
}

export function LegalFooter() {
  return (
    <View className="pb-1">
      <Text className="text-center text-[11px] leading-4 text-ink-4">
        En continuant, vous acceptez nos{" "}
        <Text
          className="underline text-ink-3"
          onPress={() => openLegal("/cgv")}
        >
          conditions générales de vente
        </Text>
        , notre{" "}
        <Text
          className="underline text-ink-3"
          onPress={() => openLegal("/rgpd")}
        >
          politique de gestion des données personnelles
        </Text>{" "}
        et notre{" "}
        <Text
          className="underline text-ink-3"
          onPress={() => openLegal("/cookies")}
        >
          politique de cookies
        </Text>
        .
      </Text>
    </View>
  );
}

/** 3 boutons de connexion sociale (cf. buupp-onboarding/4.png). */
export function SocialButtons({
  onPress,
}: {
  onPress: (p: "apple" | "google" | "facebook") => void;
}) {
  const items: {
    key: "apple" | "google" | "facebook";
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
  }[] = [
    { key: "apple", icon: "logo-apple", color: "#0F1629" },
    { key: "google", icon: "logo-google", color: "#EA4335" },
    { key: "facebook", icon: "logo-facebook", color: "#1877F2" },
  ];
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-line" />
        <Text
          className="text-[11px] font-bold uppercase text-ink-4"
          style={{ letterSpacing: 2 }}
        >
          ou
        </Text>
        <View className="h-px flex-1 bg-line" />
      </View>
      <View className="flex-row gap-3">
        {items.map((it) => (
          <Pressable
            key={it.key}
            onPress={() => onPress(it.key)}
            accessibilityRole="button"
            accessibilityLabel={`Continuer avec ${it.key}`}
            className="flex-1 items-center justify-center rounded-2xl border border-line bg-paper py-3.5 active:opacity-70"
          >
            <Ionicons name={it.icon} size={22} color={it.color} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
