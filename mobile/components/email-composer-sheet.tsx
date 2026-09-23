// Composition d'un e-mail individuel envoyé PAR BUUPP (parité web
// EmailComposerModal, Pro.jsx). L'adresse du prospect n'est jamais exposée :
// le serveur la résout, envoie un e-mail aux couleurs BUUPP avec le pro en
// Reply-To. Quota : 1 envoi par prospect et par campagne (409 quota_reached).
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useTheme } from "../lib/theme";
import {
  apiErrorCode,
  useContactEmail,
  type ProContactRow,
} from "../lib/queries-pro-contacts";
import { useContactPalette } from "./contact-style";

type Tpl = { label: string; subject: string; body: string };

// Modèles pré-remplis par objectif de campagne — copie conforme du web
// (EMAIL_TEMPLATES_BY_OBJECTIVE). Tokens : {{prenom}} {{pro}} {{camp}}.
const TEMPLATES: Record<string, Tpl[]> = {
  contact: [
    {
      label: "Premier contact — neutre",
      subject: "Suite à votre acceptation sur BUUPP",
      body:
        "Bonjour {{prenom}},\n\n" +
        "Merci d'avoir accepté notre sollicitation dans le cadre de la campagne « {{camp}} ».\n\n" +
        "Je reviens vers vous pour échanger plus en détail sur vos besoins et voir comment {{pro}} peut vous aider concrètement.\n\n" +
        "Quel serait le meilleur moment pour échanger ?\n\n" +
        "Très bonne journée,",
    },
  ],
  rdv: [
    {
      label: "Proposition de RDV",
      subject: "Fixons un rendez-vous — {{camp}}",
      body:
        "Bonjour {{prenom}},\n\n" +
        "Suite à votre acceptation de la campagne « {{camp}} », je vous propose un échange pour avancer concrètement.\n\n" +
        "Quelques créneaux que je peux vous réserver cette semaine :\n" +
        "  • Mardi 10h – 11h\n" +
        "  • Jeudi 14h – 15h\n" +
        "  • Vendredi 16h – 17h\n\n" +
        "Vous pouvez aussi me proposer un autre horaire qui vous arrange — je m'adapte.\n\n" +
        "À très bientôt,",
    },
  ],
  evt: [
    {
      label: "Invitation à un événement",
      subject: "Invitation — {{camp}}",
      body:
        "Bonjour {{prenom}},\n\n" +
        "Merci d'avoir manifesté votre intérêt pour notre campagne « {{camp}} » !\n\n" +
        "Comme convenu, voici le détail de l'événement auquel vous êtes convié(e) :\n\n" +
        "  📅 Date :\n" +
        "  📍 Lieu :\n" +
        "  ⏰ Horaire :\n\n" +
        "Merci de confirmer votre présence en répondant simplement à ce mail. Au plaisir de vous y retrouver !\n\n" +
        "Cordialement,",
    },
  ],
  dl: [
    {
      label: "Envoi du contenu téléchargeable",
      subject: "Votre contenu BUUPP — {{camp}}",
      body:
        "Bonjour {{prenom}},\n\n" +
        "Merci de l'intérêt que vous portez à la campagne « {{camp}} » !\n\n" +
        "Vous trouverez ci-dessous le lien pour télécharger le contenu :\n" +
        "  → [insérer le lien ici]\n\n" +
        "N'hésitez pas à me dire ce que vous en pensez — vos retours nous aident à améliorer nos prochains contenus.\n\n" +
        "Bonne lecture,",
    },
  ],
  devis: [
    {
      label: "Demande d'informations pour devis",
      subject: "Préparons votre devis — {{camp}}",
      body:
        "Bonjour {{prenom}},\n\n" +
        "Merci d'avoir accepté notre proposition de devis dans le cadre de la campagne « {{camp}} ».\n\n" +
        "Pour préparer une estimation précise, j'aurais besoin de quelques informations :\n" +
        "  • Votre besoin principal :\n" +
        "  • Vos contraintes (délai, budget approximatif) :\n" +
        "  • Le meilleur moyen de vous joindre (téléphone, email) :\n\n" +
        "Une fois ces éléments en main, je vous reviens sous 48 h avec une proposition chiffrée.\n\n" +
        "Bien à vous,",
    },
  ],
  survey: [
    {
      label: "Lancement du sondage",
      subject: "Votre avis compte — {{camp}}",
      body:
        "Bonjour {{prenom}},\n\n" +
        "Merci d'avoir accepté de participer à notre sondage dans le cadre de « {{camp}} ».\n\n" +
        "Le questionnaire prend environ 5 minutes :\n" +
        "  → [insérer le lien]\n\n" +
        "Vos réponses sont entièrement anonymes et nous aideront à mieux comprendre vos besoins.\n\n" +
        "Merci d'avance pour votre temps !",
    },
  ],
};

function applyTokens(text: string, t: { prenom: string; pro: string; camp: string }) {
  return text
    .split("{{prenom}}").join(t.prenom.trim() || "vous")
    .split("{{pro}}").join(t.pro.trim() || "BUUPP")
    .split("{{camp}}").join(t.camp.trim() || "la campagne en cours");
}

const ERRORS: Record<string, string> = {
  quota_reached: "Vous avez déjà envoyé un email à ce prospect pour cette campagne.",
  prospect_email_missing: "Le prospect n'a pas partagé son email.",
  relation_not_accepted: "Cette relation n'est plus active.",
  forbidden: "Action non autorisée sur ce contact.",
  campaign_not_closed: "Disponible à la clôture de la campagne.",
  subject_too_long: "L'objet est trop long (200 caractères max).",
  body_too_long: "Le message est trop long (10 000 caractères max).",
  pro_email_missing: "Votre email de compte est introuvable.",
};

export function EmailComposerSheet({
  contact,
  visible,
  onClose,
  onSent,
}: {
  contact: ProContactRow | null;
  visible: boolean;
  onClose: () => void;
  onSent?: () => void;
}) {
  const p = useContactPalette();
  const { varStyle } = useTheme();
  const send = useContactEmail();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (visible) {
      setSubject("");
      setBody("");
      setError(null);
      setDone(false);
    }
  }, [visible, contact?.relationId]);

  const templates = useMemo(
    () => TEMPLATES[contact?.campaignObjective || "contact"] || TEMPLATES.contact,
    [contact?.campaignObjective],
  );

  if (!contact) return null;

  // « Marie L. » → « Marie ».
  const firstName = ((contact.name || "").split(/\s+/)[0] || "").replace(/\.$/, "");
  const tokens = { prenom: firstName, pro: contact.proName || "", camp: contact.campaign || "" };
  const sending = send.isPending;

  const submit = () => {
    const subj = subject.trim();
    const bod = body.trim();
    if (!subj) return setError("L'objet est requis.");
    if (!bod) return setError("Le message ne peut pas être vide.");
    setError(null);
    send.mutate(
      { relationId: contact.relationId, subject: subj, body: bod },
      {
        onSuccess: () => {
          setDone(true);
          onSent?.();
        },
        onError: (e) => setError(ERRORS[apiErrorCode(e) ?? ""] ?? "Échec — réessayez."),
      },
    );
  };

  const field = {
    fontSize: 14,
    color: p.text,
    backgroundColor: p.field,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.border,
    paddingVertical: 11,
    paddingHorizontal: 13,
  } as const;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !sending && onClose()}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[varStyle, { flex: 1 }]}
      >
        <Pressable
          onPress={() => !sending && onClose()}
          style={{ flex: 1, backgroundColor: "rgba(10,22,40,0.44)", justifyContent: "center", padding: 18 }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              maxHeight: "92%",
              backgroundColor: p.card,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: p.border,
              overflow: "hidden",
            }}
          >
            <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled">
              <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
                <Text className="font-serif-bold" style={{ flex: 1, fontSize: 17, color: p.text }}>
                  Envoyer un email à {contact.name}
                </Text>
                <Pressable onPress={() => !sending && onClose()} hitSlop={8} accessibilityLabel="Fermer">
                  <Ionicons name="close" size={20} color={p.sub} />
                </Pressable>
              </View>

              {done ? (
                <>
                  <View
                    className="flex-row items-start"
                    style={{ gap: 10, padding: 12, borderRadius: 12, backgroundColor: p.accentSoft, borderWidth: 1, borderColor: p.accentBorder }}
                  >
                    <Ionicons name="checkmark-circle" size={18} color={p.accent} />
                    <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: p.accentInk }}>
                      Message envoyé via BUUPP. Le prospect vous répondra directement sur votre adresse.
                    </Text>
                  </View>
                  <Pressable
                    onPress={onClose}
                    className="active:opacity-80"
                    style={{ paddingVertical: 12, borderRadius: 12, backgroundColor: p.ctaBg, alignItems: "center" }}
                  >
                    <Text style={{ fontSize: 13.5, fontWeight: "600", color: p.ctaText }}>Fermer</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text
                    style={{
                      fontSize: 12,
                      lineHeight: 18,
                      color: p.sub,
                      padding: 11,
                      borderRadius: 10,
                      backgroundColor: p.accentSoft,
                      borderWidth: 1,
                      borderColor: p.accentBorder,
                      overflow: "hidden",
                    }}
                  >
                    <Text style={{ fontWeight: "700", color: p.text }}>Envoi via BUUPP. </Text>
                    Votre message part depuis nos serveurs avec votre adresse en Reply-To — le
                    prospect répondra directement chez vous. L&apos;adresse email du prospect reste
                    cachée. Quota : 1 envoi par campagne.
                  </Text>

                  {templates.length > 0 ? (
                    <View style={{ gap: 7 }}>
                      <Text className="font-mono" style={{ fontSize: 10, letterSpacing: 1, color: p.muted }}>
                        MODÈLES SUGGÉRÉS
                      </Text>
                      <View className="flex-row" style={{ flexWrap: "wrap", gap: 8 }}>
                        {templates.map((t, i) => (
                          <Pressable
                            key={i}
                            disabled={sending}
                            onPress={() => {
                              setSubject(applyTokens(t.subject, tokens));
                              setBody(applyTokens(t.body, tokens));
                            }}
                            className="flex-row items-center active:opacity-70"
                            style={{ gap: 5, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: p.border, backgroundColor: p.card }}
                          >
                            <Ionicons name="sparkles-outline" size={12} color={p.accent} />
                            <Text style={{ fontSize: 12, fontWeight: "600", color: p.text }}>{t.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  <Text style={{ fontSize: 12, fontWeight: "600", color: p.sub }}>Objet</Text>
                  <TextInput
                    value={subject}
                    onChangeText={(t) => setSubject(t.slice(0, 200))}
                    maxLength={200}
                    editable={!sending}
                    placeholder="Ex. : Suite à votre intérêt pour notre offre"
                    placeholderTextColor={p.muted}
                    style={field}
                  />
                  <View className="flex-row justify-between">
                    <Text style={{ fontSize: 12, fontWeight: "600", color: p.sub }}>Message</Text>
                    <Text className="font-mono" style={{ fontSize: 11, color: p.muted }}>
                      {body.length} / 10000
                    </Text>
                  </View>
                  <TextInput
                    value={body}
                    onChangeText={(t) => setBody(t.slice(0, 10000))}
                    editable={!sending}
                    multiline
                    placeholder={"Bonjour,\n\nMerci d'avoir accepté ma sollicitation. Je vous recontacte pour…"}
                    placeholderTextColor={p.muted}
                    style={[field, { minHeight: 160, textAlignVertical: "top" }]}
                  />
                  <Text style={{ fontSize: 11, lineHeight: 16, color: p.muted }}>
                    Votre message sera intégré dans un email aux couleurs BUUPP, en mentionnant la
                    campagne {contact.campaign ? `« ${contact.campaign} »` : "concernée"}.
                  </Text>

                  {error ? (
                    <Text
                      style={{ fontSize: 12.5, color: "#B91C1C", padding: 10, borderRadius: 10, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FCA5A5", overflow: "hidden" }}
                    >
                      {error}
                    </Text>
                  ) : null}

                  <View className="flex-row" style={{ gap: 10 }}>
                    <Pressable
                      onPress={onClose}
                      disabled={sending}
                      className="active:opacity-80"
                      style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: p.border, alignItems: "center" }}
                    >
                      <Text style={{ fontSize: 13.5, fontWeight: "600", color: p.text }}>Annuler</Text>
                    </Pressable>
                    <Pressable
                      onPress={submit}
                      disabled={sending || !subject.trim() || !body.trim()}
                      className="active:opacity-80"
                      style={{
                        flex: 1.4,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: p.ctaBg,
                        alignItems: "center",
                        opacity: sending || !subject.trim() || !body.trim() ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ fontSize: 13.5, fontWeight: "600", color: p.ctaText }}>
                        {sending ? "Envoi…" : "Envoyer via BUUPP"}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
