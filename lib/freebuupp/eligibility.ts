import type { FreebuuppStatus } from "./types";

export type JoinDenyReason =
  | "not_open" | "phone_unverified" | "already_joined" | "panel_full" | "geo_ineligible";

export type JoinDecision = { ok: true } | { ok: false; reason: JoinDenyReason };

/** Gardes ordonnées (état campagne d'abord, puis prospect, puis capacité). */
export function canJoin(input: {
  status: FreebuuppStatus;
  phoneVerified: boolean;
  alreadyJoined: boolean;
  participantCount: number;
  panelSize: number;
  geoEligible: boolean;
}): JoinDecision {
  if (input.status !== "open") return { ok: false, reason: "not_open" };
  if (!input.geoEligible) return { ok: false, reason: "geo_ineligible" };
  if (!input.phoneVerified) return { ok: false, reason: "phone_unverified" };
  if (input.alreadyJoined) return { ok: false, reason: "already_joined" };
  if (input.participantCount >= input.panelSize) return { ok: false, reason: "panel_full" };
  return { ok: true };
}
