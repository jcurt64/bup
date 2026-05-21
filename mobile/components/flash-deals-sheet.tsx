// Bottom-sheet « Flash deals » — ouvert depuis le bouton éclair du
// header. Liste les campagnes durationKey='1h' actuellement actives
// renvoyées par /api/landing/flash-deals, chacune dans sa propre card.
// Parité conceptuelle avec la bannière marquee web (sans le défilement
// horizontal — sur mobile on empile verticalement pour la lisibilité).
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { BottomSheet } from "./bottom-sheet";
import {
  useDecideRelation,
  useFlashDeals,
  type FlashDeal,
} from "../lib/queries";

// "HH:MM:SS" depuis un endsAt ISO et un nowTs courant (passé en arg
// pour forcer le re-render à chaque tick du parent). "Expirée" si négatif.
function fmtHms(endsAt: string, nowTs: number): string {
  const ms = new Date(endsAt).getTime() - nowTs;
  if (ms <= 0) return "Expirée";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// "12,50 €" — montant fr-FR.
function fmtEur(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

// "×2" / "+50 €" / "×1.5" — multiplicateur du gain selon le type de bonus.
function fmtMultiplier(d: FlashDeal): string {
  if (d.founderVipBonusApplied) return "+50 €";
  if (d.founderBonusApplied) return "×2";
  const m = d.multiplier;
  if (!m || m === 1) return "Flash";
  // Garde une décimale uniquement si non entière.
  const txt = Number.isInteger(m) ? String(m) : m.toFixed(1).replace(".", ",");
  return `×${txt}`;
}

// Initiales pour avatar pro (fallback "?" si nom vide).
function initials(name: string | null): string {
  return (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function DealCard({ d, nowTs }: { d: FlashDeal; nowTs: number }) {
  const hms = fmtHms(d.endsAt, nowTs);
  const expired = hms === "Expirée";
  const mult = fmtMultiplier(d);
  const decide = useDecideRelation();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"accept" | "refuse" | null>(null);

  // Boutons actifs uniquement quand le prospect a déjà une relation
  // « pending » sur cette campagne (cf. /api/landing/flash-deals qui
  // joint relations et expose relationId + relationStatus).
  const canDecide = d.relationStatus === "pending" && !!d.relationId && !expired;

  async function decideRelation(action: "accept" | "refuse") {
    if (!d.relationId || busy) return;
    setBusy(action);
    try {
      await decide.mutateAsync({ id: d.relationId, action });
      // Refetch immédiat de la liste pour que la card disparaisse
      // (l'API filtre par relationStatus = pending pour rester actionable).
      await qc.invalidateQueries({ queryKey: ["landing", "flash-deals"] });
    } catch {
      Alert.alert(
        "Action impossible",
        "La campagne est peut-être expirée. Réessayez dans un instant.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <View
      className="rounded-2xl border border-line bg-paper"
      style={{
        padding: 14,
        gap: 14,
        // Léger glow violet pour rappeler l'identité flash deal.
        shadowColor: "#4F46E5",
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
    >
      {/* Header : avatar pro + nom/secteur + pill multiplicateur */}
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-violet-soft">
          <Text className="font-serif-bold text-[14px] text-violet">
            {initials(d.proName)}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-serif text-lg text-ink" numberOfLines={1}>
            {d.proName ?? "Un professionnel"}
          </Text>
          {d.proSector ? (
            <Text className="text-[13px] text-ink-4" numberOfLines={1}>
              {d.proSector}
            </Text>
          ) : null}
        </View>
        <View
          className="rounded-full"
          style={{
            backgroundColor: "#0F1629",
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text className="font-mono text-[12px] font-bold text-paper">
            {mult}
          </Text>
        </View>
      </View>

      {/* Brief (mot du pro) — italique, encadré accent doux */}
      {d.brief ? (
        <View
          className="rounded-xl px-3 py-2.5"
          style={{
            backgroundColor: "#F4F1FB",
            borderWidth: 1,
            borderColor: "#E4DEF5",
          }}
        >
          <Text className="font-serif-italic text-[13px] leading-5 text-ink-2">
            « {d.brief} »
          </Text>
        </View>
      ) : null}

      {/* Récompense + timer alignés */}
      <View className="flex-row items-center justify-between">
        <View>
          <Text
            className="font-mono text-[10px] uppercase text-ink-4"
            style={{ letterSpacing: 0.8 }}
          >
            Récompense
          </Text>
          <Text className="font-serif text-2xl text-violet">
            {fmtEur(d.costPerContactCents)}
          </Text>
        </View>
        <View className="items-end">
          <View className="flex-row items-center gap-1">
            <Ionicons name="flash" size={11} color="#92400E" />
            <Text
              className="font-mono text-[10px] uppercase text-ink-4"
              style={{ letterSpacing: 0.8 }}
            >
              Expire dans
            </Text>
          </View>
          <Text
            className="font-mono text-[16px] font-semibold"
            style={{
              color: expired ? "#DC2626" : "#0F1629",
              fontVariant: ["tabular-nums"],
            }}
          >
            {hms}
          </Text>
        </View>
      </View>

      {/* Actions Accepter / Refuser — branchées sur useDecideRelation
          (POST /api/prospect/relations/[id]/decision). Visibles quand
          le prospect a déjà une relation pending sur cette campagne. */}
      {canDecide ? (
        <View className="flex-row gap-3">
          <Pressable
            disabled={busy !== null}
            onPress={() => decideRelation("refuse")}
            className="flex-1 items-center rounded-full border border-line bg-paper py-3 active:opacity-70"
          >
            <Text className="text-sm font-medium text-ink-3">
              {busy === "refuse" ? "…" : "Refuser"}
            </Text>
          </Pressable>
          <Pressable
            disabled={busy !== null}
            onPress={() => decideRelation("accept")}
            className="flex-1 items-center rounded-full bg-ink py-3 active:opacity-80"
          >
            <Text className="text-sm font-semibold text-paper">
              {busy === "accept" ? "…" : "Accepter"}
            </Text>
          </Pressable>
        </View>
      ) : d.relationStatus === "accepted" || d.relationStatus === "settled" ? (
        <View className="flex-row items-center justify-center gap-1.5 rounded-full bg-good/10 py-2.5">
          <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
          <Text className="text-[13px] font-medium text-good">
            Déjà acceptée
          </Text>
        </View>
      ) : d.relationStatus === "refused" ? (
        <View className="flex-row items-center justify-center gap-1.5 rounded-full bg-bad/10 py-2.5">
          <Ionicons name="close-circle" size={14} color="#DC2626" />
          <Text className="text-[13px] font-medium text-bad">
            Refusée
          </Text>
        </View>
      ) : expired ? null : (
        // Pas encore sollicité : invitation à compléter ses données.
        <Text className="text-center text-[12.5px] text-ink-4">
          Complétez vos données pour pouvoir accepter ce deal.
        </Text>
      )}
    </View>
  );
}

export function FlashDealsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const q = useFlashDeals();
  const deals = q.data?.deals ?? [];

  // Refetch à l'ouverture (pour ne pas laisser le user voir des deals
  // figés/expirés si la sheet est restée fermée longtemps).
  useEffect(() => {
    if (visible) q.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Tick 1 s pour rafraîchir les timers HH:MM:SS visibles. Reset au
  // mount pour ne pas afficher une horloge figée si la sheet a été
  // refermée puis rouverte longtemps après.
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    if (!visible) return;
    setNowTs(Date.now());
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [visible]);

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPct={82}>
      <View className="flex-row items-center gap-2">
        <View
          className="h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: "#0F1629" }}
        >
          <Ionicons name="flash" size={16} color="#FFFFFF" />
        </View>
        <Text className="font-serif text-2xl text-ink">Flash deals</Text>
        {deals.length > 0 ? (
          <View className="rounded-full bg-ink px-2.5 py-0.5">
            <Text className="font-mono text-[11px] font-semibold text-paper">
              {deals.length}
            </Text>
          </View>
        ) : null}
      </View>
      <Text className="mb-4 mt-3 text-[13.5px] leading-5 text-ink-3">
        Les flash deals sont les sollicitations les{" "}
        <Text className="font-semibold text-ink">mieux rémunérées</Text>
        {" "}— bonus{" "}
        <Text className="font-semibold text-violet">×2 immédiat</Text>
        . N'hésitez pas, sautez sur l'occasion !
      </Text>

      {q.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#4F46E5" />
        </View>
      ) : q.isError ? (
        <View className="rounded-2xl border-l-4 border-bad bg-paper p-4">
          <Text className="text-sm text-bad">
            Impossible de charger les flash deals.
          </Text>
        </View>
      ) : deals.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <View
            className="mb-3 h-32 w-32 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(79, 70, 229, 0.10)" }}
          >
            <Ionicons name="flash-outline" size={56} color="#4F46E5" />
          </View>
          <Text className="font-serif text-xl text-ink">
            Aucun flash deal en cours
          </Text>
          <Text className="mt-1.5 text-center text-[14px] leading-5 text-ink-4">
            Les campagnes éclair{"\n"}apparaîtront ici dès leur lancement.
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-3 pb-2"
          showsVerticalScrollIndicator={false}
        >
          {deals.map((d) => (
            <DealCard key={d.id} d={d} nowTs={nowTs} />
          ))}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

// Indique au header s'il faut afficher la pastille rouge (au moins 1
// deal actif). Hook léger, partagé avec le bouton flash du header.
export function useFlashDealsCount() {
  const q = useFlashDeals();
  return q.data?.deals.length ?? 0;
}

