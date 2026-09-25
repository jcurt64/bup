// Sheet « Messages » (icône cloche du header). Bottom-sheet : état vide
// (cf. mes1.html) ou liste de cards par catégorie (cf. mes2.html). « Lire le
// message » ouvre le détail (Modal MessageDetailModal) PAR-DESSUS la sheet —
// la liste reste montée dessous, donc le retour/la suppression reviennent à
// la liste (pas à l'accueil). Données/logique inchangées (/api/me/notifications).
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import { BuuppFooter } from "./buupp-footer";
import { EmptyInboxArt } from "./empty-inbox-art";
import { PushStatusBadge } from "./push-settings";
import { BuuppLoader } from "./loader";
import { MessageDetailModal } from "./message-detail";
import { useTheme } from "../lib/theme";
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type Notif,
} from "../lib/queries";
import {
  CAT_CONF,
  categorizeMessage,
  fmtMessageDate,
} from "../lib/message-category";


function MessageCard({
  n,
  onOpen,
  onDelete,
}: {
  n: Notif;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { c } = useTheme();
  const cat = CAT_CONF[categorizeMessage(n.title, n.body)];
  return (
    <View
      style={{
        borderRadius: 18,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.borderSoft,
        shadowColor: "#0F1629",
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      {/* Rognage des coins sur une vue interne : l'ombre de la vue externe reste visible sur iOS (overflow:hidden l'efface), comme sur Android. */}
      <View style={{ borderRadius: 17, overflow: "hidden" }}>
        {/* Barre d'accent gauche colorée selon la catégorie. */}
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            backgroundColor: cat.color,
          }}
        />
        <Pressable onPress={onOpen} style={{ padding: 14, paddingLeft: 18 }}>
          <View style={{ flexDirection: "row", gap: 11 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                backgroundColor: cat.bg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={cat.icon} size={17} color={cat.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: "700",
                    letterSpacing: 0.8,
                    color: cat.color,
                  }}
                >
                  {cat.label}
                </Text>
                <Text style={{ fontSize: 11.5, color: c.textMuted }}>
                  {fmtMessageDate(n.createdAt)}
                </Text>
              </View>
              <Text
                className="font-serif"
                numberOfLines={2}
                style={{
                  fontSize: 16.5,
                  color: n.unread ? c.text : c.textSub,
                  marginTop: 3,
                }}
              >
                {n.unread ? <Text style={{ color: cat.color }}>• </Text> : null}
                {n.title}
              </Text>
              {n.body ? (
                <Text
                  numberOfLines={2}
                  style={{ fontSize: 13.5, lineHeight: 19, color: c.textSub, marginTop: 4 }}
                >
                  {n.body}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>

        {/* Pied de card : Lire le message · Supprimer. */}
        <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: c.borderSoft }}>
          <Pressable
            onPress={onOpen}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 12,
              paddingLeft: 18,
            }}
            accessibilityRole="button"
            accessibilityLabel="Lire le message"
          >
            <Text style={{ fontSize: 13.5, fontWeight: "600", color: c.text }}>
              Lire le message
            </Text>
            <Ionicons name="chevron-forward" size={15} color={c.text} />
          </Pressable>
          <Pressable
            onPress={onDelete}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderLeftWidth: 1,
              borderLeftColor: c.borderSoft,
            }}
            accessibilityRole="button"
            accessibilityLabel="Supprimer ce message"
          >
            <Ionicons name="trash-outline" size={15} color={c.bad} />
            <Text style={{ fontSize: 13.5, fontWeight: "600", color: c.bad }}>
              Supprimer
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function MessagesSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const q = useNotifications();
  const read = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const del = useDeleteNotification();
  const { c } = useTheme();
  // Détail ouvert PAR-DESSUS la sheet (la liste reste montée dessous) — évite
  // le flash sur l'accueil et garde le retour/suppression vers la liste.
  const [openDetail, setOpenDetail] = useState<Notif | null>(null);
  const notifs = q.data?.notifications ?? [];
  const unreadIds = notifs.filter((n) => n.unread).map((n) => n.id);
  const unreadCount = q.data?.unreadCount ?? unreadIds.length;

  // Refetch à l'ouverture (synchro web ⇄ mobile, cf. dismissals).
  useEffect(() => {
    if (visible) q.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

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

  function openMessage(n: Notif) {
    if (n.unread) read.mutate({ id: n.id });
    // Ouvre le détail PAR-DESSUS la sheet (pas de fermeture/navigation).
    setOpenDetail(n);
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPct={86}>
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2">
          <Text className="font-serif text-2xl text-ink">Messages</Text>
          {notifs.length > 0 ? (
            <View
              style={{
                minWidth: 22,
                height: 22,
                borderRadius: 999,
                backgroundColor: c.text,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 6,
              }}
            >
              <Text className="font-mono text-[11px] font-bold text-paper">
                {notifs.length}
              </Text>
            </View>
          ) : null}
        </View>
        {unreadIds.length > 0 ? (
          <Pressable
            onPress={() => {
              if (markAll.isPending) return;
              markAll.mutate({ ids: unreadIds });
            }}
            disabled={markAll.isPending}
            accessibilityRole="button"
            accessibilityLabel={`Tout lire — ${unreadIds.length} non lus`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 13,
              borderRadius: 999,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.borderSoft,
            }}
          >
            <Ionicons name="checkmark-done" size={15} color={c.text} />
            <Text style={{ fontSize: 12.5, fontWeight: "600", color: c.text }}>
              {markAll.isPending ? "…" : "Tout lire"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Text className="mb-3 mt-0.5 text-base text-ink-4">
        {notifs.length === 0
          ? "Aucun message pour le moment."
          : `${notifs.length} message${notifs.length > 1 ? "s" : ""}${
              unreadCount
                ? ` · ${unreadCount} non lu${unreadCount > 1 ? "s" : ""}`
                : ""
            }`}
      </Text>

      {q.isPending ? (
        <View className="flex-1 items-center justify-center">
          <BuuppLoader />
        </View>
      ) : q.isError ? (
        <View className="rounded-2xl border-l-4 border-bad bg-paper p-4">
          <Text className="text-sm text-bad">
            Impossible de charger les messages.
          </Text>
        </View>
      ) : notifs.length === 0 ? (
        // État vide — illustration animée (components/empty-inbox-art).
        <View className="flex-1 items-center justify-center px-6">
          <View className="mb-3">
            <EmptyInboxArt />
          </View>
          <Text className="font-serif text-xl text-ink">Votre boîte est vide</Text>
          <Text className="mt-1.5 text-center text-[13px] leading-5 text-ink-4">
            Les annonces, alertes et communications BUUPP{"\n"}s&apos;afficheront ici dès qu&apos;elles arriveront.
          </Text>
          {/* État réel de la permission du téléphone (pas codé en dur). */}
          <PushStatusBadge />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-3 pb-2"
          showsVerticalScrollIndicator={false}
        >
          {notifs.map((n) => (
            <MessageCard
              key={n.id}
              n={n}
              onOpen={() => openMessage(n)}
              onDelete={() => confirmDelete(n.id, n.title)}
            />
          ))}
        </ScrollView>
      )}

      <BuuppFooter variant="ivory" key={visible ? "open" : "closed"} />

      {/* Détail PAR-DESSUS la sheet — rendu en ENFANT du Modal de la sheet
          (le Modal parent présente le Modal enfant ; iOS interdit de présenter
          deux Modals frères). `transparent` (overFullScreen) → plein écran
          correct. Retour/suppression reviennent à la liste. */}
      <MessageDetailModal
        notif={openDetail}
        visible={openDetail !== null}
        onClose={() => setOpenDetail(null)}
      />
    </BottomSheet>
  );
}
