// Helpers d'écran réutilisables : conteneur scrollable + pull-to-refresh
// (fraîcheur active §6.2), porte d'état React Query (loading/erreur 401/
// vide), carte et ligne de stat. Évite la répétition sur tous les
// onglets prospect/pro.
import { type ReactNode, useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError } from "../lib/api";

export function ScrollScreen({
  children,
  onRefresh,
}: {
  children: ReactNode;
  onRefresh?: () => Promise<unknown>;
}) {
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

  return (
    <SafeAreaView className="flex-1 bg-ivory" edges={["bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-5 gap-4"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
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
        <ActivityIndicator color="#4F46E5" />
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
      <View className="items-center rounded-2xl border border-line bg-paper p-8">
        <Text className="text-center text-sm text-ink-4">{emptyLabel}</Text>
      </View>
    );
  }
  return <>{children(d)}</>;
}

export function Card({
  children,
  dark = false,
  className = "",
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <View
      className={`rounded-2xl p-5 ${
        dark ? "bg-ink" : "border border-line bg-paper"
      } ${className}`}
    >
      {children}
    </View>
  );
}

export function Stat({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <View className="flex-1 rounded-2xl border border-line bg-paper p-4">
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
      {hint ? (
        <Text className="mt-0.5 text-[11px] text-ink-4">{hint}</Text>
      ) : null}
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
        <Text className="text-sm leading-5 text-ink-3">{desc}</Text>
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
