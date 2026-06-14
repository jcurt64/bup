/**
 * Diffusion d'un message à un segment (SP2) — sélection des destinataires.
 *
 * Logique pure et testable, isolée de l'I/O. La route
 * /api/pro/segments/broadcast charge l'audience, applique ces helpers, puis
 * envoie les e-mails de façon MÉDIÉE : BUUPP est l'expéditeur, le pro ne voit
 * jamais les adresses des prospects (pseudonymisation préservée).
 */

import type { SegmentContact, SegmentFilters } from "./types";
import { matchesFilters } from "./filter";

export const BROADCAST_MAX_RECIPIENTS = 500;
export const BROADCAST_MAX_SUBJECT = 200;
export const BROADCAST_MAX_BODY = 10_000;

export type BroadcastRecipient = {
  relationId: string;
  prospectId: string;
  email: string | null;
  prenom: string | null;
  trackingConsent: boolean;
};

export type RecipientPartition = {
  eligible: BroadcastRecipient[];
  skippedNoEmail: number;
  skippedQuota: number;
};

/** relationIds des contacts du segment (= correspondant aux filtres). */
export function matchedRelationIds(
  contacts: SegmentContact[],
  filters: SegmentFilters,
): string[] {
  return contacts.filter((c) => matchesFilters(c, filters)).map((c) => c.relationId);
}

/**
 * Répartit les destinataires :
 *   - eligible       : e-mail présent ET quota non atteint
 *   - skippedNoEmail : prospect sans e-mail partagé
 *   - skippedQuota   : prospect déjà sollicité par e-mail pour cette campagne
 *     (quota anti-spam : 1 e-mail / pro / prospect / campagne)
 */
export function partitionRecipients(
  recipients: BroadcastRecipient[],
  alreadyEmailedProspectIds: ReadonlySet<string>,
): RecipientPartition {
  const eligible: BroadcastRecipient[] = [];
  let skippedNoEmail = 0;
  let skippedQuota = 0;
  for (const r of recipients) {
    if (!r.email) {
      skippedNoEmail++;
      continue;
    }
    if (alreadyEmailedProspectIds.has(r.prospectId)) {
      skippedQuota++;
      continue;
    }
    eligible.push(r);
  }
  return { eligible, skippedNoEmail, skippedQuota };
}
