// Permission, registration et channels Android. Pas d'API publique
// React (pas de hook) — c'est consommé impérativement depuis _layout
// et l'écran d'onboarding.
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { apiBase } from "./api";

const TOKEN_KEY = "buupp.push.expo_token.v1";

export type PushStatus = "granted" | "denied" | "undetermined";

/**
 * Demande la permission OS si nécessaire, récupère le token Expo,
 * et l'enregistre côté backend via /api/me/push-token.
 *
 * Idempotent — peut être rappelée plusieurs fois sans risque (upsert
 * côté serveur, no-op si la permission est `denied`).
 *
 * @param getClerkToken — fonction async qui renvoie le JWT Clerk (cf. useAuth().getToken)
 */
export async function registerForPushNotifications(
  getClerkToken: () => Promise<string | null>,
): Promise<{ status: PushStatus; token?: string }> {
  // Web : expo-notifications n'est pas supporté et la demande de permission
  // navigateur peut rester en attente indéfiniment (await jamais résolu),
  // ce qui bloquerait la suite de l'onboarding. On n'essaie donc pas.
  if (Platform.OS === "web") return { status: "denied" };

  const current = await Notifications.getPermissionsAsync();
  let status: PushStatus = current.granted
    ? "granted"
    : current.canAskAgain
      ? "undetermined"
      : "denied";

  if (status === "undetermined") {
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    status = asked.granted ? "granted" : "denied";
  }
  if (status !== "granted") return { status };

  let token: string;
  try {
    const projectId = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)
      ?.eas as { projectId?: string } | undefined;
    const result = await Notifications.getExpoPushTokenAsync(
      projectId?.projectId ? { projectId: projectId.projectId } : undefined,
    );
    token = result.data;
  } catch (e) {
    console.warn("[push] getExpoPushTokenAsync failed", e);
    return { status: "granted" };
  }

  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    /* best-effort */
  }

  // POST au backend (sans dépendre du hook useApi pour pouvoir être
  // appelée depuis un effet hors-React tree au cold start).
  try {
    const jwt = await getClerkToken();
    if (!jwt) return { status, token };
    await fetch(`${apiBase()}/api/me/push-token`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        token,
        platform: Platform.OS === "ios" ? "ios" : "android",
        appVersion: Constants.expoConfig?.version,
      }),
    });
  } catch (e) {
    console.warn("[push] register POST failed", e);
  }

  return { status, token };
}

/**
 * Supprime le token côté backend (sign-out). Best-effort — n'échoue
 * pas si la requête plante (le user voudrait quand même se déconnecter).
 */
export async function unregisterPushToken(
  getClerkToken: () => Promise<string | null>,
): Promise<void> {
  let token: string | null = null;
  try {
    token = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    /* swallow */
  }
  if (!token) return;
  try {
    const jwt = await getClerkToken();
    if (!jwt) return;
    await fetch(`${apiBase()}/api/me/push-token`, {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ token }),
    });
  } catch (e) {
    console.warn("[push] unregister DELETE failed", e);
  }
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* swallow */
  }
}

/**
 * Crée les channels Android (no-op iOS). À appeler au mount du root.
 */
export async function ensurePushChannelsAndroid(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("solicitations-classic", {
    name: "Sollicitations",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
    vibrationPattern: [0, 250],
    lightColor: "#7C5CFC",
  });
  await Notifications.setNotificationChannelAsync("solicitations-flash", {
    name: "Flash deals",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 300, 200, 300],
    lightColor: "#FF7A6B",
  });
}
