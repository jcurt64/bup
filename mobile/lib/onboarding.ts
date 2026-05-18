// Flag "onboarding vu" — persisté via expo-secure-store pour ne montrer
// le carrousel qu'une seule fois (par appareil). Échoue silencieusement
// (ne doit jamais bloquer le démarrage).
import * as SecureStore from "expo-secure-store";

const KEY = "buupp.onboarding.seen.v1";

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === "1";
  } catch {
    return false;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, "1");
  } catch {
    /* best-effort */
  }
}
