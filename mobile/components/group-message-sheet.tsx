// « Message groupé » — composition dans l'app (objet + message) puis envoi
// PAR BUUPP via POST /api/pro/segments/broadcast `{ campaignId, subject, body,
// relationIds }`. Le pro ne voit jamais les adresses des prospects (pas de
// mailto). 1 à 500 relations d'UNE même campagne ; quota 1 e-mail par
// prospect et par campagne appliqué côté serveur.
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import {
  broadcastErrorMessage,
  useProSegmentBroadcast,
  type BroadcastResult,
} from "../lib/queries";
import { useTheme } from "../lib/theme";

export const GROUP_MESSAGE_MAX = 500;

export type GroupMessageTarget = {
  campaignId: string;
  campaignName: string;
  relationIds: string[];
};

export function GroupMessageSheet({
  target,
  onClose,
}: {
  target: GroupMessageTarget | null;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const broadcast = useProSegmentBroadcast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Réinitialise le formulaire à chaque ouverture.
  useEffect(() => {
    if (!target) return;
    setSubject("");
    setBody("");
    setResult(null);
    setError(null);
  }, [target]);

  const count = target?.relationIds.length ?? 0;
  const canSend =
    !!subject.trim() && !!body.trim() && !broadcast.isPending && count > 0;

  const send = () => {
    if (!target) return;
    const subj = subject.trim();
    const bod = body.trim();
    if (!subj || !bod) {
      setError("Objet et message requis.");
      return;
    }
    setError(null);
    broadcast.mutate(
      {
        campaignId: target.campaignId,
        relationIds: target.relationIds.slice(0, GROUP_MESSAGE_MAX),
        subject: subj,
        body: bod,
      },
      {
        onSuccess: (r) => setResult(r),
        onError: (e) => setError(broadcastErrorMessage(e)),
      },
    );
  };

  const inputStyle = {
    fontSize: 15,
    color: c.text,
    backgroundColor: c.field,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingVertical: 11,
    paddingHorizontal: 13,
  } as const;

  return (
    <BottomSheet visible={target !== null} onClose={onClose}>
      <View style={{ gap: 14, paddingBottom: 8 }}>
        <View className="flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: c.accentSoft }}
          >
            <Ionicons name="mail-outline" size={18} color={c.accent} />
          </View>
          <View className="flex-1">
            <Text className="font-serif text-xl text-ink">Message groupé</Text>
            <Text className="text-[13px] text-ink-4" numberOfLines={1}>
              {target?.campaignName ?? ""} · {count} destinataire{count > 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        {result ? (
          <>
            <View
              className="rounded-2xl px-4 py-3.5"
              style={{ backgroundColor: c.tintGreen, borderWidth: 1, borderColor: c.borderSoft }}
            >
              <Text className="text-[14px] font-semibold text-ink">
                {result.sent} e-mail{result.sent > 1 ? "s" : ""} envoyé
                {result.sent > 1 ? "s" : ""} sur {result.total}
              </Text>
              {result.skippedNoEmail > 0 ? (
                <Text className="mt-1 text-[13px] text-ink-2">
                  {result.skippedNoEmail} sans e-mail renseigné
                </Text>
              ) : null}
              {result.skippedQuota > 0 ? (
                <Text className="mt-1 text-[13px] text-ink-2">
                  {result.skippedQuota} déjà contacté{result.skippedQuota > 1 ? "s" : ""} pour
                  cette campagne (1 e-mail max.)
                </Text>
              ) : null}
              {result.skippedCap > 0 ? (
                <Text className="mt-1 text-[13px] text-ink-2">
                  {result.skippedCap} au-delà de la limite d&apos;envoi
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              className="items-center rounded-full py-3.5 active:opacity-80"
              style={{ backgroundColor: c.btnBg }}
            >
              <Text className="text-sm font-semibold" style={{ color: c.btnText }}>
                Fermer
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text className="text-[13px] leading-5 text-ink-3">
              BUUPP envoie votre message aux prospects sélectionnés. Leurs adresses
              e-mail restent cachées. Quota : 1 e-mail par prospect et par campagne.
            </Text>
            <TextInput
              value={subject}
              onChangeText={(t) => setSubject(t.slice(0, 200))}
              placeholder="Objet"
              placeholderTextColor={c.textMuted}
              style={inputStyle}
            />
            <TextInput
              value={body}
              onChangeText={(t) => setBody(t.slice(0, 10000))}
              placeholder="Votre message…"
              placeholderTextColor={c.textMuted}
              multiline
              style={{ ...inputStyle, minHeight: 130, textAlignVertical: "top" }}
            />
            {error ? (
              <Text accessibilityRole="alert" className="text-[13px]" style={{ color: c.bad }}>
                {error}
              </Text>
            ) : null}
            <View className="flex-row gap-3">
              <Pressable
                onPress={onClose}
                className="flex-1 items-center rounded-full border border-line bg-paper py-3.5 active:opacity-70"
              >
                <Text className="text-sm font-medium text-ink-3">Annuler</Text>
              </Pressable>
              <Pressable
                onPress={send}
                disabled={!canSend}
                accessibilityRole="button"
                className="flex-1 flex-row items-center justify-center gap-2 rounded-full py-3.5 active:opacity-80"
                style={{ backgroundColor: c.btnBg, opacity: canSend ? 1 : 0.5 }}
              >
                <Ionicons name="send-outline" size={14} color={c.btnText} />
                <Text className="text-sm font-semibold" style={{ color: c.btnText }}>
                  {broadcast.isPending ? "Envoi…" : "Envoyer via BUUPP"}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}
