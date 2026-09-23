// Ville + Code postal (+ Région) — autocomplétion partagée.
// Extrait de app/(prospect)/donnees.tsx (logique copiée à l'identique) pour
// être réutilisé côté pro (Mes informations, parité web CityPostalEditCard).
// donnees.tsx conserve encore sa copie locale : il pourra importer ce
// composant ensuite (même API : ville / codePostal / onPick).
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { useTheme } from "../lib/theme";

// Ville + Code postal — autocomplétion. Deux sources publiques gratuites
// (HTTPS, sans clé) avec fallback croisé pour fiabiliser le mobile :
//   • noms de ville → API BAN (api-adresse.data.gouv.fr, type=municipality)
//     excellente dès 1 lettre, renvoie ville + code postal (arrondissements
//     inclus) ; fallback geo.api.gouv.fr (?nom=).
//   • codes postaux → geo.api.gouv.fr (?codePostal=) ; fallback BAN
//     (recherche générale) pour les préfixes partiels.
// Une commune à plusieurs CP (Paris/Lyon/Marseille…) est éclatée en
// suggestions distinctes. Parité fonctionnelle avec Prospect.jsx (web).
export type CityPostalItem = { ville: string; codePostal: string; region: string };

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

export function CityPostalAutocomplete({
  ville,
  codePostal,
  onPick,
  placeholder = "Tapez votre ville ou un code postal",
}: {
  ville: string;
  codePostal: string;
  onPick: (v: CityPostalItem) => void;
  placeholder?: string;
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
        placeholder={placeholder}
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

