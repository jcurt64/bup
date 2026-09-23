// Flux de décision Accepter / Refuser une mise en relation, PARTAGÉ entre le
// détail (MovementDetailSheet) et les boutons directs des cartes de
// sollicitation (écran Relations). Une seule implémentation de :
//   · garde « données complètes » (pré-check client + backstop 422),
//   · consentement préalable au canal téléphonique (PhoneConsentSheet),
//   · refused → accepted via undo puis accept (429 rate-limit géré),
//   · messages d'erreur 429 / 403 accept_restricted / 402 / 410 / 409.
// Le consommateur rend `sheet` (popup de consentement) dans son arbre.
import { useState } from "react";
import { Alert } from "react-native";

import { useAcceptGate } from "./accept-gate";
import { PhoneConsentSheet } from "./phone-consent-sheet";
import { ApiError } from "../lib/api";
import { relationRequiredTierNums } from "../lib/completeness";
import { useDecideRelation } from "../lib/queries";

export type DecisionAction = "accept" | "refuse";

/** Sous-ensemble d'une relation nécessaire à la décision. */
export type DecisionTarget = {
  id: string;
  tier: number;
  tiers?: number[] | null;
  /** Statut brut DB — "refused" déclenche le passage undo → accept. */
  relationStatus?: string | null;
};

type Pending = { target: DecisionTarget; onDone?: () => void };

export function useRelationDecision() {
  const decide = useDecideRelation();
  const gate = useAcceptGate();
  const [busy, setBusy] = useState<{ id: string; action: DecisionAction } | null>(null);
  // Acceptation en attente du consentement téléphone (popup ouverte).
  const [consentFor, setConsentFor] = useState<Pending | null>(null);

  async function perform(action: DecisionAction, target: DecisionTarget, onDone?: () => void) {
    const alreadyRefused = target.relationStatus === "refused";
    setBusy({ id: target.id, action });
    try {
      // refused → accepted : l'API n'autorise pas la transition directe
      // (refused → pending via undo, puis pending → accepted). Le serveur
      // rate-limite toutes les actions sur `<userId>:<relationId>` (5 min) :
      // l'undo consomme le slot, l'accept immédiat reçoit donc 429.
      if (action === "accept" && alreadyRefused) {
        await decide.mutateAsync({ id: target.id, action: "undo" });
        try {
          await decide.mutateAsync({ id: target.id, action: "accept", phoneConsent: true });
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
        });
      }
      onDone?.();
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
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
        gate.openIncomplete(
          target.id,
          relationRequiredTierNums({ tiers: target.tiers, tier: target.tier }),
          missingTiers,
        );
        onDone?.();
        return;
      }
      let serverMsg: string | null = null;
      if (e instanceof ApiError) {
        try {
          const j = JSON.parse(e.body) as { message?: string };
          if (typeof j.message === "string") serverMsg = j.message;
        } catch {}
      }
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
   * Point d'entrée : pour ACCEPTER, applique la garde « données complètes »
   * (sans appel API si incomplet) puis ouvre la popup de consentement
   * téléphone ; la décision n'est finalisée qu'à la confirmation. REFUSER
   * est envoyé directement. `onDone` est appelé quand le flux se termine
   * (succès, garde déclenchée, 422) — typiquement pour fermer un détail.
   */
  function request(action: DecisionAction, target: DecisionTarget, onDone?: () => void) {
    if (busy) return;
    if (action === "accept") {
      if (gate.guardAccept({ id: target.id, tiers: target.tiers, tier: target.tier })) {
        onDone?.();
        return;
      }
      setConsentFor({ target, onDone });
      return;
    }
    void perform(action, target, onDone);
  }

  const sheet = (
    <PhoneConsentSheet
      visible={consentFor !== null}
      onClose={() => setConsentFor(null)}
      onAccept={() => {
        const p = consentFor;
        setConsentFor(null);
        if (p) void perform("accept", p.target, p.onDone);
      }}
    />
  );

  /** Action en cours pour une relation donnée (pour les libellés « … »). */
  const busyFor = (id: string): DecisionAction | null => (busy?.id === id ? busy.action : null);

  return { request, sheet, busy: busy !== null, busyFor };
}
