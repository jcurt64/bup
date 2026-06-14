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
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { QueryGate, ScrollScreen } from "../../components/screen";
import {
  ContactCard,
  FILTERS,
  FiltersCard,
  GroupHeader,
  type FilterKey,
} from "../../components/contact-cards";
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
  const [selected, setSelected] = useState<ProContact | null>(null);

  // Atelier de segmentation.
  const [activeCampaign, setActiveCampaign] = useState<{ id: string; name: string } | null>(null);
  const [segFilters, setSegFilters] = useState<SegmentFilters>({});

  const audienceQ = useProAudience(activeCampaign?.id ?? null);
  const filteredQ = useProContactsFiltered(activeCampaign?.id ?? null, segFilters);

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
    const filtered = rows.filter((r) =>
      [...active].every((k) => FILTERS.find((f) => f.key === k)!.test(r)),
    );
    const map = new Map<string, ProContact[]>();
    for (const r of filtered) {
      const key = r.campaign || "Sans campagne";
      (map.get(key) ?? map.set(key, []).get(key)!).push(r);
    }
    return [...map.entries()].map(([campaign, contacts]) => ({ campaign, contacts }));
  }, [q.data, active]);

  const total = q.data?.rows?.length ?? 0;
  const shown = groups.reduce((n, g) => n + g.contacts.length, 0);

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
            {/* Sélecteur de campagne (atelier) */}
            {campaigns.length > 0 ? (
              <CampaignSelector
                campaigns={campaigns}
                active={activeCampaign}
                onSelectAll={() => {
                  setActiveCampaign(null);
                  setSegFilters({});
                }}
                onSelect={(c) => {
                  setActiveCampaign(c);
                  setSegFilters({});
                }}
                p={p}
              />
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
                  <View>
                    <GroupHeader
                      campaign={activeCampaign.name}
                      count={filteredRows.length}
                    />
                    <View style={{ gap: 12 }}>
                      {filteredRows.map((c) => (
                        <ContactCard
                          key={c.relationId}
                          contact={c}
                          onDetails={() => setSelected(c)}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </>
            ) : (
              <>
                {/* Vue « Toutes » — comportement existant inchangé. */}
                <FiltersCard
                  active={active}
                  onToggle={toggle}
                  onClear={() => setActive(new Set())}
                  shown={shown}
                  total={total}
                />
                {groups.length === 0 ? (
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
                  groups.map((g) => (
                    <View key={g.campaign}>
                      <GroupHeader campaign={g.campaign} count={g.contacts.length} />
                      <View style={{ gap: 12 }}>
                        {g.contacts.map((c) => (
                          <ContactCard
                            key={c.relationId}
                            contact={c}
                            onDetails={() => setSelected(c)}
                          />
                        ))}
                      </View>
                    </View>
                  ))
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
      />
    </ScrollScreen>
  );
}
