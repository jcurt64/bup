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
import { Alert, Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../lib/theme";
import type { ProContact } from "../lib/queries";

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
      ) : (
        <Text
          className="font-serif-italic"
          style={{ fontSize: 13.5, color: p.muted }}
          numberOfLines={1}
        >
          {value}
        </Text>
      )}
    </View>
  );
}

export function ContactDetailSheet({
  contact,
  campaign,
  visible,
  onClose,
}: {
  contact: ProContact | null;
  /** Nom de la campagne d'où provient le contact (sous-titre de l'en-tête). */
  campaign: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { varStyle } = useTheme();
  const p = useContactPalette();
  if (!contact) return null;

  const NR = "— non renseigné —";

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
          {/* En-tête : avatar + « Fiche prospect » + campagne */}
          <View className="flex-row items-center" style={{ gap: 13 }}>
            <LinearGradient
              colors={p.avatar}
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
                style={{ fontSize: 20, color: p.text, lineHeight: 22 }}
              >
                Fiche prospect
              </Text>
              {campaign ? (
                <Text style={{ fontSize: 12.5, color: p.sub, marginTop: 2 }}>
                  Reçue dans « {campaign} »
                </Text>
              ) : null}
            </View>
          </View>

          {/* Carte d'identification */}
          <View
            style={{
              marginTop: 18,
              backgroundColor: p.card,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: p.border,
              overflow: "hidden",
              shadowColor: "#0A1628",
              shadowOpacity: 0.05,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 5 },
            }}
          >
            <View
              className="flex-row items-center"
              style={{
                gap: 9,
                paddingVertical: 13,
                paddingHorizontal: 16,
                backgroundColor: p.accentSoft,
                borderBottomWidth: 1,
                borderBottomColor: p.accentBorder,
              }}
            >
              <Ionicons name="shield-outline" size={18} color={p.accentInk} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  letterSpacing: 1,
                  color: p.accentInk,
                }}
              >
                IDENTIFICATION · PALIER {contact.tier}
              </Text>
            </View>
            <InfoRow label="Prénom" value={NR} />
            <InfoRow label="Nom" value={NR} />
            <InfoRow
              label="E-mail (alias sécurisé)"
              value={contact.email ?? NR}
              mono
            />
            <InfoRow label="Téléphone" value={contact.telephone ?? NR} mono={!!contact.telephone} />
            <InfoRow label="Date de naissance" value={NR} last />
          </View>

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

          {/* Actions + Fermer */}
          <View className="flex-row items-center" style={{ gap: 8, marginTop: 17 }}>
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
        </ScrollView>
      </View>
    </Modal>
  );
}
