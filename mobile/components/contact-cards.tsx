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

// Date de clôture longue (« 12 juin 2026 »).
export function closeLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// Couleur de catégorie par objectif de campagne (parité web Pro.jsx) :
// accent latéral + pastille. Palette désaturée « épuré, jamais criard ».
type CategoryStyle = { accent: string; label: string; ion: keyof typeof Ionicons.glyphMap };
const CATEGORY: Record<string, CategoryStyle> = {
  contact: { accent: "#4F46E5", label: "Contact", ion: "mail-outline" },
  rdv: { accent: "#0D9488", label: "Rendez-vous", ion: "calendar-outline" },
  evt: { accent: "#D97706", label: "Événementiel", ion: "sparkles-outline" },
  dl: { accent: "#DB2777", label: "Téléchargement", ion: "download-outline" },
  survey: { accent: "#7C3AED", label: "Études & avis", ion: "document-text-outline" },
  promo: { accent: "#E11D48", label: "Promotions", ion: "gift-outline" },
  addigital: { accent: "#0891B2", label: "Publicité", ion: "globe-outline" },
};
export function categoryStyle(objectiveId?: string | null): CategoryStyle {
  return (objectiveId && CATEGORY[objectiveId]) || { accent: "#6B7280", label: "Campagne", ion: "pricetag-outline" };
}

// Gradient d'avatar (cercle d'initiales) varié par prospect — teintes vives,
// initiales blanches. Hash stable sur le nom (parité avec le web).
const AVATAR_GRADIENTS: [string, string][] = [
  ["#6366F1", "#4F46E5"], // indigo
  ["#14B8A6", "#0D9488"], // teal
  ["#F59E0B", "#D97706"], // ambre
  ["#EC4899", "#DB2777"], // rose
  ["#8B5CF6", "#7C3AED"], // violet
  ["#06B6D4", "#0891B2"], // cyan
  ["#22C55E", "#16A34A"], // vert
  ["#FB7185", "#E11D48"], // rose foncé
];
export function avatarGradient(name: string): [string, string] {
  const s = name || "?";
  let h = 0;
  for (let i = 0; i < s.length; i++) h += s.charCodeAt(i);
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
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
                backgroundColor: on ? "#3B82F6" : p.card,
                borderWidth: on ? 0 : 1.5,
                borderColor: p.border,
              }}
            >
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: "600",
                  color: on ? "#FFFFFF" : p.text,
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
// Refonte « Mes prospects » (parité web) : accent latéral + pastille de
// catégorie, date de clôture, et le trio d'actions empilé
// (Voir en détails · Sélectionner tous · Message groupé).
// Pile d'avatars (3 max + badge « +N » du reste). Bordure épaisse couleur carte
// pour le chevauchement, dégradés vifs par prospect.
function AvatarStack({ contacts }: { contacts: ProContact[] }) {
  const p = useContactPalette();
  const preview = contacts.slice(0, 3);
  const extra = contacts.length - preview.length;
  return (
    <View className="flex-row items-center" style={{ flexShrink: 0 }}>
      {preview.map((c, idx) => (
        <LinearGradient
          key={c.relationId || idx}
          colors={avatarGradient(c.name)}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            marginLeft: idx === 0 ? 0 : -10,
            borderWidth: 3,
            borderColor: p.card,
          }}
        >
          <Text
            className="font-serif-bold"
            style={{ fontSize: 11.5, color: "#FFFFFF" }}
          >
            {initials(c.name)}
          </Text>
        </LinearGradient>
      ))}
      {extra > 0 ? (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            marginLeft: -10,
            borderWidth: 3,
            borderColor: p.card,
            backgroundColor: p.text,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: p.card }}>
            +{extra}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function GroupHeader({
  campaign,
  count,
  objective,
  closesAt,
  contacts = [],
  emailableCount = 0,
  selectedCount = 0,
  allSelected = false,
  sending = false,
  collapsed = false,
  onToggleCollapse,
  onViewDetails,
  onToggleSelectAll,
  onGroupMessage,
}: {
  campaign: string;
  count: number;
  objective?: string | null;
  closesAt?: string | null;
  contacts?: ProContact[];
  emailableCount?: number;
  selectedCount?: number;
  allSelected?: boolean;
  sending?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onViewDetails?: () => void;
  onToggleSelectAll?: () => void;
  onGroupMessage?: () => void;
}) {
  const p = useContactPalette();
  const cat = categoryStyle(objective);
  const closed = closeLabel(closesAt);
  const canSelect = emailableCount > 0;
  const canMessage = selectedCount > 0 && !sending;
  return (
    <View
      style={{
        gap: 12,
        marginBottom: 12,
        borderLeftWidth: 3,
        borderLeftColor: cat.accent,
        paddingLeft: 12,
      }}
    >
      {/* Identité + pastille catégorie + date de clôture */}
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            backgroundColor: cat.accent + "1A",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={cat.ion} size={16} color={cat.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View className="flex-row items-center" style={{ gap: 6, marginBottom: 2 }}>
            <View
              style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: cat.accent }}
            />
            <Text
              style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.8, color: cat.accent }}
              numberOfLines={1}
            >
              {cat.label.toUpperCase()}
            </Text>
          </View>
          <Text
            className="font-serif-bold"
            style={{ fontSize: 16.5, color: p.text, lineHeight: 18 }}
            numberOfLines={1}
          >
            {campaign}
          </Text>
          <View
            className="flex-row items-center"
            style={{ flexWrap: "wrap", marginTop: 2, rowGap: 2 }}
          >
            <Text style={{ fontSize: 11.5, color: p.muted }}>
              {count} prospect{count > 1 ? "s" : ""}
            </Text>
            {closed ? (
              <View className="flex-row items-center" style={{ gap: 3, marginLeft: 6 }}>
                <Text style={{ fontSize: 11.5, color: p.muted, opacity: 0.5 }}>·</Text>
                <Ionicons name="calendar-outline" size={12} color={p.muted} />
                <Text style={{ fontSize: 11.5, color: p.muted }}>
                  Clôturée le {closed}
                </Text>
              </View>
            ) : null}
            {selectedCount > 0 ? (
              <Text style={{ fontSize: 11.5, color: p.muted, marginLeft: 6 }}>
                · {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
              </Text>
            ) : null}
          </View>
        </View>
        {contacts.length > 0 ? <AvatarStack contacts={contacts} /> : null}
      </View>

      {/* Actions : Déplier · Statistiques · Sélectionner tous · Message groupé */}
      <View className="flex-row" style={{ flexWrap: "wrap", gap: 8 }}>
        <Pressable
          onPress={onToggleCollapse}
          accessibilityRole="button"
          className="flex-row items-center active:opacity-80"
          style={{
            gap: 6,
            paddingVertical: 7,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: p.card,
            borderWidth: 1,
            borderColor: p.border,
          }}
        >
          <Ionicons
            name={collapsed ? "chevron-down" : "chevron-up"}
            size={14}
            color={p.text}
          />
          <Text style={{ fontSize: 12, fontWeight: "600", color: p.text }}>
            {collapsed ? "Déplier" : "Replier"}
          </Text>
        </Pressable>

        <Pressable
          onPress={onViewDetails}
          className="flex-row items-center active:opacity-80"
          style={{
            gap: 6,
            paddingVertical: 7,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: cat.accent + "14",
            borderWidth: 1,
            borderColor: cat.accent,
          }}
        >
          <Ionicons name="stats-chart-outline" size={14} color={cat.accent} />
          <Text style={{ fontSize: 12, fontWeight: "600", color: cat.accent }}>
            Statistiques
          </Text>
        </Pressable>

        <Pressable
          onPress={onToggleSelectAll}
          disabled={!canSelect}
          className="flex-row items-center active:opacity-80"
          style={{
            gap: 6,
            paddingVertical: 7,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: p.card,
            borderWidth: 1,
            borderColor: p.border,
            opacity: canSelect ? 1 : 0.45,
          }}
        >
          <Ionicons
            name={allSelected ? "checkbox" : "square-outline"}
            size={14}
            color={p.text}
          />
          <Text style={{ fontSize: 12, fontWeight: "600", color: p.text }}>
            {allSelected ? "Tout désélectionner" : "Sélectionner tous"}
          </Text>
        </Pressable>

        <Pressable
          onPress={onGroupMessage}
          disabled={!canMessage}
          className="flex-row items-center active:opacity-80"
          style={{
            gap: 6,
            paddingVertical: 7,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: canMessage ? p.ctaBg : p.field,
            borderWidth: canMessage ? 0 : 1,
            borderColor: p.border,
          }}
        >
          <Ionicons
            name="mail-outline"
            size={14}
            color={canMessage ? p.ctaText : p.muted}
          />
          <Text
            style={{ fontSize: 12, fontWeight: "600", color: canMessage ? p.ctaText : p.muted }}
          >
            {sending
              ? "Envoi…"
              : `Message groupé${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
          </Text>
        </Pressable>
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
  selectable = false,
  checked = false,
  onToggleSelect,
}: {
  contact: ProContact;
  onDetails: () => void;
  /** Mode sélection groupée : affiche une case à cocher (email requis). */
  selectable?: boolean;
  checked?: boolean;
  onToggleSelect?: () => void;
}) {
  const p = useContactPalette();
  const reached = !!contact.email; // « Contact atteint » = coordonnées révélées
  const canSelect = selectable && reached; // pas d'email partagé → non sélectionnable
  return (
    <View
      style={{
        backgroundColor: p.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: checked ? p.accent : p.border,
        overflow: "hidden",
        shadowColor: "#0A1628",
        shadowOpacity: 0.05,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      <View style={{ paddingVertical: 15, paddingHorizontal: 16 }}>
        {/* (Case à cocher) + Avatar + identité + reçu */}
        <View className="flex-row items-center" style={{ gap: 12 }}>
          {selectable ? (
            <Pressable
              onPress={canSelect ? onToggleSelect : undefined}
              disabled={!canSelect}
              accessibilityLabel={`Sélectionner ${contact.name}`}
              hitSlop={8}
              className="active:opacity-70"
              style={{ opacity: canSelect ? 1 : 0.35 }}
            >
              <Ionicons
                name={checked ? "checkbox" : "square-outline"}
                size={22}
                color={checked ? p.accent : p.muted}
              />
            </Pressable>
          ) : null}
          <LinearGradient
            colors={avatarGradient(contact.name)}
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
