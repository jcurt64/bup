// Mes données — /api/prospect/donnees (lecture + édition par palier via
// PATCH /api/prospect/donnees) + masquer/supprimer (POST /api/prospect/tier).
// Champs/libellés/ordre = Prospect.jsx fn MesDonnees (web).
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
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
import { QueryGate, ScrollScreen } from "../../components/screen";
import type { CompactExtra } from "../../lib/header-scroll";
import { useTheme } from "../../lib/theme";
import { HERO_GRADIENT } from "../../lib/pro-theme";
import {
  useProspectDonnees,
  usePatchDonnees,
  useTierAction,
  type TierKey,
} from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

// Base web (= prod que pointe le mobile) — sert les pages légales (/rgpd…),
// même logique que openLegal() dans components/ui.tsx.
const WEB_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://buupp.com";

// Config par champ — parité avec FIELD_CONFIG côté web (Prospect.jsx).
// L'absence de `cfg` = type text par défaut.
type FieldConfig =
  | { type: "text"; placeholder?: string }
  | { type: "numeric"; placeholder?: string }
  | { type: "date" }
  | { type: "select"; options: readonly string[]; placeholder?: string }
  | {
      type: "tag";
      options: readonly string[];
      multi?: boolean;
      /** Option exclusive (ex. « Aucun ») : la sélectionner vide les autres
       *  et sélectionner une autre option la retire. Parité web Prospect.jsx. */
      exclusive?: string;
    }
  | {
      type: "tag+text";
      options: readonly string[];
      detailField: string;
      detailPlaceholder: string;
      /** Si défini, le champ détail n'apparaît que quand le tag actif vaut
       *  cette valeur (ex. animaux=Oui → afficher "type d'animal"). */
      detailVisibleWhenTag?: string;
      /** Si défini, le champ détail est MASQUÉ quand le tag actif vaut cette
       *  valeur (ex. vehicule=Aucun → pas de marque). Permet de compléter le
       *  palier sans posséder de véhicule. Parité web FIELD_CONFIG. */
      detailHiddenWhenTag?: string;
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
    // ville + codePostal + region : en mode édition, ces 3 champs sont
    // remplacés par un widget combiné CityPostalAutocomplete (parité web).
    // La région est renseignée automatiquement avec la ville/le code postal
    // (geo.api.gouv.fr `fields=...,region`) — non éditable directement, mais
    // REQUISE pour compléter le palier 2 (cf. lib/completeness).
    { key: "ville", label: "Ville", icon: "business-outline" },
    { key: "codePostal", label: "Code postal", icon: "pin-outline" },
    {
      key: "region",
      label: "Région",
      icon: "map-outline",
      readOnly: true,
      hint: "Renseignée automatiquement avec la ville et le code postal",
    },
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
        // « Aucun » permet à un non-motorisé de compléter le palier 3.
        options: ["SUV", "4x4", "Berline", "Citadine", "Break", "Monospace", "Coupé", "Cabriolet", "Utilitaire", "Aucun"],
        detailField: "vehiculeMarque",
        detailPlaceholder: "Marque du véhicule",
        // La marque ne s'affiche que pour un vrai véhicule — masquée si « Aucun ».
        detailHiddenWhenTag: "Aucun",
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
    {
      key: "secteur",
      label: "Secteur",
      icon: "business-outline",
      // Liste déroulante des 21 sections de la nomenclature NAF rév. 2
      // (INSEE). Intitulés officiels des sections A à U (T/U abrégés).
      // Parité web Prospect.jsx FIELD_CONFIG['pro.secteur'].
      cfg: {
        type: "select",
        placeholder: "Sélectionnez un secteur…",
        options: [
          "Agriculture, sylviculture et pêche",
          "Industries extractives",
          "Industrie manufacturière",
          "Production et distribution d'électricité, de gaz, de vapeur et d'air conditionné",
          "Production et distribution d'eau ; assainissement, gestion des déchets et dépollution",
          "Construction",
          "Commerce ; réparation d'automobiles et de motocycles",
          "Transports et entreposage",
          "Hébergement et restauration",
          "Information et communication",
          "Activités financières et d'assurance",
          "Activités immobilières",
          "Activités spécialisées, scientifiques et techniques",
          "Activités de services administratifs et de soutien",
          "Administration publique",
          "Enseignement",
          "Santé humaine et action sociale",
          "Arts, spectacles et activités récréatives",
          "Autres activités de services",
          "Activités des ménages en tant qu'employeurs",
          "Activités extra-territoriales",
        ],
      },
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
      key: "projets",
      label: "Projets à 3–5 ans",
      icon: "flag-outline",
      // « Déménagement » est cumulable avec Achat/Construction/Location
      // (multi). « Aucun » reste exclusif et permet à qqn sans projet de
      // compléter le palier 5. Parité web Prospect.jsx.
      cfg: {
        type: "tag",
        multi: true,
        options: ["Achat", "Construction", "Location", "Déménagement", "Aucun"],
        exclusive: "Aucun",
      },
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
  const { c } = useTheme();
  return (
    <View
      className="items-center justify-center rounded-full bg-accent-soft"
      style={{ width: size, height: size }}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={c.accent} />
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
  const { c } = useTheme();
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
        <Ionicons name="calendar-outline" size={18} color={c.ink4} />
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
  exclusive,
  onChange,
}: {
  value: string;
  options: readonly string[];
  multi?: boolean;
  exclusive?: string;
  onChange: (v: string) => void;
}) {
  const { c } = useTheme();
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
                if (next.has(opt)) {
                  next.delete(opt);
                } else {
                  next.add(opt);
                  // Option exclusive (ex. « Aucun ») : la sélectionner vide
                  // les autres ; sélectionner une autre option la retire.
                  if (exclusive) {
                    if (opt === exclusive) {
                      next.clear();
                      next.add(opt);
                    } else {
                      next.delete(exclusive);
                    }
                  }
                }
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
              borderColor: active ? TAG_VIOLET : c.borderSoft,
              backgroundColor: active ? TAG_VIOLET : c.surface,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: active ? "600" : "500",
                color: active ? "#FFFFFF" : c.text,
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

// SelectField — liste déroulante (parité web FieldInput type "select").
// RN n'a pas de <select> natif : on affiche un déclencheur (valeur courante
// ou placeholder) qui ouvre une BottomSheet listant les options. Tap = pick.
function SelectField({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: readonly string[];
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        className="flex-row items-center justify-between rounded-xl border border-line bg-paper px-3 py-2.5"
      >
        <Text
          className={`flex-1 text-base ${value ? "text-ink" : "text-ink-4"}`}
          numberOfLines={1}
        >
          {value || placeholder || "Sélectionnez…"}
        </Text>
        <Ionicons name="chevron-down" size={18} color={c.ink4} />
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} heightPct={70}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {options.map((opt) => {
            const active = value === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => {
                  onChange(active ? "" : opt);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className="flex-row items-center gap-3 border-b border-line py-3"
              >
                <Ionicons
                  name={active ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={active ? TAG_VIOLET : c.ink4}
                />
                <Text
                  className="flex-1 text-base"
                  style={{ color: active ? TAG_VIOLET : c.text, fontWeight: active ? "600" : "400" }}
                >
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </>
  );
}

// Ville + Code postal — autocomplétion. Deux sources publiques gratuites
// (HTTPS, sans clé) avec fallback croisé pour fiabiliser le mobile :
//   • noms de ville → API BAN (api-adresse.data.gouv.fr, type=municipality)
//     excellente dès 1 lettre, renvoie ville + code postal (arrondissements
//     inclus) ; fallback geo.api.gouv.fr (?nom=).
//   • codes postaux → geo.api.gouv.fr (?codePostal=) ; fallback BAN
//     (recherche générale) pour les préfixes partiels.
// Une commune à plusieurs CP (Paris/Lyon/Marseille…) est éclatée en
// suggestions distinctes. Parité fonctionnelle avec Prospect.jsx (web).
type CityPostalItem = { ville: string; codePostal: string; region: string };

type BanFeature = {
  // `context` BAN = "75, Paris, Île-de-France" → le dernier segment est la
  // région administrative (utilisé en fallback quand geo est indisponible).
  properties?: { city?: string; name?: string; postcode?: string; context?: string };
};
type GeoCommune = { nom: string; codesPostaux?: string[]; region?: { nom?: string } };

// Région administrative à partir du `context` BAN ("dép, ville, région").
function regionFromBanContext(context?: string): string {
  if (!context) return "";
  const parts = context.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

// GET + parse JSON tolérant : renvoie null sur échec réseau (la source est
// alors considérée « indisponible »), relance uniquement l'AbortError.
async function safeJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch (e) {
    if ((e as { name?: string }).name === "AbortError") throw e;
    return null;
  }
}

// Récupère les suggestions ville/CP. Chaque source est interrogée de façon
// tolérante (si l'une est injoignable, l'autre prend le relais) :
//   • Saisie texte → on interroge EN PARALLÈLE BAN (type=municipality) ET
//     geo (?nom=) et on fusionne → une lettre propose toujours des villes,
//     sans dépendre du code postal.
//   • Saisie chiffres → geo (?codePostal=) puis fallback BAN (préfixes).
// `anyOk` = au moins une source a répondu (pour distinguer « 0 résultat »
// de « hors ligne »).
async function fetchCityPostal(
  q: string,
  signal: AbortSignal,
): Promise<{ items: CityPostalItem[]; anyOk: boolean }> {
  const isPostal = /^\d+$/.test(q);
  const seen = new Set<string>();
  const out: CityPostalItem[] = [];
  const push = (
    ville?: string | null,
    cp?: string | null,
    region?: string | null,
  ) => {
    if (!ville || !cp) return;
    const key = `${cp}-${ville}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ville, codePostal: cp, region: region ?? "" });
  };
  let anyOk = false;

  if (isPostal) {
    // 1) geo.api.gouv.fr — codes postaux.
    const geo = await safeJson<GeoCommune[]>(
      `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(q)}&fields=nom,codesPostaux,region&limit=20`,
      signal,
    );
    if (geo) {
      anyOk = true;
      for (const c of geo)
        for (const cp of c.codesPostaux ?? [])
          if (cp.startsWith(q)) push(c.nom, cp, c.region?.nom);
    }
    // 2) Fallback BAN pour les préfixes partiels (ex. « 750 »).
    if (out.length === 0) {
      const ban = await safeJson<{ features?: BanFeature[] }>(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=15`,
        signal,
      );
      if (ban) {
        anyOk = true;
        for (const f of ban.features ?? []) {
          const p = f.properties;
          if (p?.postcode?.startsWith(q))
            push(p.city ?? p.name, p.postcode, regionFromBanContext(p.context));
        }
      }
    }
    out.sort((a, b) => a.codePostal.localeCompare(b.codePostal));
  } else {
    // Texte : les deux sources en parallèle, fusionnées (résilient si l'une
    // est bloquée sur l'appareil).
    const [ban, geo] = await Promise.all([
      safeJson<{ features?: BanFeature[] }>(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&type=municipality&autocomplete=1&limit=10`,
        signal,
      ),
      safeJson<GeoCommune[]>(
        `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=nom,codesPostaux,region&boost=population&limit=10`,
        signal,
      ),
    ]);
    if (ban) {
      anyOk = true;
      for (const f of ban.features ?? []) {
        const p = f.properties;
        push(p?.city ?? p?.name, p?.postcode, regionFromBanContext(p?.context));
      }
    }
    if (geo) {
      anyOk = true;
      for (const c of geo)
        for (const cp of c.codesPostaux ?? []) push(c.nom, cp, c.region?.nom);
    }
  }
  return { items: out.slice(0, 30), anyOk };
}

function CityPostalAutocomplete({
  ville,
  codePostal,
  onPick,
}: {
  ville: string;
  codePostal: string;
  onPick: (v: CityPostalItem) => void;
}) {
  const { c: theme } = useTheme();
  const initial =
    ville && codePostal
      ? `${codePostal} ${ville}`
      : ville || codePostal || "";
  const [query, setQuery] = useState(initial);
  const [items, setItems] = useState<CityPostalItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const q = query.trim();
    // Déclenchement dès le 1er caractère (lettre ou chiffre).
    if (q.length < 1) {
      setItems([]);
      setLoading(false);
      setError(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(false);
    const timer = setTimeout(async () => {
      try {
        const { items: res, anyOk } = await fetchCityPostal(q, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setItems(res);
        // Erreur réseau seulement si AUCUNE source n'a répondu.
        setError(!anyOk);
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") return;
        setItems([]);
        setError(true);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  function pick(item: CityPostalItem) {
    setQuery(`${item.codePostal} ${item.ville}`);
    setItems([]);
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
        placeholderTextColor={theme.textMuted}
        autoCorrect={false}
        className="rounded-xl border border-line bg-paper px-3 py-2.5 text-base text-ink"
      />
      {open && query.trim().length >= 1 ? (
        <View className="mt-1.5 overflow-hidden rounded-xl border border-line bg-paper">
          {loading && items.length === 0 ? (
            <Text className="px-3 py-2.5 text-sm text-ink-4">Recherche…</Text>
          ) : error ? (
            <Text className="px-3 py-2.5 text-sm text-bad">
              Recherche indisponible — vérifiez votre connexion.
            </Text>
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

// Méta par palier : numéro, label, icône thématique et palette de couleurs
// (alignée pixel sur do.html). Chaque palier a une identité visuelle :
//   headerBg  = bandeau d'en-tête + fond des pastilles de ligne
//   footerBg  = même teinte à 40 % d'opacité (footer d'actions)
//   boxBorder = bordure des tuiles icône blanches (en-tête de card)
//   accent    = couleur forte (PALIER N, barre de progression, icônes)
type TierMeta = {
  n: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  headerBg: string;
  footerBg: string;
  boxBorder: string;
  accent: string;
};

const TIER_META: Record<TierKey, TierMeta> = {
  identity: {
    n: 1,
    label: "Identification",
    icon: "finger-print-outline",
    headerBg: "#F2EDFF",
    footerBg: "rgba(242,237,255,0.4)",
    boxBorder: "#E8E0FF",
    accent: "#7C5CFF",
  },
  localisation: {
    n: 2,
    label: "Localisation",
    icon: "map-outline",
    headerBg: "#DDE9F8",
    footerBg: "rgba(221,233,248,0.4)",
    boxBorder: "#CFE0F4",
    accent: "#3F7FD6",
  },
  vie: {
    n: 3,
    label: "Style de vie",
    icon: "heart-outline",
    headerBg: "#DCEFDF",
    footerBg: "rgba(220,239,223,0.4)",
    boxBorder: "#CCE5D1",
    accent: "#3F9056",
  },
  pro: {
    n: 4,
    label: "Données professionnelles",
    icon: "briefcase-outline",
    headerBg: "#F8E8C9",
    footerBg: "rgba(248,232,201,0.4)",
    boxBorder: "#EFD9A8",
    accent: "#E0972F",
  },
  patrimoine: {
    n: 5,
    label: "Patrimoine & projets",
    icon: "diamond-outline",
    headerBg: "#F9DDD5",
    footerBg: "rgba(249,221,213,0.4)",
    boxBorder: "#F0C6BB",
    accent: "#DD5F48",
  },
};

const TIERS: TierKey[] = ["identity", "localisation", "vie", "pro", "patrimoine"];

// Variante sombre des couleurs par palier (fusionnée sur TIER_META quand le
// thème sombre est actif) : tuiles re-densifiées + accents lumineux.
const TIER_DARK: Record<
  TierKey,
  { headerBg: string; footerBg: string; boxBorder: string; accent: string }
> = {
  identity: { headerBg: "#242147", footerBg: "#201D38", boxBorder: "#322C5C", accent: "#9785FF" },
  localisation: { headerBg: "#18283F", footerBg: "#152338", boxBorder: "#2A3F5E", accent: "#6FA0FF" },
  vie: { headerBg: "#16302A", footerBg: "#142A24", boxBorder: "#244A3A", accent: "#4FBF7E" },
  pro: { headerBg: "#322914", footerBg: "#2A2310", boxBorder: "#4A3D1E", accent: "#E8B468" },
  patrimoine: { headerBg: "#34231D", footerBg: "#2A1C17", boxBorder: "#4F302A", accent: "#FF8C7E" },
};

// Accent violet global (do.html) — pastilles « Ajouter », anneau de
// complétude, header compact.
const VIOLET = "#7C5CFF";
const VIOLET_DEEP = "#5B3FE0";

// Récap complétude — même définition que le web (Prospect.jsx fn
// MesDonnees) : les paliers supprimés (removedTiers) sont exclus du
// calcul ; un palier masqué (hiddenTiers) reste compté mais avec 0 champ
// rempli ; un palier est « atteint » dès qu'au moins un champ est rempli.
// Extrait au niveau module pour être réutilisé par le header compact
// (niveau de palier) et la card « Niveau de palier ».
type DonneesData = ReturnType<typeof useProspectDonnees>["data"];
function computeStats(d: NonNullable<DonneesData>) {
  const isFilled = (v: unknown) => v != null && String(v).trim() !== "";
  const visibleTiers = TIERS.filter((k) => !d.removedTiers.includes(k));
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
  return {
    tierStats,
    reachedTiers,
    visibleCount: visibleTiers.length,
    completeness,
    totalFields,
    filledFields,
  };
}

// Anneau de progression circulaire SANS react-native-svg (exclu du
// projet). Technique : deux demi-disques colorés pivotant autour du
// centre, clippés à gauche/droite, + un trou central qui transforme le
// disque plein en anneau. Couvre correctement 0–100 %.
function ProgressRing({
  size = 60,
  stroke = 6,
  pct,
  color,
  track,
  hole,
  children,
}: {
  size?: number;
  stroke?: number;
  pct: number;
  color?: string;
  track?: string;
  hole?: string;
  children?: React.ReactNode;
}) {
  const { c } = useTheme();
  const ringColor = color ?? c.violet;
  const trackColor = track ?? c.track;
  const holeColor = hole ?? c.surface;
  const p = Math.max(0, Math.min(100, pct));
  const half = size / 2;
  const rightDeg = p <= 50 ? (p / 50) * 180 : 180; // 0..180
  const leftDeg = p > 50 ? ((p - 50) / 50) * 180 : 0; // 0..180

  // Demi-disque coloré bulgeant d'un côté, pivotant autour du centre du
  // conteneur, clippé sur une moitié verticale. À 0° il est hors-clip
  // (invisible) ; à 180° il remplit la moitié visible.
  const Sweep = ({
    clip,
    rotate,
  }: {
    clip: "right" | "left";
    rotate: number;
  }) => (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: clip === "right" ? half : 0,
        width: half,
        height: size,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 0,
          left: clip === "right" ? -half : 0,
          width: size,
          height: size,
          transform: [{ rotate: `${rotate}deg` }],
        }}
      >
        <View
          style={{
            position: "absolute",
            top: 0,
            left: clip === "right" ? 0 : half,
            width: half,
            height: size,
            backgroundColor: ringColor,
            borderTopLeftRadius: clip === "right" ? half : 0,
            borderBottomLeftRadius: clip === "right" ? half : 0,
            borderTopRightRadius: clip === "left" ? half : 0,
            borderBottomRightRadius: clip === "left" ? half : 0,
          }}
        />
      </View>
    </View>
  );

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: half,
          backgroundColor: trackColor,
        }}
      />
      <Sweep clip="right" rotate={rightDeg} />
      {p > 50 ? <Sweep clip="left" rotate={leftDeg} /> : null}
      <View
        style={{
          position: "absolute",
          width: size - 2 * stroke,
          height: size - 2 * stroke,
          borderRadius: (size - 2 * stroke) / 2,
          backgroundColor: holeColor,
        }}
      />
      {children}
    </View>
  );
}

// Pastille icône d'une ligne en mode lecture (do.html) : tuile arrondie
// 34×34 teintée à la couleur du palier, icône en accent du palier.
function RowFieldIcon({
  icon,
  bg,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  color: string;
}) {
  return (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Ionicons name={icon} size={17} color={color} />
    </View>
  );
}

// Pastille « Ajouter » (do.html) — affordance des champs vides en mode
// lecture. Toujours violette quel que soit le palier. Tap → ouvre
// l'édition du palier.
function AddPill({ onPress, label }: { onPress: () => void; label: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Renseigner ${label}`}
      className="active:opacity-70"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingVertical: 5,
        paddingLeft: 8,
        paddingRight: 11,
        borderRadius: 999,
        backgroundColor: c.surface,
        borderWidth: 1.5,
        borderColor: c.violetSoft,
        flexShrink: 0,
      }}
    >
      <Ionicons name="add" size={15} color={c.accVioletDeep} />
      <Text style={{ fontSize: 12.5, fontWeight: "600", color: c.accVioletDeep }}>
        Ajouter
      </Text>
    </Pressable>
  );
}

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
  const { c, isDark, mode } = useTheme();
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

  // Stats au niveau composant (q.data dispo) — alimentent le header
  // compact. Recalculées à l'identique dans le QueryGate pour le rendu
  // détaillé (la même fonction garantit la cohérence).
  const headerStats = q.data ? computeStats(q.data) : null;
  // Extras du header compact (au scroll) : niveau de palier (pastille
  // layers « 20% · 1/5 ») + œil de pseudonymisation synchronisé avec le
  // toggle de la page.
  const compactExtras: CompactExtra[] | undefined = headerStats
    ? [
        {
          icon: "layers-outline",
          value: `${headerStats.completeness}% · ${headerStats.reachedTiers}/${headerStats.visibleCount}`,
          color: c.accViolet,
          bg: c.accentSoft,
        },
        {
          icon: pseudonymized ? "eye-off-outline" : "eye-outline",
          onPress: () => setPseudonymized((v) => !v),
          color: pseudonymized ? "#FFFFFF" : c.accVioletDeep,
          bg: pseudonymized ? VIOLET : c.accentSoft,
          accessibilityLabel: pseudonymized
            ? "Afficher mes données"
            : "Masquer mes données",
        },
      ]
    : undefined;

  return (
    <ScrollScreen onRefresh={q.refetch} compactExtras={compactExtras}>
      {/* Hero — card gradient violet (do.html). Eyebrow + titre + desc à
          gauche, tuile icône layers translucide à droite. */}
      <LinearGradient
        colors={HERO_GRADIENT[mode]}
        locations={[0, 0.6, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.85 }}
        style={{
          borderRadius: 22,
          padding: 20,
          shadowColor: "#5B3FE0",
          shadowOpacity: 0.26,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: 14 },
          elevation: 6,
        }}
      >
        <View className="flex-row items-start justify-between gap-3.5">
          <View className="flex-1">
            <Text
              className="text-[11px] font-bold uppercase text-white/70"
              style={{ letterSpacing: 1.6 }}
            >
              Mes données
            </Text>
            <Text className="mt-1 font-serif text-2xl text-white">
              Vos paliers
            </Text>
            <Text className="mt-2 text-[14px] leading-5 text-white/80">
              Plus vous renseignez de données, plus votre BUUPP Score et vos
              gains augmentent. Vous restez maître de ce que vous partagez.
            </Text>
          </View>
          <View
            className="items-center justify-center"
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              backgroundColor: "rgba(255,255,255,0.16)",
              flexShrink: 0,
            }}
          >
            <Ionicons name="layers-outline" size={24} color="#FFFFFF" />
          </View>
        </View>
      </LinearGradient>

      {/* Card droits RGPD — card plate ambre (do.html) : fond #F8E8C9,
          bordure #EFD9A8, tuile icône blanche, titre Fraunces, surtitre
          caps ambre, puis le renvoi vers la page de gestion des données. */}
      <View
        style={{
          flexDirection: "row",
          gap: 13,
          padding: 16,
          borderRadius: 18,
          backgroundColor: c.tintAmber,
          borderWidth: 1,
          borderColor: c.borderSoft,
          alignItems: "flex-start",
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.borderSoft,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Ionicons name="shield-checkmark-outline" size={19} color={c.accAmber} />
        </View>
        <View style={{ flex: 1 }}>
          <Text className="font-serif" style={{ fontSize: 16.5, color: c.text }}>
            Vos droits sur vos données
          </Text>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: c.accAmber,
              marginTop: 2,
            }}
          >
            ARTICLES 15 À 22 DU RGPD
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontSize: 12.5,
              lineHeight: 19,
              color: c.textSub,
            }}
          >
            Rendez-vous sur la{" "}
            <Text
              style={{ fontWeight: "600", textDecorationLine: "underline" }}
              onPress={() =>
                void WebBrowser.openBrowserAsync(
                  `${WEB_BASE}/rgpd?from=mobile-app`,
                  {
                    presentationStyle:
                      WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                  },
                )
              }
            >
              page de gestion des données personnelles
            </Text>{" "}
            pour toute information et l&apos;exercice de vos droits.
          </Text>
        </View>
      </View>

      <QueryGate query={q}>
        {(d) => {
          const { tierStats, reachedTiers, visibleCount, completeness, totalFields, filledFields } =
            computeStats(d);
          return (
          <View className="gap-3">
            {/* Card « Niveau de palier » (do.html) — anneau circulaire +
                récap, puis une barre de progression par palier dans la
                couleur d'accent du palier. */}
            <View
              className="rounded-[20px] bg-paper"
              style={{
                padding: 18,
                borderWidth: 1,
                borderColor: c.borderSoft,
                shadowColor: "#000000",
                shadowOpacity: 0.05,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 5 },
                elevation: 2,
              }}
            >
              <View className="flex-row items-center" style={{ gap: 14 }}>
                <ProgressRing pct={completeness} size={60} stroke={6}>
                  <Text
                    className="font-serif"
                    style={{ fontSize: 16, color: c.text }}
                  >
                    {completeness}
                    <Text style={{ fontSize: 11 }}>%</Text>
                  </Text>
                </ProgressRing>
                <View className="flex-1">
                  <Text
                    style={{
                      fontSize: 10,
                      letterSpacing: 1.6,
                      fontWeight: "600",
                      color: c.textSub,
                      textTransform: "uppercase",
                    }}
                  >
                    Niveau de palier
                  </Text>
                  <View
                    className="flex-row flex-wrap items-baseline"
                    style={{ gap: 8, marginTop: 3 }}
                  >
                    <Text
                      style={{ fontSize: 13, fontWeight: "600", color: c.text }}
                    >
                      {reachedTiers}/{visibleCount} paliers
                    </Text>
                    <Text style={{ fontSize: 12.5, color: c.textMuted }}>
                      · {filledFields}/{totalFields} champs renseignés
                    </Text>
                  </View>
                </View>
              </View>
              <Text
                style={{
                  marginTop: 13,
                  fontSize: 12.5,
                  lineHeight: 19,
                  color: c.textSub,
                }}
              >
                Un palier est atteint dès qu&apos;au moins une donnée y est
                renseignée. Plus vous remplissez de champs, plus votre BUUPP
                Score augmente.
              </Text>
              <View style={{ marginTop: 16, gap: 13 }}>
                {tierStats.map((s) => {
                  const m = isDark
                    ? { ...TIER_META[s.key], ...TIER_DARK[s.key] }
                    : TIER_META[s.key];
                  const pct =
                    s.total === 0 ? 0 : Math.round((s.filled / s.total) * 100);
                  return (
                    <View key={s.key}>
                      <View
                        className="flex-row items-center justify-between"
                        style={{ marginBottom: 6 }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 13,
                            fontWeight: "500",
                            color: c.text,
                            flexShrink: 1,
                          }}
                        >
                          Palier {m.n} · {m.label}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12.5,
                            fontWeight: "600",
                            color: s.filled > 0 ? m.accent : c.textMuted,
                            marginLeft: 10,
                          }}
                        >
                          {s.filled}/{s.total}
                        </Text>
                      </View>
                      {/* Barre — couleur d'accent du palier (do.html), grise
                          si le palier est masqué. */}
                      <View
                        style={{
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: c.track,
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            borderRadius: 3,
                            backgroundColor: s.isHidden ? c.textMuted : m.accent,
                          }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Card « Pseudonymiser vos données » (do.html) — fond violet
                pâle, tuile icône blanche, libellé + sous-texte, switch pill
                à droite. Synchronisé avec l'œil du header compact. */}
            <Pressable
              onPress={() => setPseudonymized((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: pseudonymized }}
              accessibilityLabel="Pseudonymiser vos données"
              className="active:opacity-80"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                paddingHorizontal: 16,
                paddingVertical: 15,
                borderRadius: 18,
                backgroundColor: c.tintViolet,
                borderWidth: 1,
                borderColor: c.violetSoft,
              }}
            >
              <View
                className="items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: pseudonymized ? VIOLET : c.surface,
                  borderWidth: 1,
                  borderColor: pseudonymized ? VIOLET : c.violetSoft,
                  flexShrink: 0,
                }}
              >
                <Ionicons
                  name={pseudonymized ? "eye-off-outline" : "eye-outline"}
                  size={19}
                  color={pseudonymized ? "#FFFFFF" : c.accVioletDeep}
                />
              </View>
              <View className="flex-1">
                <Text
                  className="font-serif"
                  style={{ fontSize: 16.5, color: c.text }}
                >
                  Pseudonymiser vos données
                </Text>
                <Text style={{ fontSize: 12.5, color: c.textSub, marginTop: 2 }}>
                  {pseudonymized
                    ? "Affichage masqué — vos données restent en clair en base"
                    : "Masquez l'affichage de toutes vos données."}
                </Text>
              </View>
              {/* Switch pill (do.html) : 46×27, knob 21 qui glisse */}
              <View
                style={{
                  width: 46,
                  height: 27,
                  borderRadius: 999,
                  backgroundColor: pseudonymized ? VIOLET : (isDark ? c.ink5 : "#D8D1C0"),
                  flexShrink: 0,
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    top: 3,
                    left: pseudonymized ? 22 : 3,
                    width: 21,
                    height: 21,
                    borderRadius: 999,
                    backgroundColor: c.surface,
                    shadowColor: "#000000",
                    shadowOpacity: 0.2,
                    shadowRadius: 3,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 2,
                  }}
                />
              </View>
            </Pressable>

            {TIERS.map((k) => {
              const m = isDark ? { ...TIER_META[k], ...TIER_DARK[k] } : TIER_META[k];
              const row = (d[k] ?? {}) as Record<string, unknown>;
              const hidden = d.hiddenTiers.includes(k);
              const removed = d.removedTiers.includes(k);
              const isEditing = editing === k;
              return (
                <View
                  key={k}
                  className={`overflow-hidden rounded-[20px] bg-paper ${removed || hidden ? "opacity-60" : ""}`}
                  style={{
                    borderWidth: 1,
                    borderColor: c.borderSoft,
                    shadowColor: "#000000",
                    shadowOpacity: 0.05,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 5 },
                    elevation: 2,
                  }}
                >
                  {/* En-tête de card (do.html) : fond teinté du palier,
                      tuile icône blanche bordée, « PALIER N » en accent +
                      nom du palier en Fraunces. */}
                  <View
                    className="flex-row items-center"
                    style={{
                      gap: 13,
                      paddingHorizontal: 16,
                      paddingVertical: 15,
                      backgroundColor: m.headerBg,
                    }}
                  >
                    <View
                      className="items-center justify-center"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: c.surface,
                        borderWidth: 1,
                        borderColor: m.boxBorder,
                        flexShrink: 0,
                      }}
                    >
                      <Ionicons name={m.icon} size={20} color={m.accent} />
                    </View>
                    <View className="flex-1">
                      <Text
                        style={{
                          fontSize: 10.5,
                          fontWeight: "700",
                          letterSpacing: 0.8,
                          color: m.accent,
                        }}
                      >
                        PALIER {m.n}
                      </Text>
                      <Text
                        className="font-serif"
                        numberOfLines={1}
                        style={{
                          fontSize: 19,
                          color: c.text,
                          lineHeight: 22,
                          marginTop: 1,
                        }}
                      >
                        {m.label}
                      </Text>
                    </View>
                    {hidden || removed ? (
                      <View className="rounded-full bg-paper px-3 py-1">
                        <Text className="font-mono text-sm text-ink-4">
                          {removed ? "supprimé" : "masqué"}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Body — édition : padding standard (px-5 py-4).
                      Lecture : lignes pleine largeur séparées par des
                      filets (do.html), donc padding géré au niveau ligne. */}
                  <View className={isEditing ? "px-5 py-4" : ""}>
                    {isEditing ? (
                      <View className="gap-3">
                        {FIELDS[k].map((f) => {
                          // Pour la localisation, on remplace ville+CP par UN
                          // widget combiné (CityPostalAutocomplete). Le champ
                          // "ville" sert d'ancre de rendu ; "codePostal" est
                          // sauté pour ne pas dupliquer.
                          // codePostal + region : pris en charge par le widget
                          // combiné rendu sur l'ancre "ville" → on les saute
                          // pour ne pas les dupliquer.
                          if (
                            k === "localisation" &&
                            (f.key === "codePostal" || f.key === "region")
                          ) {
                            return null;
                          }
                          if (k === "localisation" && f.key === "ville") {
                            const regionVal =
                              draft.region !== undefined
                                ? draft.region
                                : String(row.region ?? "");
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
                                      // La région suit la ville (requise pour
                                      // compléter le palier 2).
                                      region: item.region,
                                    }))
                                  }
                                />
                                {/* Région renseignée automatiquement avec la
                                    ville/le code postal. */}
                                {regionVal ? (
                                  <View className="flex-row items-center gap-2">
                                    <Ionicons
                                      name="map-outline"
                                      size={13}
                                      color={c.accent}
                                    />
                                    <Text className="text-[12.5px] text-ink-3">
                                      Région :{" "}
                                      <Text className="font-semibold text-ink">
                                        {regionVal}
                                      </Text>
                                    </Text>
                                  </View>
                                ) : (
                                  <Text className="text-[12px] text-ink-4">
                                    La région sera renseignée automatiquement
                                    avec la ville.
                                  </Text>
                                )}
                              </View>
                            );
                          }
                          // Champ readonly (téléphone)
                          if (f.readOnly) {
                            return (
                              <View key={f.key} className="gap-1.5">
                                <View className="flex-row items-center gap-2">
                                  <FieldIcon icon={f.icon} size={24} />
                                  <Text className="text-[14px] uppercase text-ink-4">
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
                                  <Text className="text-[13px] text-ink-4">
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
                                exclusive={f.cfg.exclusive}
                                onChange={(v) =>
                                  setDraft((s) => ({ ...s, [f.key]: v }))
                                }
                              />
                            );
                          } else if (f.cfg?.type === "select") {
                            widget = (
                              <SelectField
                                value={currentValue}
                                options={f.cfg.options}
                                placeholder={f.cfg.placeholder}
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
                              (!f.cfg.detailVisibleWhenTag ||
                                currentValue === f.cfg.detailVisibleWhenTag) &&
                              (!f.cfg.detailHiddenWhenTag ||
                                currentValue !== f.cfg.detailHiddenWhenTag);
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
                                  <Text className="mt-1 text-[13px] text-bad">
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
                            className="flex-1 items-center rounded-full py-2.5"
                            style={{ backgroundColor: c.btnBg }}
                            onPress={async () => {
                              // Rien n'a été modifié → on referme sans appeler
                              // l'API. L'endpoint PATCH /api/prospect/donnees
                              // rejette en 400 "no_known_fields" si le payload
                              // `fields` est vide (route.ts ligne 135) ; sans
                              // ce garde-fou, ré-enregistrer un palier déjà
                              // rempli faisait apparaître l'erreur.
                              if (Object.keys(draft).length === 0) {
                                setEditing(null);
                                return;
                              }
                              try {
                                await patch.mutateAsync({
                                  tier: k,
                                  fields: draft,
                                });
                                setEditing(null);
                                setDraft({});
                              } catch (e) {
                                Alert.alert(
                                  "Enregistrement impossible",
                                  e instanceof Error && e.message
                                    ? e.message
                                    : "Une erreur est survenue. Réessayez dans un instant.",
                                );
                              }
                            }}
                          >
                            <Text
                              className="text-base font-semibold"
                              style={{ color: c.btnText }}
                            >
                              {patch.isPending ? "…" : "Enregistrer"}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View>
                        {FIELDS[k].map((f, idx) => {
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
                          // Badge ✓ vérifié pour le téléphone une fois
                          // validé par SMS (parité web). Masqué si
                          // pseudonymisé pour rester cohérent.
                          const isPhone =
                            k === "identity" && f.key === "telephone";
                          const phoneVerified =
                            isPhone &&
                            Boolean(d.identityMeta?.phoneVerifiedAt) &&
                            main !== "" &&
                            !isMasked;
                          // Champ vide & éditable → pastille « Ajouter »
                          // (do.html) qui ouvre l'édition du palier. Champ
                          // read-only (téléphone) vide → on garde « — ».
                          const isEmpty = main === "";
                          const showAddButton = isEmpty && !f.readOnly;
                          const isLast = idx === FIELDS[k].length - 1;
                          return (
                            <View
                              key={f.key}
                              className="flex-row items-center"
                              style={{
                                gap: 13,
                                paddingHorizontal: 16,
                                paddingVertical: 12,
                                borderBottomWidth: isLast ? 0 : 1,
                                borderBottomColor: c.track,
                              }}
                            >
                              <RowFieldIcon
                                icon={f.icon}
                                bg={m.headerBg}
                                color={m.accent}
                              />
                              <Text
                                numberOfLines={1}
                                style={{
                                  flex: 1,
                                  fontSize: 14.5,
                                  fontWeight: main ? "500" : "400",
                                  color: main ? c.text : c.textSub,
                                }}
                              >
                                {f.label}
                              </Text>
                              <View
                                className="flex-row items-center justify-end"
                                style={{ gap: 7, maxWidth: "55%" }}
                              >
                                {showAddButton ? (
                                  <AddPill
                                    onPress={() => setEditing(k)}
                                    label={f.label}
                                  />
                                ) : (
                                  <Text
                                    numberOfLines={1}
                                    style={{
                                      flexShrink: 1,
                                      textAlign: "right",
                                      fontSize: 13.5,
                                      color: isEmpty ? c.textMuted : c.text,
                                    }}
                                  >
                                    {displayed}
                                  </Text>
                                )}
                                {phoneVerified ? (
                                  <View
                                    className="items-center justify-center"
                                    style={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: 999,
                                      backgroundColor: c.goodSoft,
                                      flexShrink: 0,
                                    }}
                                  >
                                    <Ionicons
                                      name="checkmark"
                                      size={11}
                                      color={c.good}
                                    />
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          );
                        })}
                        {/* Message d'erreur placé AVANT le footer (le footer
                            occupe le bas de la card). */}
                        {tierAction.isError && (
                          <Text
                            className="text-[14px] text-bad"
                            style={{ paddingHorizontal: 16, paddingTop: 10 }}
                          >
                            Échec de l&apos;action. Réessayez.
                          </Text>
                        )}
                        {/* Footer d'actions (do.html) : fond teinté du palier
                            à 40 %, Modifier + Masquer/Réafficher (libellés) +
                            Supprimer (icône, terracotta). */}
                        {!removed ? (
                          <View
                            className="flex-row"
                            style={{
                              gap: 9,
                              paddingHorizontal: 14,
                              paddingVertical: 12,
                              backgroundColor: m.footerBg,
                            }}
                          >
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Modifier"
                              onPress={() => setEditing(k)}
                              className="flex-1 flex-row items-center justify-center active:opacity-70"
                              style={{
                                gap: 7,
                                height: 40,
                                borderRadius: 12,
                                backgroundColor: c.surface,
                                borderWidth: 1,
                                borderColor: c.borderSoft,
                              }}
                            >
                              <Ionicons
                                name="pencil-outline"
                                size={16}
                                color={c.text}
                              />
                              <Text
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: "600",
                                  color: c.text,
                                }}
                              >
                                Modifier
                              </Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={hidden ? "Réafficher" : "Masquer"}
                              disabled={tierAction.isPending}
                              onPress={() => {
                                // Réafficher = non destructif → mutate direct.
                                // Masquer = impact visible → confirmation.
                                if (hidden) {
                                  void runTierAction(k, "restore");
                                } else {
                                  setConfirmHide(k);
                                }
                              }}
                              className="flex-1 flex-row items-center justify-center active:opacity-70"
                              style={{
                                gap: 7,
                                height: 40,
                                borderRadius: 12,
                                backgroundColor: c.surface,
                                borderWidth: 1,
                                borderColor: c.borderSoft,
                              }}
                            >
                              <Ionicons
                                name={hidden ? "eye-outline" : "eye-off-outline"}
                                size={16}
                                color={c.textSub}
                              />
                              <Text
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: "600",
                                  color: c.textSub,
                                }}
                              >
                                {hidden ? "Réafficher" : "Masquer"}
                              </Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Supprimer"
                              disabled={tierAction.isPending}
                              onPress={() => setConfirmDelete(k)}
                              className="items-center justify-center active:opacity-70"
                              style={{
                                width: 56,
                                height: 40,
                                borderRadius: 12,
                                backgroundColor: c.surface,
                                borderWidth: 1,
                                borderColor: c.badSoft,
                              }}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={16}
                                color={c.bad}
                              />
                            </Pressable>
                          </View>
                        ) : null}
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
              className="rounded-[20px] bg-paper"
              style={{
                padding: 20,
                borderWidth: 1,
                borderColor: c.borderSoft,
                shadowColor: "#000000",
                shadowOpacity: 0.05,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 5 },
                elevation: 2,
              }}
            >
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View
                  className="items-center justify-center"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: c.tintViolet,
                    flexShrink: 0,
                  }}
                >
                  <Ionicons name="options-outline" size={20} color={VIOLET_DEEP} />
                </View>
                <Text
                  className="flex-1 font-serif"
                  style={{ fontSize: 20, color: c.text }}
                >
                  Affinez vos préférences
                </Text>
              </View>
              <Text
                style={{
                  marginTop: 13,
                  fontSize: 13.5,
                  lineHeight: 21,
                  color: c.textSub,
                }}
              >
                Vos données nourrissent votre BUUPP Score. Réglez en plus vos
                canaux de communication, votre rayon de ciblage et les types
                de sollicitations directement dans la page Préférences.
              </Text>
              <Pressable
                onPress={() => router.push("/(prospect)/preferences")}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir mes préférences"
                className="mt-4 flex-row items-center justify-center gap-2 rounded-full py-3 active:opacity-80"
                style={{ backgroundColor: c.btnBg }}
              >
                <Ionicons name="options-outline" size={16} color={c.btnText} />
                <Text
                  className="text-base font-semibold"
                  style={{ color: c.btnText }}
                >
                  Ouvrir mes préférences
                </Text>
                <Ionicons name="chevron-forward" size={16} color={c.btnText} />
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
