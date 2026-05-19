// Sheet « Messages » (icône cloche du header). Bottom-sheet ~80% de
// l'écran : notifications /api/me/notifications, lecture + pièce jointe
// (même données/logique que l'écran Messages, sans ScrollScreen/hero).
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { BottomSheet } from "./bottom-sheet";
import { Card, dateFr } from "./screen";
import { useMarkNotificationRead, useNotifications } from "../lib/queries";
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
  const download = useAuthedDownload();
  const notifs = q.data?.notifications ?? [];

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPct={80}>
      <Text className="font-serif text-2xl text-ink">Messages</Text>
      <Text className="mb-3 mt-0.5 text-sm text-ink-4">
        Annonces, alertes et communications BUUPP.
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
        <View className="flex-1 items-center justify-center">
          <View className="items-center rounded-2xl border border-line bg-paper p-8">
            <Text className="text-center text-sm text-ink-4">
              Aucun message pour le moment.
            </Text>
          </View>
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
                        className={`flex-1 pr-2 text-base ${
                          n.unread ? "font-semibold text-ink" : "text-ink-2"
                        }`}
                      >
                        {n.title}
                      </Text>
                      <Text className="font-mono text-[10px] text-ink-4">
                        {dateFr(n.createdAt)}
                      </Text>
                    </View>
                    {n.body ? (
                      <Text className="mt-1 text-sm leading-5 text-ink-3">
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
                        <Text className="text-xs text-ink-2">
                          📎 {n.attachmentFilename ?? "Pièce jointe"}
                        </Text>
                      </Pressable>
                    ) : null}
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
