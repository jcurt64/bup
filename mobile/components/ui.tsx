// Primitives UI partagées — fidèles aux maquettes buupp-onboarding
// (fond ivoire, chip "buupp" navy, boutons pill ink, accents violets
// italiques serif, eyebrow capitales espacées).
import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";

export function ScreenBg({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className="flex-1 bg-ivory">
      <View className={`flex-1 px-6 ${className}`}>{children}</View>
    </View>
  );
}

/** Chip logo "buupp" — pastille navy, texte serif blanc. */
export function BrandPill({ small = false }: { small?: boolean }) {
  return (
    <View
      className={`self-center rounded-full bg-navy ${
        small ? "px-5 py-2" : "px-8 py-3.5"
      }`}
      style={{
        shadowColor: "#13235B",
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      }}
    >
      <Text
        className={`font-serif font-bold text-paper ${
          small ? "text-base" : "text-2xl"
        }`}
      >
        buupp
      </Text>
    </View>
  );
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
    <Text className="font-serif italic text-violet">{children}</Text>
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
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
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

export function LegalFooter() {
  return (
    <View className="gap-1 pb-1">
      <Text className="text-center text-[11px] leading-4 text-ink-4">
        En continuant, vous acceptez nos{" "}
        <Text className="underline">Conditions</Text>, notre{" "}
        <Text className="underline">Politique de confidentialité</Text> et la
        conformité <Text className="underline">RGPD</Text>.
      </Text>
      <Text className="text-center text-[11px] text-ink-4">
        Mentions légales · Cookies
      </Text>
    </View>
  );
}
