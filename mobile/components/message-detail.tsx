// Détail d'un message (cf. mes3.html) — présenté via le composant BottomSheet
// (sheet haute 94 %) PAR-DESSUS la sheet Messages. BottomSheet est le pattern
// éprouvé de l'app (flash deals, mouvements), y compris imbriqué : présentation,
// safe-area, scroll et touches fonctionnent. Le bouton retour (←) ferme la
// sheet de détail → on revient à la liste (montée dessous). Retour/suppression
// ne ramènent donc pas à l'accueil.
// Note : cartes méta (Pro/Récompense/Expire) + CTA « Voir le flash deal » de la
// maquette = données spécifiques flash-deal absentes du payload notification →
// non rendues ici.
import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { BottomSheet } from "./bottom-sheet";
import { BuuppFooter } from "./buupp-footer";
import { CAT_CONF, categorizeMessage, fmtMessageDate } from "../lib/message-category";
import {
  deleteMockNotif,
  isMockNotif,
  useDeleteNotification,
  type Notif,
} from "../lib/queries";
import { useAuthedDownload } from "../lib/use-authed-download";
import { useTheme } from "../lib/theme";

export function MessageDetailModal({
  notif,
  visible,
  onClose,
}: {
  notif: Notif | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const del = useDeleteNotification();
  const download = useAuthedDownload();
  const qc = useQueryClient();
  const cat = notif
    ? CAT_CONF[notif.category ?? categorizeMessage(notif.title, notif.body)]
    : null;

  function confirmDelete() {
    if (!notif) return;
    const id = notif.id;
    Alert.alert(
      "Supprimer ce message ?",
      "Ce message sera retiré de votre boîte de réception.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            // Messages fictifs : suppression simulée (pas d'appel API).
            if (isMockNotif(id)) {
              deleteMockNotif(id);
              qc.invalidateQueries({ queryKey: ["me", "notifications"] });
              onClose();
              return;
            }
            del.mutate(
              { id },
              {
                onSuccess: () => onClose(),
                onError: () =>
                  Alert.alert(
                    "Erreur",
                    "Suppression impossible. Réessayez dans un instant.",
                  ),
              },
            );
          },
        },
      ],
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPct={94} topRadius={28}>
      {/* Header — back (ferme le détail) + « Messages » + corbeille */}
      <View className="mb-1 flex-row items-center gap-3">
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityLabel="Retour"
          className="h-10 w-10 flex-row items-center justify-center rounded-full bg-paper active:opacity-70"
        >
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </Pressable>
        <Text className="flex-1 font-serif-bold text-lg text-ink">Messages</Text>
        {notif ? (
          <Pressable
            onPress={confirmDelete}
            hitSlop={10}
            accessibilityLabel="Supprimer ce message"
            className="h-10 w-10 items-center justify-center rounded-full bg-paper active:opacity-70"
          >
            <Ionicons name="trash-outline" size={19} color={c.bad} />
          </Pressable>
        ) : (
          <View className="h-10 w-10" />
        )}
      </View>

      {!notif || !cat ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="mail-open-outline" size={40} color={c.textMuted} />
          <Text className="mt-3 text-center text-[15px] text-ink-3">
            Ce message n’est plus disponible.
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 8 }}
        >
          {/* Chip catégorie */}
          <View
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 6,
              paddingHorizontal: 11,
              borderRadius: 999,
              backgroundColor: cat.bg,
            }}
          >
            <Ionicons name={cat.icon} size={13} color={cat.color} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 0.8,
                color: cat.color,
              }}
            >
              {cat.label}
            </Text>
          </View>

          {/* Titre */}
          <Text
            className="font-serif"
            style={{ fontSize: 27, lineHeight: 34, color: c.text, marginTop: 14 }}
          >
            {notif.title}
          </Text>

          {/* Expéditeur + date */}
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                backgroundColor: "#0F1629",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text className="font-serif-bold text-paper" style={{ fontSize: 19 }}>
                b
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 14.5, fontWeight: "700", color: c.text }}>
                  Équipe BUUPP
                </Text>
                <Ionicons name="checkmark-circle" size={14} color={c.violet} />
              </View>
              <Text style={{ fontSize: 12.5, color: c.textMuted, marginTop: 1 }}>
                Message officiel
              </Text>
            </View>
            <Text
              style={{ fontSize: 12.5, color: c.textMuted, textAlign: "right" }}
              numberOfLines={2}
            >
              {fmtMessageDate(notif.createdAt)}
            </Text>
          </View>

          {/* Séparateur */}
          <View style={{ height: 1, backgroundColor: c.borderSoft, marginVertical: 18 }} />

          {/* Corps */}
          {notif.body ? (
            <Text style={{ fontSize: 15.5, lineHeight: 25, color: c.text }}>
              {notif.body}
            </Text>
          ) : (
            <Text style={{ fontSize: 15, color: c.textMuted }}>(Aucun contenu)</Text>
          )}

          {/* Pièce jointe */}
          {notif.hasAttachment ? (
            <Pressable
              onPress={async () => {
                try {
                  await download(
                    `/api/me/notifications/${notif.id}/attachment`,
                    notif.attachmentFilename ?? undefined,
                  );
                } catch {
                  Alert.alert("Erreur", "Téléchargement impossible.");
                }
              }}
              style={{
                marginTop: 18,
                alignSelf: "flex-start",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 11,
                paddingHorizontal: 16,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: c.borderSoft,
                backgroundColor: c.surface,
              }}
            >
              <Ionicons name="document-attach-outline" size={17} color={c.text} />
              <Text style={{ fontSize: 14, color: c.text }}>
                {notif.attachmentFilename ?? "Pièce jointe"}
              </Text>
            </Pressable>
          ) : null}

          {/* Marqué comme lu */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              marginTop: 22,
            }}
          >
            <Ionicons name="checkmark" size={15} color={c.textMuted} />
            <Text style={{ fontSize: 12.5, color: c.textMuted }}>Marqué comme lu</Text>
          </View>

          <BuuppFooter variant="ivory" />
        </ScrollView>
      )}
    </BottomSheet>
  );
}
