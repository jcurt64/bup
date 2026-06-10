// FREEBUUPP (pro) — détail d'un tirage : statut, lancement du tirage
// vérifiable, gagnants (n° + téléphone + signalement éventuel), et mail
// groupé unique de consolation aux non-gagnants.
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Linking, Pressable, Text, TextInput, View } from "react-native";

import { Card, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import {
  useConsolationFreebuupp,
  useDrawFreebuupp,
  useProFreebuuppDetail,
  type ProFreebuuppDetail,
} from "../../lib/queries";
import { useTheme } from "../../lib/theme";

const STATUS_LABEL: Record<string, string> = {
  open: "En cours",
  closed: "À tirer",
  drawn: "Tiré",
  canceled: "Annulé",
};

function countdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Clôturé";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function FreebuuppDetailPro() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useProFreebuuppDetail(id);
  const draw = useDrawFreebuupp();
  const consolation = useConsolationFreebuupp();
  const [message, setMessage] = useState("");

  const onRefresh = useCallback(async () => {
    await detail.refetch();
  }, [detail]);

  async function doDraw() {
    try {
      await draw.mutateAsync({ id });
    } catch {
      Alert.alert("Erreur", "Le tirage n'a pas pu être lancé. Réessayez.");
    }
  }

  async function sendConsolation() {
    if (!message.trim()) return;
    try {
      const res = await consolation.mutateAsync({ id, message: message.trim() });
      setMessage("");
      Alert.alert("Mail envoyé", `Votre message a été envoyé à ${res.sent} non-gagnant(s).`);
    } catch {
      Alert.alert("Erreur", "L'envoi a échoué. Réessayez.");
    }
  }

  return (
    <ScrollScreen
      onRefresh={onRefresh}
      headerVariant="pro"
      hero={{ eyebrow: "FREEBUUPP", title: "Détail du tirage", nav: "back" }}
    >
      <QueryGate query={detail}>
        {(d) => {
          const fb: ProFreebuuppDetail = d.freebuupp;
          const losersCount = Math.max(0, (fb.participantCount || 0) - (fb.winners?.length ?? 0));
          return (
            <View className="gap-4">
              <View>
                <SectionTitle eyebrow="Tirage" title={fb.title} />
                <Text className="mt-1 text-lg text-ink-3">🎁 {fb.prizeDescription}</Text>
              </View>

              <Card>
                <View className="flex-row flex-wrap gap-6">
                  <Stat label="Participants" value={`${fb.participantCount} / ${fb.panelSize}`} c={c} />
                  <Stat label="Gagnants" value={String(fb.winnersCount)} c={c} />
                  <Stat label="Statut" value={STATUS_LABEL[fb.effectiveStatus] ?? fb.status} c={c} />
                  {fb.effectiveStatus === "open" && (
                    <Stat label="Clôture" value={countdown(fb.closesAt)} c={c} />
                  )}
                </View>
              </Card>

              {fb.effectiveStatus === "open" && (
                <Card>
                  <Text className="text-ink-3">
                    Inscriptions ouvertes. Le tirage sera disponible à la clôture (24 h) ou dès que le panel
                    sera complet.
                  </Text>
                </Card>
              )}

              {fb.effectiveStatus === "closed" && (
                <Card>
                  <Text className="font-semibold text-ink">Les inscriptions sont closes 🎲</Text>
                  <Text className="mt-1 text-sm text-ink-4">
                    {fb.participantCount} participant(s). Lancez le tirage au sort vérifiable.
                  </Text>
                  <Pressable
                    disabled={draw.isPending}
                    onPress={doDraw}
                    className="mt-3 items-center rounded-full py-3 active:opacity-80"
                    style={{ backgroundColor: c.accent }}
                  >
                    <Text className="text-sm font-semibold" style={{ color: c.paper }}>
                      {draw.isPending ? "Tirage…" : "Lancer le tirage"}
                    </Text>
                  </Pressable>
                </Card>
              )}

              {fb.status === "drawn" && (
                <Card badge={{ icon: "trophy-outline", tone: "amber" }} tone="amber">
                  <Text className="font-serif text-xl text-ink">🎉 Gagnants</Text>
                  <View className="mt-2 gap-2">
                    {fb.winners.map((w) => (
                      <View
                        key={w.participantNumber}
                        className="flex-row items-center justify-between border-b py-2"
                        style={{ borderColor: c.field }}
                      >
                        <Text className="font-semibold text-ink">n°{w.participantNumber}</Text>
                        <View className="flex-row items-center gap-3">
                          {w.telephone ? (
                            <Pressable
                              onPress={() => Linking.openURL(`tel:${w.telephone}`)}
                              className="flex-row items-center gap-1 active:opacity-70"
                            >
                              <Ionicons name="call-outline" size={14} color={c.accent} />
                              <Text className="font-mono text-sm" style={{ color: c.accent }}>
                                {w.telephone}
                              </Text>
                            </Pressable>
                          ) : (
                            <Text className="text-sm text-ink-4">—</Text>
                          )}
                          {w.prizeReported && (
                            <Text className="text-xs" style={{ color: c.bad }}>
                              ⚠️ Signalé
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                  <Text className="mt-3 text-xs text-ink-4">
                    🔒 Tirage vérifiable. Seul le téléphone des gagnants vous est communiqué — contactez-les
                    pour la remise du lot.
                  </Text>
                </Card>
              )}

              {fb.status === "drawn" && losersCount > 0 && (
                <Card>
                  <SectionTitle eyebrow="Marketing" title="Mail aux non-gagnants" />
                  {fb.consolationSent ? (
                    <Text className="mt-2 text-ink-3">
                      ✅ Mail de consolation déjà envoyé aux {losersCount} non-gagnant(s). Un seul envoi est
                      autorisé.
                    </Text>
                  ) : (
                    <View className="mt-2 gap-3">
                      <Text className="text-sm text-ink-4">
                        Envoyez un <Text className="font-semibold">unique</Text> message aux {losersCount}{" "}
                        prospect(s) non tiré(s) pour présenter vos services.
                      </Text>
                      <TextInput
                        value={message}
                        onChangeText={setMessage}
                        maxLength={1500}
                        multiline
                        placeholder="Ex. : Merci d'avoir participé ! -10 % sur votre première visite…"
                        placeholderTextColor={c.textMuted}
                        style={{
                          backgroundColor: c.field,
                          color: c.ink,
                          borderRadius: 12,
                          padding: 12,
                          fontSize: 16,
                          minHeight: 90,
                          textAlignVertical: "top",
                        }}
                      />
                      <Pressable
                        disabled={consolation.isPending || !message.trim()}
                        onPress={sendConsolation}
                        className="items-center rounded-full py-3 active:opacity-80"
                        style={{ backgroundColor: c.accent, opacity: !message.trim() ? 0.5 : 1 }}
                      >
                        <Text className="text-sm font-semibold" style={{ color: c.paper }}>
                          {consolation.isPending ? "Envoi…" : "Envoyer (une seule fois)"}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </Card>
              )}
            </View>
          );
        }}
      </QueryGate>
    </ScrollScreen>
  );
}

function Stat({ label, value, c }: { label: string; value: string; c: { textMuted: string; ink: string } }) {
  return (
    <View>
      <Text className="font-mono text-[11px] uppercase" style={{ color: c.textMuted }}>
        {label}
      </Text>
      <Text className="font-serif text-xl" style={{ color: c.ink }}>
        {value}
      </Text>
    </View>
  );
}
