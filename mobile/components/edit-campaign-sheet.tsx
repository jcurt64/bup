// Sheet « Modifier une campagne en cours » — design premium repris de la
// maquette web (public/prototype/mod_files/Modifier la campagne - Modale.html) :
// barre d'accent indigo, en-tête réf + titre serif, note « élargir uniquement »,
// champ Vitrine, niveaux de vérification / fiabilité, pied Annuler / Enregistrer. Palette indigo fixe (modale
// premium, indépendante du thème). Icônes via Ionicons (react-native-svg est
// exclu du projet) ; titre en Fraunces (font-serif).
//
// Règle métier inchangée : on ne peut qu'ÉLARGIR (jamais restreindre) — lien
// Vitrine, niveau de vérification, fiabilité minimum,
// exclusion des anciens acceptants (retirable seulement). Le
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
import {
  campaignExcludesPastAcceptors,
  useEditCampaign,
  type EditCampaignBody,
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
  campaign_closed: "Cette campagne est clôturée : elle n'est plus modifiable.",
  nothing_to_update: "Aucune modification à enregistrer.",
  verif_not_widening: "Le niveau de vérification ne peut être qu'abaissé, pas durci.",
  verif_invalid: "Niveau de vérification invalide.",
  fiabilite_not_widening: "Le seuil de fiabilité ne peut être que baissé, pas relevé.",
  fiabilite_invalid: "Seuil de fiabilité invalide.",
  exclude_past_acceptors_not_widening:
    "L'exclusion des prospects ayant déjà accepté une de vos campagnes ne peut être que retirée, pas activée.",
};

// Niveaux de vérification (du plus large au plus strict) — libellés web.
const EDIT_VERIF_OPTS: { id: string; name: string; sub: string }[] = [
  { id: "p0", name: "Basique", sub: "Compte créé — email vérifié" },
  { id: "p1", name: "Vérifié", sub: "Numéro de téléphone vérifié par SMS" },
  { id: "p2", name: "Certifié confiance", sub: "Mise en relation validée par un pro" },
];
// Seuils de fiabilité minimum (du plus large au plus strict).
const EDIT_FIAB_OPTS: { v: number; name: string; sub: string }[] = [
  { v: 0, name: "Toutes", sub: "Aucun filtre de fiabilité" },
  { v: 60, name: "Fiabilité bonne", sub: "≥ 60 / 100" },
  { v: 80, name: "Fiabilité excellente", sub: "≥ 80 / 100" },
];

function parseErr(e: unknown): { code: string; message: string | null } {
  if (e instanceof ApiError) {
    try {
      const j = JSON.parse(e.body) as { error?: unknown; message?: unknown };
      return {
        code: typeof j?.error === "string" ? j.error : "",
        message: typeof j?.message === "string" ? j.message : null,
      };
    } catch {
      /* corps non JSON */
    }
  }
  return { code: "", message: null };
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
  const [verif, setVerif] = useState("p0");
  const [minFiab, setMinFiab] = useState(0);
  // Exclusion des anciens acceptants : décochable seulement (élargir).
  const [excludePast, setExcludePast] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) setLoadedId(null);
  }, [visible]);

  useEffect(() => {
    if (!d || d.id === loadedId) return;
    setSite((d.websiteUrl || "").replace(/^https?:\/\//i, ""));
    setVerif(d.targeting?.verifLevel || "p0");
    setMinFiab(Number(d.targeting?.minFiabilite ?? 0));
    setExcludePast(campaignExcludesPastAcceptors(d));
    setErr(null);
    setLoadedId(d.id);
  }, [d, loadedId]);

  const hasVitrine = !!d?.websiteUrl;
  const refLabel = d?.name || campId;

  const siteOriginal = (d?.websiteUrl || "").replace(/^https?:\/\//i, "");
  const siteTrim = site.trim().replace(/^https?:\/\//i, "");
  const siteChanged = hasVitrine && !!siteTrim && siteTrim !== siteOriginal;
  const baseVerif = d?.targeting?.verifLevel || "p0";
  const baseVerifRank = Math.max(0, EDIT_VERIF_OPTS.findIndex((v) => v.id === baseVerif));
  const baseFiab = Number(d?.targeting?.minFiabilite ?? 0);
  const verifChanged = verif !== baseVerif;
  const fiabChanged = minFiab !== baseFiab;
  const baseExcludePast = d ? campaignExcludesPastAcceptors(d) : false;
  const excludePastChanged = baseExcludePast && !excludePast;
  const canSubmit =
    !edit.isPending &&
    (siteChanged || verifChanged || fiabChanged || excludePastChanged);

  const submit = async () => {
    const body: EditCampaignBody = {};
    if (siteChanged) body.websiteUrl = "https://" + siteTrim;
    if (verifChanged) body.verifLevel = verif;
    if (fiabChanged) body.minFiabilite = minFiab;
    if (excludePastChanged) body.excludePastAcceptors = false;
    if (Object.keys(body).length === 0) {
      setErr(ERR_LABELS.nothing_to_update);
      return;
    }
    setErr(null);
    try {
      await edit.mutateAsync(body);
      onClose();
    } catch (e) {
      const { code, message } = parseErr(e);
      setErr(ERR_LABELS[code] || message || "Échec de l'enregistrement. Réessayez.");
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
            backgroundColor: C.card, borderRadius: 22, 
            shadowColor: "#161a1d", shadowOpacity: 0.28, shadowRadius: 40, shadowOffset: { width: 0, height: 24 }, elevation: 24,
          }}
        >
          {/* Rognage des coins sur une vue interne : l'ombre de la vue externe reste visible sur iOS (overflow:hidden l'efface), comme sur Android. */}
          <View style={{ borderRadius: 22, overflow: "hidden", flexShrink: 1 }}>
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

                  {/* 2) Niveau de vérification minimum — abaisser seulement */}
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

                  {/* 3) Fiabilité minimum — baisser le seuil seulement */}
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

                  {/* 4) Anciens acceptants — l'exclusion peut être retirée
                      (élargissement), jamais activée en cours de campagne. */}
                  <View style={{ marginTop: 22 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                      <Text style={{ fontSize: 11, color: C.ink3, ...MONO }}>Anciens acceptants</Text>
                      <View style={{ marginLeft: "auto", backgroundColor: C.indigoSoft, borderWidth: 1, borderColor: "rgba(90,87,214,0.22)", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 }}>
                        <Text style={{ fontSize: 10, color: C.indigoD, ...MONO }}>Actuel · {baseExcludePast ? "Exclus" : "Inclus"}</Text>
                      </View>
                    </View>
                    <Pressable
                      disabled={!baseExcludePast}
                      onPress={() => setExcludePast((v) => !v)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: excludePast, disabled: !baseExcludePast }}
                      style={{
                        flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1.5,
                        borderColor: excludePastChanged ? C.indigo : !baseExcludePast ? C.lineSoft : C.ink,
                        backgroundColor: excludePastChanged ? C.indigoXsoft : !baseExcludePast ? C.paper : "#fff",
                      }}
                    >
                      <Ionicons
                        name={excludePast ? "checkbox" : "square-outline"}
                        size={16}
                        color={!baseExcludePast ? C.ink4 : excludePastChanged ? C.indigo : C.ink}
                      />
                      <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "600", color: !baseExcludePast ? C.ink4 : excludePastChanged ? C.indigoD : C.ink }}>
                        Exclure les prospects ayant déjà accepté une de mes campagnes (12 derniers mois)
                      </Text>
                      {!baseExcludePast ? <Ionicons name="lock-closed" size={12} color={C.ink4} /> : null}
                    </Pressable>
                    <Text style={{ fontSize: 12, color: C.ink3, marginTop: 9, lineHeight: 17 }}>
                      {baseExcludePast
                        ? "Décochez pour solliciter aussi les prospects ayant déjà accepté une de vos campagnes."
                        : "Option non activée : elle ne peut pas être ajoutée à une campagne en cours."}
                    </Text>
                  </View>

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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
