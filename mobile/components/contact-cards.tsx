// Composants présentables de la liste Contacts (maquette co.html) : carte
// « Filtres combinés », en-tête de groupe (campagne), carte contact et pilule
// d'état. Extraits dans un module partagé pour pouvoir être réutilisés (écran
// réel + preview). Couleurs « forest » de la maquette → tokens du thème via
// useContactPalette (s'adapte buupp / sombre / fushia).
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View } from "react-native";

import {
  ContactActions,
  initials,
  useContactPalette,
} from "./contact-detail-sheet";
import type { ProContact } from "../lib/queries";

// « il y a 8 h » / « 29 mai » selon l'ancienneté.
export function receivedLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const h = diff / 3_600_000;
  if (h < 1) return "à l'instant";
  if (h < 24) return `il y a ${Math.floor(h)} h`;
  const j = h / 24;
  if (j < 7) return `il y a ${Math.floor(j)} j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ── Filtres cumulatifs (AND) appliqués côté client ────────────────────────
export type FilterKey = "score" | "reached" | "tier2";
export const FILTERS: {
  key: FilterKey;
  label: string;
  test: (r: ProContact) => boolean;
}[] = [
  { key: "score", label: "F1 · Score ≥ 720", test: (r) => r.score >= 720 },
  { key: "reached", label: "F2 · Contact atteint", test: (r) => !!r.email },
  { key: "tier2", label: "F3 · Palier 2", test: (r) => r.tier >= 2 },
];

export function FiltersCard({
  active,
  onToggle,
  onClear,
  shown,
  total,
}: {
  active: Set<FilterKey>;
  onToggle: (k: FilterKey) => void;
  onClear: () => void;
  shown: number;
  total: number;
}) {
  const p = useContactPalette();
  return (
    <View
      style={{
        backgroundColor: p.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: p.border,
        padding: 18,
        shadowColor: "#0A1628",
        shadowOpacity: 0.05,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 5 },
        elevation: 3,
      }}
    >
      <View className="flex-row" style={{ alignItems: "flex-start", gap: 12 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            backgroundColor: p.accentSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="funnel-outline" size={18} color={p.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text className="font-serif-bold" style={{ fontSize: 16.5, color: p.text }}>
            Filtres combinés
          </Text>
          <Text style={{ fontSize: 12.5, color: p.sub, marginTop: 2, lineHeight: 17 }}>
            Activez plusieurs filtres pour affiner vos prospects.
          </Text>
        </View>
        <Text
          style={{ fontSize: 11.5, fontWeight: "600", color: p.muted }}
          numberOfLines={1}
        >
          {shown} / {total}
        </Text>
      </View>

      <View className="flex-row" style={{ flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        {FILTERS.map((f) => {
          const on = active.has(f.key);
          return (
            <Pressable
              key={f.key}
              onPress={() => onToggle(f.key)}
              className="active:opacity-70"
              style={{
                paddingVertical: 7,
                paddingHorizontal: 13,
                borderRadius: 999,
                backgroundColor: on ? p.ctaBg : p.card,
                borderWidth: on ? 0 : 1.5,
                borderColor: p.border,
              }}
            >
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: "600",
                  color: on ? p.ctaText : p.text,
                }}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={onClear}
          className="flex-row items-center active:opacity-70"
          style={{
            gap: 5,
            paddingVertical: 7,
            paddingHorizontal: 13,
            borderRadius: 999,
            backgroundColor: active.size === 0 ? p.ctaBg : p.card,
            borderWidth: active.size === 0 ? 0 : 1.5,
            borderColor: p.border,
          }}
        >
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: "600",
              color: active.size === 0 ? p.ctaText : p.text,
            }}
          >
            × Sans filtre
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── En-tête de groupe (campagne) ──────────────────────────────────────────
export function GroupHeader({ campaign, count }: { campaign: string; count: number }) {
  const p = useContactPalette();
  return (
    <View
      className="flex-row items-center justify-between"
      style={{ gap: 10, marginBottom: 12 }}
    >
      <View className="flex-row items-center" style={{ gap: 10, flex: 1, minWidth: 0 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            backgroundColor: p.accentSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="star" size={16} color={p.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            className="font-serif-bold"
            style={{ fontSize: 16.5, color: p.text, lineHeight: 18 }}
            numberOfLines={1}
          >
            {campaign}
          </Text>
          <Text style={{ fontSize: 11.5, color: p.muted }}>
            {count} prospect{count > 1 ? "s" : ""}
          </Text>
        </View>
      </View>
      <View
        className="flex-row items-center"
        style={{
          gap: 6,
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: p.card,
          borderWidth: 1,
          borderColor: p.accentBorder,
          flexShrink: 0,
        }}
      >
        <Ionicons name="mail-outline" size={14} color={p.accent} />
        <Text style={{ fontSize: 12, fontWeight: "600", color: p.accentInk }}>
          Message groupé
        </Text>
      </View>
    </View>
  );
}

// Pilule d'état (point + libellé). Verte si atteinte, neutre sinon.
function EvalPill({ label, on }: { label: string; on: boolean }) {
  const p = useContactPalette();
  return (
    <View
      className="flex-row items-center"
      style={{
        gap: 5,
        paddingVertical: 5,
        paddingHorizontal: 11,
        borderRadius: 999,
        backgroundColor: on ? p.accentSoft : p.card,
        borderWidth: 1.5,
        borderColor: on ? p.accentBorder : p.border,
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          backgroundColor: on ? p.accent : p.ink5,
        }}
      />
      <Text
        style={{ fontSize: 12, fontWeight: "600", color: on ? p.accentInk : p.sub }}
      >
        {label}
      </Text>
    </View>
  );
}

// ── Carte contact ─────────────────────────────────────────────────────────
export function ContactCard({
  contact,
  onDetails,
}: {
  contact: ProContact;
  onDetails: () => void;
}) {
  const p = useContactPalette();
  const reached = !!contact.email; // « Contact atteint » = coordonnées révélées
  return (
    <View
      style={{
        backgroundColor: p.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: p.border,
        overflow: "hidden",
        shadowColor: "#0A1628",
        shadowOpacity: 0.05,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      <View style={{ paddingVertical: 15, paddingHorizontal: 16 }}>
        {/* Avatar + identité + reçu */}
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <LinearGradient
            colors={p.avatar}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: p.accent,
              shadowOpacity: 0.25,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
              elevation: 4,
            }}
          >
            <Text
              className="font-serif-bold"
              style={{ fontSize: 15, color: "#FFFFFF", letterSpacing: 0.3 }}
            >
              {initials(contact.name)}
            </Text>
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              className="font-serif-bold"
              style={{ fontSize: 17, color: p.text, lineHeight: 19 }}
              numberOfLines={1}
            >
              {contact.name}
            </Text>
            <View className="flex-row items-center" style={{ gap: 7, marginTop: 4 }}>
              <View
                className="flex-row items-center"
                style={{
                  gap: 4,
                  backgroundColor: p.accentSoft,
                  borderRadius: 6,
                  paddingVertical: 2,
                  paddingHorizontal: 7,
                }}
              >
                <Ionicons name="star" size={11} color={p.accent} />
                <Text style={{ fontSize: 11.5, fontWeight: "700", color: p.accentInk }}>
                  {contact.score}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: p.sub,
                  backgroundColor: p.palier,
                  borderWidth: 1,
                  borderColor: p.border,
                  borderRadius: 6,
                  paddingVertical: 2,
                  paddingHorizontal: 7,
                  overflow: "hidden",
                }}
              >
                P{contact.tier}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
            <Text
              style={{
                fontSize: 9.5,
                fontWeight: "700",
                letterSpacing: 0.6,
                color: p.muted,
              }}
            >
              REÇU
            </Text>
            <Text style={{ fontSize: 11.5, color: p.sub, marginTop: 3 }}>
              {receivedLabel(contact.receivedAt)}
            </Text>
          </View>
        </View>

        {/* Encart coordonnées (watermark) */}
        <View
          style={{
            marginTop: 13,
            paddingVertical: 11,
            paddingHorizontal: 13,
            borderRadius: 12,
            backgroundColor: p.field,
            borderWidth: 1,
            borderColor: p.border,
          }}
        >
          <View className="flex-row items-center" style={{ gap: 9 }}>
            <Ionicons name="mail-outline" size={16} color={p.accent} />
            <Text
              className="font-mono"
              style={{ fontSize: 12, color: p.text, flex: 1 }}
              numberOfLines={1}
            >
              {contact.email ?? "—"}
            </Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 9, marginTop: 8 }}>
            <Ionicons name="call-outline" size={16} color={p.muted} />
            <Text style={{ fontSize: 12.5, color: p.muted }}>
              {contact.telephone ?? "—"}
            </Text>
          </View>
        </View>

        {/* État d'évaluation */}
        <View className="flex-row items-center" style={{ gap: 9, marginTop: 13 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 0.6,
              color: p.muted,
            }}
          >
            ÉVAL.
          </Text>
          <EvalPill label={reached ? "Atteint" : "Non atteint"} on={reached} />
          <EvalPill
            label={contact.tier >= 2 ? "Palier 2" : "Palier 1"}
            on={contact.tier >= 2}
          />
        </View>
      </View>

      {/* Footer : actions + Voir détails */}
      <View
        className="flex-row items-center justify-between"
        style={{
          gap: 10,
          paddingVertical: 12,
          paddingHorizontal: 16,
          backgroundColor: p.accentSoft,
          borderTopWidth: 1,
          borderTopColor: p.line,
        }}
      >
        <ContactActions email={contact.email} />
        <Pressable
          onPress={onDetails}
          accessibilityLabel="Voir les détails du prospect"
          className="flex-row items-center active:opacity-80"
          style={{
            gap: 6,
            paddingVertical: 9,
            paddingHorizontal: 14,
            borderRadius: 999,
            backgroundColor: p.ctaBg,
            flexShrink: 0,
          }}
        >
          <Ionicons name="copy-outline" size={15} color={p.ctaText} />
          <Text style={{ fontSize: 12.5, fontWeight: "600", color: p.ctaText }}>
            Voir détails
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
