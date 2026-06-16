// Contacts acquis — /api/pro/contacts. E-mail/téléphone renvoyés MASQUÉS par
// le serveur (alias watermarqué / numéro tronqué) : l'app affiche ce que l'API
// renvoie, jamais les vraies coordonnées brutes (invariant RGPD/anti-fraude —
// cf. MOBILE_APP_SPEC §6.4).
//
// Design : maquette co.html (liste) + co2.html (détail). Titre, carte
// « Filtres combinés », puis contacts groupés par campagne sous forme de
// cartes (cf. components/contact-cards.tsx) et fiche détail en bottom-sheet
// (cf. components/contact-detail-sheet.tsx). Les maquettes sont en thème
// forest ; toutes les couleurs vives passent par useContactPalette pour
// s'adapter aux thèmes buupp / sombre / fushia.
//
// ATELIER DE SEGMENTATION (parité web) : quand une campagne (clôturée) est
// sélectionnée, on affiche au-dessus de la liste un panneau « Audience »
// (distributions des facettes), une barre de filtres/recherche et les segments
// enregistrés. La liste est alors filtrée CÔTÉ SERVEUR. Sans campagne active,
// le comportement existant (toutes les lignes + filtres locaux) est conservé.
import { useMemo, useRef, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { QueryGate, ScrollScreen } from "../../components/screen";
import {
  ContactCard,
  FILTERS,
  FiltersCard,
  GroupHeader,
  type FilterKey,
} from "../../components/contact-cards";
import { Ionicons } from "@expo/vector-icons";
import {
  ContactDetailSheet,
  useContactPalette,
} from "../../components/contact-detail-sheet";
import {
  useProAudience,
  useProContacts,
  useProContactsFiltered,
  useProSegmentCreate,
  useProSegmentDelete,
  useProSegmentBroadcast,
  useProGroupReveal,
  type BroadcastResult,
  type AudienceFacets,
  type ProAudience,
  type ProContact,
  type ProSegment,
  type SegmentFilters,
} from "../../lib/queries";

type Palette = ReturnType<typeof useContactPalette>;

// Clés catégorielles + libellé affiché (ordre de la maquette web).
const CATEGORICAL: { key: keyof SegmentFilters & keyof AudienceFacets; title: string }[] = [
  { key: "region", title: "Région" },
  { key: "distance", title: "Distance du centre" },
  { key: "statutPro", title: "Statut pro" },
  { key: "logement", title: "Logement" },
  { key: "foyer", title: "Foyer" },
  { key: "vehicule", title: "Véhicule" },
  { key: "animaux", title: "Animaux" },
];

// ── Chip générique (pilule tappable) ──────────────────────────────────────
function Chip({
  label,
  on,
  onPress,
  p,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  p: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-70"
      style={{
        paddingVertical: 7,
        paddingHorizontal: 13,
        borderRadius: 999,
        backgroundColor: on ? p.accent : p.card,
        borderWidth: on ? 0 : 1.5,
        borderColor: p.border,
      }}
    >
      <Text
        style={{ fontSize: 12.5, fontWeight: "600", color: on ? "#FFFFFF" : p.text }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Bloc de facette (titre + lignes valeur | barre | compte) ───────────────
function FacetBlock({
  title,
  items,
  p,
}: {
  title: string;
  items: { value: string; count: number }[];
  p: Palette;
}) {
  if (!items.length) return null;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <View style={{ gap: 7 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.6,
          color: p.muted,
          textTransform: "uppercase",
        }}
      >
        {title}
      </Text>
      {items.map((it) => (
        <View
          key={it.value}
          className="flex-row items-center"
          style={{ gap: 9 }}
        >
          <Text
            style={{ fontSize: 12, color: p.sub, width: 96 }}
            numberOfLines={1}
          >
            {it.value}
          </Text>
          <View
            style={{
              flex: 1,
              height: 8,
              borderRadius: 999,
              backgroundColor: p.field,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${(it.count / max) * 100}%`,
                height: "100%",
                borderRadius: 999,
                backgroundColor: p.accent,
              }}
            />
          </View>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: p.text,
              width: 30,
              textAlign: "right",
            }}
          >
            {it.count}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Panneau Audience (distributions) ──────────────────────────────────────
function AudiencePanel({ audience, p }: { audience: ProAudience; p: Palette }) {
  const f = audience.facets;
  return (
    <View
      style={{
        backgroundColor: p.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: p.border,
        padding: 18,
        gap: 16,
      }}
    >
      <Text className="font-serif-bold" style={{ fontSize: 16.5, color: p.text }}>
        Audience · {audience.total} contact{audience.total > 1 ? "s" : ""}
      </Text>
      <FacetBlock
        title="BUPP Score"
        items={f.score.map((b) => ({ value: b.label, count: b.count }))}
        p={p}
      />
      {CATEGORICAL.map(({ key, title }) => {
        const items = f[key as keyof AudienceFacets] as
          | { value: string; count: number }[]
          | undefined;
        return items ? (
          <FacetBlock key={key} title={title} items={items} p={p} />
        ) : null;
      })}
      <FacetBlock title="Contact" items={f.reached} p={p} />
    </View>
  );
}

// ── Barre de filtres (recherche + chips score + chips catégoriels) ─────────
function FiltersBar({
  audience,
  filters,
  setFilters,
  p,
}: {
  audience: ProAudience;
  filters: SegmentFilters;
  setFilters: React.Dispatch<React.SetStateAction<SegmentFilters>>;
  p: Palette;
}) {
  const f = audience.facets;

  const setQ = (q: string) =>
    setFilters((prev) => {
      const next = { ...prev };
      if (q) next.q = q;
      else delete next.q;
      return next;
    });

  const toggleScoreMin = (v: number) =>
    setFilters((prev) => {
      const next = { ...prev };
      if (next.scoreMin === v) delete next.scoreMin;
      else next.scoreMin = v;
      return next;
    });

  const toggleCategory = (
    key: keyof SegmentFilters & keyof AudienceFacets,
    value: string,
  ) =>
    setFilters((prev) => {
      const next = { ...prev };
      const cur = (next[key] as string[] | undefined) ?? [];
      const has = cur.includes(value);
      const updated = has ? cur.filter((x) => x !== value) : [...cur, value];
      if (updated.length) (next[key] as string[]) = updated;
      else delete next[key];
      return next;
    });

  const hasFilters = Object.keys(filters).length > 0;

  return (
    <View
      style={{
        backgroundColor: p.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: p.border,
        padding: 18,
        gap: 14,
      }}
    >
      <TextInput
        value={filters.q ?? ""}
        onChangeText={setQ}
        placeholder="Rechercher un prospect…"
        placeholderTextColor={p.muted}
        style={{
          fontSize: 13.5,
          color: p.text,
          backgroundColor: p.field,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: p.border,
          paddingVertical: 10,
          paddingHorizontal: 13,
        }}
      />

      {/* Score */}
      <View className="flex-row" style={{ flexWrap: "wrap", gap: 8 }}>
        <Chip
          label="≥ 600"
          on={filters.scoreMin === 600}
          onPress={() => toggleScoreMin(600)}
          p={p}
        />
        <Chip
          label="≥ 720"
          on={filters.scoreMin === 720}
          onPress={() => toggleScoreMin(720)}
          p={p}
        />
      </View>

      {/* Facettes catégorielles (chips des valeurs top) */}
      {CATEGORICAL.map(({ key, title }) => {
        const items = f[key as keyof AudienceFacets] as
          | { value: string; count: number }[]
          | undefined;
        if (!items || !items.length) return null;
        const selected = (filters[key] as string[] | undefined) ?? [];
        return (
          <View key={key} style={{ gap: 7 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 0.6,
                color: p.muted,
                textTransform: "uppercase",
              }}
            >
              {title}
            </Text>
            <View className="flex-row" style={{ flexWrap: "wrap", gap: 8 }}>
              {items.map((it) => (
                <Chip
                  key={it.value}
                  label={it.value}
                  on={selected.includes(it.value)}
                  onPress={() => toggleCategory(key, it.value)}
                  p={p}
                />
              ))}
            </View>
          </View>
        );
      })}

      {hasFilters ? (
        <View className="flex-row" style={{ gap: 8 }}>
          <Chip label="× Réinitialiser" on={false} onPress={() => setFilters({})} p={p} />
        </View>
      ) : null}
    </View>
  );
}

// ── Segments enregistrés (chips charger / supprimer + Enregistrer) ─────────
function SavedSegments({
  segments,
  campaignId,
  filters,
  setFilters,
  p,
}: {
  segments: ProSegment[];
  campaignId: string;
  filters: SegmentFilters;
  setFilters: (f: SegmentFilters) => void;
  p: Palette;
}) {
  const create = useProSegmentCreate();
  const del = useProSegmentDelete();
  const broadcast = useProSegmentBroadcast();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  // Diffusion SP2 (modal compose).
  const [diffusing, setDiffusing] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [bcResult, setBcResult] = useState<BroadcastResult | null>(null);
  const [bcError, setBcError] = useState<string | null>(null);

  const canSave = Object.keys(filters).length > 0;

  const openDiffuse = () => {
    setSubject("");
    setBody("");
    setBcResult(null);
    setBcError(null);
    setDiffusing(true);
  };
  const sendBroadcast = () => {
    const subj = subject.trim();
    const bod = body.trim();
    if (!subj || !bod) {
      setBcError("Objet et message requis.");
      return;
    }
    setBcError(null);
    broadcast.mutate(
      { campaignId, filters, subject: subj, body: bod },
      {
        onSuccess: (r) => setBcResult(r),
        onError: () => setBcError("Échec de la diffusion — réessayez."),
      },
    );
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(
      { campaignId, name: trimmed, filters },
      {
        onSuccess: () => {
          setName("");
          setNaming(false);
        },
      },
    );
  };

  return (
    <View
      style={{
        backgroundColor: p.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: p.border,
        padding: 18,
        gap: 12,
      }}
    >
      <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
        <Text className="font-serif-bold" style={{ fontSize: 15.5, color: p.text }}>
          Segments enregistrés
        </Text>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Pressable
            onPress={openDiffuse}
            className="active:opacity-80"
            style={{
              paddingVertical: 8,
              paddingHorizontal: 13,
              borderRadius: 999,
              backgroundColor: p.ctaBg,
            }}
          >
            <Text style={{ fontSize: 12.5, fontWeight: "600", color: p.ctaText }}>
              Diffuser
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setNaming(true)}
            disabled={!canSave}
            className="active:opacity-80"
            style={{
              paddingVertical: 8,
              paddingHorizontal: 13,
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: p.border,
              opacity: canSave ? 1 : 0.5,
            }}
          >
            <Text style={{ fontSize: 12.5, fontWeight: "600", color: canSave ? p.text : p.muted }}>
              Enregistrer
            </Text>
          </Pressable>
        </View>
      </View>

      {segments.length === 0 ? (
        <Text style={{ fontSize: 12.5, color: p.muted }}>
          Aucun segment enregistré pour cette campagne.
        </Text>
      ) : (
        <View className="flex-row" style={{ flexWrap: "wrap", gap: 8 }}>
          {segments.map((s) => (
            <View
              key={s.id}
              className="flex-row items-center"
              style={{
                gap: 6,
                paddingVertical: 7,
                paddingLeft: 13,
                paddingRight: 9,
                borderRadius: 999,
                backgroundColor: p.accentSoft,
                borderWidth: 1,
                borderColor: p.accentBorder,
              }}
            >
              <Pressable
                onPress={() => setFilters(s.filters || {})}
                className="active:opacity-70"
              >
                <Text style={{ fontSize: 12.5, fontWeight: "600", color: p.accentInk }}>
                  {s.name}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => del.mutate(s.id)}
                hitSlop={6}
                accessibilityLabel={`Supprimer le segment ${s.name}`}
                className="active:opacity-60"
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: p.muted }}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Modal de nommage */}
      <Modal
        visible={naming}
        transparent
        animationType="fade"
        onRequestClose={() => setNaming(false)}
      >
        <Pressable
          onPress={() => setNaming(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(10,22,40,0.44)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: "100%",
              maxWidth: 360,
              backgroundColor: p.card,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: p.border,
              padding: 20,
              gap: 14,
            }}
          >
            <Text className="font-serif-bold" style={{ fontSize: 17, color: p.text }}>
              Nommer ce segment
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex. Patrimoine élevé Île-de-France"
              placeholderTextColor={p.muted}
              autoFocus
              style={{
                fontSize: 14,
                color: p.text,
                backgroundColor: p.field,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: p.border,
                paddingVertical: 11,
                paddingHorizontal: 13,
              }}
            />
            <View className="flex-row" style={{ gap: 10 }}>
              <Pressable
                onPress={() => setNaming(false)}
                className="active:opacity-80"
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: p.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: "600", color: p.text }}>
                  Annuler
                </Text>
              </Pressable>
              <Pressable
                onPress={save}
                disabled={!name.trim() || create.isPending}
                className="active:opacity-80"
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: p.ctaBg,
                  alignItems: "center",
                  opacity: !name.trim() || create.isPending ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: "600", color: p.ctaText }}>
                  {create.isPending ? "Enregistrement…" : "Enregistrer"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de diffusion (SP2) */}
      <Modal
        visible={diffusing}
        transparent
        animationType="fade"
        onRequestClose={() => setDiffusing(false)}
      >
        <Pressable
          onPress={() => setDiffusing(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(10,22,40,0.44)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: "100%",
              maxWidth: 380,
              backgroundColor: p.card,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: p.border,
              padding: 20,
              gap: 12,
            }}
          >
            <Text className="font-serif-bold" style={{ fontSize: 17, color: p.text }}>
              Diffuser un message au segment
            </Text>

            {bcResult ? (
              <>
                <Text style={{ fontSize: 13, color: p.text, lineHeight: 19 }}>
                  Diffusion lancée : {bcResult.sent} message
                  {bcResult.sent === 1 ? "" : "s"} en cours d&apos;envoi sur{" "}
                  {bcResult.total} contact{bcResult.total === 1 ? "" : "s"} du segment.
                  {bcResult.skippedQuota > 0
                    ? ` ${bcResult.skippedQuota} déjà sollicité(s) (quota).`
                    : ""}
                  {bcResult.skippedNoEmail > 0
                    ? ` ${bcResult.skippedNoEmail} sans email.`
                    : ""}
                  {bcResult.skippedCap > 0
                    ? ` ${bcResult.skippedCap} au-delà du plafond (500).`
                    : ""}
                </Text>
                <Pressable
                  onPress={() => setDiffusing(false)}
                  className="active:opacity-80"
                  style={{
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: p.ctaBg,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 13.5, fontWeight: "600", color: p.ctaText }}>
                    Fermer
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 12, color: p.muted, lineHeight: 17 }}>
                  BUUPP envoie votre message aux contacts du segment courant (Reply-To
                  = votre email). Les adresses des prospects restent cachées. Quota : 1
                  email par campagne — les déjà-sollicités sont ignorés.
                </Text>
                <TextInput
                  value={subject}
                  onChangeText={(t) => setSubject(t.slice(0, 200))}
                  placeholder="Objet"
                  placeholderTextColor={p.muted}
                  style={{
                    fontSize: 14,
                    color: p.text,
                    backgroundColor: p.field,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: p.border,
                    paddingVertical: 11,
                    paddingHorizontal: 13,
                  }}
                />
                <TextInput
                  value={body}
                  onChangeText={(t) => setBody(t.slice(0, 10000))}
                  placeholder="Votre message…"
                  placeholderTextColor={p.muted}
                  multiline
                  style={{
                    fontSize: 14,
                    color: p.text,
                    backgroundColor: p.field,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: p.border,
                    paddingVertical: 11,
                    paddingHorizontal: 13,
                    minHeight: 120,
                    textAlignVertical: "top",
                  }}
                />
                {bcError ? (
                  <Text style={{ fontSize: 12.5, color: "#c0432d" }}>{bcError}</Text>
                ) : null}
                <View className="flex-row" style={{ gap: 10 }}>
                  <Pressable
                    onPress={() => setDiffusing(false)}
                    className="active:opacity-80"
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: p.border,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 13.5, fontWeight: "600", color: p.text }}>
                      Annuler
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={sendBroadcast}
                    disabled={!subject.trim() || !body.trim() || broadcast.isPending}
                    className="active:opacity-80"
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: p.ctaBg,
                      alignItems: "center",
                      opacity:
                        !subject.trim() || !body.trim() || broadcast.isPending ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 13.5, fontWeight: "600", color: p.ctaText }}>
                      {broadcast.isPending ? "Diffusion…" : "Diffuser"}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Sélecteur de campagne (chips horizontaux) ─────────────────────────────
function CampaignSelector({
  campaigns,
  active,
  onSelectAll,
  onSelect,
  p,
}: {
  campaigns: { id: string; name: string }[];
  active: { id: string; name: string } | null;
  onSelectAll: () => void;
  onSelect: (c: { id: string; name: string }) => void;
  p: Palette;
}) {
  return (
    <View style={{ gap: 8 }}>
      {!active ? (
        <Text style={{ fontSize: 12.5, color: p.sub }}>
          ▸ Choisissez une campagne pour analyser et segmenter votre audience
        </Text>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 4 }}
      >
        <Chip label="Toutes" on={!active} onPress={onSelectAll} p={p} />
        {campaigns.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            on={active?.id === c.id}
            onPress={() => onSelect(c)}
            p={p}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default function Contacts() {
  const q = useProContacts();
  const p = useContactPalette();
  const [active, setActive] = useState<Set<FilterKey>>(new Set());
  const [prioFilter, setPrioFilter] = useState<Set<number>>(new Set()); // priorité 1/2/3
  const togglePrio = (v: number) =>
    setPrioFilter((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  const [selected, setSelected] = useState<ProContact | null>(null);

  // Atelier de segmentation (page Statistiques, ouverte via le bouton dédié).
  const [activeCampaign, setActiveCampaign] = useState<{ id: string; name: string } | null>(null);
  const [segFilters, setSegFilters] = useState<SegmentFilters>({});
  // Filtre liste : les chips de campagne se comportent comme un filtre
  // (n'affiche que la campagne choisie) — sans basculer vers l'atelier.
  const [campaignFilter, setCampaignFilter] = useState<{ id: string; name: string } | null>(null);

  const audienceQ = useProAudience(activeCampaign?.id ?? null);
  const filteredQ = useProContactsFiltered(activeCampaign?.id ?? null, segFilters);

  // Sélection groupée (parité web) : ids des relations cochées, par
  // relationId. « Message groupé » révèle les emails (group-reveal) puis
  // ouvre un mailto: avec tous les prospects en Cci.
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const groupReveal = useProGroupReveal();
  const [sendingKey, setSendingKey] = useState<string | null>(null);

  // Repli/dépli des sections campagne (parité web) : repliées par défaut
  // dans la vue « Toutes » ; en mode atelier la campagne reste dépliée.
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  // Mode atelier : la campagne ouverte est dépliée par défaut.
  const [workshopCollapsed, setWorkshopCollapsed] = useState(false);
  const toggleCollapse = (key: string) =>
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const togglePick = (id: string) =>
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Emailables d'un groupe (email partagé) et ceux déjà cochés.
  const emailableOf = (contacts: ProContact[]) => contacts.filter((c) => !!c.email);
  const pickedOf = (contacts: ProContact[]) =>
    emailableOf(contacts).filter((c) => pickedIds.has(c.relationId));

  const setGroupPicked = (contacts: ProContact[], on: boolean) => {
    const ids = emailableOf(contacts).map((c) => c.relationId);
    setPickedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const sendGroupMessage = async (key: string, contacts: ProContact[]) => {
    const ids = pickedOf(contacts).map((c) => c.relationId);
    if (ids.length === 0) return;
    setSendingKey(key);
    try {
      const res = await groupReveal.mutateAsync(ids.slice(0, 50));
      const emails = (res.items || []).map((x) => x.email).filter((e): e is string => !!e);
      const skipped = ids.length - emails.length;
      if (emails.length === 0) {
        Alert.alert("Message groupé", "Aucun email disponible parmi les prospects sélectionnés.");
        return;
      }
      // Anti-fuite (parité web) : prospects en Cci, le pro en destinataire,
      // rappel RGPD pré-rempli pour dissuader le déplacement Cci → À/Cc.
      const bcc = emails.map(encodeURIComponent).join(",");
      const to = encodeURIComponent(res.proEmail || "");
      const subject = encodeURIComponent("Message — BUUPP");
      const body = encodeURIComponent(
        "\n\n— — — — — — — — — — — — — — — — — — — — — — — — — —\n" +
          "Envoi groupé via BUUPP — chaque destinataire est en Cci :\n" +
          "il ne verra pas les emails des autres prospects.\n" +
          "Ne déplacez pas les adresses dans « À » ou « Cc » avant\n" +
          "d'envoyer : cela exposerait les emails de tous à tous, ce qui\n" +
          "constitue une fuite de données personnelles (RGPD).\n" +
          "Rédigez votre message au-dessus de cette ligne.\n",
      );
      const url = `mailto:${to}?bcc=${bcc}&subject=${subject}&body=${body}`;
      const ok = await Linking.canOpenURL(url).catch(() => false);
      if (!ok) {
        Alert.alert("Message groupé", "Aucune application e-mail disponible sur cet appareil.");
        return;
      }
      await Linking.openURL(url);
      if (skipped > 0) {
        Alert.alert(
          "Message groupé",
          `${skipped} prospect${skipped > 1 ? "s" : ""} ignoré${skipped > 1 ? "s" : ""} (email non partagé).`,
        );
      }
    } catch {
      Alert.alert("Message groupé", "Impossible de récupérer les emails. Réessayez.");
    } finally {
      setSendingKey(null);
    }
  };

  const openCampaignDetails = (c: { id: string; name: string }) => {
    setActiveCampaign(c);
    setSegFilters({});
  };

  const toggle = (k: FilterKey) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  // Campagnes distinctes (ordre d'apparition) dérivées des lignes.
  const campaigns = useMemo(() => {
    const rows = q.data?.rows ?? [];
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.campaignId && !map.has(r.campaignId)) map.set(r.campaignId, r.campaign);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [q.data]);

  // Auto-sélection si une seule campagne (une fois, comme le web).
  const autoSelected = useRef(false);
  if (!autoSelected.current && campaigns.length === 1 && !activeCampaign) {
    autoSelected.current = true;
    setActiveCampaign(campaigns[0]);
    setSegFilters({});
  }

  // Filtrage cumulatif local + regroupement (vue « Toutes », sans campagne).
  const groups = useMemo(() => {
    const rows = q.data?.rows ?? [];
    const filtered = rows.filter(
      (r) =>
        [...active].every((k) => FILTERS.find((f) => f.key === k)!.test(r)) &&
        (prioFilter.size === 0 || prioFilter.has(r.priority ?? -1)),
    );
    const map = new Map<string, ProContact[]>();
    for (const r of filtered) {
      const key = r.campaign || "Sans campagne";
      (map.get(key) ?? map.set(key, []).get(key)!).push(r);
    }
    return [...map.entries()].map(([campaign, contacts]) => ({ campaign, contacts }));
  }, [q.data, active, prioFilter]);

  const total = q.data?.rows?.length ?? 0;
  // Groupes affichés : filtrés sur la campagne choisie dans les chips (le cas
  // échéant). Sans filtre → toutes les campagnes.
  const visibleGroups = campaignFilter
    ? groups.filter((g) => (g.contacts[0]?.campaignId || g.campaign) === campaignFilter.id)
    : groups;
  const shown = visibleGroups.reduce((n, g) => n + g.contacts.length, 0);

  // Replie toutes les campagnes au premier chargement (vue « Toutes ») — une
  // seule fois, pour ne pas réannuler les dépliages manuels (parité web).
  const didInitCollapse = useRef(false);
  if (!didInitCollapse.current && groups.length > 0) {
    didInitCollapse.current = true;
    setCollapsedKeys(new Set(groups.map((g) => g.contacts[0]?.campaignId || g.campaign)));
  }

  const hasSegFilters = Object.keys(segFilters).length > 0;
  const filteredRows = filteredQ.data?.rows ?? [];

  return (
    <ScrollScreen onRefresh={q.refetch} headerVariant="pro">
      {/* Titre */}
      <View style={{ gap: 1 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 1.6,
            color: p.accent,
            textTransform: "uppercase",
          }}
        >
          Mes contacts
        </Text>
        <Text className="font-serif text-2xl" style={{ color: p.text, marginTop: 4 }}>
          Prospects ayant accepté
        </Text>
        <Text style={{ fontSize: 13.5, lineHeight: 20, color: p.sub, marginTop: 6 }}>
          Données accessibles dans l’app uniquement — un watermark est appliqué à
          chaque fiche.
        </Text>
      </View>

      <QueryGate
        query={q}
        isEmpty={(d) => (d.rows?.length ?? 0) === 0}
        emptyLabel="Aucun contact acquis pour le moment."
      >
        {() => (
          <View style={{ gap: 18 }}>
            {/* Sélecteur de campagne — agit comme un FILTRE de la liste
                (n'affiche que la campagne choisie). Masqué en mode atelier. */}
            {campaigns.length > 0 && !activeCampaign ? (
              <CampaignSelector
                campaigns={campaigns}
                active={campaignFilter}
                onSelectAll={() => setCampaignFilter(null)}
                onSelect={(c) => setCampaignFilter(c)}
                p={p}
              />
            ) : null}

            {/* Bouton retour bien visible (violet clair) — sous le groupe de boutons. */}
            {activeCampaign ? (
              <Pressable
                onPress={() => {
                  setActiveCampaign(null);
                  setSegFilters({});
                }}
                accessibilityRole="button"
                accessibilityLabel="Retour aux campagnes"
                className="flex-row items-center active:opacity-80"
                style={{
                  alignSelf: "flex-start",
                  gap: 8,
                  paddingVertical: 11,
                  paddingHorizontal: 18,
                  borderRadius: 999,
                  backgroundColor: "#A78BFA",
                  shadowColor: "#A78BFA",
                  shadowOpacity: 0.4,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 4,
                }}
              >
                <Ionicons name="arrow-back" size={18} color="#3B0764" />
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#3B0764" }}>
                  Retour aux campagnes
                </Text>
              </Pressable>
            ) : null}

            {activeCampaign ? (
              <>
                {/* Audience + filtres + segments (campagne clôturée). */}
                {audienceQ.data ? (
                  <>
                    <AudiencePanel audience={audienceQ.data} p={p} />
                    <FiltersBar
                      audience={audienceQ.data}
                      filters={segFilters}
                      setFilters={setSegFilters}
                      p={p}
                    />
                    <SavedSegments
                      segments={audienceQ.data.savedSegments}
                      campaignId={activeCampaign.id}
                      filters={segFilters}
                      setFilters={setSegFilters}
                      p={p}
                    />
                  </>
                ) : audienceQ.isError ? (
                  <View
                    style={{
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: p.border,
                      backgroundColor: p.card,
                      padding: 18,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: p.muted, textAlign: "center" }}>
                      L’atelier d’audience n’est disponible que pour une campagne
                      clôturée.
                    </Text>
                  </View>
                ) : null}

                {/* Liste filtrée côté serveur, groupée sous la campagne. */}
                {filteredRows.length === 0 ? (
                  <View
                    style={{
                      alignItems: "center",
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: p.border,
                      backgroundColor: p.card,
                      padding: 24,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: p.muted, textAlign: "center" }}>
                      {hasSegFilters
                        ? "Aucun contact pour ce filtre."
                        : "Aucun contact pour cette campagne."}
                    </Text>
                  </View>
                ) : (
                  <View
                    style={{
                      backgroundColor: p.accentSoft,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: p.accentBorder,
                      padding: 14,
                    }}
                  >
                    <GroupHeader
                      campaign={activeCampaign.name}
                      count={filteredRows.length}
                      contacts={filteredRows}
                      objective={filteredRows[0]?.campaignObjective}
                      closesAt={filteredRows[0]?.campaignClosesAt}
                      emailableCount={emailableOf(filteredRows).length}
                      selectedCount={pickedOf(filteredRows).length}
                      allSelected={
                        emailableOf(filteredRows).length > 0 &&
                        pickedOf(filteredRows).length === emailableOf(filteredRows).length
                      }
                      sending={sendingKey === activeCampaign.id}
                      collapsed={workshopCollapsed}
                      onToggleCollapse={() => setWorkshopCollapsed((v) => !v)}
                      onViewDetails={() => openCampaignDetails(activeCampaign)}
                      onToggleSelectAll={() =>
                        setGroupPicked(
                          filteredRows,
                          pickedOf(filteredRows).length !== emailableOf(filteredRows).length,
                        )
                      }
                      onGroupMessage={() => sendGroupMessage(activeCampaign.id, filteredRows)}
                    />
                    {!workshopCollapsed && (
                      <View style={{ gap: 12 }}>
                        {filteredRows.map((c) => (
                          <ContactCard
                            key={c.relationId}
                            contact={c}
                            onDetails={() => setSelected(c)}
                            selectable
                            checked={pickedIds.has(c.relationId)}
                            onToggleSelect={() => togglePick(c.relationId)}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </>
            ) : (
              <>
                {/* Vue « Toutes » — comportement existant inchangé. */}
                <FiltersCard
                  active={active}
                  onToggle={toggle}
                  prioActive={prioFilter}
                  onTogglePrio={togglePrio}
                  onClear={() => {
                    setActive(new Set());
                    setPrioFilter(new Set());
                  }}
                  shown={shown}
                  total={total}
                />
                {visibleGroups.length === 0 ? (
                  <View
                    style={{
                      alignItems: "center",
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: p.border,
                      backgroundColor: p.card,
                      padding: 24,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: p.muted, textAlign: "center" }}>
                      Aucun prospect ne correspond à ces filtres.
                    </Text>
                  </View>
                ) : (
                  visibleGroups.map((g) => {
                    const emailable = emailableOf(g.contacts).length;
                    const picked = pickedOf(g.contacts).length;
                    const key = g.contacts[0]?.campaignId || g.campaign;
                    const isCollapsed = collapsedKeys.has(key);
                    return (
                      <View
                        key={g.campaign}
                        style={{
                          backgroundColor: p.accentSoft,
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: p.accentBorder,
                          padding: 14,
                        }}
                      >
                        <GroupHeader
                          campaign={g.campaign}
                          count={g.contacts.length}
                          contacts={g.contacts}
                          objective={g.contacts[0]?.campaignObjective}
                          closesAt={g.contacts[0]?.campaignClosesAt}
                          emailableCount={emailable}
                          selectedCount={picked}
                          allSelected={emailable > 0 && picked === emailable}
                          sending={sendingKey === key}
                          collapsed={isCollapsed}
                          onToggleCollapse={() => toggleCollapse(key)}
                          onViewDetails={() =>
                            g.contacts[0]?.campaignId &&
                            openCampaignDetails({ id: g.contacts[0].campaignId, name: g.campaign })
                          }
                          onToggleSelectAll={() => setGroupPicked(g.contacts, picked !== emailable)}
                          onGroupMessage={() => sendGroupMessage(key, g.contacts)}
                        />
                        {!isCollapsed && (
                          <View style={{ gap: 12 }}>
                            {g.contacts.map((c) => (
                              <ContactCard
                                key={c.relationId}
                                contact={c}
                                onDetails={() => setSelected(c)}
                                selectable
                                checked={pickedIds.has(c.relationId)}
                                onToggleSelect={() => togglePick(c.relationId)}
                              />
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </>
            )}
          </View>
        )}
      </QueryGate>

      <ContactDetailSheet
        contact={selected}
        campaign={selected?.campaign ?? null}
        visible={!!selected}
        onClose={() => setSelected(null)}
        siblings={
          !selected
            ? []
            : activeCampaign
              ? filteredRows
              : (groups.find(
                  (g) =>
                    (g.contacts[0]?.campaignId || g.campaign) ===
                    (selected.campaignId || selected.campaign),
                )?.contacts ?? [selected])
        }
        onNavigate={(c) => setSelected(c)}
        onPriorityChange={() => {
          void q.refetch();
        }}
      />
    </ScrollScreen>
  );
}
