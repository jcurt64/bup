// Acquittement local du choix de formule (équivalent web `planAlreadyAck`).
// Évite de re-proposer la popup tant que le quota du cycle n'est pas atteint,
// même si cycleCount vaut encore 0 (plan choisi mais 1re campagne pas lancée).
import * as SecureStore from "expo-secure-store";

const KEY = "buupp.plan.ack.v1";

export async function getPlanAck(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === "1";
  } catch {
    return false;
  }
}
export async function setPlanAck(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, "1");
  } catch {
    /* best-effort */
  }
}
export async function clearPlanAck(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* best-effort */
  }
}
