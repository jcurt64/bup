// Sheet « Modifier une campagne en cours » — design premium repris de la
// maquette web (public/prototype/mod_files/Modifier la campagne - Modale.html) :
// barre d'accent indigo, en-tête réf + titre serif, note « élargir uniquement »,
// champ Vitrine, ÉCHELLE géo à 4 paliers (verrouillé / actuelle / ajouté), pills
// d'âge + légende, pied Annuler / Enregistrer. Palette indigo fixe (modale
// premium, indépendante du thème). Icônes via Ionicons (react-native-svg est
// exclu du projet) ; titre en Fraunces (font-serif).
//
// Règle métier inchangée : on ne peut qu'ÉLARGIR (jamais restreindre) — lien
// Vitrine, zone géo, tranche d'âge, niveau de vérification, fiabilité minimum. Le
// serveur applique le garde-fou (cf. lib/campaigns/edit-targeting.ts côté web).
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ApiError, useApi } from "../lib/api";
import { AGE_RANGES_NO_TOUS } from "../lib/pro-pricing";
import {
  useEditCampaign,
  type EditCampaignBody,
  type EditCampaignGeo,
  type ProCampaignDetail,
} from "../lib/queries";

// Palette EXACTE de la maquette (mod_files/Modifier la campagne - Modale.html).
const C = {
  paper: "#f4f1ea",
  paperWarm: "#efeadd",
  card: "#fffdf8",
  ink: "#161a1d",
  ink2: "#3c444b",
  ink3: "#757d83",
  ink4: "#9aa0a4",
  line: "rgba(22,26,29,0.10)",
  lineSoft: "rgba(22,26,29,0.06)",
  indigo: "#5a57d6",
  indigoD: "#4744bf",
  indigoSoft: "#ecebfb",
  indigoXsoft: "#f4f3fd",
  red: "#B91C1C",
};

const ERR_LABELS: Record<string, string> = {
  vitrine_not_subscribed: "L'option Vitrine n'a pas été souscrite pour cette campagne.",
  invalid_website: "Lien de site invalide (https requis).",
  age_not_widening: "La tranche d'âge ne peut être qu'élargie, pas restreinte.",
  geo_not_widening: "La zone ne peut être qu'élargie, pas restreinte.",
  geo_invalid: "Élargissement de zone invalide.",
  geo_resolve_failed: "Impossible de résoudre la zone élargie. Réessayez.",
  campaign_closed: "Cette campagne est clôturée : elle n'est plus modifiable.",
  nothing_to_update: "Aucune modification à enregistrer.",
  verif_not_widening: "Le niveau de vérification ne peut être qu'abaissé, pas durci.",
  verif_invalid: "Niveau de vérification invalide.",
  fiabilite_not_widening: "Le seuil de fiabilité ne peut être que baissé, pas relevé.",
  fiabilite_invalid: "Seuil de fiabilité invalide.",
};

// Niveaux de vérification (du plus large au plus strict) — libellés web.
const EDIT_VERIF_OPTS: { id: string; name: string; sub: string }[] = [
  { id: "p0", name: "Basique", sub: "Compte créé — email vérifié" },
  { id: "p1", name: "Vérifié", sub: "Numéro de téléphone vérifié par SMS" },
  { id: "p2", name: "Certifié confiance", sub: "Rendez-vous physique accepté" },
];
// Seuils de fiabilité minimum (du plus large au plus strict).
const EDIT_FIAB_OPTS: { v: number; name: string; sub: string }[] = [
  { v: 0, name: "Toutes", sub: "Aucun filtre de fiabilité" },
  { v: 60, name: "Fiabilité bonne", sub: "≥ 60 / 100" },
  { v: 80, name: "Fiabilité excellente", sub: "≥ 80 / 100" },
];

type GeoStep = { lab: string; sub: string; kind: "around" | "zone" | "national"; radiusKm?: number; level?: "dept" | "region" | "ville" };
type GeoModel = { steps: GeoStep[]; currentIndex: number; curLabel: string };

// Échelle géo à 4 paliers (miroir de la maquette). Le mode « around »
// (rayon autour de moi) suit la même mécanique d'échelle.
function buildGeoModel(d: ProCampaignDetail): GeoModel {
  const geo = d.targeting?.geo || null;
  const radius = d.targeting?.radiusKm ?? null;
  if (geo === "around") {
    const radii = [10, 30, 50];
    const steps: GeoStep[] = [
      ...radii.map((r): GeoStep => ({ lab: `${r} km`, sub: "Autour de moi", kind: "around", radiusKm: r })),
      { lab: "National", sub: "France entière", kind: "national" },
    ];
    let ci = radii.indexOf(Number(radius));
    if (ci < 0) ci = 0;
    return { steps, currentIndex: ci, curLabel: `${radii[ci]} km` };
  }
  const steps: GeoStep[] = [
    { lab: "Ville", sub: "~20 km", kind: "zone", level: "ville" },
    { lab: "Département", sub: "~50 km", kind: "zone", level: "dept" },
    { lab: "Région", sub: "~150 km", kind: "zone", level: "region" },
    { lab: "National", sub: "France entière", kind: "national" },
  ];
  const idx = ({ ville: 0, dept: 1, region: 2, national: 3 } as Record<string, number>)[geo ?? ""];
  const ci = idx == null ? 3 : idx;
  return { steps, currentIndex: ci, curLabel: steps[ci].lab };
}

function geoPayloadForStep(step: GeoStep): EditCampaignGeo {
  if (step.kind === "national") return { mode: "national" };
  if (step.kind === "around") return { mode: "around", radiusKm: step.radiusKm as number };
  return { mode: "zone", level: step.level as "dept" | "region" };
}

function parseErrCode(e: unknown): string {
  if (e instanceof ApiError) {
    try {
      const j = JSON.parse(e.body) as { error?: string };
      if (j?.error) return j.error;
    } catch {
      /* corps non JSON */
    }
  }
  return "";
}

// Libellé « mono » de la maquette (capitales + interlettrage).
const MONO = { letterSpacing: 1.3, textTransform: "uppercase" as const };

// Cartes de niveau (vérification / fiabilité) : les options plus strictes que
// l'actuelle sont verrouillées (élargir seulement, parité modale web).
function LevelCards({
  title,
  current,
  options,
  help,
}: {
  title: string;
  current: string;
  options: {
    key: string;
    name: string;
    sub: string;
    locked: boolean;
    isBase: boolean;
    selected: boolean;
    onPress: () => void;
  }[];
  help: string;
}) {
  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <Text style={{ fontSize: 11, color: C.ink3, ...MONO }}>{title}</Text>
        <View style={{ marginLeft: "auto", backgroundColor: C.indigoSoft, borderWidth: 1, borderColor: "rgba(90,87,214,0.22)", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 }}>
          <Text style={{ fontSize: 10, color: C.indigoD, ...MONO }}>Actuel · {current}</Text>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        {options.map((o) => {
          const added = o.selected && !o.isBase;
          return (
            <Pressable
              key={o.key}
              disabled={o.locked}
              onPress={o.onPress}
              accessibilityState={{ disabled: o.locked, selected: o.selected }}
              style={{
                flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1.5,
                borderColor: added ? C.indigo : o.selected ? C.ink : o.locked ? C.lineSoft : C.line,
                backgroundColor: added ? C.indigoXsoft : o.locked ? C.paper : "#fff",
              }}
            >
              <Ionicons
                name={o.locked ? "lock-closed" : o.selected ? "checkmark-circle" : "ellipse-outline"}
                size={16}
                color={o.locked ? C.ink4 : added ? C.indigo : o.selected ? C.ink : C.ink3}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13.5, fontWeight: "600", color: o.locked ? C.ink4 : added ? C.indigoD : C.ink }}>
                  {o.name}
                  {o.isBase ? <Text style={{ fontSize: 10, color: C.ink3 }}>{"  "}ACTUEL</Text> : null}
                </Text>
                <Text style={{ fontSize: 11.5, color: C.ink3, marginTop: 2 }}>{o.sub}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ fontSize: 12, color: C.ink3, marginTop: 9, lineHeight: 17 }}>{help}</Text>
    </View>
  );
}

export function EditCampaignSheet({
  campId,
  visible,
  onClose,
}: {
  campId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const api = useApi();
  const edit = useEditCampaign(campId);

  const detailQ = useQuery({
    queryKey: ["pro", "campaign", campId],
    queryFn: () => api<ProCampaignDetail>(`/api/pro/campaigns/${campId}`),
    enabled: visible && !!campId,
    staleTime: 30_000,
  });
  const d = detailQ.data;

  const [site, setSite] = useState("");
  const [chosenIndex, setChosenIndex] = useState(0);
  const [ages, setAges] = useState<Set<string>>(() => new Set());
  const [locked, setLocked] = useState<Set<string>>(() => new Set());
  const [verif, setVerif] = useState("p0");
  const [minFiab, setMinFiab] = useState(0);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) setLoadedId(null);
  }, [visible]);

  useEffect(() => {
    if (!d || d.id === loadedId) return;
    setSite((d.websiteUrl || "").replace(/^https?:\/\//i, ""));
    const cur = Array.isArray(d.targeting?.ages) ? d.targeting.ages : [];
    const isAll = cur.length === 0 || cur.includes("Tous") || AGE_RANGES_NO_TOUS.every((b) => cur.includes(b));
    const init = new Set(isAll ? AGE_RANGES_NO_TOUS : cur.filter((a) => a !== "Tous"));
    setAges(new Set(init));
    setLocked(new Set(init));
    const gm = buildGeoModel(d);
    setChosenIndex(gm.currentIndex);
    setVerif(d.targeting?.verifLevel || "p0");
    setMinFiab(Number(d.targeting?.minFiabilite ?? 0));
    setErr(null);
    setLoadedId(d.id);
  }, [d, loadedId]);

  const geoModel = d ? buildGeoModel(d) : null;
  const ci = geoModel ? geoModel.currentIndex : 0;
  const lastIndex = geoModel ? geoModel.steps.length - 1 : 0;
  const hasVitrine = !!d?.websiteUrl;
  const refLabel = d?.name || campId;

  const toggleAge = (b: string) => {
    if (locked.has(b)) return;
    setAges((prev) => {
      const n = new Set(prev);
      if (n.has(b)) n.delete(b);
      else n.add(b);
      return n;
    });
  };

  const siteOriginal = (d?.websiteUrl || "").replace(/^https?:\/\//i, "");
  const siteTrim = site.trim().replace(/^https?:\/\//i, "");
  const siteChanged = hasVitrine && !!siteTrim && siteTrim !== siteOriginal;
  const selectedAges = AGE_RANGES_NO_TOUS.filter((b) => ages.has(b));
  const agesChanged = selectedAges.length > locked.size;
  const geoChanged = !!geoModel && chosenIndex > ci;
  const baseVerif = d?.targeting?.verifLevel || "p0";
  const baseVerifRank = Math.max(0, EDIT_VERIF_OPTS.findIndex((v) => v.id === baseVerif));
  const baseFiab = Number(d?.targeting?.minFiabilite ?? 0);
  const verifChanged = verif !== baseVerif;
  const fiabChanged = minFiab !== baseFiab;
  const canSubmit =
    !edit.isPending && (siteChanged || agesChanged || geoChanged || verifChanged || fiabChanged);

  const geoHelp = geoChanged
    ? `Cible élargie à « ${geoModel!.steps[chosenIndex].lab} ». Les zones plus étroites restent couvertes.`
    : ci >= lastIndex
      ? "Zone déjà à son maximum — France entière."
      : "Sélectionnez une zone plus large pour élargir la diffusion.";

  const submit = async () => {
    const body: EditCampaignBody = {};
    if (siteChanged) body.websiteUrl = "https://" + siteTrim;
    if (agesChanged) body.ages = selectedAges;
    if (geoChanged) body.geo = geoPayloadForStep(geoModel!.steps[chosenIndex]);
    if (verifChanged) body.verifLevel = verif;
    if (fiabChanged) body.minFiabilite = minFiab;
    if (Object.keys(body).length === 0) {
      setErr(ERR_LABELS.nothing_to_update);
      return;
    }
    setErr(null);
    try {
      await edit.mutateAsync(body);
      onClose();
    } catch (e) {
      const code = parseErrCode(e);
      setErr(ERR_LABELS[code] || "Échec de l'enregistrement. Réessayez.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* Fond et carte sont FRÈRES : envelopper le ScrollView dans un
          Pressable lui volait les gestes (défilement bloqué). */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}
      >
        <Pressable
          onPress={() => !edit.isPending && onClose()}
          accessibilityLabel="Fermer"
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(22,26,29,0.42)" }]}
        />
        <View
          style={{
            width: "100%", maxWidth: 460, maxHeight: "90%",
            backgroundColor: C.card, borderRadius: 22, overflow: "hidden",
            shadowColor: "#161a1d", shadowOpacity: 0.28, shadowRadius: 40, shadowOffset: { width: 0, height: 24 }, elevation: 24,
          }}
        >
          {/* Barre d'accent indigo (haut de carte) */}
          <LinearGradient colors={[C.indigoD, C.indigo, "#8a88ea"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 4 }} />

          <ScrollView
            contentContainerStyle={{ padding: 24, paddingBottom: 22 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {/* En-tête : réf + titre + fermer */}
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: C.ink4, ...MONO }} numberOfLines={1}>Campagne · {refLabel}</Text>
                <Text className="font-serif" style={{ fontSize: 25, color: C.ink, marginTop: 6 }}>Modifier la campagne</Text>
              </View>
              <Pressable
                onPress={() => !edit.isPending && onClose()}
                style={{ width: 32, height: 32, borderRadius: 9, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" size={16} color={C.ink3} />
              </Pressable>
            </View>

            {/* Note « élargir uniquement » */}
            <View style={{ flexDirection: "row", gap: 11, marginTop: 16, padding: 13, borderRadius: 13, backgroundColor: C.indigoXsoft, borderWidth: 1, borderColor: "rgba(90,87,214,0.18)" }}>
              <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(90,87,214,0.26)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="expand" size={14} color={C.indigoD} />
              </View>
              <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: C.ink2 }}>
                Vous pouvez uniquement <Text style={{ color: C.indigoD, fontWeight: "700" }}>élargir</Text> la cible — jamais la restreindre. Les prospects déjà sollicités ne sont pas affectés.
              </Text>
            </View>

            {!d && detailQ.isLoading ? (
              <View style={{ paddingVertical: 28, alignItems: "center" }}><ActivityIndicator color={C.indigo} /></View>
            ) : null}
            {detailQ.isError ? (
              <Text style={{ marginTop: 16, fontSize: 13, color: C.red }}>Impossible de charger la campagne.</Text>
            ) : null}

            {d ? (
              <>
                {/* 1) Lien Vitrine */}
                {hasVitrine ? (
                  <View style={{ marginTop: 22 }}>
                    <Text style={{ fontSize: 11, color: C.ink3, marginBottom: 10, ...MONO }}>Lien de votre site (vitrine)</Text>
                    <View style={{ flexDirection: "row", alignItems: "stretch", borderWidth: 1.5, borderColor: C.line, borderRadius: 13, overflow: "hidden", backgroundColor: "#fff" }}>
                      <View style={{ justifyContent: "center", paddingHorizontal: 15, backgroundColor: C.paperWarm, borderRightWidth: 1, borderRightColor: C.line }}>
                        <Text style={{ fontSize: 13, color: C.ink3 }}>https://</Text>
                      </View>
                      <TextInput
                        value={site}
                        onChangeText={(t) => setSite(t.replace(/^https?:\/\//i, ""))}
                        placeholder="www.exemple.com"
                        placeholderTextColor={C.ink4}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: C.ink }}
                      />
                    </View>
                  </View>
                ) : null}

                {/* 2) Zone géographique — échelle 4 paliers */}
                {geoModel ? (
                  <View style={{ marginTop: 22 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                      <Text style={{ fontSize: 11, color: C.ink3, ...MONO }}>Zone géographique</Text>
                      <View style={{ marginLeft: "auto", backgroundColor: C.indigoSoft, borderWidth: 1, borderColor: "rgba(90,87,214,0.22)", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 }}>
                        <Text style={{ fontSize: 10, color: C.indigoD, ...MONO }}>Actuelle · {geoModel.curLabel}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {geoModel.steps.map((s, i) => {
                        const isLocked = i < ci;
                        const isCurrent = i === ci;
                        const isAdded = i > ci && i <= chosenIndex;
                        const isChosen = i === chosenIndex && i > ci;
                        const labColor = isLocked ? C.ink4 : isAdded ? C.indigoD : C.ink;
                        const subColor = isAdded ? C.indigo : C.ink4;
                        return (
                          <Pressable
                            key={i}
                            onPress={() => { if (i <= ci) return; setChosenIndex(chosenIndex === i ? ci : i); }}
                            style={{
                              width: "48%", position: "relative", paddingVertical: 12, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1.5,
                              borderColor: isCurrent ? C.ink : isAdded ? C.indigo : isLocked ? C.lineSoft : C.line,
                              backgroundColor: isAdded ? C.indigoXsoft : isLocked ? C.paper : "#fff",
                            }}
                          >
                            {(isCurrent || isChosen) ? (
                              <View style={{ position: "absolute", top: -8, left: 11, backgroundColor: isChosen ? C.indigo : C.ink, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 }}>
                                <Text style={{ fontSize: 8.5, color: "#fff", ...MONO }}>{isChosen ? "Nouvelle cible" : "Actuelle"}</Text>
                              </View>
                            ) : null}
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text style={{ fontSize: 13.5, fontWeight: "600", color: labColor }}>{s.lab}</Text>
                              {isLocked ? <Ionicons name="lock-closed" size={12} color={C.ink4} /> : null}
                            </View>
                            <Text style={{ fontSize: 10, color: subColor, marginTop: 4, letterSpacing: 0.2 }}>{s.sub}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text style={{ fontSize: 12, color: C.ink3, marginTop: 9, lineHeight: 17 }}>{geoHelp}</Text>
                  </View>
                ) : null}

                {/* 3) Tranche d'âge — pills + légende */}
                <View style={{ marginTop: 22 }}>
                  <Text style={{ fontSize: 11, color: C.ink3, marginBottom: 10, ...MONO }}>Tranche d&apos;âge</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {AGE_RANGES_NO_TOUS.map((b) => {
                      const isBase = locked.has(b);
                      const isAdded = !isBase && ages.has(b);
                      return (
                        <Pressable
                          key={b}
                          onPress={() => toggleAge(b)}
                          style={{
                            flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5,
                            borderColor: isAdded ? C.indigo : isBase ? C.lineSoft : C.line,
                            backgroundColor: isAdded ? C.indigo : isBase ? C.paper : "#fff",
                          }}
                        >
                          <Text style={{ fontSize: 13.5, fontWeight: "600", color: isAdded ? "#fff" : isBase ? C.ink3 : C.ink2 }}>{b}</Text>
                          {isBase ? (
                            <Ionicons name="lock-closed" size={12} color={C.ink4} />
                          ) : isAdded ? (
                            <Ionicons name="checkmark" size={14} color="#fff" />
                          ) : (
                            <Ionicons name="add" size={14} color={C.ink3} />
                          )}
                        </Pressable>
                      );
                    })}
                    {/* « Tous » : coche toutes les tranches (élargissement max). */}
                    {(() => {
                      const allSel = AGE_RANGES_NO_TOUS.every((b) => ages.has(b));
                      return (
                        <Pressable
                          onPress={() => setAges(new Set(AGE_RANGES_NO_TOUS))}
                          style={{
                            flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5,
                            borderColor: allSel ? C.indigo : C.line,
                            backgroundColor: allSel ? C.indigo : "#fff",
                          }}
                        >
                          <Text style={{ fontSize: 13.5, fontWeight: "600", color: allSel ? "#fff" : C.ink2 }}>Tous</Text>
                          <Ionicons name={allSel ? "checkmark" : "add"} size={14} color={allSel ? "#fff" : C.ink3} />
                        </Pressable>
                      );
                    })()}
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 11 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 11, height: 11, borderRadius: 4, backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.lineSoft }} />
                      <Text style={{ fontSize: 11.5, color: C.ink3 }}>Déjà ciblée (verrouillée)</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 11, height: 11, borderRadius: 4, backgroundColor: C.indigo }} />
                      <Text style={{ fontSize: 11.5, color: C.ink3 }}>Ajoutée</Text>
                    </View>
                  </View>
                </View>

                {/* 4) Niveau de vérification minimum — abaisser seulement */}
                <LevelCards
                  title="Niveau de vérification minimum"
                  current={EDIT_VERIF_OPTS[baseVerifRank]?.name ?? "—"}
                  options={EDIT_VERIF_OPTS.map((v, i) => ({
                    key: v.id,
                    name: v.name,
                    sub: v.sub,
                    locked: i > baseVerifRank,
                    isBase: v.id === baseVerif,
                    selected: verif === v.id,
                    onPress: () => setVerif(v.id),
                  }))}
                  help="Vous pouvez abaisser l'exigence pour élargir la cible, jamais la durcir."
                />

                {/* 5) Fiabilité minimum — baisser le seuil seulement */}
                <LevelCards
                  title="Fiabilité minimum"
                  current={EDIT_FIAB_OPTS.find((o) => o.v === baseFiab)?.name ?? `≥ ${baseFiab}`}
                  options={EDIT_FIAB_OPTS.map((o) => ({
                    key: String(o.v),
                    name: o.name,
                    sub: o.sub,
                    locked: o.v > baseFiab,
                    isBase: o.v === baseFiab,
                    selected: minFiab === o.v,
                    onPress: () => setMinFiab(o.v),
                  }))}
                  help="Baissez le seuil pour toucher davantage de prospects ; il ne peut pas être relevé."
                />

                {err ? (
                  <View style={{ marginTop: 16, padding: 11, borderRadius: 12, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" }}>
                    <Text style={{ fontSize: 13, color: C.red }}>{err}</Text>
                  </View>
                ) : null}
              </>
            ) : null}

            {/* Pied : Annuler (secondaire) / Enregistrer (principal, dégradé
                indigo de la modale). Même hauteur, coins pilule, état
                désactivé explicite tant qu'aucun élargissement n'est choisi. */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 26, paddingTop: 20, borderTopWidth: 1, borderTopColor: C.line }}>
              <Pressable
                onPress={() => !edit.isPending && onClose()}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flex: 1, height: 52, borderRadius: 999, alignItems: "center", justifyContent: "center",
                  borderWidth: 1.5, borderColor: C.line, backgroundColor: pressed ? C.paperWarm : "#fff",
                })}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: C.ink2 }}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={!canSubmit}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmit }}
                style={({ pressed }) => ({
                  flex: 1.6, height: 52, borderRadius: 999, overflow: "hidden",
                  opacity: canSubmit ? (pressed ? 0.85 : 1) : 1,
                  shadowColor: C.indigoD, shadowOpacity: canSubmit ? 0.3 : 0, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
                  elevation: canSubmit ? 4 : 0,
                })}
              >
                {canSubmit ? (
                  <LinearGradient
                    colors={[C.indigoD, C.indigo]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    {edit.isPending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    )}
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
                      {edit.isPending ? "Enregistrement…" : "Enregistrer"}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.paperWarm, borderRadius: 999 }}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={C.ink4} />
                    <Text style={{ fontSize: 15, fontWeight: "600", color: C.ink4 }}>Enregistrer</Text>
                  </View>
                )}
              </Pressable>
            </View>
            {!canSubmit && d ? (
              <Text style={{ marginTop: 10, fontSize: 11.5, color: C.ink4, textAlign: "center" }}>
                Élargissez au moins un critère pour enregistrer.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
