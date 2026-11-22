// Ville — saisie libre + suggestions (version allégée de l'ancien
// CityPostalAutocomplete d'avant le pivot). Seul le NOM de la ville est
// enregistré (pas de code postal ni de région, aucun ciblage géo ; le pro ne
// voit jamais la ville). Sources publiques gratuites, sans clé, interrogées en
// parallèle : geo.api.gouv.fr (?nom=) et BAN (type=municipality). Si les deux
// sont injoignables, la saisie libre reste possible.
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { useTheme } from "../lib/theme";

type CityItem = { ville: string; codePostal: string };

type GeoCommune = { nom: string; codesPostaux?: string[] };
type BanFeature = { properties?: { city?: string; name?: string; postcode?: string } };

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

export async function fetchCities(q: string, signal: AbortSignal): Promise<CityItem[]> {
  const [geo, ban] = await Promise.all([
    safeJson<GeoCommune[]>(
      `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=nom,codesPostaux&boost=population&limit=8`,
      signal,
    ),
    safeJson<{ features?: BanFeature[] }>(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&type=municipality&autocomplete=1&limit=8`,
      signal,
    ),
  ]);
  const seen = new Set<string>();
  const out: CityItem[] = [];
  const push = (ville?: string | null, cp?: string | null) => {
    if (!ville) return;
    const key = `${ville.toLocaleLowerCase("fr-FR")}-${(cp ?? "").slice(0, 2)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ville, codePostal: cp ?? "" });
  };
  for (const c of geo ?? []) push(c.nom, c.codesPostaux?.[0]);
  for (const f of ban?.features ?? []) push(f.properties?.city ?? f.properties?.name, f.properties?.postcode);
  return out.slice(0, 6);
}

export function CityAutocomplete({
  value,
  onChange,
}: {
  value: string;
  onChange: (ville: string) => void;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CityItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = value.trim();
    if (!open || q.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchCities(q, ctrl.signal);
        if (!ctrl.signal.aborted) setItems(res);
      } catch {
        if (!ctrl.signal.aborted) setItems([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [value, open]);

  const showList = open && value.trim().length >= 2 && (loading || items.length > 0);

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={(v) => {
          onChange(v);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Ex. Bordeaux"
        placeholderTextColor={c.textMuted}
        autoCapitalize="words"
        autoCorrect={false}
        textContentType="addressCity"
        autoComplete="postal-address-locality"
        className="rounded-xl border border-line bg-paper px-3 py-2.5 text-base text-ink"
      />
      {showList ? (
        <View
          className="mt-1.5 overflow-hidden rounded-xl"
          style={{ borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.surface }}
        >
          {loading && items.length === 0 ? (
            <Text style={{ paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: c.textSub }}>
              Recherche…
            </Text>
          ) : (
            items.map((it, i) => (
              <Pressable
                key={`${it.ville}-${it.codePostal}-${i}`}
                onPress={() => {
                  onChange(it.ville);
                  setItems([]);
                  setOpen(false);
                }}
                className="flex-row items-center justify-between active:opacity-70"
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: c.track,
                }}
              >
                <Text style={{ fontSize: 14, color: c.text }}>{it.ville}</Text>
                {it.codePostal ? (
                  <Text className="font-mono" style={{ fontSize: 12, color: c.textSub }}>
                    {it.codePostal.slice(0, 2)}
                  </Text>
                ) : null}
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}
