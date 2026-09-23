// Rangée d'actions de contact (appel / e-mail / SMS / WhatsApp) — parité web
// ContactActionButtons + RevealContactModal + EmailComposerModal (Pro.jsx).
//
//  - Chaque clic est logué (`contact-click` → audit admin + rappel anti-abus
//    ≥3/24h) ; l'appel est aussi logué (`call-log`).
//  - E-mail : jamais de mailto — composition dans l'app, envoi PAR BUUPP
//    (POST /email, quota 1 / campagne).
//  - Appel / SMS / WhatsApp : le numéro est obtenu via la révélation AUDITÉE
//    (POST /reveal, fail-closed : pas de journal → pas de numéro), affiché
//    masqué, puis la CTA ouvre l'app native. SMS de préavis « BUUPP + code »
//    au lancement de l'appel (call-notice, dédupliqué serveur).
//  - Bouton non actionnable (donnée non partagée, quota, canal inactif) :
//    reste cliquable et explique pourquoi (au lieu d'un bouton « mort »).
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Linking, Modal, Pressable, Text, View } from "react-native";

import { useApi } from "../lib/api";
import { useTheme } from "../lib/theme";
import { useContactReveal, type ProContactRow } from "../lib/queries-pro-contacts";
import { useContactPalette } from "./contact-detail-sheet";
import { EmailComposerSheet } from "./email-composer-sheet";

type Intent = "call" | "email" | "sms" | "whatsapp";
type PhoneIntent = Exclude<Intent, "email">;

// « 06 •• •• •• 78 » — seul l'AFFICHAGE est masqué, la CTA utilise le numéro réel.
export function maskPhoneDisplay(v: string | null | undefined): string {
  if (!v) return "";
  const d = String(v).replace(/\D/g, "");
  if (d.length < 4) return v;
  return `${d.slice(0, 2)} •• •• •• ${d.slice(-2)}`;
}

// Normalise un numéro FR pour WhatsApp (wa.me attend l'international sans +).
function waNumber(phone: string): string {
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "33" + d.slice(1);
  return d.replace(/\D/g, "");
}

const REVEAL: Record<
  PhoneIntent,
  { icon: keyof typeof Ionicons.glyphMap; title: string; cta: string; build: (v: string) => string }
> = {
  call: { icon: "call-outline", title: "Contacter", cta: "Appeler maintenant", build: (v) => `tel:${v.replace(/[^\d+]/g, "")}` },
  sms: { icon: "chatbox-outline", title: "Envoyer un SMS à", cta: "Ouvrir mes SMS", build: (v) => `sms:${v.replace(/[^\d+]/g, "")}` },
  whatsapp: { icon: "logo-whatsapp", title: "WhatsApp avec", cta: "Ouvrir WhatsApp", build: (v) => `https://wa.me/${waNumber(v)}` },
};

// ── Modale de révélation auditée (téléphone) ──────────────────────────────
function RevealContactSheet({
  relationId,
  intent,
  name,
  onClose,
}: {
  relationId: string;
  intent: PhoneIntent;
  name: string;
  onClose: () => void;
}) {
  const p = useContactPalette();
  const { varStyle } = useTheme();
  const api = useApi();
  const reveal = useContactReveal();
  const [status, setStatus] = useState<"loading" | "ok" | "not_shared" | "error">("loading");
  const [value, setValue] = useState<string | null>(null);
  const meta = REVEAL[intent];

  useEffect(() => {
    let cancelled = false;
    reveal
      .mutateAsync({ relationId, field: "telephone" })
      .then((j) => {
        if (cancelled) return;
        setValue(j.value);
        setStatus("ok");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const st = (e as { status?: number })?.status;
        setStatus(st === 404 ? "not_shared" : "error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationId]);

  const launch = () => {
    if (!value) return;
    if (intent === "call") {
      // SMS de préavis « BUUPP + code buupp » (dédupliqué serveur, 1×/relation).
      api(`/api/pro/contacts/${relationId}/call-notice`, { method: "POST" }).catch(() => {});
    }
    Linking.openURL(meta.build(value)).catch(() =>
      Alert.alert("Action indisponible", "Impossible d'ouvrir l'application sur cet appareil."),
    );
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={[varStyle, { flex: 1, backgroundColor: "rgba(10,22,40,0.44)", justifyContent: "center", padding: 22 }]}
      >
        <Pressable
          onPress={() => {}}
          style={{ backgroundColor: p.card, borderRadius: 20, borderWidth: 1, borderColor: p.border, padding: 20, gap: 12 }}
        >
          <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
            <View className="flex-row items-center" style={{ gap: 8, flex: 1 }}>
              <Ionicons name={meta.icon} size={17} color={p.text} />
              <Text className="font-serif-bold" style={{ fontSize: 17, color: p.text, flexShrink: 1 }} numberOfLines={2}>
                {meta.title} {name}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Fermer">
              <Ionicons name="close" size={20} color={p.sub} />
            </Pressable>
          </View>

          {status === "loading" ? (
            <Text style={{ textAlign: "center", color: p.muted, fontSize: 13, paddingVertical: 18 }}>
              Récupération du contact…
            </Text>
          ) : status === "ok" && value ? (
            <>
              <Text className="font-mono" style={{ textAlign: "center", fontSize: 22, color: p.text, paddingVertical: 14 }}>
                {maskPhoneDisplay(value)}
              </Text>
              <Pressable
                onPress={launch}
                className="flex-row items-center justify-center active:opacity-80"
                style={{ gap: 8, paddingVertical: 13, borderRadius: 12, backgroundColor: p.ctaBg }}
              >
                <Ionicons name={meta.icon} size={16} color={p.ctaText} />
                <Text style={{ fontSize: 14, fontWeight: "600", color: p.ctaText }}>{meta.cta}</Text>
              </Pressable>
              <Text style={{ fontSize: 11, color: p.muted, textAlign: "center" }}>
                ⓘ Cet accès a été enregistré dans votre historique de consultations.
              </Text>
              <View
                className="flex-row items-start"
                style={{ gap: 8, padding: 10, borderRadius: 8, backgroundColor: "#B91C1C1A", borderWidth: 1, borderColor: "#B91C1C4D" }}
              >
                <Ionicons name="alert-circle-outline" size={15} color="#B91C1C" />
                <Text style={{ flex: 1, fontSize: 11, lineHeight: 16, color: "#B91C1C" }}>
                  L&apos;accès aux informations des prospects est loggé pour des raisons d&apos;audit
                  et de traçabilité. Une seule sollicitation par prospect est autorisée conformément
                  aux CGV de BUUPP.
                </Text>
              </View>
            </>
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 10, gap: 14 }}>
              <Text style={{ fontSize: 13, color: p.text, textAlign: "center" }}>
                {status === "not_shared"
                  ? "Le prospect n'a pas partagé ce contact pour cette campagne."
                  : "Impossible de récupérer le contact. Réessayez."}
              </Text>
              <Pressable
                onPress={onClose}
                className="active:opacity-80"
                style={{ paddingVertical: 9, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: p.border }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: p.text }}>Fermer</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Rangée d'actions ──────────────────────────────────────────────────────
export function ContactActions({ contact }: { contact: ProContactRow | null }) {
  const p = useContactPalette();
  const api = useApi();
  const [reveal, setReveal] = useState<PhoneIntent | null>(null);
  const [composing, setComposing] = useState(false);

  if (!contact || contact.locked) return null;
  const relationId = contact.relationId;

  const channels = Array.isArray(contact.campaignChannels) ? contact.campaignChannels : null;
  const channelAllowed = (k: string) => channels === null || channels.includes(k);
  const hasValue = (v: string | null | undefined) => !!v && v !== "—";
  const phoneOk = contact.telephoneAvailable ?? hasValue(contact.telephone);
  const emailOk = contact.emailAvailable ?? hasValue(contact.email);
  const quotaReached = (contact.emailsSent ?? 0) >= 1;

  const buttons: {
    key: Intent;
    channel: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    label: string;
    dataOk: boolean;
  }[] = [
    { key: "call", channel: "phone", icon: "call-outline", color: p.accent, label: "Appeler", dataOk: phoneOk },
    { key: "email", channel: "email", icon: "mail-outline", color: p.coral, label: "Envoyer un e-mail via BUUPP", dataOk: emailOk },
    { key: "sms", channel: "sms", icon: "chatbox-outline", color: p.blue, label: "SMS", dataOk: phoneOk },
    { key: "whatsapp", channel: "whatsapp", icon: "logo-whatsapp", color: p.accent, label: "WhatsApp", dataOk: phoneOk },
  ];

  const blockedInfo = (b: (typeof buttons)[number]): [string, string] | null => {
    if (!channelAllowed(b.channel)) {
      return [
        "Canal non activé pour cette campagne",
        "Ce canal de contact n'a pas été activé lors de la configuration de votre campagne. Pour l'utiliser, créez une nouvelle campagne en cochant ce canal à l'étape « Objectif & canaux ».",
      ];
    }
    if (!b.dataOk) {
      const what = b.channel === "email" ? "son adresse e-mail" : "son numéro de téléphone";
      return [
        "Donnée non partagée par le prospect",
        `Le prospect n’a pas partagé ${what} pour cette campagne. Vous ne pouvez donc pas le contacter par ce canal. Sur BUUPP, chaque donnée révélée est conditionnée à l’accord explicite du prospect.`,
      ];
    }
    if (b.key === "email" && quotaReached) {
      return [
        "Quota d’envoi atteint",
        "Vous avez déjà envoyé un e-mail à ce prospect pour cette campagne. Pour préserver son expérience et éviter le harcèlement, BUUPP limite à « 1 envoi par campagne et par prospect ».",
      ];
    }
    return null;
  };

  const onPress = (b: (typeof buttons)[number]) => {
    const info = blockedInfo(b);
    if (info) {
      Alert.alert(info[0], info[1]);
      return;
    }
    api(`/api/pro/contacts/${relationId}/contact-click`, {
      method: "POST",
      body: JSON.stringify({ channel: b.key }),
    }).catch(() => {});
    if (b.key === "email") {
      setComposing(true);
      return;
    }
    if (b.key === "call") {
      api(`/api/pro/contacts/${relationId}/call-log`, { method: "POST" }).catch(() => {});
    }
    setReveal(b.key);
  };

  return (
    <View className="flex-row" style={{ gap: 8 }}>
      {buttons.map((b) => {
        const blocked = !!blockedInfo(b);
        return (
          <Pressable
            key={b.key}
            onPress={() => onPress(b)}
            hitSlop={6}
            accessibilityLabel={b.label}
            className="items-center justify-center active:opacity-70"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: p.card,
              borderWidth: 0.7,
              borderColor: p.border,
              opacity: blocked ? 0.55 : 1,
            }}
          >
            <Ionicons name={b.icon} size={17} color={b.color} />
          </Pressable>
        );
      })}
      {reveal ? (
        <RevealContactSheet
          relationId={relationId}
          intent={reveal}
          name={contact.name}
          onClose={() => setReveal(null)}
        />
      ) : null}
      <EmailComposerSheet contact={contact} visible={composing} onClose={() => setComposing(false)} />
    </View>
  );
}
