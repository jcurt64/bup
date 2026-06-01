// Signalement d'un professionnel — bottom-sheet ouverte depuis
// MovementDetailSheet. Réplique ReportProModal du web (cf.
// public/prototype/components/Prospect.jsx fn ReportProModal) :
// 3 motifs fixes + commentaire optionnel ≤ 1000 chars → POST
// /api/prospect/relations/[id]/report. 409 = déjà signalé → succès
// silencieux (cf. useReportRelation côté queries).
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import { useTheme } from "../lib/theme";
import {
  useReportRelation,
  type MovementRelation,
  type ReportReason,
} from "../lib/queries";

const REPORT_REASONS: {
  key: ReportReason;
  label: string;
  help: string;
}[] = [
  {
    key: "sollicitation_multiple",
    label: "Sollicitation multiple",
    help: "Ce professionnel m'a contacté plus d'une fois. C'est interdit par le règlement BUUPP.",
  },
  {
    key: "faux_compte",
    label: "Faux compte",
    help: "Je doute qu'il s'agisse d'une vraie société. Le pro ne semble pas légitime.",
  },
  {
    key: "echange_abusif",
    label: "Échange abusif",
    help: "L'attitude du professionnel n'a pas été correcte (ton, propos, pression…).",
  },
];

function initials(name: string): string {
  return (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function ReportProSheet({
  visible,
  onClose,
  relation,
  onSubmitted,
}: {
  visible: boolean;
  onClose: () => void;
  relation: MovementRelation | null;
  /** Notifie le parent qu'un signalement a été transmis avec succès,
   *  pour qu'il bascule l'UI sur l'état « déjà signalé ». */
  onSubmitted?: () => void;
}) {
  const { c, isDark } = useTheme();
  const report = useReportRelation();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Réinitialise l'état local à chaque (ré)ouverture pour ne pas
  // persister un signalement passé sur une autre relation.
  useEffect(() => {
    if (visible) {
      setReason(null);
      setComment("");
      setError(null);
      setDone(false);
    }
  }, [visible, relation?.id]);

  // Auto-close après affichage de la confirmation (1,8 s — parité web).
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => onClose(), 1800);
    return () => clearTimeout(t);
  }, [done, onClose]);

  if (!relation) {
    return <BottomSheet visible={visible} onClose={onClose}>{null}</BottomSheet>;
  }

  async function submit() {
    if (!relation || !reason || report.isPending) return;
    setError(null);
    try {
      await report.mutateAsync({
        id: relation.id,
        reason,
        comment: comment.trim() || undefined,
      });
      onSubmitted?.();
      setDone(true);
    } catch {
      setError("Une erreur est survenue, merci de réessayer.");
    }
  }

  if (done) {
    return (
      <BottomSheet visible={visible} onClose={onClose}>
        <View className="items-center gap-3 py-4">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-good">
            <Ionicons name="checkmark" size={28} color="#FFFFFF" />
          </View>
          <Text className="font-serif text-xl text-ink">
            Signalement transmis
          </Text>
          <Text className="px-6 text-center text-[13px] leading-5 text-ink-3">
            Notre équipe le traitera dans les meilleurs délais.
          </Text>
        </View>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPct={88}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingBottom: 12 }}
      >
        <Text className="font-serif text-xl text-ink">
          Signaler un comportement
        </Text>

        {/* Pro concerné — rappel discret */}
        <View className="flex-row items-center gap-3 rounded-2xl border border-line bg-paper px-3 py-2.5">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-violet-soft">
            <Text className="font-serif-bold text-[13px] text-violet">
              {initials(relation.pro)}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-[14px] text-ink" numberOfLines={1}>
              {relation.pro}
            </Text>
            {relation.sector ? (
              <Text className="text-[12px] text-ink-4" numberOfLines={1}>
                {relation.sector}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Motifs — cards sélectionnables (1 actif à la fois) */}
        <View className="gap-2">
          {REPORT_REASONS.map((opt) => {
            const active = reason === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setReason(opt.key)}
                className="rounded-2xl px-4 py-3 active:opacity-80"
                style={{
                  borderWidth: 1.5,
                  borderColor: active ? c.accent : c.borderSoft,
                  backgroundColor: active ? c.accentSoft : c.surface,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className={`text-[14px] font-semibold ${
                      active ? "text-accent-ink" : "text-ink"
                    }`}
                  >
                    {opt.label}
                  </Text>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={18} color={c.accent} />
                  ) : (
                    <View className="h-[18px] w-[18px] rounded-full border border-line" />
                  )}
                </View>
                <Text className="mt-1 text-[12.5px] leading-5 text-ink-3">
                  {opt.help}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Commentaire facultatif */}
        <View>
          <Text
            className="font-mono text-[10px] uppercase text-ink-4"
            style={{ letterSpacing: 0.8 }}
          >
            Détail facultatif
          </Text>
          <View className="mt-1.5 rounded-2xl border border-line bg-paper px-3 py-2">
            <TextInput
              value={comment}
              onChangeText={(t) => setComment(t.slice(0, 1000))}
              placeholder="Ajouter un détail à l'attention de l'équipe BUUPP (facultatif)"
              placeholderTextColor={c.textMuted}
              multiline
              numberOfLines={4}
              style={{
                minHeight: 80,
                textAlignVertical: "top",
                fontSize: 13,
                color: c.text,
              }}
            />
          </View>
          <Text className="mt-1 text-right font-mono text-[11px] text-ink-4">
            {comment.length} / 1000
          </Text>
        </View>

        {error ? (
          <View
            className="rounded-2xl px-3 py-2.5"
            style={{
              backgroundColor: isDark ? c.badSoft : "#FEF2F2",
              borderWidth: 1,
              borderColor: isDark ? c.bad : "#FECACA",
            }}
          >
            <Text className="text-[13px] text-bad">{error}</Text>
          </View>
        ) : null}

        <View className="mt-1 flex-row gap-3">
          <Pressable
            disabled={report.isPending}
            onPress={onClose}
            className="flex-1 items-center rounded-full border border-line bg-paper py-3.5 active:opacity-70"
          >
            <Text className="text-sm font-medium text-ink-3">Annuler</Text>
          </Pressable>
          <Pressable
            disabled={!reason || report.isPending}
            onPress={submit}
            className={`flex-1 items-center rounded-full py-3.5 active:opacity-80 ${
              !reason ? "bg-ink-5" : "bg-ink"
            }`}
          >
            <Text className="text-sm font-semibold text-paper">
              {report.isPending ? "Envoi…" : "Envoyer"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
