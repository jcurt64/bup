// Ciblage pro « Villes » — sélection multiple de communes (puces, max 20).
// Autocomplétion geo.api.gouv.fr + BAN (cf. fetchCities). Liste vide = toute
// la France. Seul le nom de la commune est envoyé (targetCities).
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { fetchCities } from "./city-autocomplete";
import { MAX_TARGET_CITIES } from "../lib/contact-channels";
import { useTheme } from "../lib/theme";

type Suggestion = Awaited<ReturnType<typeof fetchCities>>[number];

export function CityMultiPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (cities: string[]) => void;
}) {
  const { c } = useTheme();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const full = value.length >= MAX_TARGET_CITIES;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
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
        const res = await fetchCities(q, ctrl.signal);
        if (!ctrl.signal.aborted) setItems(res);
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") return;
        setItems([]);
        setError(true);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const has = (v: string) =>
    value.some((x) => x.toLocaleLowerCase("fr-FR") === v.toLocaleLowerCase("fr-FR"));

  function add(ville: string) {
    if (full || has(ville)) {
      setQuery("");
      return;
    }
    onChange([...value, ville]);
    setQuery("");
    setItems([]);
  }

  return (
    <View style={{ gap: 8 }}>
      {value.length > 0 ? (
        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          {value.map((v) => (
            <Pressable
              key={v}
              onPress={() => onChange(value.filter((x) => x !== v))}
              accessibilityRole="button"
              accessibilityLabel={`Retirer ${v}`}
              className="flex-row items-center active:opacity-70"
              style={{
                gap: 5,
                paddingLeft: 11,
                paddingRight: 8,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: c.accentSoft,
                borderWidth: 1,
                borderColor: c.accent,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: c.accentInk }}>{v}</Text>
              <Ionicons name="close" size={14} color={c.accentInk} />
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={{ fontSize: 12.5, color: c.textSub }}>
          Aucune ville sélectionnée : toute la France.
        </Text>
      )}

      {full ? (
        <Text style={{ fontSize: 12, color: c.textMuted }}>
          Maximum {MAX_TARGET_CITIES} villes atteint.
        </Text>
      ) : (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Ajouter une ville (ex. Lyon)"
          placeholderTextColor={c.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
          className="rounded-xl border border-line bg-paper px-3 py-2.5 text-base text-ink"
        />
      )}

      {!full && query.trim().length >= 2 ? (
        <View
          className="overflow-hidden rounded-xl"
          style={{ borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.surface }}
        >
          {loading && items.length === 0 ? (
            <Text style={{ paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: c.textSub }}>
              Recherche…
            </Text>
          ) : error ? (
            <Text style={{ paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: c.bad }}>
              Recherche indisponible — vérifiez votre connexion.
            </Text>
          ) : items.length === 0 ? (
            <Text style={{ paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: c.textSub }}>
              Aucune ville trouvée.
            </Text>
          ) : (
            items.map((it, i) => {
              const already = has(it.ville);
              return (
                <Pressable
                  key={`${it.ville}-${it.codePostal}-${i}`}
                  onPress={() => add(it.ville)}
                  disabled={already}
                  className="flex-row items-center justify-between active:opacity-70"
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: c.track,
                    opacity: already ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontSize: 14, color: c.text }}>{it.ville}</Text>
                  <View className="flex-row items-center" style={{ gap: 6 }}>
                    {it.codePostal ? (
                      <Text className="font-mono" style={{ fontSize: 12, color: c.textSub }}>
                        {it.codePostal.slice(0, 2)}
                      </Text>
                    ) : null}
                    <Ionicons
                      name={already ? "checkmark" : "add"}
                      size={15}
                      color={c.accent}
                    />
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}
    </View>
  );
}
