import { commissionCents } from "@/lib/pricing/commission";

/** Coût d'une participation validée pour le pro : rémunération + commission BUUPP. */
export function studyUnitCostCents(rewardCents: number): number {
  return rewardCents + commissionCents(rewardCents);
}

/** Budget réservé à la publication : max × coût unitaire. */
export function studyBudgetMaxCents(maxParticipants: number, rewardCents: number): number {
  return maxParticipants * studyUnitCostCents(rewardCents);
}
