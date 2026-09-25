// Composants présentables de la liste Contacts (maquette co.html) : carte
// « Filtres combinés », en-tête de groupe (campagne), carte contact et pilule
// d'état. Extraits dans un module partagé pour pouvoir être réutilisés (écran
// réel + preview). Couleurs « forest » de la maquette → tokens du thème via
// useContactPalette (s'adapte buupp / sombre / fushia).
import { Ionicons } from "@expo/vector-icons";
import { Motif } from "./motif";
import { withAlpha } from "../lib/color";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, View } from "react-native";

import { ContactActions } from "./contact-actions";
import {
  avatarGradient,
  categoryStyle,
  initials,
  useContactPalette,
} from "./contact-style";
import type { ProContact } from "../lib/queries";
import type { ContactEvaluation, ProContactRow } from "../lib/queries-pro-contacts";

export { avatarGradient, categoryStyle };

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



// ── Filtres cumulatifs (AND) appliqués côté client ────────────────────────
// Parité web (Pro.jsx FILTERS) : F2 = signalement « Atteint » du pro (et non
// la simple présence d'un e-mail), F3 = palier 2 EXACT.
export type FilterKey = "score" | "reached" | "tier2";
export const FILTERS: {
  key: FilterKey;
  label: string;
  test: (r: ProContactRow) => boolean;
}[] = [
  { key: "score", label: "F1 · Score ≥ 720", test: (r) => Number(r.score) >= 720 },
  { key: "reached", label: "F2 · Contact atteint", test: (r) => r.evaluation === "atteint" },
  { key: "tier2", label: "F3 · Palier 2", test: (r) => Number(r.tier) === 2 },
];

/** Ligne « e-mailable » (sélection groupée) : email partagé et campagne clôturée. */
export function isEmailable(r: ProContactRow): boolean {
  if (r.locked) return false;
  if (typeof r.emailAvailable === "boolean") return r.emailAvailable;
  return !!r.email && r.email !== "—";
}

// Options de filtre par priorité (mêmes couleurs que la fiche détaillée).
// Fiabilité (alignée sur le web) : Haute = vert, Moyenne = ambre, Basse = rouge.
const PRIO_FILTER: { v: number; label: string; color: string }[] = [
  { v: 1, label: "Haute", color: "#16A34A" },
  { v: 2, label: "Moyenne", color: "#D97706" },
  { v: 3, label: "Basse", color: "#DC2626" },
];

export function FiltersCard({
  active,
  onToggle,
  prioActive,
  onTogglePrio,
  onClear,
  shown,
  total,
}: {
  active: Set<FilterKey>;
  onToggle: (k: FilterKey) => void;
  prioActive?: Set<number>;
  onTogglePrio?: (v: number) => void;
  onClear: () => void;
  shown: number;
  total: number;
}) {
  const p = useContactPalette();
  const noFilter = active.size === 0 && (!prioActive || prioActive.size === 0);
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
            backgroundColor: noFilter ? p.ctaBg : p.card,
            borderWidth: noFilter ? 0 : 1.5,
            borderColor: p.border,
          }}
        >
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: "600",
              color: noFilter ? p.ctaText : p.text,
            }}
          >
            × Sans filtre
          </Text>
        </Pressable>
      </View>

      {/* Filtre par fiabilité (mêmes couleurs que la fiche). */}
      <View className="flex-row items-center" style={{ flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <Text className="font-mono" style={{ fontSize: 10, letterSpacing: 0.8, color: p.muted }}>
          FIABILITÉ
        </Text>
        {PRIO_FILTER.map((o) => {
          const on = !!prioActive?.has(o.v);
          return (
            <Pressable
              key={o.v}
              onPress={() => onTogglePrio?.(o.v)}
              className="flex-row items-center active:opacity-70"
              style={{
                gap: 4,
                paddingVertical: 7,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: on ? o.color + "1F" : p.card,
                borderWidth: 1.5,
                borderColor: on ? o.color : p.border,
              }}
            >
              <Ionicons name="star" size={12} color={o.color} />
              <Text style={{ fontSize: 12.5, fontWeight: "700", color: o.color }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
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
  locked = false,
  empty = false,
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
  /** Campagne en cours (séquestre) : carte verrouillée, non dépliable, sans
   *  avatars ni actions — les détails n'apparaissent qu'à la clôture. */
  locked?: boolean;
  /** Campagne en cours sans aucune acceptation (carte vide). */
  empty?: boolean;
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
        marginBottom: locked ? 0 : 12,
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
          <Ionicons name={locked ? "lock-closed" : cat.ion} size={16} color={cat.accent} />
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
            {locked ? (
              <View className="flex-row items-center" style={{ gap: 3, marginLeft: 6 }}>
                <Text style={{ fontSize: 11.5, color: p.muted, opacity: 0.5 }}>·</Text>
                <Ionicons name="time-outline" size={12} color={cat.accent} />
                <Text style={{ fontSize: 11.5, color: cat.accent }}>
                  {empty ? "En cours — en attente d'acceptations" : "En cours — détails à la clôture"}
                </Text>
              </View>
            ) : closed ? (
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
        {/* Avatars masqués pour une campagne en cours (ils trahiraient des
            identités avant la clôture). */}
        {!locked && contacts.length > 0 ? <AvatarStack contacts={contacts} /> : null}
      </View>

      {/* Actions : Déplier · Statistiques · Sélectionner tous · Message groupé
          — aucune action possible sur une campagne en cours. */}
      {locked ? null : (
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
      )}
    </View>
  );
}

// Signalement « Atteint / Non atteint » (parité web, colonne Évaluation).
// Alimente l'escalade non-réponse du prospect (2 → signalement, 3 → malus,
// 4 → restriction) : le pro doit pouvoir le poser, et le réinitialiser (↺).
function EvaluationControl({
  value,
  busy,
  onChange,
}: {
  value: ContactEvaluation | null | undefined;
  busy: boolean;
  onChange?: (v: ContactEvaluation | null) => void;
}) {
  const p = useContactPalette();
  const GOOD = "#16A34A";
  const WARN = "#D97706";
  const chip = (label: string, color: string) => (
    <View
      style={{
        paddingVertical: 5,
        paddingHorizontal: 11,
        borderRadius: 999,
        backgroundColor: color + "1F",
        borderWidth: 1.5,
        borderColor: color + "66",
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "700", color }}>{label}</Text>
    </View>
  );
  const btn = (label: string, v: ContactEvaluation | null, a11y: string) => (
    <Pressable
      onPress={() => onChange?.(v)}
      disabled={busy || !onChange}
      accessibilityLabel={a11y}
      hitSlop={4}
      className="active:opacity-70"
      style={{
        paddingVertical: 5,
        paddingHorizontal: 11,
        borderRadius: 999,
        backgroundColor: p.card,
        borderWidth: 1.5,
        borderColor: p.border,
        opacity: busy ? 0.55 : 1,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "600", color: p.text }}>{label}</Text>
    </Pressable>
  );
  if (value === "atteint" || value === "non_atteint") {
    return (
      <View className="flex-row items-center" style={{ gap: 6 }}>
        {value === "atteint" ? chip("✓ Atteint", GOOD) : chip("Non atteint", WARN)}
        {btn("↺", null, "Réinitialiser l'évaluation")}
      </View>
    );
  }
  return (
    <View className="flex-row items-center" style={{ gap: 6, flexWrap: "wrap" }}>
      {btn("Atteint", "atteint", "Vous avez joint le prospect (échange constructif)")}
      {btn("Non atteint", "non_atteint", "Le prospect n'a pas répondu à vos sollicitations")}
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
  onEvaluate,
  evaluating = false,
}: {
  contact: ProContactRow;
  onDetails: () => void;
  /** Mode sélection groupée : affiche une case à cocher (email requis). */
  selectable?: boolean;
  checked?: boolean;
  onToggleSelect?: () => void;
  /** Signalement Atteint / Non atteint (null = reset). */
  onEvaluate?: (v: ContactEvaluation | null) => void;
  evaluating?: boolean;
}) {
  const p = useContactPalette();
  const locked = !!contact.locked;
  const canSelect = selectable && isEmailable(contact); // pas d'email partagé → non sélectionnable
  return (
    <View
      style={{
        backgroundColor: p.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: checked ? p.accent : p.border,
        shadowColor: "#0A1628",
        shadowOpacity: 0.05,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      {/* Rognage des coins sur une vue interne : l'ombre de la vue externe reste visible sur iOS (overflow:hidden l'efface), comme sur Android. */}
      <View style={{ borderRadius: 17, overflow: "hidden" }}>
        {/* Décor : voile teinté de la couleur de l'avatar, points, filigrane */}
        <LinearGradient
          colors={[withAlpha(avatarGradient(contact.name)[0], "1F"), withAlpha(p.card, "00")]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 0.7 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <Motif variant="dots" color={withAlpha(avatarGradient(contact.name)[0], "59")} />
        <View
          pointerEvents="none"
          style={{ position: "absolute", right: -14, bottom: -18, opacity: 0.06, transform: [{ rotate: "-12deg" }] }}
        >
          <Ionicons name="person" size={110} color={avatarGradient(contact.name)[0]} />
        </View>
        <View style={{ paddingVertical: 15, paddingHorizontal: 16 }}>
          {/* (Case à cocher) + Avatar + identité + reçu */}
          <View className="flex-row items-center" style={{ gap: 12 }}>
            {selectable && !locked ? (
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
                {locked ? "🔒 Disponible à la clôture" : (contact.email ?? "—")}
              </Text>
            </View>
            <View className="flex-row items-center" style={{ gap: 9, marginTop: 8 }}>
              <Ionicons name="call-outline" size={16} color={p.muted} />
              <Text style={{ fontSize: 12.5, color: p.muted }}>
                {locked ? "🔒 Disponible à la clôture" : (contact.telephone ?? "—")}
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
            {locked ? (
              <Text style={{ fontSize: 12, color: p.muted }}>—</Text>
            ) : (
              <EvaluationControl
                value={contact.evaluation}
                busy={evaluating}
                onChange={onEvaluate}
              />
            )}
          </View>

          {/* Fiabilité — un badge par niveau noté (compte de pros cross-pro,
              identique à la fiche). Parité web. */}
          {(() => {
            const agg = contact.fiabiliteAgg || {};
            const items = PRIO_FILTER.map((o) => ({
              o,
              n: Number(agg[String(o.v)] || 0),
            })).filter((x) => x.n > 0);
            if (items.length === 0) return null;
            return (
              <View
                className="flex-row items-center"
                style={{ gap: 8, marginTop: 11, flexWrap: "wrap" }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 0.6,
                    color: p.muted,
                  }}
                >
                  FIAB.
                </Text>
                {items.map(({ o, n }) => (
                  <View
                    key={o.v}
                    className="flex-row items-center"
                    style={{
                      gap: 4,
                      paddingVertical: 3,
                      paddingHorizontal: 8,
                      borderRadius: 999,
                      backgroundColor: o.color + "1F",
                      borderWidth: 1,
                      borderColor: o.color + "59",
                    }}
                  >
                    <Ionicons name="star" size={11} color={o.color} />
                    <Text style={{ fontSize: 11.5, fontWeight: "700", color: o.color }}>
                      {n}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })()}
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
          {locked ? (
            <View className="flex-row items-center" style={{ gap: 5 }}>
              <Ionicons name="lock-closed" size={12} color={p.muted} />
              <Text style={{ fontSize: 11.5, color: p.muted }}>Disponible à la clôture</Text>
            </View>
          ) : (
            <>
          <ContactActions contact={contact} />
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
            </>
          )}
        </View>
      </View>
    </View>
  );
}
