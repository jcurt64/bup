// Écran Messages partagé prospect/pro — /api/me/notifications.
import { Alert, Pressable, Text, View } from "react-native";

import { useAuthedDownload } from "../lib/use-authed-download";
import { useMarkNotificationRead, useNotifications } from "../lib/queries";
import { useRefetchOnFocus } from "../lib/use-refetch-on-focus";
import { Card, dateFr, QueryGate, ScrollScreen } from "./screen";

export default function NotificationsScreen() {
  const q = useNotifications();
  const read = useMarkNotificationRead();
  const download = useAuthedDownload();
  useRefetchOnFocus(q);
  return (
    <ScrollScreen
      onRefresh={q.refetch}
      hero={{
        eyebrow: "Messages",
        title: "Vos notifications",
        desc: "Annonces, alertes et communications BUUPP.",
      }}
    >
      <QueryGate
        query={q}
        isEmpty={(d) => (d.notifications?.length ?? 0) === 0}
        emptyLabel="Aucun message pour le moment."
      >
        {(d) => (
          <View className="gap-3">
            {d.notifications.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => {
                  if (n.unread) read.mutate({ id: n.id });
                }}
              >
                <Card badge={{ icon: "notifications-outline", tone: "amber" }}>
                  <View className="flex-row items-start gap-3">
                    {n.unread ? (
                      <View className="mt-1.5 h-2 w-2 rounded-full bg-violet" />
                    ) : (
                      <View className="mt-1.5 h-2 w-2 rounded-full bg-ink-5" />
                    )}
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
          </View>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
