// Fiche prospect — bottom-sheet détail d'un contact acquis (maquette co2.html).
// Overlay scrim foncé + panneau bas arrondi (radius 28) ; en-tête avatar +
// carte « IDENTIFICATION · PALIER n » (Prénom / Nom / e-mail alias / téléphone
// / date de naissance), encart RGPD, rangée d'actions + bouton Fermer.
//
// Le design source est en thème « forest » (verts) : toutes les couleurs vives
// sont mappées sur l'accent du thème courant (useContactPalette) pour s'adapter
// aux thèmes buupp / sombre / fushia. Les coordonnées affichées sont MASQUÉES
// par le serveur (alias watermarqué) — invariant RGPD, cf. contacts.tsx.
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../lib/theme";
import { useApi } from "../lib/api";
import type { ProContact, ProContactDetails, ProDetailTier } from "../lib/queries";
import { avatarGradient, categoryStyle } from "./contact-cards";

// Métadonnées d'affichage par palier (icône Ionicons + couleur + n°).
const TIER_META: Record<string, { n: number; color: string; ion: keyof typeof Ionicons.glyphMap }> = {
  identity: { n: 1, color: "#4F46E5", ion: "person-outline" },
  localisation: { n: 2, color: "#0D9488", ion: "location-outline" },
  vie: { n: 3, color: "#D97706", ion: "heart-outline" },
  pro: { n: 4, color: "#1F2937", ion: "briefcase-outline" },
  patrimoine: { n: 5, color: "#DB2777", ion: "home-outline" },
};
// Fiabilité (alignée sur le web) : Haute = vert (prospect fiable),
// Moyenne = ambre, Basse = rouge.
const PRIORITY_OPTS: { v: number; label: string; color: string }[] = [
  { v: 1, label: "Haute", color: "#16A34A" },
  { v: 2, label: "Moyenne", color: "#D97706" },
  { v: 3, label: "Basse", color: "#DC2626" },
];
const priorityLabel = (v: number | null) =>
  PRIORITY_OPTS.find((o) => o.v === v)?.label ?? null;

// ── Palette dérivée du thème ──────────────────────────────────────────────
// Mappe les couleurs « forest » de la maquette vers les tokens du thème actif.
export function useContactPalette() {
  const { c, isDark } = useTheme();
  return {
    isDark,
    card: c.surface, // #fff
    border: c.borderSoft, // #e7e1d2
    text: c.text, // #0a1628
    sub: c.textSub, // #6b7384
    muted: c.textMuted, // #9aa1ad
    accent: c.accent, // #2f8d5b
    accentInk: c.accentInk, // #1d6b42
    accentSoft: c.accentSoft, // #eaf5ee
    accentBorder: c.accent + (isDark ? "55" : "40"), // #cfe9d8 (accent translucide)
    field: c.surface2, // #f4f1e9 (encart e-mail watermark)
    line: c.track, // #ece7d9 (filets)
    coral: c.accCoral, // #dd5f48 (action e-mail)
    blue: c.accBlue, // #3f7fd6 (action SMS)
    // Bouton sombre neutre (× Sans filtre / Voir détails / Fermer). Dans la
    // maquette forest c'est un foncé navy/quasi-noir (PAS l'accent vert) → on
    // utilise c.ink (neutre foncé teinté par thème : navy buupp, quasi-noir
    // forest, prune fushia). En sombre, c.ink est clair → on inverse en pastille
    // claire (c.btnBg) pour garder le contraste.
    ctaBg: isDark ? c.btnBg : c.ink,
    ctaText: c.btnText,
    palier: c.ivory2, // pastille « P1 »
    ink5: c.ink5,
    sheetBg: c.bg, // fond de la sheet (= ivoire du thème, #f4f1e9 en forest)
    avatar: (isDark ? [c.accent, c.violet] : [c.accent, c.accentInk]) as [
      string,
      string,
    ],
  };
}

// Initiales (2 lettres max) à partir du nom affiché.
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Rangée d'actions de contact (call / mail / sms / whatsapp) ─────────────
// Tuiles blanches 34×34. Couleurs : accent (appel + whatsapp), coral (mail),
// bleu (sms). Coordonnées masquées → seul l'e-mail alias ouvre un mailto.
export function ContactActions({ email }: { email?: string | null }) {
  const p = useContactPalette();
  const masked = () =>
    Alert.alert(
      "Coordonnées masquées",
      "Les coordonnées du prospect sont protégées (alias watermarqué). Utilisez l'e-mail sécurisé pour le contacter.",
    );
  const Btn = ({
    icon,
    color,
    onPress,
    label,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    onPress: () => void;
    label: string;
  }) => (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityLabel={label}
      className="items-center justify-center active:opacity-70"
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: p.card,
        borderWidth: 0.7,
        borderColor: p.border,
      }}
    >
      <Ionicons name={icon} size={17} color={color} />
    </Pressable>
  );
  return (
    <View className="flex-row" style={{ gap: 8 }}>
      <Btn icon="call-outline" color={p.accent} onPress={masked} label="Appeler" />
      <Btn
        icon="mail-outline"
        color={p.coral}
        onPress={() =>
          email ? Linking.openURL(`mailto:${email}`).catch(() => masked()) : masked()
        }
        label="Envoyer un e-mail"
      />
      <Btn icon="chatbox-outline" color={p.blue} onPress={masked} label="SMS" />
      <Btn icon="logo-whatsapp" color={p.accent} onPress={masked} label="WhatsApp" />
    </View>
  );
}

// Ligne « label / valeur » de la carte d'identification.
function InfoRow({
  label,
  value,
  mono,
  last,
}: {
  label: string;
  value: string;
  /** Valeur renseignée (mono accent) vs « — non renseigné — » (italique gris). */
  mono?: boolean;
  last?: boolean;
}) {
  const p = useContactPalette();
  const empty = value === "— non renseigné —";
  return (
    <View
      className="flex-row items-center justify-between"
      style={{
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: p.line,
      }}
    >
      <Text style={{ fontSize: 13, color: p.sub, flexShrink: 0 }}>{label}</Text>
      {mono && !empty ? (
        <Text
          className="font-mono"
          style={{
            fontSize: 11.5,
            fontWeight: "600",
            color: p.accentInk,
            textAlign: "right",
            flexShrink: 1,
          }}
        >
          {value}
        </Text>
      ) : empty ? (
        <Text
          className="font-serif-italic"
          style={{ fontSize: 13.5, color: p.muted, textAlign: "right", flexShrink: 1 }}
        >
          {value}
        </Text>
      ) : (
        <Text
          style={{ fontSize: 13.5, fontWeight: "700", color: p.text, textAlign: "right", flexShrink: 1 }}
        >
          {value}
        </Text>
      )}
    </View>
  );
}

export function ContactDetailSheet({
  contact,
  visible,
  onClose,
  siblings,
  onNavigate,
  onPriorityChange,
}: {
  contact: ProContact | null;
  /** Nom de la campagne d'où provient le contact (sous-titre de l'en-tête). */
  campaign: string | null;
  visible: boolean;
  onClose: () => void;
  /** Fiches de la même campagne (navigation Précédent / Suivant). */
  siblings?: ProContact[];
  onNavigate?: (c: ProContact) => void;
  onPriorityChange?: (relationId: string, priority: number | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const { varStyle } = useTheme();
  const p = useContactPalette();
  const api = useApi();

  const [tiers, setTiers] = useState<ProDetailTier[]>([]);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [picked, setPicked] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const relId = contact?.relationId ?? null;
  useEffect(() => {
    if (!relId || !visible) return;
    let cancelled = false;
    setStatus("loading");
    setTiers([]);
    setRefCode(null);
    setPicked(contact?.priority ?? null);
    setSaved(contact?.priority ?? null);
    api<ProContactDetails>(`/api/pro/contacts/${relId}/details`)
      .then((j) => {
        if (cancelled) return;
        setTiers(j.tiers || []);
        setRefCode(j.ref ?? null);
        setPicked(j.priority ?? null);
        setSaved(j.priority ?? null);
        setStatus("ok");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relId, visible]);

  if (!contact) return null;

  const NR = "— non renseigné —";
  const cat = categoryStyle(contact.campaignObjective);
  const list = Array.isArray(siblings) && siblings.length ? siblings : [contact];
  const idx = Math.max(0, list.findIndex((s) => s.relationId === contact.relationId));
  const total = list.length;
  const num = String(idx + 1).padStart(2, "0");
  const goPrev = () => {
    if (idx > 0) onNavigate?.(list[idx - 1]);
  };
  const goNext = () => {
    if (idx < total - 1) onNavigate?.(list[idx + 1]);
  };

  const savePriority = async () => {
    setSaving(true);
    try {
      await api(`/api/pro/contacts/${contact.relationId}/priority`, {
        method: "POST",
        body: JSON.stringify({ priority: picked }),
      });
      setSaved(picked);
      onPriorityChange?.(contact.relationId, picked);
    } catch {
      Alert.alert("Fiabilité", "Impossible d'enregistrer la fiabilité. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Scrim foncé cliquable (maquette : rgba(10,22,40,.44)). */}
      <Pressable
        onPress={onClose}
        accessibilityLabel="Fermer"
        style={{ flex: 1, backgroundColor: "rgba(10,22,40,0.44)" }}
      />
      {/* Panneau bas arrondi. varStyle ré-applique les variables du thème
          (le Modal est rendu hors de l'arbre ThemeProvider). */}
      <View
        style={[
          varStyle,
          {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: "94%",
            backgroundColor: p.sheetBg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            shadowColor: "#0A1628",
            shadowOpacity: 0.32,
            shadowRadius: 50,
            shadowOffset: { width: 0, height: -18 },
            elevation: 24,
          },
        ]}
      >
        {/* Poignée */}
        <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
          <View
            style={{ width: 42, height: 5, borderRadius: 3, backgroundColor: p.ink5 }}
          />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: insets.bottom + 26,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* En-tête : avatar + nom + objectif + fermer */}
          <View className="flex-row items-start" style={{ gap: 13 }}>
            <LinearGradient
              colors={avatarGradient(contact.name)}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: p.accent,
                shadowOpacity: 0.27,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
              }}
            >
              <Text
                className="font-serif-bold"
                style={{ fontSize: 16, color: "#FFFFFF" }}
              >
                {initials(contact.name)}
              </Text>
            </LinearGradient>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                className="font-serif-bold"
                style={{ fontSize: 19, color: p.text, lineHeight: 23 }}
                numberOfLines={1}
              >
                Fiche de {contact.name}
              </Text>
              <Text style={{ fontSize: 12, marginTop: 2, lineHeight: 16 }}>
                <Text style={{ color: p.sub }}>Catégories payées dans </Text>
                <Text style={{ color: cat.accent, fontWeight: "700" }}>« {cat.label} »</Text>
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Fermer"
              hitSlop={8}
              style={{
                width: 30, height: 30, borderRadius: 999, backgroundColor: p.card,
                borderWidth: 1, borderColor: p.border, alignItems: "center", justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={16} color={p.sub} />
            </Pressable>
          </View>

          {/* Badge fiche + pagination */}
          <View className="flex-row items-center justify-between" style={{ marginTop: 12, gap: 10 }}>
            <View className="flex-row items-center" style={{ gap: 8, flex: 1, minWidth: 0 }}>
              <View className="flex-row items-center" style={{ gap: 5, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 6, backgroundColor: p.text }}>
                <Ionicons name="document-text-outline" size={11} color={p.card} />
                <Text style={{ fontSize: 9.5, fontWeight: "700", letterSpacing: 0.6, color: p.card }}>FICHE</Text>
              </View>
              <Text className="font-mono" style={{ fontSize: 10.5, color: p.muted, flexShrink: 1 }} numberOfLines={1}>
                N° {num}{refCode ? ` · ${refCode}` : ""}
              </Text>
            </View>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Pressable onPress={goPrev} disabled={idx <= 0} hitSlop={6} style={{ width: 30, height: 30, borderRadius: 999, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, alignItems: "center", justifyContent: "center", opacity: idx <= 0 ? 0.4 : 1 }}>
                <Ionicons name="chevron-back" size={16} color={p.text} />
              </Pressable>
              <Text className="font-mono" style={{ fontSize: 13, color: p.text }}>
                <Text style={{ fontWeight: "700" }}>{num}</Text>
                <Text style={{ color: p.muted }}> / {total}</Text>
              </Text>
              <Pressable onPress={goNext} disabled={idx >= total - 1} hitSlop={6} style={{ width: 30, height: 30, borderRadius: 999, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, alignItems: "center", justifyContent: "center", opacity: idx >= total - 1 ? 0.4 : 1 }}>
                <Ionicons name="chevron-forward" size={16} color={p.text} />
              </Pressable>
            </View>
          </View>

          {/* Priorité de traitement */}
          <View style={{ marginTop: 16, backgroundColor: "#7C3AED14", borderWidth: 1, borderColor: "#7C3AED33", borderRadius: 16, padding: 14 }}>
            <View className="flex-row items-center" style={{ gap: 10, marginBottom: 12 }}>
              <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: p.card, borderWidth: 1, borderColor: p.border, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="flag-outline" size={16} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text className="font-serif-bold" style={{ fontSize: 14.5, color: p.text }}>Fiabilité</Text>
                <Text style={{ fontSize: 12, color: p.sub, marginTop: 1 }}>Notez la fiabilité de ce prospect : elle alimente son indice de désirabilité et vous sert à filtrer vos contacts.</Text>
              </View>
            </View>
            <View className="flex-row" style={{ gap: 8 }}>
              {PRIORITY_OPTS.map((o) => {
                const on = picked === o.v;
                return (
                  <Pressable
                    key={o.v}
                    onPress={() => setPicked(on ? null : o.v)}
                    className="active:opacity-80"
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: "center",
                      backgroundColor: on ? o.color + "1F" : p.card,
                      borderWidth: 1.5, borderColor: on ? o.color : p.border,
                    }}
                  >
                    {/* Icône dans une pastille colorée — plus de chiffre de
                        niveau (1/2/3), qui prêtait à confusion avec un compte
                        (parité web). */}
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 999,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: o.color + "26",
                        borderWidth: 1,
                        borderColor: o.color + "59",
                      }}
                    >
                      <Ionicons name="star" size={16} color={o.color} />
                    </View>
                    <Text style={{ fontSize: 11, color: p.muted, marginTop: 4 }}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={savePriority}
              disabled={saving || picked === saved}
              className="active:opacity-80"
              style={{
                marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center",
                gap: 7, paddingVertical: 12, borderRadius: 12, backgroundColor: p.ctaBg,
                opacity: saving || picked === saved ? 0.55 : 1,
              }}
            >
              <Ionicons name="save-outline" size={15} color={p.ctaText} />
              <Text style={{ fontSize: 13.5, fontWeight: "700", color: p.ctaText }}>
                {saving ? "Enregistrement…" : "Enregistrer la fiabilité"}
              </Text>
            </Pressable>
          </View>

          {/* Paliers de données payées (chargés via l'API détails) */}
          {status === "loading" ? (
            <Text style={{ textAlign: "center", color: p.muted, fontSize: 13, paddingVertical: 24 }}>
              Chargement des informations…
            </Text>
          ) : status === "error" ? (
            <View style={{ marginTop: 16, padding: 13, borderRadius: 12, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FCA5A5" }}>
              <Text style={{ fontSize: 12.5, color: "#991B1B", lineHeight: 18 }}>
                Impossible de charger les détails pour le moment. Réessayez dans un instant.
              </Text>
            </View>
          ) : tiers.length === 0 ? (
            <Text style={{ textAlign: "center", color: p.muted, fontSize: 13, paddingVertical: 20 }}>
              Aucune catégorie de données disponible pour cette campagne.
            </Text>
          ) : (
            tiers.map((t) => {
              const m = TIER_META[t.key] ?? { n: 0, color: p.accent, ion: "document-outline" as const };
              return (
                <View
                  key={t.key}
                  style={{ marginTop: 14, backgroundColor: p.card, borderRadius: 18, borderWidth: 1, borderColor: p.border, overflow: "hidden" }}
                >
                  <View
                    className="flex-row items-center justify-between"
                    style={{ paddingVertical: 12, paddingHorizontal: 16, backgroundColor: p.field, borderBottomWidth: 1, borderBottomColor: p.line }}
                  >
                    <View className="flex-row items-center" style={{ gap: 9, flex: 1, minWidth: 0 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: m.color, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name={m.ion} size={15} color="#FFFFFF" />
                      </View>
                      <Text className="font-serif-bold" style={{ fontSize: 14, color: p.text }} numberOfLines={1}>
                        {t.label}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 9, fontWeight: "700", letterSpacing: 0.8, color: p.muted, textAlign: "right" }}>
                      PALIER {m.n}
                    </Text>
                  </View>
                  {t.items.map((it, i) => (
                    <InfoRow
                      key={i}
                      label={it.label}
                      value={it.value ?? NR}
                      mono={!!it.value && (it.label.startsWith("E-mail") || it.label === "Téléphone")}
                      last={i === t.items.length - 1}
                    />
                  ))}
                </View>
              );
            })
          )}

          {/* Encart RGPD */}
          <View
            className="flex-row"
            style={{
              alignItems: "flex-start",
              gap: 11,
              marginTop: 14,
              paddingVertical: 13,
              paddingHorizontal: 15,
              borderRadius: 14,
              backgroundColor: p.accentSoft,
              borderWidth: 1,
              borderColor: p.accentBorder,
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 999,
                marginTop: 1,
                backgroundColor: p.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons
                name="information-variant"
                size={13}
                color="#FFFFFF"
              />
            </View>
            <Text style={{ flex: 1, fontSize: 12, color: p.accentInk, lineHeight: 18 }}>
              L’e-mail est un{" "}
              <Text style={{ fontWeight: "600" }}>alias sécurisé watermarqué</Text> :
              tout message y est routé vers le prospect, et toute fuite reste
              imputable. Accès journalisé conformément à notre politique RGPD.
            </Text>
          </View>

          {/* Statut fiabilité + actions + Fermer */}
          <View style={{ marginTop: 17, gap: 12 }}>
            <Text style={{ fontSize: 12, color: p.muted }}>
              {saved ? (
                <Text>
                  Fiabilité{" "}
                  <Text style={{ fontWeight: "700", color: PRIORITY_OPTS.find((o) => o.v === saved)?.color }}>
                    {priorityLabel(saved)}
                  </Text>
                </Text>
              ) : (
                "Priorité non définie — enregistrez pour filtrer."
              )}
            </Text>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <ContactActions email={contact.email} />
              <Pressable
                onPress={onClose}
                accessibilityLabel="Fermer"
                className="active:opacity-80"
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: p.ctaBg,
                  alignItems: "center",
                  shadowColor: "#0A1628",
                  shadowOpacity: 0.22,
                  shadowRadius: 20,
                  shadowOffset: { width: 0, height: 8 },
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: p.ctaText }}>
                  Fermer
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
