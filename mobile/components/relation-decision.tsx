// Flux de décision Accepter / Refuser une mise en relation, PARTAGÉ entre le
// détail (MovementDetailSheet), les boutons directs des cartes de
// sollicitation (écran Relations) et le détail d'un flash deal
// (FlashDealDetailSheet). Une seule implémentation de :
//   · garde « données complètes » (pré-check client + backstop 422),
//   · autorisation de suivi iOS (ATT) pour les campagnes « Publicité
//     digitale » (pré-check client + backstop 403 tracking_not_authorized),
//   · consentement préalable au canal téléphonique (PhoneConsentSheet),
//   · refused → accepted via undo puis accept (429 rate-limit géré),
//   · messages d'erreur 429 / 403 accept_restricted / 402 / 410 / 409.
// Le consommateur rend `sheet` (popup de consentement) dans son arbre.
import { useState } from "react";
import { Alert, Linking } from "react-native";

import { useAcceptGateOptional } from "./accept-gate";
import { PhoneConsentSheet } from "./phone-consent-sheet";
import { ApiError } from "../lib/api";
import { relationRequiredTierNums } from "../lib/completeness";
import { useDecideRelation } from "../lib/queries";
import {
  resolveTrackingAuthorization,
  TRACKING_OBJECTIVE_ID,
} from "../lib/tracking";

export type DecisionAction = "accept" | "refuse";

/** Sous-ensemble d'une relation nécessaire à la décision. */
export type DecisionTarget = {
  id: string;
  tier: number;
  tiers?: number[] | null;
  /** Statut brut DB — "refused" déclenche le passage undo → accept. */
  relationStatus?: string | null;
  /** Objectif de la campagne — "addigital" exige l'autorisation ATT (iOS). */
  objectiveId?: string | null;
};

export type DecisionOptions = {
  /** Appelé uniquement quand la décision a bien été enregistrée. */
  onSuccess?: (action: DecisionAction) => void;
  /** Ne pas appliquer la garde « données complètes » du provider (l'appelant
   *  fait déjà son propre pré-check, ex. flash deals). */
  skipGate?: boolean;
};

type Pending = {
  target: DecisionTarget;
  onDone?: () => void;
  opts?: DecisionOptions;
  trackingAuthorized?: boolean;
};

const TRACKING_TITLE = "Autorisation de suivi requise";
const TRACKING_MSG =
  "Cette campagne de publicité digitale permet au professionnel de vous montrer ses publicités sur d'autres applis et sites. Pour l'accepter, vous devez autoriser BUUPP à suivre votre activité.\n\n" +
  "Pour l'activer : Réglages › Confidentialité et sécurité › Suivi, puis activez BUUPP.";

function showTrackingRequired(message?: string | null) {
  Alert.alert(TRACKING_TITLE, message || TRACKING_MSG, [
    { text: "Plus tard", style: "cancel" },
    { text: "Ouvrir les Réglages", onPress: () => void Linking.openSettings() },
  ]);
}

function parseErrorBody(e: unknown): { error?: string; message?: string } {
  if (!(e instanceof ApiError)) return {};
  try {
    const j = JSON.parse(e.body) as { error?: unknown; message?: unknown };
    return {
      error: typeof j.error === "string" ? j.error : undefined,
      message: typeof j.message === "string" ? j.message : undefined,
    };
  } catch {
    return {};
  }
}

export function useRelationDecision() {
  const decide = useDecideRelation();
  // Optionnel : la feuille flash deals est aussi montée hors espace prospect.
  const gate = useAcceptGateOptional();
  const [busy, setBusy] = useState<{ id: string; action: DecisionAction } | null>(null);
  // Acceptation en attente du consentement téléphone (popup ouverte).
  const [consentFor, setConsentFor] = useState<Pending | null>(null);

  async function perform(
    action: DecisionAction,
    target: DecisionTarget,
    onDone?: () => void,
    opts?: DecisionOptions,
    trackingAuthorized?: boolean,
  ) {
    const alreadyRefused = target.relationStatus === "refused";
    setBusy({ id: target.id, action });
    try {
      // Statut ATT envoyé avec toute acceptation iOS (le serveur ne l'exige
      // que pour « Publicité digitale »). Déjà résolu en amont pour ces
      // campagnes ; sinon simple lecture du statut, sans demande.
      const tracking =
        action === "accept"
          ? (trackingAuthorized ?? (await resolveTrackingAuthorization(false)))
          : undefined;
      // refused → accepted : l'API n'autorise pas la transition directe
      // (refused → pending via undo, puis pending → accepted). Le serveur
      // rate-limite toutes les actions sur `<userId>:<relationId>` (5 min) :
      // l'undo consomme le slot, l'accept immédiat reçoit donc 429.
      if (action === "accept" && alreadyRefused) {
        await decide.mutateAsync({ id: target.id, action: "undo" });
        try {
          await decide.mutateAsync({
            id: target.id,
            action: "accept",
            phoneConsent: true,
            trackingAuthorized: tracking,
          });
        } catch (acceptErr) {
          if (acceptErr instanceof ApiError && acceptErr.status === 429) {
            let waitMsg = "Réessayez dans quelques minutes";
            try {
              const j = JSON.parse(acceptErr.body) as { retryAfterSec?: number };
              if (typeof j.retryAfterSec === "number" && j.retryAfterSec > 0) {
                waitMsg = `Réessayez dans ${Math.ceil(j.retryAfterSec / 60)} min`;
              }
            } catch {}
            Alert.alert(
              "Refus annulé",
              `Votre refus a été annulé — cette sollicitation est de nouveau en attente. Pour confirmer votre acceptation, ${waitMsg}.`,
            );
            onDone?.();
            return;
          }
          throw acceptErr;
        }
      } else {
        await decide.mutateAsync({
          id: target.id,
          action,
          phoneConsent: action === "accept" ? true : undefined,
          trackingAuthorized: tracking,
        });
      }
      opts?.onSuccess?.(action);
      onDone?.();
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      const body = parseErrorBody(e);
      // Backstop garde « données complètes » : 422 tiers_incomplete (profil
      // pas encore chargé côté client) → même modale que le pré-check.
      if (status === 422 && action === "accept") {
        let missingTiers: number[] = [];
        if (e instanceof ApiError) {
          try {
            const j = JSON.parse(e.body) as { missingTiers?: number[] };
            if (Array.isArray(j.missingTiers)) {
              missingTiers = j.missingTiers.filter((n) => Number.isFinite(n));
            }
          } catch {}
        }
        if (gate) {
          gate.openIncomplete(
            target.id,
            relationRequiredTierNums({ tiers: target.tiers, tier: target.tier }),
            missingTiers,
          );
        } else {
          Alert.alert(
            "Données incomplètes",
            "Pour accepter, complétez d'abord les données demandées par cette campagne dans « Mes données ».",
          );
        }
        onDone?.();
        return;
      }
      // Backstop ATT : campagne « Publicité digitale » acceptée sur iOS sans
      // autorisation de suivi → message serveur + accès aux Réglages.
      if (status === 403 && body.error === "tracking_not_authorized") {
        showTrackingRequired(body.message);
        return;
      }
      const serverMsg = body.message ?? null;
      // 403 accept_restricted : compte mis en pause 2 mois (message serveur).
      const msg =
        (status === 429 || status === 403) && serverMsg
          ? serverMsg
          : status === 402
            ? "Le professionnel n'a plus assez de budget sur sa campagne. Réessayez plus tard."
            : status === 410
              ? "Cette campagne a expiré."
              : status === 409
                ? "Cette sollicitation n'est plus dans un état modifiable. Rafraîchissez la liste."
                : "Action impossible. Réessayez dans un instant.";
      Alert.alert(
        status === 429
          ? "Patientez un instant"
          : status === 403 && serverMsg
            ? "Acceptation en pause"
            : "Action impossible",
        msg,
      );
    } finally {
      setBusy(null);
    }
  }

  /**
   * Étapes préalables à une acceptation : autorisation de suivi iOS pour les
   * campagnes « Publicité digitale » (demande ATT système si encore
   * possible), puis popup de consentement téléphone.
   */
  async function prepareAccept(
    target: DecisionTarget,
    onDone?: () => void,
    opts?: DecisionOptions,
  ) {
    let trackingAuthorized: boolean | undefined;
    if (target.objectiveId === TRACKING_OBJECTIVE_ID) {
      setBusy({ id: target.id, action: "accept" });
      try {
        trackingAuthorized = await resolveTrackingAuthorization(true);
      } finally {
        setBusy(null);
      }
      // iOS sans autorisation : on n'appelle pas le serveur.
      if (trackingAuthorized === false) {
        showTrackingRequired();
        return;
      }
    }
    setConsentFor({ target, onDone, opts, trackingAuthorized });
  }

  /**
   * Point d'entrée : pour ACCEPTER, applique la garde « données complètes »
   * (sans appel API si incomplet), l'autorisation de suivi iOS si la
   * campagne l'exige, puis ouvre la popup de consentement téléphone ; la
   * décision n'est finalisée qu'à la confirmation. REFUSER est envoyé
   * directement. `onDone` est appelé quand le flux se termine (succès, garde
   * déclenchée, 422) — typiquement pour fermer un détail.
   */
  function request(
    action: DecisionAction,
    target: DecisionTarget,
    onDone?: () => void,
    opts?: DecisionOptions,
  ) {
    if (busy) return;
    if (action === "accept") {
      if (
        !opts?.skipGate &&
        gate?.guardAccept({ id: target.id, tiers: target.tiers, tier: target.tier })
      ) {
        onDone?.();
        return;
      }
      void prepareAccept(target, onDone, opts);
      return;
    }
    void perform(action, target, onDone, opts);
  }

  const sheet = (
    <PhoneConsentSheet
      visible={consentFor !== null}
      onClose={() => setConsentFor(null)}
      onAccept={() => {
        const p = consentFor;
        setConsentFor(null);
        if (p) void perform("accept", p.target, p.onDone, p.opts, p.trackingAuthorized);
      }}
    />
  );

  /** Action en cours pour une relation donnée (pour les libellés « … »). */
  const busyFor = (id: string): DecisionAction | null => (busy?.id === id ? busy.action : null);

  return { request, sheet, busy: busy !== null, busyFor };
}
