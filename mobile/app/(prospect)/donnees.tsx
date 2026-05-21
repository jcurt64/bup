// Mes données — /api/prospect/donnees (lecture + édition par palier via
// PATCH /api/prospect/donnees) + masquer/supprimer (POST /api/prospect/tier).
// Champs/libellés/ordre = Prospect.jsx fn MesDonnees (web).
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { BottomSheet } from "../../components/bottom-sheet";
import { Card, QueryGate, ScrollScreen } from "../../components/screen";
import {
  useProspectDonnees,
  usePatchDonnees,
  useTierAction,
  type TierKey,
} from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

// Config par champ — parité avec FIELD_CONFIG côté web (Prospect.jsx).
// L'absence de `cfg` = type text par défaut.
type FieldConfig =
  | { type: "text"; placeholder?: string }
  | { type: "numeric"; placeholder?: string }
  | { type: "date" }
  | { type: "tag"; options: readonly string[]; multi?: boolean }
  | {
      type: "tag+text";
      options: readonly string[];
      detailField: string;
      detailPlaceholder: string;
      /** Si défini, le champ détail n'apparaît que quand le tag actif vaut
       *  cette valeur (ex. animaux=Oui → afficher "type d'animal"). */
      detailVisibleWhenTag?: string;
    };

type FieldDef = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  readOnly?: boolean;
  hint?: string;
  cfg?: FieldConfig;
};

const FIELDS: Record<TierKey, FieldDef[]> = {
  identity: [
    { key: "prenom", label: "Prénom", icon: "person-outline" },
    { key: "nom", label: "Nom", icon: "person-circle-outline" },
    { key: "email", label: "Email", icon: "mail-outline" },
    {
      key: "telephone",
      label: "Téléphone",
      icon: "call-outline",
      readOnly: true,
      hint: "Modifiable via Préférences (vérification SMS)",
    },
    {
      key: "naissance",
      label: "Date de naissance",
      icon: "calendar-outline",
      cfg: { type: "date" },
    },
  ],
  localisation: [
    { key: "adresse", label: "Adresse postale", icon: "location-outline" },
    // ville + codePostal : en mode édition, ces 2 champs sont remplacés
    // par un widget combiné CityPostalAutocomplete (parité web).
    { key: "ville", label: "Ville", icon: "business-outline" },
    { key: "codePostal", label: "Code postal", icon: "pin-outline" },
  ],
  vie: [
    {
      key: "foyer",
      label: "Composition du foyer",
      icon: "people-outline",
      cfg: { type: "tag", options: ["Solo", "Famille"] },
    },
    {
      key: "logement",
      label: "Type de logement",
      icon: "home-outline",
      cfg: {
        type: "tag",
        multi: true,
        options: ["Maison", "Appartement", "Studio", "Loft", "Duplex", "Colocation"],
      },
    },
    {
      key: "mobilite",
      label: "Mobilité",
      icon: "navigate-outline",
      cfg: {
        type: "tag",
        multi: true,
        options: ["Voiture", "Co-voiturage", "Transports en commun", "Vélo", "Trottinette", "Moto", "Piéton"],
      },
    },
    {
      key: "vehicule",
      label: "Véhicule",
      icon: "car-outline",
      cfg: {
        type: "tag+text",
        options: ["SUV", "4x4", "Berline", "Citadine", "Break", "Monospace", "Coupé", "Cabriolet", "Utilitaire"],
        detailField: "vehiculeMarque",
        detailPlaceholder: "Marque du véhicule",
      },
    },
    { key: "sports", label: "Sports / loisirs", icon: "barbell-outline" },
    {
      key: "animaux",
      label: "Animaux",
      icon: "paw-outline",
      cfg: {
        type: "tag+text",
        options: ["Oui", "Non"],
        detailField: "animauxDetail",
        detailPlaceholder: "Chat, chien…",
        detailVisibleWhenTag: "Oui",
      },
    },
  ],
  pro: [
    { key: "poste", label: "Poste", icon: "briefcase-outline" },
    {
      key: "statut",
      label: "Statut",
      icon: "ribbon-outline",
      cfg: {
        type: "tag",
        options: [
          "Cadre",
          "Non cadre",
          "Cadre dirigeant",
          "Directeur",
          "Employé",
          "Ouvrier",
          "Profession libérale",
          "Indépendant / Freelance",
          "Chef d'entreprise",
          "Fonctionnaire",
          "Étudiant",
          "En recherche d'emploi",
          "Retraité",
        ],
      },
    },
    { key: "secteur", label: "Secteur", icon: "business-outline" },
    {
      key: "revenus",
      label: "Revenus déclarés",
      icon: "cash-outline",
      cfg: { type: "numeric", placeholder: "Montant en euros (chiffres uniquement)" },
    },
  ],
  patrimoine: [
    {
      key: "residence",
      label: "Résidence principale",
      icon: "key-outline",
      cfg: { type: "tag", options: ["Oui", "Non"] },
    },
    {
      key: "epargne",
      label: "Épargne disponible",
      icon: "wallet-outline",
      cfg: { type: "text", placeholder: "Actions, livret A, immobilier locatif…" },
    },
    {
      key: "projets",
      label: "Projets à 3–5 ans",
      icon: "flag-outline",
      cfg: { type: "tag", options: ["Achat", "Construction", "Location"] },
    },
  ],
};

// Pastille icône réutilisable — pour chaque champ d'un palier. Fond
// pastel violet (cohérent avec la barre niveau de palier qui passe en
// violet accent), icône en accent foncé.
function FieldIcon({
  icon,
  size = 28,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
}) {
  return (
    <View
      className="items-center justify-center rounded-full bg-accent-soft"
      style={{ width: size, height: size }}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color="#4F46E5" />
    </View>
  );
}

// Parse "JJ/MM/AAAA" → Date (ou null si invalide). Parité avec
// isNaissanceValid (Prospect.jsx) : regex + plage 0-12 / 0-31 + roundtrip
// pour rejeter 31/02 etc.
function parseDateFr(s: string): Date | null {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return null;
  const [d, m, y] = s.split("/").map(Number);
  const dt = new Date(y, m - 1, d);
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt;
}

// Date → "JJ/MM/AAAA" (format de stockage attendu par /api/prospect/donnees).
function formatDateFr(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear());
  return `${day}/${month}/${year}`;
}

// Champ date — Pressable qui ouvre le date picker natif (modal Android,
// spinner inline iOS). Stocke en "JJ/MM/AAAA" via onChange. Plage = 120
// ans dans le passé jusqu'à aujourd'hui (parité isNaissanceValid).
function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseDateFr(value);
  const today = new Date();
  const minDate = new Date(today.getFullYear() - 120, 0, 1);
  // Date initiale du picker : valeur courante si valide, sinon ~25 ans
  // en arrière (ouverture sur une décennie crédible pour une majorité
  // de prospects).
  const initial =
    parsed ?? new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());

  function handleChange(
    event: { type?: string },
    selected?: Date,
  ) {
    if (Platform.OS === "android") {
      // Android : le dialog se ferme automatiquement après "set" ou
      // "dismissed", on rebascule le state.
      setOpen(false);
    }
    if (event.type === "dismissed") return;
    if (selected) onChange(formatDateFr(selected));
  }

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Sélectionner une date"
        className="flex-row items-center justify-between rounded-xl border border-line bg-paper px-3 py-3"
      >
        <Text
          className={`text-base ${value ? "text-ink" : "text-ink-4"}`}
        >
          {value || "JJ/MM/AAAA"}
        </Text>
        <Ionicons name="calendar-outline" size={18} color="#8A91A1" />
      </Pressable>
      {open ? (
        <>
          <DateTimePicker
            value={initial}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={today}
            minimumDate={minDate}
            onChange={handleChange}
            locale="fr-FR"
          />
          {Platform.OS === "ios" ? (
            <View className="mt-1 flex-row justify-end">
              <Pressable
                onPress={() => setOpen(false)}
                className="rounded-full bg-accent px-4 py-1.5"
              >
                <Text className="text-sm font-semibold text-paper">
                  Terminé
                </Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

// TagPicker — grille de pastilles cliquables. Mono ou multi sélection.
// Stockage CSV "A, B, C" pour le multi (compat colonnes TEXT, parité web
// fn TagPicker + tagsToList/listToTags).
const TAG_VIOLET = "#7C3AED";

function csvToList(v: string): string[] {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function TagPicker({
  value,
  options,
  multi,
  onChange,
}: {
  value: string;
  options: readonly string[];
  multi?: boolean;
  onChange: (v: string) => void;
}) {
  const selected = multi ? new Set(csvToList(value)) : null;
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const active = multi ? selected!.has(opt) : value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => {
              if (multi) {
                const next = new Set(selected);
                if (next.has(opt)) next.delete(opt);
                else next.add(opt);
                // Préserve l'ordre des options pour un rendu stable
                // (parité web Prospect.jsx fn TagPicker).
                onChange(options.filter((o) => next.has(o)).join(", "));
              } else {
                onChange(active ? "" : opt);
              }
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 14,
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: active ? TAG_VIOLET : "#E6E3DA",
              backgroundColor: active ? TAG_VIOLET : "#FFFFFF",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: active ? "600" : "500",
                color: active ? "#FFFFFF" : "#0F1629",
              }}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Ville + Code postal — autocomplétion via geo.api.gouv.fr (parité avec
// Prospect.jsx fn CityPostalAutocomplete). Une commune avec plusieurs CP
// (Paris/Lyon/Marseille…) est éclatée en suggestions distinctes.
type CityPostalItem = { ville: string; codePostal: string };

function CityPostalAutocomplete({
  ville,
  codePostal,
  onPick,
}: {
  ville: string;
  codePostal: string;
  onPick: (v: CityPostalItem) => void;
}) {
  const initial =
    ville && codePostal
      ? `${codePostal} ${ville}`
      : ville || codePostal || "";
  const [query, setQuery] = useState(initial);
  const [items, setItems] = useState<CityPostalItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const isPostal = /^\d{2,5}$/.test(q);
        const url = isPostal
          ? `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(q)}&fields=nom,codesPostaux&limit=20`
          : `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=nom,codesPostaux&boost=population&limit=10`;
        const r = await fetch(url);
        if (!r.ok) {
          setItems([]);
          return;
        }
        const data = (await r.json()) as
          | { nom: string; codesPostaux?: string[] }[]
          | null;
        const exploded: CityPostalItem[] = [];
        for (const c of data ?? []) {
          const codes = Array.isArray(c.codesPostaux) ? c.codesPostaux : [];
          for (const cp of codes) {
            // Filtre les CP qui ne commencent pas par la saisie partielle
            // pour éviter de noyer dans des codes hors zone (ex. "750"
            // → ne remonter que les codes 750xx).
            if (isPostal && !cp.startsWith(q)) continue;
            exploded.push({ ville: c.nom, codePostal: cp });
          }
        }
        if (isPostal) {
          exploded.sort((a, b) =>
            a.codePostal.localeCompare(b.codePostal),
          );
        }
        setItems(exploded.slice(0, 30));
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  function pick(item: CityPostalItem) {
    setQuery(`${item.codePostal} ${item.ville}`);
    setOpen(false);
    onPick(item);
  }

  return (
    <View>
      <TextInput
        value={query}
        onChangeText={(v) => {
          setQuery(v);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Tapez votre ville ou un code postal"
        className="rounded-xl border border-line bg-paper px-3 py-2.5 text-base text-ink"
      />
      {open && query.trim().length >= 2 ? (
        <View className="mt-1.5 overflow-hidden rounded-xl border border-line bg-paper">
          {loading && items.length === 0 ? (
            <Text className="px-3 py-2.5 text-sm text-ink-4">Recherche…</Text>
          ) : items.length === 0 ? (
            <Text className="px-3 py-2.5 text-sm text-ink-4">
              Aucune ville trouvée.
            </Text>
          ) : (
            items.slice(0, 6).map((it, i) => (
              <Pressable
                key={`${it.codePostal}-${it.ville}-${i}`}
                onPress={() => pick(it)}
                className={`flex-row items-center justify-between px-3 py-2.5 active:bg-ivory ${i > 0 ? "border-t border-line" : ""}`}
              >
                <Text className="text-[14px] text-ink">{it.ville}</Text>
                <Text className="font-mono text-[12px] text-ink-4">
                  {it.codePostal}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

// Méta par palier : numéro, label, icône thématique et couleurs du banner
// (header full-width coloré). Couleurs choisies dans la palette BUUPP pour
// que chaque card ait une identité visuelle distincte.
type TierMeta = {
  n: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  bannerBg: string;
  iconBg: string;
  iconFg: string;
};

const TIER_META: Record<TierKey, TierMeta> = {
  identity: {
    n: 1,
    label: "Identification",
    icon: "finger-print-outline",
    bannerBg: "#F4EFFE",
    iconBg: "#EDE9FE",
    iconFg: "#5B3FD6",
  },
  localisation: {
    n: 2,
    label: "Localisation",
    icon: "map-outline",
    bannerBg: "#EEF3FE",
    iconBg: "#E4ECFD",
    iconFg: "#3E6DDD",
  },
  vie: {
    n: 3,
    label: "Style de vie",
    icon: "heart-outline",
    bannerBg: "#EAF8F4",
    iconBg: "#DCF4F0",
    iconFg: "#198E80",
  },
  pro: {
    n: 4,
    label: "Données professionnelles",
    icon: "briefcase-outline",
    bannerBg: "#FDF6E7",
    iconBg: "#FCEFD6",
    iconFg: "#B45309",
  },
  patrimoine: {
    n: 5,
    label: "Patrimoine & projets",
    icon: "diamond-outline",
    bannerBg: "#FFF0EC",
    iconBg: "#FFE7E3",
    iconFg: "#E74F3B",
  },
};

const TIERS: TierKey[] = ["identity", "localisation", "vie", "pro", "patrimoine"];

// Sheet de confirmation « Masquer cette catégorie ? » — réplique mobile
// de ConfirmHideModal (Prospect.jsx) : titre, encart warn avec icône
// eye-off, body « Conséquence du masquage », mention réversible, info chip
// stockage, 2 boutons.
function HideTierSheet({
  visible,
  tierKey,
  busy,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  tierKey: TierKey | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const m = tierKey ? TIER_META[tierKey] : null;
  return (
    <BottomSheet visible={visible} onClose={busy ? () => {} : onClose}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingBottom: 12 }}
      >
        {/* Titre */}
        <View className="flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: "#D97706" }}
          >
            <Ionicons name="eye-off-outline" size={18} color="#FFFFFF" />
          </View>
          <Text className="flex-1 font-serif text-xl text-ink">
            Masquer cette catégorie ?
          </Text>
        </View>

        {/* Encart warn — conséquence du masquage */}
        <View
          className="flex-row gap-3 rounded-2xl px-4 py-3.5"
          style={{
            backgroundColor: "#FFF7ED",
            borderWidth: 1.5,
            borderColor: "#FDBA74",
          }}
        >
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: "#D97706" }}
          >
            <Ionicons name="eye-off-outline" size={16} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-[14px] text-ink">
              Conséquence du masquage
            </Text>
            <Text className="mt-1 text-[13px] leading-5 text-ink-2">
              Tant que la catégorie{" "}
              <Text className="font-semibold">{m?.label ?? ""}</Text> est
              masquée, les professionnels{" "}
              <Text className="font-semibold">
                ne pourront plus vous contacter
              </Text>{" "}
              pour les campagnes qui exigent ces données. Vous recevrez donc
              moins de demandes de mise en relation — et potentiellement aucun
              gain sur les campagnes correspondant à ce palier.
            </Text>
            <Text
              className="mt-2.5 font-mono text-[11px] uppercase text-ink-4"
              style={{ letterSpacing: 0.7 }}
            >
              Action réversible à tout moment — restauration en un clic
            </Text>
          </View>
        </View>

        {/* Info chip — données restent stockées */}
        <View
          className="flex-row items-center gap-2.5 rounded-xl bg-ivory-2 px-3 py-2.5"
        >
          <Ionicons name="information-circle-outline" size={16} color="#5B6478" />
          <Text className="flex-1 text-[12.5px] leading-5 text-ink-3">
            Vos données restent stockées mais{" "}
            <Text className="font-semibold text-ink-2">
              ne sont plus diffusables
            </Text>
            {" — "}
            aucun professionnel n&apos;y aura accès.
          </Text>
        </View>

        {/* Actions */}
        <View className="mt-1 flex-row gap-3">
          <Pressable
            disabled={busy}
            onPress={onClose}
            className="flex-1 items-center rounded-full border border-line bg-paper py-3.5 active:opacity-70"
          >
            <Text className="text-sm font-medium text-ink-3">Annuler</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={onConfirm}
            accessibilityRole="button"
            accessibilityLabel="Confirmer le masquage"
            className="flex-1 flex-row items-center justify-center gap-2 rounded-full py-3.5 active:opacity-80"
            style={{ backgroundColor: busy ? "#FCA5A5" : "#7C5CFC" }}
          >
            <Ionicons name="eye-off-outline" size={14} color="#FFFFFF" />
            <Text className="text-sm font-semibold text-paper">
              {busy ? "…" : "Masquer temporairement"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

// Sheet de confirmation « Suppression définitive » — réplique mobile de
// ConfirmDeleteModal (Prospect.jsx). Cas spécial pour identity : encart
// supplémentaire qui prévient de la cascade.
function DeleteTierSheet({
  visible,
  tierKey,
  busy,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  tierKey: TierKey | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const m = tierKey ? TIER_META[tierKey] : null;
  const isIdentity = tierKey === "identity";
  const otherCategoriesLabels = TIERS.filter((k) => k !== "identity")
    .map((k) => TIER_META[k].label)
    .join(", ");
  return (
    <BottomSheet
      visible={visible}
      onClose={busy ? () => {} : onClose}
      heightPct={isIdentity ? 88 : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingBottom: 12 }}
      >
        {/* Titre */}
        <View className="flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: "#DC2626" }}
          >
            <Ionicons name="alert" size={18} color="#FFFFFF" />
          </View>
          <Text className="flex-1 font-serif text-xl text-ink">
            Suppression définitive
          </Text>
        </View>

        {/* Encart rouge — perte de sollicitations */}
        <View
          className="flex-row gap-3 rounded-2xl px-4 py-3.5"
          style={{
            backgroundColor: "#FEF2F2",
            borderWidth: 1.5,
            borderColor: "#FECACA",
          }}
        >
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: "#DC2626" }}
          >
            <Ionicons name="alert" size={16} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-[14px]" style={{ color: "#7F1D1D" }}>
              Vous ne pourrez plus être sollicité
            </Text>
            <Text className="mt-1 text-[13px] leading-5" style={{ color: "#991B1B" }}>
              En supprimant la catégorie{" "}
              <Text className="font-semibold">{m?.label ?? ""}</Text>, les
              professionnels{" "}
              <Text className="font-semibold">
                ne pourront plus vous contacter
              </Text>{" "}
              pour les campagnes qui exigent ces données. Vous ne recevrez donc
              plus aucune sollicitation associée à ce palier — et ne pourrez plus
              en tirer de gains.
            </Text>
            <Text
              className="mt-2.5 font-mono text-[11px] uppercase"
              style={{ color: "#991B1B", letterSpacing: 0.7 }}
            >
              Action irréversible — RGPD article 17 (droit à l&apos;effacement)
            </Text>
          </View>
        </View>

        {/* Encart orange supplémentaire — cascade si identity */}
        {isIdentity ? (
          <View
            className="flex-row gap-3 rounded-2xl px-4 py-3.5"
            style={{
              backgroundColor: "#FFF7ED",
              borderWidth: 1.5,
              borderColor: "#FDBA74",
            }}
          >
            <View
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: "#EA580C" }}
            >
              <Ionicons name="alert" size={16} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-[14px]" style={{ color: "#7C2D12" }}>
                Suppression en cascade de tous vos paliers
              </Text>
              <Text className="mt-1 text-[13px] leading-5" style={{ color: "#7C2D12" }}>
                La catégorie{" "}
                <Text className="font-semibold">Identification</Text> est la{" "}
                <Text className="font-semibold">clé de voûte</Text> de votre
                profil — sans elle, plus aucune donnée ne peut être rattachée à
                votre personne. Sa suppression entraînera donc{" "}
                <Text className="font-semibold">l&apos;effacement définitif</Text>
                {" "}de toutes les autres catégories :{" "}
                <Text className="font-semibold">{otherCategoriesLabels}</Text>.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Actions */}
        <View className="mt-1 flex-row gap-3">
          <Pressable
            disabled={busy}
            onPress={onClose}
            className="flex-1 items-center rounded-full border border-line bg-paper py-3.5 active:opacity-70"
          >
            <Text className="text-sm font-medium text-ink-3">Annuler</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={onConfirm}
            accessibilityRole="button"
            accessibilityLabel="Confirmer la suppression"
            className="flex-1 flex-row items-center justify-center gap-2 rounded-full py-3.5 active:opacity-80"
            style={{ backgroundColor: busy ? "#FCA5A5" : "#DC2626" }}
          >
            <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
            <Text
              className="text-sm font-semibold text-paper"
              numberOfLines={1}
            >
              {busy
                ? "…"
                : isIdentity
                  ? "Confirmer la suppression complète"
                  : "Confirmer la suppression"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

export default function Donnees() {
  const q = useProspectDonnees();
  const patch = usePatchDonnees();
  const tierAction = useTierAction();
  useRefetchOnFocus(q);
  const [editing, setEditing] = useState<TierKey | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  // États de confirmation pour les actions destructives. La sheet reste
  // ouverte tant que `pending` est true (mutation en vol) pour bloquer un
  // double-tap accidentel.
  const [confirmHide, setConfirmHide] = useState<TierKey | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TierKey | null>(null);
  // Masque l'affichage des valeurs (•••• ••••) sans toucher au stockage.
  // Local-only — pour les regards par-dessus l'épaule. État volontairement
  // non persisté : on repart en clair à la prochaine ouverture.
  const [pseudonymized, setPseudonymized] = useState(false);

  // Action commune : exécute la mutation, ferme la sheet en cas de succès,
  // remonte une Alert en cas d'erreur (pas de promise non-traitée silencieuse
  // — utile pour diagnostiquer les 401/500 quand l'utilisateur dit « rien ne
  // se passe »).
  async function runTierAction(
    tier: TierKey,
    action: "hide" | "restore" | "delete",
  ) {
    try {
      await tierAction.mutateAsync({ tier, action });
      if (action === "hide") setConfirmHide(null);
      if (action === "delete") setConfirmDelete(null);
    } catch (e) {
      Alert.alert(
        "Action impossible",
        e instanceof Error && e.message
          ? e.message
          : "Une erreur est survenue. Réessayez dans un instant.",
      );
    }
  }

  return (
    <ScrollScreen
      onRefresh={q.refetch}
      hero={{
        eyebrow: "Mes données — RGPD art. 15 à 22",
        title: "Vos paliers",
        desc: "Plus vous renseignez de données, plus votre BUUPP Score et vos gains augmentent. Vous restez maître de ce que vous partagez.",
      }}
    >
      {/* Bannière droits RGPD — gradient jaune et palette ambre exactement
          alignés sur Prospect.jsx (web) :
            linear-gradient(120deg, #FEF3C7 → #FCD34D)
            border #F59E0B, texte #78350F, footer mono #92400E
            icône shield dans cercle #FDE68A bordé #B45309. */}
      <LinearGradient
        colors={["#FEF3C7", "#FCD34D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.85 }}
        style={{
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: "#F59E0B",
          padding: 20,
          flexDirection: "row",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            backgroundColor: "#FDE68A",
            borderWidth: 1.5,
            borderColor: "#B45309",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Ionicons name="shield-outline" size={20} color="#78350F" />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            className="font-serif text-xl"
            style={{ color: "#78350F" }}
          >
            Vos droits sur vos données — articles 15 à 22 du RGPD
          </Text>
          <Text
            className="mt-1.5 text-base leading-6"
            style={{ color: "#78350F" }}
          >
            Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement,
            de limitation du traitement, de portabilité et d&apos;opposition sur
            l&apos;intégralité de vos données personnelles. Ces droits s&apos;exercent
            directement depuis cette page — chaque action est horodatée et tracée.
          </Text>
          <Text
            className="mt-2.5 font-mono text-[12px] uppercase"
            style={{ color: "#92400E", letterSpacing: 0.7 }}
          >
            RGPD · Articles 15 à 22 · Règlement (UE) 2016/679
          </Text>
        </View>
      </LinearGradient>

      <QueryGate query={q}>
        {(d) => {
          // Récap complétude — même définition que le web (Prospect.jsx
          // fn MesDonnees) : les paliers supprimés définitivement
          // (removedTiers) sont exclus du calcul ; un palier masqué
          // (hiddenTiers) reste compté mais avec 0 champ rempli ; un
          // palier est "atteint" dès qu'au moins un champ est renseigné.
          const isFilled = (v: unknown) =>
            v != null && String(v).trim() !== "";
          const visibleTiers = TIERS.filter(
            (k) => !d.removedTiers.includes(k),
          );
          const tierStats = visibleTiers.map((k) => {
            const row = (d[k] ?? {}) as Record<string, unknown>;
            const isHidden = d.hiddenTiers.includes(k);
            const total = FIELDS[k].length;
            const filled = isHidden
              ? 0
              : FIELDS[k].filter((f) => isFilled(row[f.key])).length;
            const reached = !isHidden && filled > 0;
            return { key: k, total, filled, reached, isHidden };
          });
          const reachedTiers = tierStats.filter((s) => s.reached).length;
          const completeness =
            visibleTiers.length === 0
              ? 0
              : Math.round((reachedTiers / visibleTiers.length) * 100);
          const totalFields = tierStats.reduce((a, s) => a + s.total, 0);
          const filledFields = tierStats.reduce((a, s) => a + s.filled, 0);
          return (
          <View className="gap-3">
            {/* Récap complétude — % global + paliers atteints + champs renseignés */}
            <Card badge={{ icon: "stats-chart-outline", tone: "violet" }}>
              <Text className="font-mono text-[12px] uppercase text-ink-4">
                Niveau de palier
              </Text>
              <Text className="font-serif text-3xl text-ink">
                {completeness}
                <Text className="text-xl text-ink-4">%</Text>
              </Text>
              <Text className="mt-1 text-sm text-ink-3">
                <Text className="text-ink-2">
                  {reachedTiers}/{visibleTiers.length} paliers atteints
                </Text>
                {"  ·  "}
                {filledFields}/{totalFields} champs renseignés
              </Text>
              <Text className="mt-1.5 text-[13px] leading-5 text-ink-4">
                Un palier est atteint dès qu&apos;au moins une donnée y est
                renseignée. Plus vous remplissez de champs, plus votre BUUPP
                Score augmente.
              </Text>
              <View className="mt-3.5 gap-2.5">
                {tierStats.map((s) => {
                  const m = TIER_META[s.key];
                  const pct =
                    s.total === 0
                      ? 0
                      : Math.round((s.filled / s.total) * 100);
                  return (
                    <View key={s.key}>
                      <View className="flex-row justify-between">
                        <Text className="text-sm text-ink-3">
                          Palier {m.n} · {m.label}
                        </Text>
                        <Text className="font-mono text-sm text-ink-3">
                          {s.filled}/{s.total}
                        </Text>
                      </View>
                      {/* Barre niveau de palier — violet accent (parité web
                          var(--accent) = #4F46E5). Variante grise quand le
                          palier est masqué (parité web var(--warn)). */}
                      <View className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
                        <View
                          className={`h-full rounded-full ${s.isHidden ? "bg-ink-4" : "bg-accent"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>

            {/* Toggle "Pseudonymiser vos données" — masque l'affichage des
                valeurs avec •••• sans toucher au stockage. Icône eye / eye-off
                comme bouton de bascule (parité visuelle avec les contrôles
                de visibilité sur le reste de la page). */}
            <Pressable
              onPress={() => setPseudonymized((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: pseudonymized }}
              accessibilityLabel="Pseudonymiser vos données"
              className="flex-row items-center gap-3 rounded-2xl bg-paper px-4 py-3 active:opacity-80"
              style={{ borderWidth: 0.7, borderColor: "#CBC7B9" }}
            >
              <View
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{
                  backgroundColor: pseudonymized ? "#4F46E5" : "#EEF2FF",
                }}
              >
                <Ionicons
                  name={pseudonymized ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={pseudonymized ? "#FFFFFF" : "#4F46E5"}
                />
              </View>
              <View className="flex-1">
                <Text className="font-serif text-base text-ink">
                  Pseudonymiser vos données
                </Text>
                <Text className="mt-0.5 text-[12px] text-ink-4">
                  {pseudonymized
                    ? "Affichage masqué — vos données restent en clair en base"
                    : "Touchez pour masquer l'affichage de toutes vos données"}
                </Text>
              </View>
            </Pressable>

            {TIERS.map((k) => {
              const m = TIER_META[k];
              const row = (d[k] ?? {}) as Record<string, unknown>;
              const hidden = d.hiddenTiers.includes(k);
              const removed = d.removedTiers.includes(k);
              const isEditing = editing === k;
              return (
                <View
                  key={k}
                  className={`overflow-hidden rounded-3xl bg-paper ${removed || hidden ? "opacity-60" : ""}`}
                  style={{
                    borderWidth: 0.7,
                    borderColor: "#CBC7B9",
                    shadowColor: "#0F1629",
                    shadowOpacity: 0.05,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 2,
                  }}
                >
                  {/* Banner full-width : logo thématique + titre « Palier N
                      · Label » à droite. Fond pastel propre à chaque palier
                      (TIER_META.bannerBg). */}
                  <View
                    className="flex-row items-center gap-3 px-5 py-4"
                    style={{ backgroundColor: m.bannerBg }}
                  >
                    <View
                      className="h-11 w-11 items-center justify-center rounded-full"
                      style={{ backgroundColor: m.iconBg }}
                    >
                      <Ionicons name={m.icon} size={22} color={m.iconFg} />
                    </View>
                    <Text
                      className="flex-1 font-serif text-xl text-ink"
                      numberOfLines={2}
                    >
                      Palier {m.n} · {m.label}
                    </Text>
                    {hidden || removed ? (
                      <View className="rounded-full bg-paper px-2.5 py-1">
                        <Text className="font-mono text-xs text-ink-4">
                          {removed ? "supprimé" : "masqué"}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Body — padding standard 20 (px-5 py-4). */}
                  <View className="px-5 py-4">
                    {isEditing ? (
                      <View className="gap-3">
                        {FIELDS[k].map((f) => {
                          // Pour la localisation, on remplace ville+CP par UN
                          // widget combiné (CityPostalAutocomplete). Le champ
                          // "ville" sert d'ancre de rendu ; "codePostal" est
                          // sauté pour ne pas dupliquer.
                          if (k === "localisation" && f.key === "codePostal") {
                            return null;
                          }
                          if (k === "localisation" && f.key === "ville") {
                            return (
                              <View key="ville+cp" className="gap-1.5">
                                <View className="flex-row items-center gap-2">
                                  <FieldIcon icon="map-outline" size={24} />
                                  <Text className="text-[13px] uppercase text-ink-4">
                                    Ville & Code postal
                                  </Text>
                                </View>
                                <CityPostalAutocomplete
                                  ville={
                                    draft.ville !== undefined
                                      ? draft.ville
                                      : String(row.ville ?? "")
                                  }
                                  codePostal={
                                    draft.codePostal !== undefined
                                      ? draft.codePostal
                                      : String(row.codePostal ?? "")
                                  }
                                  onPick={(item) =>
                                    setDraft((s) => ({
                                      ...s,
                                      ville: item.ville,
                                      codePostal: item.codePostal,
                                    }))
                                  }
                                />
                              </View>
                            );
                          }
                          // Champ readonly (téléphone)
                          if (f.readOnly) {
                            return (
                              <View key={f.key} className="gap-1.5">
                                <View className="flex-row items-center gap-2">
                                  <FieldIcon icon={f.icon} size={24} />
                                  <Text className="text-[13px] uppercase text-ink-4">
                                    {f.label}
                                  </Text>
                                </View>
                                <Text className="text-base text-ink-3">
                                  {row[f.key] != null &&
                                  String(row[f.key]).trim() !== ""
                                    ? String(row[f.key])
                                    : "—"}
                                </Text>
                                {f.hint ? (
                                  <Text className="text-[12px] text-ink-4">
                                    {f.hint}
                                  </Text>
                                ) : null}
                              </View>
                            );
                          }

                          const currentValue =
                            draft[f.key] !== undefined
                              ? draft[f.key]
                              : String(row[f.key] ?? "");

                          // Dispatch widget selon cfg.type. Pas de cfg = text.
                          let widget: React.ReactNode;
                          if (f.cfg?.type === "date") {
                            widget = (
                              <DateField
                                value={currentValue}
                                onChange={(v) =>
                                  setDraft((s) => ({ ...s, [f.key]: v }))
                                }
                              />
                            );
                          } else if (f.cfg?.type === "tag") {
                            widget = (
                              <TagPicker
                                value={currentValue}
                                options={f.cfg.options}
                                multi={f.cfg.multi}
                                onChange={(v) =>
                                  setDraft((s) => ({ ...s, [f.key]: v }))
                                }
                              />
                            );
                          } else if (f.cfg?.type === "tag+text") {
                            const detailKey = f.cfg.detailField;
                            const detailValue =
                              draft[detailKey] !== undefined
                                ? draft[detailKey]
                                : String(row[detailKey] ?? "");
                            const showDetail =
                              !f.cfg.detailVisibleWhenTag ||
                              currentValue === f.cfg.detailVisibleWhenTag;
                            widget = (
                              <View className="gap-2.5">
                                <TagPicker
                                  value={currentValue}
                                  options={f.cfg.options}
                                  onChange={(v) =>
                                    setDraft((s) => ({ ...s, [f.key]: v }))
                                  }
                                />
                                {showDetail ? (
                                  <TextInput
                                    value={detailValue}
                                    onChangeText={(v) =>
                                      setDraft((s) => ({ ...s, [detailKey]: v }))
                                    }
                                    placeholder={f.cfg.detailPlaceholder}
                                    className="rounded-xl border border-line bg-paper px-3 py-2.5 text-base text-ink"
                                  />
                                ) : null}
                              </View>
                            );
                          } else if (f.cfg?.type === "numeric") {
                            const invalid =
                              !!currentValue && !/^\d+$/.test(currentValue);
                            widget = (
                              <>
                                <TextInput
                                  value={currentValue}
                                  onChangeText={(v) =>
                                    setDraft((s) => ({ ...s, [f.key]: v }))
                                  }
                                  keyboardType="numeric"
                                  placeholder={f.cfg.placeholder}
                                  className={`rounded-xl border bg-paper px-3 py-2.5 text-base text-ink ${invalid ? "border-bad" : "border-line"}`}
                                />
                                {invalid ? (
                                  <Text className="mt-1 text-[12px] text-bad">
                                    Renseignez uniquement les chiffres.
                                  </Text>
                                ) : null}
                              </>
                            );
                          } else {
                            // type "text" (défaut) ou pas de cfg
                            widget = (
                              <TextInput
                                value={currentValue}
                                onChangeText={(v) =>
                                  setDraft((s) => ({ ...s, [f.key]: v }))
                                }
                                placeholder={
                                  f.cfg?.type === "text"
                                    ? f.cfg.placeholder
                                    : undefined
                                }
                                className="rounded-xl border border-line bg-paper px-3 py-2.5 text-base text-ink"
                              />
                            );
                          }

                          return (
                            <View key={f.key} className="gap-1.5">
                              <View className="flex-row items-center gap-2">
                                <FieldIcon icon={f.icon} size={24} />
                                <Text className="text-[13px] uppercase text-ink-4">
                                  {f.label}
                                </Text>
                              </View>
                              {widget}
                            </View>
                          );
                        })}
                        <View className="mt-1 flex-row gap-2">
                          <Pressable
                            disabled={patch.isPending}
                            className="flex-1 items-center rounded-full border border-line py-2.5"
                            onPress={() => {
                              setEditing(null);
                              setDraft({});
                            }}
                          >
                            <Text className="text-base text-ink-3">
                              Annuler
                            </Text>
                          </Pressable>
                          <Pressable
                            disabled={patch.isPending}
                            className="flex-1 items-center rounded-full bg-ink py-2.5"
                            onPress={async () => {
                              await patch.mutateAsync({
                                tier: k,
                                fields: draft,
                              });
                              setEditing(null);
                              setDraft({});
                            }}
                          >
                            <Text className="text-base font-semibold text-paper">
                              {patch.isPending ? "…" : "Enregistrer"}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View className="gap-2.5">
                        {FIELDS[k].map((f) => {
                          // Concatène la valeur principale + le détail
                          // ("SUV · Tesla", "Oui · Chat") pour les champs
                          // tag+text en mode lecture.
                          const raw = row[f.key];
                          const main =
                            raw != null && String(raw).trim() !== ""
                              ? String(raw)
                              : "";
                          let displayed = main || "—";
                          if (f.cfg?.type === "tag+text" && main) {
                            const detailRaw = row[f.cfg.detailField];
                            const detail =
                              detailRaw != null && String(detailRaw).trim() !== ""
                                ? String(detailRaw)
                                : "";
                            if (detail) displayed = `${main} · ${detail}`;
                          }
                          // Masque l'affichage si pseudonymisé — uniquement
                          // quand la valeur n'est pas vide (sinon on garde
                          // le tiret "—" pour signaler le champ non rempli).
                          const isMasked = pseudonymized && main !== "";
                          if (isMasked) displayed = "•••• ••••";
                          // Badge "✓ Vérifié" pour le téléphone une fois
                          // validé par SMS (parité web Prospect.jsx ligne
                          // 2796). Masqué si pseudonymisé pour rester
                          // cohérent.
                          const isPhone =
                            k === "identity" && f.key === "telephone";
                          const phoneVerified =
                            isPhone &&
                            Boolean(d.identityMeta?.phoneVerifiedAt) &&
                            main !== "" &&
                            !isMasked;
                          return (
                            <View
                              key={f.key}
                              className="flex-row items-center gap-2.5"
                            >
                              <FieldIcon icon={f.icon} />
                              <Text className="flex-1 text-[14px] text-ink-3">
                                {f.label}
                              </Text>
                              <View
                                className="max-w-[60%] flex-row items-center justify-end gap-1.5"
                              >
                                <Text
                                  className="shrink text-right text-[14px] text-ink-2"
                                  numberOfLines={1}
                                >
                                  {displayed}
                                </Text>
                                {phoneVerified ? (
                                  <View
                                    className="flex-row items-center gap-0.5 rounded-full px-1.5 py-0.5"
                                    style={{ backgroundColor: "#DCFCE7" }}
                                  >
                                    <Ionicons
                                      name="checkmark-circle"
                                      size={11}
                                      color="#16A34A"
                                    />
                                    <Text
                                      className="text-[10px] font-semibold"
                                      style={{ color: "#15803D" }}
                                    >
                                      Vérifié
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          );
                        })}
                        {/* 3 boutons d'action — toujours visibles (parité web
                            Prospect.jsx fn MesDonnees, lignes 2702-2724),
                            flex-1 each pour width « evenly ». Le bouton
                            Supprimer ouvre l'Alert de confirmation RGPD. */}
                        {!removed ? (
                          <View className="mt-3 flex-row gap-2">
                            <Pressable
                              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-line py-2.5"
                              onPress={() => setEditing(k)}
                            >
                              <Ionicons
                                name="pencil-outline"
                                size={14}
                                color="#283044"
                              />
                              <Text className="text-sm text-ink-2">
                                Modifier
                              </Text>
                            </Pressable>
                            <Pressable
                              disabled={tierAction.isPending}
                              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-line py-2.5"
                              onPress={() => {
                                // Réafficher = action non destructive → mutate
                                // direct. Masquer = action visible-impact →
                                // confirmation via sheet (parité web).
                                if (hidden) {
                                  void runTierAction(k, "restore");
                                } else {
                                  setConfirmHide(k);
                                }
                              }}
                            >
                              <Ionicons
                                name={hidden ? "eye-outline" : "eye-off-outline"}
                                size={14}
                                color="#283044"
                              />
                              <Text className="text-sm text-ink-2">
                                {hidden ? "Réafficher" : "Masquer"}
                              </Text>
                            </Pressable>
                            <Pressable
                              disabled={tierAction.isPending}
                              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-bad py-2.5"
                              onPress={() => setConfirmDelete(k)}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={14}
                                color="#DC2626"
                              />
                              <Text className="text-sm text-bad">
                                Supprimer
                              </Text>
                            </Pressable>
                          </View>
                        ) : null}
                        {tierAction.isError && (
                          <Text className="mt-1 text-[13px] text-bad">
                            Échec de l&apos;action. Réessayez.
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            {/* CTA bottom — redirige vers la page Préférences pour affiner
                canaux de communication, rayon de ciblage et types de
                sollicitations (réglages au-delà de la simple donnée). */}
            <View
              className="rounded-3xl bg-paper px-5 py-5"
              style={{
                borderWidth: 0.7,
                borderColor: "#CBC7B9",
                shadowColor: "#0F1629",
                shadowOpacity: 0.05,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
                elevation: 2,
              }}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: "#EDE9FE" }}
                >
                  <Ionicons name="options-outline" size={22} color="#5B3FD6" />
                </View>
                <Text className="flex-1 font-serif text-xl text-ink">
                  Affinez vos préférences
                </Text>
              </View>
              <Text className="mt-2.5 text-base leading-6 text-ink-3">
                Vos données nourrissent votre BUUPP Score. Réglez en plus vos
                canaux de communication, votre rayon de ciblage et les types
                de sollicitations directement dans la page Préférences.
              </Text>
              <Pressable
                onPress={() => router.push("/(prospect)/preferences")}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir mes préférences"
                className="mt-4 flex-row items-center justify-center gap-2 rounded-full bg-ink py-3 active:opacity-80"
              >
                <Ionicons name="options-outline" size={16} color="#FFFFFF" />
                <Text className="text-base font-semibold text-paper">
                  Ouvrir mes préférences
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
          );
        }}
      </QueryGate>

      {/* Sheets de confirmation pour actions destructives — alignés sur les
          modales web (ConfirmHideModal / ConfirmDeleteModal). */}
      <HideTierSheet
        visible={confirmHide !== null}
        tierKey={confirmHide}
        busy={tierAction.isPending}
        onClose={() => setConfirmHide(null)}
        onConfirm={() =>
          confirmHide && void runTierAction(confirmHide, "hide")
        }
      />
      <DeleteTierSheet
        visible={confirmDelete !== null}
        tierKey={confirmDelete}
        busy={tierAction.isPending}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() =>
          confirmDelete && void runTierAction(confirmDelete, "delete")
        }
      />
    </ScrollScreen>
  );
}
