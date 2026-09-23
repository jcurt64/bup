// Modales d'action du détail campagne — parité web Pro.jsx :
//  - PauseCampaignSheet : « Pause café · 48 h chrono » (une seule pause,
//    reprise auto à 48 h, avertissement spécifique flash deal).
//  - ExtendCampaignSheet : « Prolonger la campagne » (+ durée initiale,
//    10 € HT débités du solde, une seule fois).
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { useTheme } from "../lib/theme";

function Shell({
  visible,
  busy,
  onClose,
  children,
}: {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { c, varStyle } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy && onClose()}>
      <Pressable
        onPress={() => !busy && onClose()}
        style={[varStyle, { flex: 1, backgroundColor: "rgba(15,22,41,0.55)", justifyContent: "center", padding: 18 }]}
      >
        <Pressable
          onPress={() => {}}
          style={{
            maxHeight: "92%",
            backgroundColor: c.surface,
            borderRadius: 20,
            borderTopWidth: 4,
            borderTopColor: c.accent,
            overflow: "hidden",
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 20 }}>{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Header({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", marginBottom: 16 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.accentSoft,
          borderWidth: 1,
          borderColor: c.accent + "4D",
          marginBottom: 12,
        }}
      >
        {icon}
      </View>
      <Text className="font-serif text-ink" style={{ fontSize: 21, textAlign: "center", marginBottom: 6 }}>
        {title}
      </Text>
      <Text className="text-ink-3" style={{ fontSize: 13.5, lineHeight: 20, textAlign: "center" }}>
        {children}
      </Text>
    </View>
  );
}

function Bullets({ items }: { items: [string, ReactNode][] }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.borderSoft,
        backgroundColor: c.surface2,
        marginBottom: 16,
      }}
    >
      {items.map(([icon, text], i) => (
        <View
          key={i}
          className="flex-row"
          style={{
            gap: 12,
            paddingVertical: 10,
            paddingHorizontal: 14,
            alignItems: "flex-start",
            borderBottomWidth: i < items.length - 1 ? 1 : 0,
            borderBottomColor: c.borderSoft,
          }}
        >
          <Text style={{ fontSize: 15, lineHeight: 20 }}>{icon}</Text>
          <Text className="text-ink-2" style={{ flex: 1, fontSize: 13, lineHeight: 19 }}>
            {text}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Buttons({
  cancel,
  confirm,
  busy,
  busyLabel,
  onCancel,
  onConfirm,
}: {
  cancel: string;
  confirm: string;
  busy: boolean;
  busyLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { c } = useTheme();
  return (
    <View className="flex-row" style={{ gap: 10 }}>
      <Pressable
        onPress={onCancel}
        disabled={busy}
        className="items-center rounded-full border py-3 active:opacity-80"
        style={{ flex: 1, borderColor: c.borderSoft }}
      >
        <Text className="text-[13.5px] font-semibold text-ink-2">{cancel}</Text>
      </Pressable>
      <Pressable
        onPress={onConfirm}
        disabled={busy}
        className="items-center rounded-full py-3 active:opacity-80"
        style={{ flex: 2, backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }}
      >
        <Text className="text-[13.5px] font-semibold" style={{ color: c.btnText }}>
          {busy ? busyLabel : confirm}
        </Text>
      </Pressable>
    </View>
  );
}

const B = ({ children }: { children: ReactNode }) => (
  <Text style={{ fontWeight: "700" }}>{children}</Text>
);

export function PauseCampaignSheet({
  visible,
  name,
  durationKey,
  busy,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  name: string;
  durationKey: string | null | undefined;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Shell visible={visible} busy={busy} onClose={onCancel}>
      <Header icon={<Text style={{ fontSize: 28 }}>☕</Text>} title="Pause café · 48 h chrono">
        Votre campagne <B>{name}</B> s&apos;octroie un mini week-end aux Bahamas. Pendant ce temps,
        elle bronze, vous respirez.
      </Header>
      {durationKey === "1h" ? (
        <View
          className="flex-row"
          style={{
            gap: 10,
            padding: 11,
            borderRadius: 10,
            marginBottom: 14,
            backgroundColor: "#B91C1C14",
            borderWidth: 1,
            borderColor: "#B91C1C40",
            alignItems: "flex-start",
          }}
        >
          <Text style={{ fontSize: 14 }}>📢</Text>
          <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: "#7F1D1D" }}>
            <B>Spécifique flash deal :</B> votre annonce <B>cesse immédiatement d&apos;apparaître sur la
            page d&apos;accueil</B> pendant la pause. Elle réapparaîtra dès la reprise (manuelle ou
            automatique à 48 h), pour le temps restant.
          </Text>
        </View>
      ) : null}
      <Bullets
        items={[
          ["🛑", <>Plus aucun prospect <B>n&apos;est sollicité</B> pendant les 48 h.</>],
          ["💰", <>Les acceptations <B>déjà obtenues sont acquises</B> — récompenses prospects + commission BUUPP <B>restent dues</B>.</>],
          ["⏱️", <>À l&apos;issue des 48 h, la campagne <B>reprend automatiquement</B>. Le temps restant au moment de la pause est <B>intégralement préservé</B>.</>],
          ["▶️", <>Vous pouvez relancer manuellement <B>avant 48 h</B> via le bouton Relancer. Le temps restant reste préservé dans tous les cas.</>],
          ["⚠️", <>Une campagne <B>ne peut être mise en pause qu&apos;une seule fois</B>. On ne rejoue pas la sieste.</>],
        ]}
      />
      <Buttons
        cancel="Finalement non"
        confirm="Mettre en pause 48 h"
        busy={busy}
        busyLabel="Pause en cours…"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </Shell>
  );
}

const DURATION_LABEL: Record<string, string> = {
  "1h": "1 heure",
  "24h": "24 heures",
  "48h": "48 heures",
  "7d": "7 jours",
};
const DURATION_MS: Record<string, number> = {
  "1h": 3600e3,
  "24h": 86400e3,
  "48h": 172800e3,
  "7d": 7 * 86400e3,
};
const fmtFr = (d: Date) =>
  d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function ExtendCampaignSheet({
  visible,
  name,
  durationKey,
  endsAt,
  busy,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  name: string;
  durationKey: string | null | undefined;
  endsAt: string | null | undefined;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { c } = useTheme();
  const label = (durationKey && DURATION_LABEL[durationKey]) || "la durée initiale";
  const ms = durationKey ? DURATION_MS[durationKey] : undefined;
  const end = endsAt ? new Date(endsAt) : null;
  const currentEnd = end && !isNaN(end.getTime()) ? fmtFr(end) : "—";
  const newEnd = end && !isNaN(end.getTime()) && ms ? fmtFr(new Date(end.getTime() + ms)) : "—";
  return (
    <Shell visible={visible} busy={busy} onClose={onCancel}>
      <Header icon={<Ionicons name="time-outline" size={26} color={c.accent} />} title="Prolonger la campagne">
        On ajoute <B>{label}</B> supplémentaires à <B>{name}</B> moyennant <B>10 € HT</B>. La durée
        ajoutée est identique à la durée initiale choisie.
      </Header>
      <Bullets
        items={[
          ["📅", <>Fin actuelle : <B>{currentEnd}</B></>],
          ["⏩", <>Nouvelle fin : <Text style={{ fontWeight: "700", color: c.accent }}>{newEnd}</Text></>],
          ["🔁", <><B>Pas de nouvelle campagne</B> : on prolonge celle-ci, code BUUPP, prospects matchés et brief restent identiques.</>],
          ["⚠️", <>Action irréversible : <B>une campagne ne peut être prolongée qu&apos;une seule fois</B>.</>],
          ["💳", <>10 € HT débités immédiatement de votre solde — non remboursables.</>],
        ]}
      />
      <Buttons
        cancel="Annuler"
        confirm="Confirmer · 10 € HT"
        busy={busy}
        busyLabel="Prolongation…"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </Shell>
  );
}
