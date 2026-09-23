// Vos suggestions — POST /api/me/suggestions (parité Prospect.jsx
// fn SuggestionsPanel).
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Card, ScrollScreen } from "../../components/screen";
import { ApiError } from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useSendSuggestion } from "../../lib/queries";

// Limites identiques au web (Prospect.jsx fn SuggestionsPanel) et à l'API.
const MAX_SUBJECT = 120;
const MAX_MESSAGE = 4000;

export default function Suggestions() {
  const { c } = useTheme();
  const send = useSendSuggestion();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  // Message d'erreur serveur (body.message) si fourni, sinon générique.
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function submit() {
    if (!message.trim()) return;
    setErrMsg(null);
    try {
      await send.mutateAsync({
        subject: subject.trim() || null,
        message: message.trim(),
      });
      setSent(true);
      setSubject("");
      setMessage("");
    } catch (e) {
      let msg = "Envoi impossible. Réessayez.";
      if (e instanceof ApiError) {
        try {
          const j = JSON.parse(e.body) as { message?: string };
          if (typeof j.message === "string" && j.message) msg = j.message;
        } catch {}
      } else {
        msg = "Erreur réseau. Réessayez dans un instant.";
      }
      setErrMsg(msg);
    }
  }

  return (
    <ScrollScreen
      hero={{
        eyebrow: "Vos suggestions",
        title: "Faites-nous part de vos idées",
        desc: "Une remarque, un bug, une idée d'amélioration ? L'équipe BUUPP vous lit.",
        nav: "drawer",
      }}
    >
      <Card className="gap-3" badge={{ icon: "bulb-outline", tone: "amber" }}>
        <View className="gap-1">
          <Text className="text-[11px] uppercase text-ink-4">Sujet (optionnel)</Text>
          <TextInput
            value={subject}
            onChangeText={(v) => setSubject(v.slice(0, MAX_SUBJECT))}
            maxLength={MAX_SUBJECT}
            placeholder="Ex. Suggestion sur les notifications"
            editable={!send.isPending}
            placeholderTextColor={c.textMuted}
            className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink"
          />
        </View>
        <View className="gap-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-[11px] uppercase text-ink-4">Votre message</Text>
            <Text className="font-mono text-[11px] text-ink-4">
              {message.length} / {MAX_MESSAGE}
            </Text>
          </View>
          <TextInput
            value={message}
            onChangeText={(v) => {
              setMessage(v.slice(0, MAX_MESSAGE));
              if (sent) setSent(false);
            }}
            maxLength={MAX_MESSAGE}
            placeholder="Décrivez votre idée ou votre retour. Les retours à la ligne sont préservés."
            editable={!send.isPending}
            placeholderTextColor={c.textMuted}
            multiline
            numberOfLines={6}
            className="min-h-[120px] rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink"
            style={{ textAlignVertical: "top" }}
          />
        </View>
        <Pressable
          disabled={send.isPending || !message.trim()}
          className={`items-center rounded-full py-3 ${
            send.isPending || !message.trim() ? "bg-ink-5" : "bg-ink"
          }`}
          onPress={submit}
        >
          <Text className="text-sm font-semibold text-paper">
            {send.isPending ? "Envoi…" : "Envoyer à l’équipe BUUPP"}
          </Text>
        </Pressable>
        {sent ? (
          <Text className="text-center text-sm text-good">
            Merci&nbsp;! Votre message a bien été transmis.
          </Text>
        ) : null}
        {errMsg ? (
          <Text className="text-center text-sm text-bad">{errMsg}</Text>
        ) : null}
      </Card>
    </ScrollScreen>
  );
}
