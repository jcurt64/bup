// Sheet « Messages » (icône cloche du header). Bottom-sheet ~80% de
// l'écran : notifications /api/me/notifications, lecture + pièce jointe
// (même données/logique que l'écran Messages, sans ScrollScreen/hero).
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

// Illustration 3D thiings.co (Mailbox) — empty state convivial.
const EMPTY_MAILBOX = require("../assets/images/empty-mailbox.png");

import { BottomSheet } from "./bottom-sheet";
import { Card, dateFr } from "./screen";
import {
  useDeleteNotification,
  useMarkNotificationRead,
  useNotifications,
} from "../lib/queries";
import { useAuthedDownload } from "../lib/use-authed-download";

export function MessagesSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const q = useNotifications();
  const read = useMarkNotificationRead();
  const del = useDeleteNotification();
  const download = useAuthedDownload();
  const notifs = q.data?.notifications ?? [];

  // Synchro web ⇄ mobile : refetch à chaque ouverture du sheet pour
  // refléter immédiatement les suppressions/lectures faites côté web
  // (les deux écrivent dans la même table admin_broadcast_dismissals).
  // Sans ce refetch, le client mobile garde la version en cache (15 s
  // staleTime) jusqu'à expiration.
  useEffect(() => {
    if (visible) {
      q.refetch();
    }
    // q.refetch identité stable côté React Query ; on déclenche
    // uniquement sur l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Confirmation native + suppression optimiste (parité web :
  // "Supprimer ce message" → "Confirmer la suppression"). Le broadcast
  // en base reste intact, on POSE juste une row admin_broadcast_dismissals.
  function confirmDelete(id: string, title: string) {
    Alert.alert(
      "Supprimer ce message ?",
      title
        ? `« ${title.length > 60 ? title.slice(0, 60) + "…" : title} » sera retiré de votre boîte de réception.`
        : "Ce message sera retiré de votre boîte de réception.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            del.mutate(
              { id },
              {
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
    <BottomSheet visible={visible} onClose={onClose} heightPct={80}>
      <View className="flex-row items-center gap-2">
        <Text className="font-serif text-2xl text-ink">Messages</Text>
        {notifs.length > 0 ? (
          <View className="rounded-full bg-ink px-2.5 py-0.5">
            <Text className="font-mono text-[11px] font-semibold text-paper">
              {notifs.length}
            </Text>
          </View>
        ) : null}
      </View>
      <Text className="mb-3 mt-0.5 text-base text-ink-4">
        {notifs.length === 0
          ? "Aucun message pour le moment."
          : `${notifs.length} message${notifs.length > 1 ? "s" : ""}${
              q.data?.unreadCount
                ? ` · ${q.data.unreadCount} non lu${q.data.unreadCount > 1 ? "s" : ""}`
                : ""
            }`}
      </Text>

      {q.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7C5CFC" />
        </View>
      ) : q.isError ? (
        <View className="rounded-2xl border-l-4 border-bad bg-paper p-4">
          <Text className="text-sm text-bad">
            Impossible de charger les messages.
          </Text>
        </View>
      ) : notifs.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          {/* Empty state — illustration 3D thiings.co (Mailbox) sur cercle
              pastel violet, titre serif + subtitle ink-4 (esthétique
              em.png : illustration centrée + texte amical). */}
          <View
            className="mb-3 h-44 w-44 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(124, 92, 252, 0.08)" }}
          >
            <Image
              source={EMPTY_MAILBOX}
              style={{ width: 140, height: 140 }}
              contentFit="contain"
              accessibilityLabel="Boîte aux lettres vide"
            />
          </View>
          <Text className="font-serif text-xl text-ink">
            Votre boîte est vide
          </Text>
          <Text className="mt-1.5 text-center text-[13px] leading-5 text-ink-4">
            Les annonces, alertes et communications BUUPP{"\n"}s'afficheront ici dès qu'elles arriveront.
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-3 pb-2"
          showsVerticalScrollIndicator={false}
        >
          {notifs.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => {
                if (n.unread) read.mutate({ id: n.id });
              }}
            >
              <Card badge={{ icon: "notifications-outline", tone: "amber" }}>
                <View className="flex-row items-start gap-3">
                  <View
                    className={`mt-1.5 h-2 w-2 rounded-full ${
                      n.unread ? "bg-violet" : "bg-ink-5"
                    }`}
                  />
                  <View className="flex-1">
                    <View className="flex-row justify-between">
                      <Text
                        className={`flex-1 pr-2 text-lg ${
                          n.unread ? "font-semibold text-ink" : "text-ink-2"
                        }`}
                      >
                        {n.title}
                      </Text>
                      <Text className="font-mono text-[12px] text-ink-4">
                        {dateFr(n.createdAt)}
                      </Text>
                    </View>
                    {n.body ? (
                      <Text className="mt-1 text-base leading-6 text-ink-3">
                        {n.body}
                      </Text>
                    ) : null}
                    {n.hasAttachment ? (
                      <Pressable
                        className="mt-3 self-start rounded-full border border-line px-4 py-2"
                        onPress={async () => {
                          if (n.unread) read.mutate({ id: n.id });
                          try {
                            await download(
                              `/api/me/notifications/${n.id}/attachment`,
                              n.attachmentFilename ?? undefined,
                            );
                          } catch {
                            Alert.alert("Erreur", "Téléchargement impossible.");
                          }
                        }}
                      >
                        <Text className="text-sm text-ink-2">
                          📎 {n.attachmentFilename ?? "Pièce jointe"}
                        </Text>
                      </Pressable>
                    ) : null}
                    {/* Footer action : supprimer ce message (parité web).
                        Discret, danger color, en bas de la carte. */}
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        confirmDelete(n.id, n.title);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Supprimer ce message"
                      className="mt-3 flex-row items-center gap-1.5 self-start py-1 active:opacity-60"
                    >
                      <Ionicons name="trash-outline" size={15} color="#DC2626" />
                      <Text className="text-sm font-medium text-bad">
                        Supprimer ce message
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </BottomSheet>
  );
}
