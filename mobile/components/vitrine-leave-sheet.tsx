// « La Vitrine » — interstitiel de sortie vers le site externe du pro
// (réplique mobile de VitrineLeaveModal côté web). Affiché depuis la carte
// de sollicitation ET le détail d'une relation. « Continuer » enregistre le
// clic (appel authentifié à /api/campaign/[id]/visit) puis ouvre le lien
// tracké dans le navigateur in-app.
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { Pressable, Text, View } from "react-native";

import { apiBase, useApi } from "../lib/api";
import { useTheme } from "../lib/theme";
import { BottomSheet } from "./bottom-sheet";

export function VitrineLeaveSheet({
  visible,
  proName,
  websiteUrl,
  onClose,
}: {
  visible: boolean;
  proName: string;
  /** Lien tracké relatif (`/api/campaign/{id}/visit`) ou null. */
  websiteUrl: string | null;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const api = useApi();

  const onContinue = async () => {
    if (websiteUrl) {
      // L'endpoint upsert le clic AVANT sa redirection 302 : même si api()
      // ne peut pas parser le HTML du site redirigé, le clic est compté.
      api(websiteUrl).catch(() => {});
      // Ouvre le lien tracké → 302 → site du pro (navigateur in-app).
      await WebBrowser.openBrowserAsync(apiBase() + websiteUrl).catch(() => {});
    }
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ alignItems: "center", paddingHorizontal: 4 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.tintViolet,
            marginBottom: 12,
          }}
        >
          <Ionicons name="open-outline" size={28} color={c.accVioletDeep} />
        </View>
        <Text className="font-serif" style={{ fontSize: 21, lineHeight: 26, textAlign: "center", color: c.text }}>
          Vous allez quitter BUUPP
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 22, textAlign: "center", color: c.textSub, marginTop: 12 }}>
          Ce lien vous redirige vers le site de{" "}
          <Text style={{ fontWeight: "700", color: c.text }}>{proName}</Text>, un site externe.
          BUUPP n&apos;est pas responsable de son contenu, et ce site n&apos;est pas soumis à la
          politique de cookies de BUUPP : la gestion des cookies et de vos données personnelles y
          relève de la{" "}
          <Text style={{ fontWeight: "700", color: c.text }}>
            politique de confidentialité de ce professionnel
          </Text>
          .
        </Text>
        <View className="flex-row" style={{ gap: 10, marginTop: 22, width: "100%" }}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            className="flex-1 items-center rounded-full border border-navy bg-paper py-3.5 active:opacity-70"
          >
            <Text className="text-sm font-semibold text-navy">Annuler</Text>
          </Pressable>
          <Pressable
            onPress={onContinue}
            accessibilityRole="button"
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-ink py-3.5 active:opacity-80"
          >
            <Text className="text-sm font-semibold text-paper">Continuer vers le site</Text>
            <Ionicons name="open-outline" size={15} color={c.paper} />
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}
