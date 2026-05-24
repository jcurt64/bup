// Bottom-sheet « Flash deals » — ouvert depuis le bouton éclair du
// header. Liste les campagnes durationKey='1h' actuellement actives
// renvoyées par /api/landing/flash-deals, chacune dans sa propre card.
// Parité conceptuelle avec la bannière marquee web (sans le défilement
// horizontal — sur mobile on empile verticalement pour la lisibilité).
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
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
import { DecisionFeedback } from "./decision-feedback";
import { ApiError } from "../lib/api";
import {
  useDecideRelation,
  useFlashDeals,
  type FlashDeal,
} from "../lib/queries";

// Mirror Prospect.jsx/HomeClient.tsx — libellés FR des catégories
// de données utilisés dans les chips « paliers requis ».
const TIER_KEY_LABEL_FR: Record<string, string> = {
  identity: "Identification",
  localisation: "Localisation",
  vie: "Style de vie",
  pro: "Données professionnelles",
  patrimoine: "Patrimoine & projets",
};

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
  // Toggle l'encart « Complétez vos données » quand l'utilisateur clique
  // Accepter alors qu'il a des paliers manquants. Évite d'appeler
  // /decision qui aboutirait mais laisserait le prospect non éligible
  // (le pro ne peut pas finaliser sans les données requises).
  const [showFillData, setShowFillData] = useState(false);
  // Feedback visuel post-décision (illustration + confettis pour accept).
  // null = pas de décision récente ; sinon on garde l'encart visible
  // pendant 3 s avant que le refetch fasse disparaître la card.
  const [justDecided, setJustDecided] = useState<"accept" | "refuse" | null>(null);
  const missing = d.missingTierKeys ?? [];
  const hasMissing = missing.length > 0;

  // Boutons actifs uniquement quand le prospect a déjà une relation
  // « pending » sur cette campagne (cf. /api/landing/flash-deals qui
  // joint relations et expose relationId + relationStatus).
  const canDecide = d.relationStatus === "pending" && !!d.relationId && !expired;

  async function decideRelation(action: "accept" | "refuse") {
    if (!d.relationId || busy) return;
    if (action === "accept" && hasMissing) {
      setShowFillData(true);
      return;
    }
    setBusy(action);
    try {
      await decide.mutateAsync({ id: d.relationId, action });
      // Feedback visuel : illustration + confettis (accept) / peace (refuse).
      // L'encart reste 2.5 s puis le refetch fait disparaître la card.
      setJustDecided(action);
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["landing", "flash-deals"] });
      }, 2500);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      // Le body 429 contient { message } rédigé côté serveur (avec
      // décompte « Réessayez dans … min »). On le réutilise tel quel.
      let serverMsg: string | null = null;
      if (e instanceof ApiError) {
        try {
          const j = JSON.parse(e.body) as { message?: string };
          if (typeof j.message === "string") serverMsg = j.message;
        } catch {}
      }
      const msg =
        status === 429 && serverMsg
          ? serverMsg
          : status === 402
            ? "Le professionnel n'a plus assez de budget sur sa campagne. Réessayez plus tard."
            : status === 410
              ? "Cette campagne a expiré."
              : status === 409
                ? "Cette sollicitation n'est plus dans un état modifiable. Rafraîchissez la liste."
                : "Action impossible. Réessayez dans un instant.";
      Alert.alert(
        status === 429 ? "Patientez un instant" : "Action impossible",
        msg,
      );
    } finally {
      setBusy(null);
    }
  }

  // Bascule refused → accepted via deux appels (undo puis accept).
  // L'endpoint /decision n'autorise pas refused → accepted en direct
  // (cf. table de transitions : refused → pending via undo, puis
  // pending → accepted via accept). Le serveur rate-limite TOUTES les
  // actions sur la clé `<userId>:<relationId>` avec fenêtre 5 min :
  // l'undo consomme le slot, donc l'accept immédiat reçoit 429. On
  // capture spécifiquement ce cas pour expliquer que l'undo a réussi
  // et indiquer quand réessayer (cf. movement-detail-sheet.tsx).
  async function acceptAfterRefused() {
    if (!d.relationId || busy) return;
    if (hasMissing) {
      setShowFillData(true);
      return;
    }
    setBusy("accept");
    try {
      await decide.mutateAsync({ id: d.relationId, action: "undo" });
      try {
        await decide.mutateAsync({ id: d.relationId, action: "accept" });
      } catch (acceptErr) {
        if (acceptErr instanceof ApiError && acceptErr.status === 429) {
          let waitMsg = "Réessayez dans quelques minutes";
          try {
            const j = JSON.parse(acceptErr.body) as {
              retryAfterSec?: number;
            };
            if (
              typeof j.retryAfterSec === "number" &&
              j.retryAfterSec > 0
            ) {
              const mins = Math.ceil(j.retryAfterSec / 60);
              waitMsg = `Réessayez dans ${mins} min`;
            }
          } catch {}
          // Refetch pour basculer le deal de refused → pending dans l'UI
          // — l'utilisateur pourra reclique sur Accepter après expiration.
          qc.invalidateQueries({ queryKey: ["landing", "flash-deals"] });
          Alert.alert(
            "Refus annulé",
            `Votre refus a été annulé — cette sollicitation est de nouveau en attente. Pour confirmer votre acceptation, ${waitMsg}.`,
          );
          return;
        }
        throw acceptErr;
      }
      setJustDecided("accept");
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["landing", "flash-deals"] });
      }, 2500);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      // Le body 429 contient { message } rédigé côté serveur (avec
      // décompte « Réessayez dans … min »). On le réutilise tel quel.
      let serverMsg: string | null = null;
      if (e instanceof ApiError) {
        try {
          const j = JSON.parse(e.body) as { message?: string };
          if (typeof j.message === "string") serverMsg = j.message;
        } catch {}
      }
      const msg =
        status === 429 && serverMsg
          ? serverMsg
          : status === 402
            ? "Le professionnel n'a plus assez de budget sur sa campagne. Réessayez plus tard."
            : status === 410
              ? "Cette campagne a expiré."
              : status === 409
                ? "Cette sollicitation n'est plus dans un état modifiable. Rafraîchissez la liste."
                : "Action impossible. Réessayez dans un instant.";
      Alert.alert(
        status === 429 ? "Patientez un instant" : "Action impossible",
        msg,
      );
    } finally {
      setBusy(null);
    }
  }

  // accepted → refused : direct via /decision action=refuse (la RPC
  // refund_relation_tx gère le remboursement du pro côté wallet).
  async function refuseAfterAccepted() {
    if (!d.relationId || busy) return;
    setBusy("refuse");
    try {
      await decide.mutateAsync({ id: d.relationId, action: "refuse" });
      setJustDecided("refuse");
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["landing", "flash-deals"] });
      }, 2500);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      // Le body 429 contient { message } rédigé côté serveur (avec
      // décompte « Réessayez dans … min »). On le réutilise tel quel.
      let serverMsg: string | null = null;
      if (e instanceof ApiError) {
        try {
          const j = JSON.parse(e.body) as { message?: string };
          if (typeof j.message === "string") serverMsg = j.message;
        } catch {}
      }
      const msg =
        status === 429 && serverMsg
          ? serverMsg
          : status === 402
            ? "Le professionnel n'a plus assez de budget sur sa campagne. Réessayez plus tard."
            : status === 410
              ? "Cette campagne a expiré."
              : status === 409
                ? "Cette sollicitation n'est plus dans un état modifiable. Rafraîchissez la liste."
                : "Action impossible. Réessayez dans un instant.";
      Alert.alert(
        status === 429 ? "Patientez un instant" : "Action impossible",
        msg,
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

      {/* Catégories de données demandées — chips. Couleur ink pour
          celles déjà remplies, ambre pour celles manquantes. */}
      {d.requiredTierKeys?.length > 0 ? (
        <View>
          <Text
            className="font-mono text-[10px] uppercase text-ink-4"
            style={{ letterSpacing: 0.8 }}
          >
            Données demandées
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-1.5">
            {d.requiredTierKeys.map((k) => {
              const missing = (d.missingTierKeys ?? []).includes(k);
              return (
                <View
                  key={k}
                  className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
                  style={{
                    backgroundColor: missing ? "#FEF6E7" : "#F2EEF5",
                    borderWidth: 1,
                    borderColor: missing ? "#F5C57A" : "#E6E3DA",
                  }}
                >
                  <Ionicons
                    name={missing ? "alert-circle-outline" : "checkmark-circle"}
                    size={11}
                    color={missing ? "#92400E" : "#16A34A"}
                  />
                  <Text
                    className="text-[11.5px] font-medium"
                    style={{ color: missing ? "#92400E" : "#0F1629" }}
                  >
                    {TIER_KEY_LABEL_FR[k] ?? k}
                  </Text>
                </View>
              );
            })}
          </View>
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

      {/* Bloc actions — modes mirror du web (FlashDealModal) :
          - canDecide : pending + relationId + non expiré → Accepter/Refuser
          - already_accepted / settled → chip vert
          - already_refused → chip rouge
          - fill_data : auth + pas de relation + paliers manquants → CTA
          - no_match : auth + pas de relation + tout rempli → message d'attente
          - non auth : déjà filtré côté liste (sheet est dans l'app loggée) */}
      {justDecided ? (
        <DecisionFeedback decision={justDecided} />
      ) : canDecide && showFillData && hasMissing ? (
        // Encart « fill_data » déclenché par un clic Accepter avec des
        // paliers manquants. Liste les catégories à remplir et pousse
        // vers /(prospect)/donnees.
        <View className="gap-2">
          <View
            className="rounded-xl px-3 py-2.5"
            style={{
              backgroundColor: "#FEF6E7",
              borderWidth: 1,
              borderColor: "#F5C57A",
            }}
          >
            <Text className="text-[13px] leading-5" style={{ color: "#92400E" }}>
              Pour accepter ce deal, complétez d'abord{" "}
              <Text className="font-semibold">
                {missing
                  .map((k) => TIER_KEY_LABEL_FR[k] ?? k)
                  .join(", ")}
              </Text>
              .
            </Text>
          </View>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setShowFillData(false)}
              className="items-center rounded-full border border-line bg-paper px-4 py-3 active:opacity-70"
            >
              <Text className="text-sm font-medium text-ink-3">Annuler</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(prospect)/donnees")}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-ink py-3 active:opacity-80"
            >
              <Text className="text-sm font-semibold text-paper">
                Compléter mes données
              </Text>
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      ) : canDecide ? (
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
      ) : d.relationStatus === "accepted" && !expired ? (
        // already_accepted (campagne encore active, escrow non encore
        // settled) — autorise un retour en arrière vers refused.
        <View className="gap-2">
          <View
            className="rounded-xl px-3 py-2.5"
            style={{
              backgroundColor: "#E8F5EE",
              borderWidth: 1,
              borderColor: "#B8DDC4",
            }}
          >
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
              <Text
                className="text-[13px] font-semibold"
                style={{ color: "#0F1629" }}
              >
                Sollicitation déjà acceptée.
              </Text>
            </View>
            <Text className="mt-1 text-[12px] leading-4 text-ink-4">
              La campagne est encore active : vous pouvez changer d'avis
              et refuser tant qu'elle n'est pas clôturée.
            </Text>
          </View>
          <Pressable
            disabled={busy !== null}
            onPress={refuseAfterAccepted}
            className="items-center rounded-full border border-line bg-paper py-3 active:opacity-70"
          >
            <Text className="text-sm font-medium text-ink">
              {busy === "refuse" ? "Refus en cours…" : "Refuser finalement"}
            </Text>
          </Pressable>
        </View>
      ) : d.relationStatus === "settled" ? (
        // already_settled — campagne soldée, plus de retour possible.
        <View className="flex-row items-center justify-center gap-1.5 rounded-full bg-good/10 py-2.5">
          <Ionicons name="checkmark-done-circle" size={14} color="#16A34A" />
          <Text className="text-[13px] font-medium text-good">
            Sollicitation acceptée · créditée
          </Text>
        </View>
      ) : d.relationStatus === "refused" && !expired ? (
        // already_refused (campagne encore active) — autorise un retour
        // en arrière vers accepted via undo+accept enchaînés.
        <View className="gap-2">
          <View
            className="rounded-xl px-3 py-2.5"
            style={{
              backgroundColor: "#EFEADD",
              borderWidth: 1,
              borderColor: "#E6E3DA",
            }}
          >
            <Text
              className="text-[13px] font-semibold"
              style={{ color: "#0F1629" }}
            >
              Vous avez refusé cette sollicitation.
            </Text>
            <Text className="mt-1 text-[12px] leading-4 text-ink-4">
              La campagne est encore active : vous pouvez changer d'avis
              et accepter tant qu'elle n'est pas clôturée.
            </Text>
          </View>
          <Pressable
            disabled={busy !== null}
            onPress={acceptAfterRefused}
            className="flex-row items-center justify-center gap-2 rounded-full bg-ink py-3 active:opacity-80"
          >
            <Text className="text-sm font-semibold text-paper">
              {busy === "accept" ? "Acceptation en cours…" : "Accepter finalement"}
            </Text>
            {busy === "accept" ? null : (
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      ) : d.relationStatus === "refused" ? (
        // already_refused mais campagne expirée — chip rouge final.
        <View className="flex-row items-center justify-center gap-1.5 rounded-full bg-bad/10 py-2.5">
          <Ionicons name="close-circle" size={14} color="#DC2626" />
          <Text className="text-[13px] font-medium text-bad">
            Sollicitation refusée
          </Text>
        </View>
      ) : expired ? null : (d.missingTierKeys?.length ?? 0) > 0 ? (
        // fill_data — invitation à compléter les données manquantes
        // pour devenir éligible à ce deal.
        <Pressable
          onPress={() => router.push("/(prospect)/donnees")}
          className="flex-row items-center justify-center gap-2 rounded-full py-3 active:opacity-80"
          style={{ backgroundColor: "#F2B65A" }}
        >
          <Ionicons name="document-text-outline" size={16} color="#0F1629" />
          <Text className="text-sm font-semibold text-ink">
            Compléter mes données
          </Text>
        </Pressable>
      ) : (
        // no_match — auth, paliers requis remplis, mais le ciblage de
        // la campagne (géo, âge, centres d'intérêt…) n'inclut pas ce
        // prospect. Mirror du web : message explicatif + CTA noir pour
        // compléter ses données et augmenter ses chances d'être éligible.
        <View className="gap-2">
          <View
            className="rounded-xl px-3 py-2.5"
            style={{
              backgroundColor: "#EFEADD",
              borderWidth: 1,
              borderColor: "#E6E3DA",
            }}
          >
            <Text className="text-[12.5px] leading-5 text-ink-2">
              Cette campagne ne correspond pas à votre profil (zone
              géographique, tranche d'âge ou centres d'intérêt).
              Complétez vos données pour augmenter vos chances d'être
              éligible.
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/(prospect)/donnees")}
            className="flex-row items-center justify-center gap-2 rounded-full bg-ink py-3 active:opacity-80"
          >
            <Text className="text-sm font-semibold text-paper">
              Compléter mes données pour accepter le deal
            </Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </Pressable>
        </View>
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
  const lastSevenDaysCount = q.data?.stats?.lastSevenDaysCount ?? 0;

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
        // Empty state convivial — illustration violet doux conservée
        // (cf. demande user 24/05/2026), puis trois blocs complémentaires
        // pour combler le vide visuel sans saturer : astuce, mini-stat
        // 7 jours (depuis /api/landing/flash-deals → stats), CTA données.
        // Wrappé dans ScrollView pour les petits écrans (SE 1ʳᵉ gen).
        <ScrollView
          className="flex-1"
          contentContainerClassName="items-center pt-2 pb-4"
          showsVerticalScrollIndicator={false}
        >
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

          {/* Carte « Astuce » — violet doux, fil rouge identité flash. */}
          <View
            className="mt-6 w-full rounded-2xl px-4 py-3.5"
            style={{
              backgroundColor: "#F4F1FB",
              borderWidth: 1,
              borderColor: "#E4DEF5",
            }}
          >
            <View className="flex-row items-center gap-2">
              <View
                className="h-7 w-7 items-center justify-center rounded-full"
                style={{ backgroundColor: "#E4DEF5" }}
              >
                <Ionicons name="bulb" size={13} color="#4F46E5" />
              </View>
              <Text
                className="font-mono text-[10.5px] uppercase text-violet"
                style={{ letterSpacing: 0.8 }}
              >
                Astuce
              </Text>
            </View>
            <Text className="mt-2 text-[13.5px] leading-5 text-ink-2">
              Plus vos données sont complètes, plus vous matchez de flash
              deals. La plupart partent en moins d'une heure — soyez prêt·e
              à saisir le prochain.
            </Text>
          </View>

          {/* Mini-stat 7 jours — chiffre dynamique si > 0, sinon message
              alternatif pour ne pas afficher un « 0 » triste. */}
          <View className="mt-3 w-full flex-row items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3.5">
            <View
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: "#EFEADD" }}
            >
              <Ionicons name="stats-chart" size={15} color="#0F1629" />
            </View>
            <View className="flex-1">
              {lastSevenDaysCount > 0 ? (
                <>
                  <Text className="font-serif text-[18px] text-ink">
                    {lastSevenDaysCount}{" "}
                    <Text className="text-[14px] text-ink-3">
                      {lastSevenDaysCount === 1
                        ? "flash deal lancé"
                        : "flash deals lancés"}
                    </Text>
                  </Text>
                  <Text className="text-[12px] text-ink-4">
                    sur les 7 derniers jours
                  </Text>
                </>
              ) : (
                <>
                  <Text className="font-serif text-[15px] text-ink">
                    Le saviez-vous ?
                  </Text>
                  <Text className="mt-0.5 text-[12.5px] leading-4 text-ink-4">
                    Les flash deals expirent en 1 h. Activez vos
                    notifications pour ne rien manquer.
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* CTA discret vers Mes données — augmente la probabilité de
              matcher un futur flash deal. Ferme la sheet avant de naviguer
              pour ne pas la laisser ouverte derrière l'écran de paliers. */}
          <Pressable
            onPress={() => {
              onClose();
              router.push("/(prospect)/donnees");
            }}
            className="mt-4 w-full flex-row items-center justify-center gap-2 rounded-full bg-ink py-3 active:opacity-80"
          >
            <Text className="text-sm font-semibold text-paper">
              Compléter mes données
            </Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </Pressable>
        </ScrollView>
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

