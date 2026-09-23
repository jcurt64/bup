// Autocomplete de la cible géographique précise (ville / département /
// région) du wizard de création de campagne — réplique de
// GeoTargetAutocomplete (Pro.jsx web). Source : geo.api.gouv.fr (officiel,
// gratuit, sans clé). Saisie numérique ⇒ recherche par code (code postal,
// code département ou code région) ; sinon par nom.
// Pour une région, un 2nd appel résout la liste de ses départements
// (utilisée côté serveur pour le filtre de codes postaux).
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import type { GeoTarget } from "../lib/pro-pricing";
import { useTheme } from "../lib/theme";

type GeoLevel = "ville" | "dept" | "region";

type ApiItem = {
  nom: string;
  code: string;
  codesPostaux?: string[];
  codeDepartement?: string;
  codeRegion?: string;
};

const BASE = "https://geo.api.gouv.fr";

function searchUrl(geo: GeoLevel, q: string): string {
  const numeric = /^\d+$/.test(q);
  const e = encodeURIComponent(q);
  if (geo === "ville") {
    return numeric
      ? `${BASE}/communes?codePostal=${e}&fields=nom,code,codesPostaux,codeDepartement,codeRegion&limit=20`
      : `${BASE}/communes?nom=${e}&fields=nom,code,codesPostaux,codeDepartement,codeRegion&boost=population&limit=10`;
  }
  if (geo === "dept") {
    return numeric
      ? `${BASE}/departements?code=${e}&fields=nom,code,codeRegion&limit=10`
      : `${BASE}/departements?nom=${e}&fields=nom,code,codeRegion&limit=10`;
  }
  return numeric
    ? `${BASE}/regions?code=${e}&fields=nom,code&limit=10`
    : `${BASE}/regions?nom=${e}&fields=nom,code&limit=10`;
}

function targetLabel(t: GeoTarget): string {
  if (t.type === "ville") return `${t.nom}${t.codesPostaux[0] ? ` (${t.codesPostaux[0]})` : ""}`;
  if (t.type === "dept") return `${t.nom} (${t.code})`;
  return t.nom;
}

export function GeoTargetAutocomplete({
  geo,
  value,
  onPick,
}: {
  geo: GeoLevel;
  value: GeoTarget | null;
  onPick: (v: GeoTarget | null) => void;
}) {
  const { c } = useTheme();
  const [query, setQuery] = useState(value ? targetLabel(value) : "");
  const [items, setItems] = useState<ApiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Sélection posée (choix, brouillon, duplication) → libellé dans le champ.
  // Le changement d'échelle est géré par le parent via `key={geo}` (remontage).
  useEffect(() => {
    if (value) setQuery(targetLabel(value));
  }, [value]);

  // Recherche « debouncée » (220 ms, comme le web).
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 1) {
      setItems([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(searchUrl(geo, q));
        let data: ApiItem[] = r.ok ? ((await r.json()) as ApiItem[]) : [];
        if (!Array.isArray(data)) data = [];
        if (geo === "ville" && /^\d+$/.test(q)) {
          data = data.filter((it) => (it.codesPostaux ?? []).some((cp) => cp.startsWith(q)));
        }
        if (alive) setItems(data);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 220);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, geo, open]);

  async function pick(it: ApiItem) {
    setOpen(false);
    setItems([]);
    if (geo === "ville") {
      onPick({
        type: "ville",
        nom: it.nom,
        code: it.code,
        codesPostaux: Array.isArray(it.codesPostaux) ? it.codesPostaux : [],
        codeDepartement: it.codeDepartement ?? null,
        codeRegion: it.codeRegion ?? null,
      });
    } else if (geo === "dept") {
      onPick({ type: "dept", nom: it.nom, code: it.code, codeRegion: it.codeRegion ?? null });
    } else {
      let deptCodes: string[] = [];
      try {
        const r2 = await fetch(`${BASE}/regions/${encodeURIComponent(it.code)}/departements?fields=code`);
        if (r2.ok) {
          const dd = (await r2.json()) as { code: string }[];
          deptCodes = Array.isArray(dd) ? dd.map((d) => String(d.code)) : [];
        }
      } catch {
        /* réseau — la région reste sélectionnée sans filtre CP */
      }
      onPick({ type: "region", nom: it.nom, code: it.code, deptCodes });
    }
  }

  const placeholder =
    geo === "ville"
      ? "Nom d'une ville ou code postal (ex. Bordeaux, 33000)"
      : geo === "dept"
        ? "Nom ou code d'un département (ex. Gironde, 33)"
        : "Nom ou code d'une région (ex. Nouvelle-Aquitaine)";

  return (
    <View>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <TextInput
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setOpen(true);
            if (value) onPick(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          placeholderTextColor={c.textMuted}
          autoCorrect={false}
          style={{
            flex: 1,
            minWidth: 0,
            backgroundColor: c.field,
            borderColor: value ? c.accent : c.borderSoft,
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 11,
            fontSize: 14,
            color: c.text,
          }}
        />
        {value || query ? (
          <Pressable
            onPress={() => {
              onPick(null);
              setQuery("");
              setOpen(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Effacer"
            hitSlop={8}
            className="rounded-full px-3 py-2.5 active:opacity-70"
            style={{ borderWidth: 1, borderColor: c.borderSoft }}
          >
            <Text className="text-[13px] font-semibold text-ink-3">Effacer</Text>
          </Pressable>
        ) : null}
      </View>

      {value ? (
        <Text className="mt-1.5 text-[11.5px] text-ink-4">
          Sélectionné : <Text style={{ color: c.text, fontWeight: "600" }}>{value.nom}</Text>
          {value.type === "ville" && value.codesPostaux.length > 0
            ? ` · CP ${value.codesPostaux.slice(0, 3).join(", ")}${value.codesPostaux.length > 3 ? "…" : ""}`
            : ""}
          {value.type === "dept" ? ` · code ${value.code}` : ""}
          {value.type === "region" ? ` · ${value.deptCodes.length} départements` : ""}
        </Text>
      ) : (
        <Text className="mt-1.5 text-[11.5px] text-ink-4">
          Optionnel — sans sélection, la zone est centrée sur votre établissement.
        </Text>
      )}

      {open && query.trim().length >= 1 && !value ? (
        <View
          className="mt-2 overflow-hidden rounded-xl"
          style={{ borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.surface }}
        >
          {loading && items.length === 0 ? (
            <View className="flex-row items-center px-3.5 py-3" style={{ gap: 8 }}>
              <ActivityIndicator size="small" color={c.textMuted} />
              <Text className="text-[13px] text-ink-4">Recherche…</Text>
            </View>
          ) : null}
          {!loading && items.length === 0 ? (
            <Text className="px-3.5 py-3 text-[13px] text-ink-4">Aucun résultat.</Text>
          ) : null}
          {items.map((it, i) => {
            const right =
              geo === "ville"
                ? [(it.codesPostaux ?? []).slice(0, 2).join(", "), it.codeDepartement ?? ""]
                    .filter(Boolean)
                    .join(" · ")
                : geo === "dept"
                  ? it.code
                  : "";
            return (
              <Pressable
                key={`${geo}-${it.code}-${i}`}
                onPress={() => void pick(it)}
                accessibilityRole="button"
                className="flex-row items-center justify-between px-3.5 py-3 active:opacity-70"
                style={{ gap: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: c.borderSoft }}
              >
                <View className="flex-1 flex-row items-center" style={{ gap: 8 }}>
                  <Ionicons name="location-outline" size={15} color={c.textMuted} />
                  <Text className="flex-1 text-[14px] text-ink" numberOfLines={1}>
                    {it.nom}
                  </Text>
                </View>
                {right ? <Text className="font-mono text-[11.5px] text-ink-4">{right}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
