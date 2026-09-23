// Réglage notifications RÉEL : lit la permission OS et renvoie vers les
// réglages du téléphone (activer/couper). Remplace les anciens toggles par
// catégorie qui n'étaient ni persistés ni appliqués.
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Platform, Pressable, Text, View } from "react-native";

import { registerForPushNotifications, type PushStatus } from "../lib/push";
import { useTheme } from "../lib/theme";

function usePushPermission() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const refresh = useCallback(async () => {
    if (Platform.OS === "web") return setStatus("denied");
    const p = await Notifications.getPermissionsAsync();
    setStatus(p.granted ? "granted" : p.canAskAgain ? "undetermined" : "denied");
  }, []);
  useEffect(() => {
    void refresh();
    // Retour des réglages du téléphone → relit la permission.
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);
  return { status, refresh };
}

export function PushSettings() {
  const { c } = useTheme();
  const { getToken } = useAuth();
  const { status, refresh } = usePushPermission();

  async function onPress() {
    if (status === "undetermined") {
      // Première demande : la popup système s'affiche, et le token est
      // enregistré côté serveur si l'utilisateur accepte.
      await registerForPushNotifications(getToken);
      await refresh();
      return;
    }
    await Linking.openSettings();
  }

  const on = status === "granted";
  const label =
    status === null
      ? "Vérification…"
      : on
        ? "Notifications activées"
        : "Notifications désactivées";
  const desc = on
    ? "Mises en relation, flash deals et gains. Pour les couper, passez par les réglages du téléphone."
    : "Activez-les pour être prévenu des nouvelles mises en relation et des flash deals.";

  return (
    <View style={{ marginTop: 14, gap: 12 }}>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <Ionicons
          name={on ? "checkmark-circle" : "close-circle"}
          size={20}
          color={on ? c.good : c.textMuted}
        />
        <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>
          {label}
        </Text>
      </View>
      <Text style={{ fontSize: 13, lineHeight: 19, color: c.textSub }}>
        {desc}
      </Text>
      {status !== null ? (
        <Pressable
          onPress={onPress}
          className="items-center active:opacity-80"
          style={{
            paddingVertical: 12,
            borderRadius: 14,
            backgroundColor: on ? c.surface2 : c.btnBg,
            borderWidth: on ? 1 : 0,
            borderColor: c.borderSoft,
          }}
        >
          <Text
            style={{
              fontSize: 14.5,
              fontWeight: "600",
              color: on ? c.text : c.btnText,
            }}
          >
            {status === "undetermined"
              ? "Activer les notifications"
              : "Ouvrir les réglages du téléphone"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
