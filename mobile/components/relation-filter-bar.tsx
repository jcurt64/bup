// Barre de filtres des sollicitations en attente — réplique mobile de
// RelFilterBar (Prospect.jsx) : 4 chips déroulants (Montant / Date / Palier /
// Autour de moi) avec compteur par option, bascule Flash deals, « Sans
// filtre », compteur « X / Y résultats » et bande des filtres actifs.
// Sur mobile, un chip ouvre une bottom-sheet d'options (au lieu d'un menu).
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import {
  REL_FILTERS,
  relFiltersActive,
  relMatchFilter,
  type RelFilterId,
  type RelFilterValues,
} from "../lib/relation-filters";
import type { Relation } from "../lib/queries";
import { useTheme } from "../lib/theme";

// Rouge « flash » (identique au web RF.flash / RF.flashD).
const FLASH = "#D6432F";
const FLASH_D = "#B8341F";

export function RelationFilterBar({
  values,
  onChange,
  pending,
  filteredCount,
}: {
  values: RelFilterValues;
  onChange: (next: RelFilterValues) => void;
  pending: Relation[];
  filteredCount: number;
}) {
  const { c, isDark } = useTheme();
  const [open, setOpen] = useState<RelFilterId | null>(null);
  const total = pending.length;
  const flashCount = pending.filter((p) => p.isFlashDeal).length;
  const active = relFiltersActive(values);
  const set = (id: RelFilterId, v: string) => onChange({ ...values, [id]: v });
  const reset = () =>
    onChange({ amount: "all", date: "all", tier: "all", distance: "all", flash: false });
  const flashSoft = isDark ? "rgba(214,67,47,0.18)" : "#F7E0DD";

  const openDef = REL_FILTERS.find((f) => f.id === open) ?? null;

  const tags: { id: RelFilterId | "flash"; label: string }[] = [];
  for (const f of REL_FILTERS) {
    const v = values[f.id];
    if (v !== "all") {
      const o = f.opts.find((x) => x.v === v);
      tags.push({ id: f.id, label: `${f.label} : ${o ? o.short : v}` });
    }
  }
  if (values.flash) tags.push({ id: "flash", label: "Flash deals" });

  return (
    <View
      style={{
        borderRadius: 20,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.borderSoft,
        padding: 14,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {REL_FILTERS.map((f) => {
          const v = values[f.id];
          const on = v !== "all";
          const short = (f.opts.find((o) => o.v === v) ?? f.opts[0]).short;
          return (
            <Pressable
              key={f.id}
              onPress={() => setOpen(f.id)}
              accessibilityRole="button"
              accessibilityLabel={`Filtre ${f.label} : ${short}`}
              className="active:opacity-80"
              style={{
                width: "48.5%",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 9,
                paddingHorizontal: 12,
                borderRadius: 11,
                borderWidth: 1,
                borderColor: on ? c.accVioletDeep : c.borderSoft,
                backgroundColor: on ? c.tintViolet : c.surface,
              }}
            >
              {on ? (
                <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: c.accViolet }} />
              ) : null}
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text
                  numberOfLines={1}
                  className="font-mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    color: on ? c.accViolet : c.textMuted,
                  }}
                >
                  {f.label}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 13.5, fontWeight: "600", color: on ? c.accVioletDeep : c.text }}
                >
                  {short}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={14} color={on ? c.accViolet : c.textMuted} />
            </Pressable>
          );
        })}

        {/* Flash deals */}
        <Pressable
          onPress={() => onChange({ ...values, flash: !values.flash })}
          accessibilityRole="button"
          accessibilityState={{ selected: values.flash }}
          className="active:opacity-80"
          style={{
            width: "48.5%",
            minHeight: 46,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            borderRadius: 11,
            borderWidth: 1,
            borderColor: values.flash ? FLASH : "rgba(214,67,47,0.34)",
            backgroundColor: values.flash ? FLASH : c.surface,
          }}
        >
          <Ionicons name="flash" size={14} color={values.flash ? "#fff" : FLASH_D} />
          <Text style={{ fontSize: 13.5, fontWeight: "600", color: values.flash ? "#fff" : FLASH_D }}>
            Flash deals
          </Text>
          <View
            style={{
              paddingHorizontal: 7,
              paddingVertical: 1,
              borderRadius: 999,
              backgroundColor: values.flash ? "rgba(255,255,255,0.22)" : flashSoft,
            }}
          >
            <Text
              className="font-mono"
              style={{ fontSize: 11, fontWeight: "600", color: values.flash ? "#fff" : FLASH_D }}
            >
              {flashCount}
            </Text>
          </View>
        </Pressable>

        {/* Sans filtre (plein quand aucun filtre actif) */}
        <Pressable
          onPress={reset}
          accessibilityRole="button"
          className="active:opacity-80"
          style={{
            width: "48.5%",
            minHeight: 46,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            borderRadius: 11,
            borderWidth: 1,
            borderColor: active ? c.borderSoft : c.btnBg,
            backgroundColor: active ? c.surface : c.btnBg,
          }}
        >
          <Ionicons name="funnel-outline" size={14} color={active ? c.textSub : c.btnText} />
          <Text style={{ fontSize: 13.5, fontWeight: "600", color: active ? c.textSub : c.btnText }}>
            Sans filtre
          </Text>
        </Pressable>
      </View>

      {/* Réinitialiser + compteur */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 14,
          marginTop: 2,
        }}
      >
        {active ? (
          <Pressable
            onPress={reset}
            accessibilityRole="button"
            className="active:opacity-70"
            style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
          >
            <Ionicons name="refresh" size={13} color={c.textSub} />
            <Text style={{ fontSize: 13, fontWeight: "500", color: c.textSub }}>Réinitialiser</Text>
          </Pressable>
        ) : null}
        <Text className="font-mono" style={{ fontSize: 12.5, color: c.textSub }}>
          <Text style={{ fontWeight: "600", color: c.text }}>{filteredCount}</Text> / {total} résultat
          {total > 1 ? "s" : ""}
        </Text>
      </View>

      {/* Bande des filtres actifs */}
      {tags.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7 }}>
          <Text
            className="font-mono"
            style={{ fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: c.textMuted }}
          >
            Actifs
          </Text>
          {tags.map((t) => {
            const isFlash = t.id === "flash";
            return (
              <View
                key={t.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 4,
                  paddingLeft: 10,
                  paddingRight: 5,
                  borderRadius: 999,
                  backgroundColor: isFlash ? flashSoft : c.tintViolet,
                  borderWidth: 1,
                  borderColor: isFlash ? "rgba(214,67,47,0.32)" : c.violetSoft,
                }}
              >
                {isFlash ? <Ionicons name="flash" size={11} color={FLASH_D} /> : null}
                <Text
                  style={{ fontSize: 12.5, fontWeight: "500", color: isFlash ? FLASH_D : c.accVioletDeep }}
                >
                  {t.label}
                </Text>
                <Pressable
                  onPress={() =>
                    t.id === "flash"
                      ? onChange({ ...values, flash: false })
                      : set(t.id as RelFilterId, "all")
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Retirer le filtre ${t.label}`}
                  hitSlop={8}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isFlash ? "rgba(214,67,47,0.16)" : "rgba(90,87,214,0.14)",
                  }}
                >
                  <Ionicons name="close" size={11} color={isFlash ? FLASH_D : c.accVioletDeep} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Options du chip ouvert */}
      <BottomSheet visible={open !== null} onClose={() => setOpen(null)}>
        {openDef ? (
          <View style={{ gap: 4, paddingBottom: 8 }}>
            <Text
              className="font-mono"
              style={{
                fontSize: 11,
                letterSpacing: 1.3,
                textTransform: "uppercase",
                color: c.textMuted,
                marginBottom: 6,
              }}
            >
              {openDef.label}
            </Text>
            {openDef.opts.map((o) => {
              const sel = values[openDef.id] === o.v;
              const count = pending.filter((p) => relMatchFilter(p, openDef.id, o.v)).length;
              return (
                <Pressable
                  key={o.v}
                  onPress={() => {
                    set(openDef.id, o.v);
                    setOpen(null);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  className="active:opacity-70"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 13,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: sel ? c.tintViolet : "transparent",
                  }}
                >
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color={c.accViolet}
                    style={{ opacity: sel ? 1 : 0 }}
                  />
                  <Text
                    style={{ flex: 1, fontSize: 15, fontWeight: sel ? "600" : "400", color: c.text }}
                  >
                    {o.t}
                  </Text>
                  <Text
                    className="font-mono"
                    style={{ fontSize: 12, color: sel ? c.accViolet : c.textMuted }}
                  >
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}
