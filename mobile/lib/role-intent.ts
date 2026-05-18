// Intention de rôle choisie à l'auth (toggle "JE SUIS" Buupper/Pro).
// Équivalent mobile du cookie d'intent du web : NON autoritaire — le
// rôle réel reste décidé côté serveur (/api/me/role + ensureRole). Sert
// uniquement à aiguiller un compte tout neuf sans rôle encore matérialisé.
import * as SecureStore from "expo-secure-store";

const KEY = "buupp.role.intent.v1";
export type RoleIntent = "prospect" | "pro";

export async function setRoleIntent(r: RoleIntent) {
  try {
    await SecureStore.setItemAsync(KEY, r);
  } catch {
    /* best-effort */
  }
}

export async function getRoleIntent(): Promise<RoleIntent | null> {
  try {
    const v = await SecureStore.getItemAsync(KEY);
    return v === "prospect" || v === "pro" ? v : null;
  } catch {
    return null;
  }
}
