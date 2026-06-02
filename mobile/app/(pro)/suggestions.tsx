// Vos suggestions — POST /api/me/suggestions (partagé prospect/pro).
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { Card, ScrollScreen } from "../../components/screen";
import { useSendSuggestion } from "../../lib/queries";
import { useTheme } from "../../lib/theme";

export default function ProSuggestions() {
  const { c } = useTheme();
  const send = useSendSuggestion();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  async function submit() {
    if (message.trim().length < 3) {
      Alert.alert("Message vide", "Décrivez votre suggestion en quelques mots.");
      return;
    }
    try {
      await send.mutateAsync({
        subject: subject.trim() || null,
        message: message.trim(),
      });
      setSubject("");
      setMessage("");
      Alert.alert("Merci !", "Votre suggestion a bien été envoyée.");
    } catch {
      Alert.alert("Envoi impossible", "Réessayez dans un instant.");
    }
  }

  return (
    <ScrollScreen
      headerVariant="pro"
      hero={{
        nav: "back",
        eyebrow: "Vos suggestions",
        title: "Aidez-nous à progresser",
        desc: "Une idée, un manque, un bug ? Dites-nous tout.",
      }}
    >
      <Card>
        <View className="gap-3">
          <View>
            <Text className="mb-1 text-[12px] font-semibold text-ink-3">Sujet (optionnel)</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="Ex. Filtres de campagne"
              placeholderTextColor={c.textMuted}
              style={{
                backgroundColor: c.field,
                borderColor: c.borderSoft,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 11,
                fontSize: 15,
                color: c.text,
              }}
            />
          </View>
          <View>
            <Text className="mb-1 text-[12px] font-semibold text-ink-3">Votre message</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Décrivez votre suggestion…"
              placeholderTextColor={c.textMuted}
              multiline
              style={{
                backgroundColor: c.field,
                borderColor: c.borderSoft,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 11,
                fontSize: 15,
                color: c.text,
                minHeight: 120,
                textAlignVertical: "top",
              }}
            />
          </View>
        </View>
      </Card>

      <Pressable
        disabled={send.isPending}
        onPress={submit}
        accessibilityRole="button"
        className="mt-1 flex-row items-center justify-center gap-2 rounded-full py-3 active:opacity-80"
        style={{ backgroundColor: c.btnBg }}
      >
        <Text className="text-base font-semibold" style={{ color: c.btnText }}>
          {send.isPending ? "Envoi…" : "Envoyer"}
        </Text>
      </Pressable>
    </ScrollScreen>
  );
}
