// Garde « coordonnées complètes » à l'acceptation d'une sollicitation.
//
// Règle métier (pivot mise en relation) : pour ACCEPTER une sollicitation, le
// prospect doit avoir renseigné ses 7 coordonnées — prénom, initiale du nom,
// ville, sexe, tranche d'âge, téléphone et e-mail. Le serveur applique le même garde-fou (422).
//
// Ce provider porte l'état du gate, écoute le profil (`/api/prospect/donnees`)
// pour rouvrir une modale quand tout est rempli, et héberge les deux
// bottom-sheets.
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
  CONTACT_FIELDS,
  CONTACT_FIELD_LABEL,
  missingContactFields,
  type ContactField,
} from "../lib/contact-channels";
import { useProspectDonnees } from "../lib/queries";
import { useTheme } from "../lib/theme";

const FIELD_ICON: Record<ContactField, keyof typeof Ionicons.glyphMap> = {
  prenom: "person-outline",
  nom: "text-outline",
  ville: "business-outline",
  genre: "people-outline",
  trancheAge: "calendar-outline",
  email: "mail-outline",
  telephone: "call-outline",
};

type RelationLike = { id: string };

type AcceptGateState = {
  relationId: string;
  missingFields: ContactField[];
} | null;
type PendingAccept = { relationId: string } | null;
type AcceptReady = { relationId: string } | null;

type AcceptGateCtx = {
  /** Pré-check au clic « Accepter ». Renvoie `true` si l'acceptation est
   *  bloquée (modale ouverte) → l'appelant NE doit PAS appeler l'API. Renvoie
   *  `false` si tout est complet (ou si le profil n'est pas encore chargé : on
   *  laisse alors le backstop serveur 422 jouer). */
  guardAccept: (rel: RelationLike) => boolean;
  /** Backstop : ouvre la modale d'incomplétude à partir d'une réponse 422. */
  openIncomplete: (relationId: string, missingFields?: string[]) => void;
};

const Ctx = createContext<AcceptGateCtx | null>(null);

/** Variante tolérante : `null` hors AcceptGateProvider (ex. feuille flash
 *  deals montée par le header, aussi présent côté pro). */
export function useAcceptGateOptional(): AcceptGateCtx | null {
  return useContext(Ctx);
}

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
      if (!data) return false;
      const missingFields = missingContactFields(data.identity);
      if (missingFields.length > 0) {
        setAcceptGate({ relationId: rel.id, missingFields });
        return true;
      }
      return false;
    },
    [q.data],
  );

  const openIncomplete = useCallback(
    (relationId: string, missingFields?: string[]) => {
      const known = (missingFields ?? []).filter((f): f is ContactField =>
        (CONTACT_FIELDS as readonly string[]).includes(f),
      );
      const fromProfile = q.data ? missingContactFields(q.data.identity) : [];
      setAcceptGate({
        relationId,
        missingFields:
          known.length > 0
            ? known
            : fromProfile.length > 0
              ? fromProfile
              : [...CONTACT_FIELDS],
      });
    },
    [q.data],
  );

  // Watcher : quand le prospect a complété ses coordonnées depuis « Mes
  // données » → modale « vous pouvez retourner accepter ».
  useEffect(() => {
    if (!pendingAccept) return;
    const data = q.data;
    if (!data) return;
    if (missingContactFields(data.identity).length === 0) {
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
        missingFields={acceptGate?.missingFields ?? []}
        onClose={() => setAcceptGate(null)}
        onGoToData={() => {
          if (acceptGate) {
            setPendingAccept({ relationId: acceptGate.relationId });
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
  missingFields,
  onClose,
  onGoToData,
}: {
  visible: boolean;
  missingFields: ContactField[];
  onClose: () => void;
  onGoToData: () => void;
}) {
  const { c } = useTheme();
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
                vos coordonnées complètes
              </Text>{" "}
              (prénom, initiale du nom, ville, sexe, tranche d&apos;âge, téléphone
              et e-mail) pour accepter cette mise en relation. Le professionnel
              ne voit que votre prénom et l&apos;initiale de votre nom.
            </Text>
          </View>
        </View>

        {/* Liste des coordonnées à compléter */}
        {missingFields.length > 0 ? (
          <View className="rounded-xl bg-ivory-2 px-3.5 py-3">
            <Text
              className="font-mono text-[10px] uppercase text-ink-4"
              style={{ letterSpacing: 0.8, marginBottom: 8 }}
            >
              À renseigner
            </Text>
            <View style={{ gap: 6 }}>
              {missingFields.map((f) => (
                <View key={f} className="flex-row items-center gap-2">
                  <Ionicons name={FIELD_ICON[f]} size={14} color={c.accent} />
                  <Text className="text-[13px] text-ink-2">
                    {CONTACT_FIELD_LABEL[f]}
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
              Vos coordonnées sont désormais complètes. Vous
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
