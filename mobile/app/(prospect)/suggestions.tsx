// Vos suggestions — POST /api/me/suggestions (parité Prospect.jsx
// fn SuggestionsPanel).
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Card, ScrollScreen } from "../../components/screen";
import { useSendSuggestion } from "../../lib/queries";

export default function Suggestions() {
  const send = useSendSuggestion();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!message.trim()) return;
    try {
      await send.mutateAsync({
        subject: subject.trim() || null,
        message: message.trim(),
      });
      setSent(true);
      setSubject("");
      setMessage("");
    } catch {
      // erreur affichée via send.isError
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
            onChangeText={setSubject}
            className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink"
          />
        </View>
        <View className="gap-1">
          <Text className="text-[11px] uppercase text-ink-4">Message</Text>
          <TextInput
            value={message}
            onChangeText={(v) => { setMessage(v); if (sent) setSent(false); }}
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
            {send.isPending ? "Envoi…" : "Envoyer"}
          </Text>
        </Pressable>
        {sent ? (
          <Text className="text-center text-sm text-good">
            Merci&nbsp;! Votre message a bien été transmis.
          </Text>
        ) : null}
        {send.isError ? (
          <Text className="text-center text-sm text-bad">
            Échec de l&apos;envoi — réessayez.
          </Text>
        ) : null}
      </Card>
    </ScrollScreen>
  );
}
