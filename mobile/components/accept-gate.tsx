// Garde « données complètes » à l'acceptation d'une sollicitation (miroir
// mobile de la logique web : Prospect.jsx `acceptGate` / `pendingAccept` /
// `acceptReady` + AcceptIncompleteModal / AcceptReadyModal).
//
// Règle métier : un prospect reçoit toutes les sollicitations qui le matchent,
// mais pour ACCEPTER il doit avoir intégralement renseigné tous les paliers
// exigés par la campagne (`relation.tiers`). Le serveur applique le même
// garde-fou (422 `tiers_incomplete`, AVANT le rate-limit).
//
// Le mobile n'a pas de « provider prospect » (tout passe par React Query) :
// ce provider porte l'état du gate, le rend résilient à la navigation, écoute
// la complétude du profil (`/api/prospect/donnees`) pour rouvrir une modale
// quand tout est rempli, et héberge les deux bottom-sheets.
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Pressable, Text, View } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import {
  missingRequiredTierNums,
  relationRequiredTierNums,
  TIER_LABEL,
  TIER_NUM_TO_KEY,
} from "../lib/completeness";
import { useProspectDonnees } from "../lib/queries";
import { useTheme } from "../lib/theme";

// Icône par numéro de palier (parité TIER_META de donnees.tsx).
const TIER_ICON: Record<number, keyof typeof Ionicons.glyphMap> = {
  1: "finger-print-outline",
  2: "map-outline",
  3: "heart-outline",
  4: "briefcase-outline",
  5: "diamond-outline",
};

type RelationLike = {
  id: string;
  tiers?: number[] | null;
  tier?: number | null;
};

type AcceptGateState = {
  relationId: string;
  requiredTierNums: number[];
  missingTierNums: number[];
} | null;
type PendingAccept = { relationId: string; requiredTierNums: number[] } | null;
type AcceptReady = { relationId: string } | null;

type AcceptGateCtx = {
  /** Pré-check au clic « Accepter ». Renvoie `true` si l'acceptation est
   *  bloquée (modale ouverte) → l'appelant NE doit PAS appeler l'API. Renvoie
   *  `false` si tout est complet (ou si le profil n'est pas encore chargé : on
   *  laisse alors le backstop serveur 422 jouer). */
  guardAccept: (rel: RelationLike) => boolean;
  /** Backstop : ouvre la modale d'incomplétude à partir d'une réponse 422
   *  serveur (`missingTiers`). */
  openIncomplete: (
    relationId: string,
    requiredTierNums: number[],
    missingTierNums: number[],
  ) => void;
};

const Ctx = createContext<AcceptGateCtx | null>(null);

export function useAcceptGate(): AcceptGateCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAcceptGate must be used within AcceptGateProvider");
  return v;
}

export function AcceptGateProvider({ children }: { children: ReactNode }) {
  const q = useProspectDonnees();
  const [acceptGate, setAcceptGate] = useState<AcceptGateState>(null);
  const [pendingAccept, setPendingAccept] = useState<PendingAccept>(null);
  const [acceptReady, setAcceptReady] = useState<AcceptReady>(null);

  const guardAccept = useCallback(
    (rel: RelationLike): boolean => {
      const data = q.data;
      // Profil pas encore chargé → on ne bloque pas côté client ; le serveur
      // renverra 422 le cas échéant (backstop géré par l'appelant).
      if (!data) return false;
      const requiredTierNums = relationRequiredTierNums(rel);
      const missingTierNums = missingRequiredTierNums(requiredTierNums, data);
      if (missingTierNums.length > 0) {
        setAcceptGate({ relationId: rel.id, requiredTierNums, missingTierNums });
        return true;
      }
      return false;
    },
    [q.data],
  );

  const openIncomplete = useCallback(
    (
      relationId: string,
      requiredTierNums: number[],
      missingTierNums: number[],
    ) => {
      setAcceptGate({
        relationId,
        requiredTierNums,
        missingTierNums:
          missingTierNums.length > 0 ? missingTierNums : requiredTierNums,
      });
    },
    [],
  );

  // Watcher : quand le prospect a complété, depuis « Mes données », tous les
  // paliers requis de la sollicitation qu'il voulait accepter → modale
  // « vous pouvez retourner accepter ». Miroir web Prospect.jsx (effet sur
  // `pendingAccept`). La query donnees est invalidée après chaque PATCH, donc
  // ce provider (même cache React Query) reçoit les données fraîches.
  useEffect(() => {
    if (!pendingAccept) return;
    const data = q.data;
    if (!data) return;
    const missing = missingRequiredTierNums(pendingAccept.requiredTierNums, data);
    if (missing.length === 0) {
      setAcceptReady({ relationId: pendingAccept.relationId });
      setPendingAccept(null);
    }
  }, [q.data, pendingAccept]);

  const value = useMemo<AcceptGateCtx>(
    () => ({ guardAccept, openIncomplete }),
    [guardAccept, openIncomplete],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <AcceptIncompleteSheet
        visible={acceptGate !== null}
        missingTierNums={acceptGate?.missingTierNums ?? []}
        onClose={() => setAcceptGate(null)}
        onGoToData={() => {
          if (acceptGate) {
            setPendingAccept({
              relationId: acceptGate.relationId,
              requiredTierNums: acceptGate.requiredTierNums,
            });
          }
          setAcceptGate(null);
          router.push("/(prospect)/donnees");
        }}
      />
      <AcceptReadySheet
        visible={acceptReady !== null}
        onClose={() => setAcceptReady(null)}
        onBack={() => {
          const id = acceptReady?.relationId;
          setAcceptReady(null);
          router.push(
            id
              ? { pathname: "/(prospect)/relations", params: { focusRelation: id } }
              : "/(prospect)/relations",
          );
        }}
      />
    </Ctx.Provider>
  );
}

// ── Modale « Informations incomplètes » ─────────────────────────────────────
function AcceptIncompleteSheet({
  visible,
  missingTierNums,
  onClose,
  onGoToData,
}: {
  visible: boolean;
  missingTierNums: number[];
  onClose: () => void;
  onGoToData: () => void;
}) {
  const { c } = useTheme();
  const tiers = [...missingTierNums]
    .filter((n) => TIER_NUM_TO_KEY[n])
    .sort((a, b) => a - b);
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ gap: 16, paddingBottom: 8 }}>
        {/* Titre */}
        <View className="flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: "#D97706" }}
          >
            <Ionicons name="alert" size={18} color="#FFFFFF" />
          </View>
          <Text className="flex-1 font-serif text-xl text-ink">
            Informations incomplètes
          </Text>
        </View>

        {/* Encart explicatif */}
        <View
          className="flex-row gap-3 rounded-2xl px-4 py-3.5"
          style={{
            backgroundColor: "#FFF7ED",
            borderWidth: 1.5,
            borderColor: "#FDBA74",
          }}
        >
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: "#D97706" }}
          >
            <Ionicons name="information" size={16} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-[14px] text-ink">
              Pour accepter cette sollicitation
            </Text>
            <Text className="mt-1 text-[13px] leading-5 text-ink-2">
              Merci de renseigner{" "}
              <Text className="font-semibold">
                l&apos;intégralité des informations demandées
              </Text>{" "}
              pour accepter cette sollicitation. Tant qu&apos;un palier requis
              est incomplet, vous ne pouvez pas accepter cette mise en relation.
            </Text>
          </View>
        </View>

        {/* Liste des paliers à compléter */}
        {tiers.length > 0 ? (
          <View className="rounded-xl bg-ivory-2 px-3.5 py-3">
            <Text
              className="font-mono text-[10px] uppercase text-ink-4"
              style={{ letterSpacing: 0.8, marginBottom: 8 }}
            >
              Paliers à compléter
            </Text>
            <View style={{ gap: 6 }}>
              {tiers.map((n) => (
                <View key={n} className="flex-row items-center gap-2">
                  <Ionicons
                    name={TIER_ICON[n] ?? "ellipse-outline"}
                    size={14}
                    color={c.accent}
                  />
                  <Text className="text-[13px] text-ink-2">
                    Palier {n} · {TIER_LABEL[n] ?? ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Actions */}
        <View className="mt-1 flex-row gap-3">
          <Pressable
            onPress={onClose}
            className="flex-1 items-center rounded-full border border-line bg-paper py-3.5 active:opacity-70"
          >
            <Text className="text-sm font-medium text-ink-3">Plus tard</Text>
          </Pressable>
          <Pressable
            onPress={onGoToData}
            accessibilityRole="button"
            accessibilityLabel="Renseigner mes informations"
            className="flex-1 flex-row items-center justify-center gap-2 rounded-full py-3.5 active:opacity-80"
            style={{ backgroundColor: c.btnBg }}
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: c.btnText }}
              numberOfLines={1}
            >
              Renseigner mes informations
            </Text>
            <Ionicons name="arrow-forward" size={14} color={c.btnText} />
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

// ── Modale « Informations complétées » ──────────────────────────────────────
function AcceptReadySheet({
  visible,
  onClose,
  onBack,
}: {
  visible: boolean;
  onClose: () => void;
  onBack: () => void;
}) {
  const { c } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ gap: 16, paddingBottom: 8 }}>
        {/* Titre */}
        <View className="flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: c.accGreen }}
          >
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
          </View>
          <Text className="flex-1 font-serif text-xl text-ink">
            Informations complétées
          </Text>
        </View>

        {/* Encart succès */}
        <View
          className="flex-row gap-3 rounded-2xl px-4 py-3.5"
          style={{
            backgroundColor: c.tintGreen,
            borderWidth: 1.5,
            borderColor: c.borderSoft,
          }}
        >
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: c.accGreen }}
          >
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-[14px] text-ink">
              Tout est renseigné
            </Text>
            <Text className="mt-1 text-[13px] leading-5 text-ink-2">
              Vos paliers requis sont désormais intégralement remplis. Vous
              pouvez{" "}
              <Text className="font-semibold">
                retourner à la sollicitation pour l&apos;accepter
              </Text>
              .
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View className="mt-1 flex-row gap-3">
          <Pressable
            onPress={onClose}
            className="flex-1 items-center rounded-full border border-line bg-paper py-3.5 active:opacity-70"
          >
            <Text className="text-sm font-medium text-ink-3">Fermer</Text>
          </Pressable>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Retourner à la sollicitation"
            className="flex-1 flex-row items-center justify-center gap-2 rounded-full py-3.5 active:opacity-80"
            style={{ backgroundColor: c.btnBg }}
          >
            <Ionicons name="swap-horizontal" size={15} color={c.btnText} />
            <Text
              className="text-sm font-semibold"
              style={{ color: c.btnText }}
              numberOfLines={1}
            >
              Retourner à la sollicitation
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}
