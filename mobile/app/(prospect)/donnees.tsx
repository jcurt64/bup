// Mes données — /api/prospect/donnees (lecture + édition par palier via
// PATCH /api/prospect/donnees) + masquer/supprimer (POST /api/prospect/tier).
// Champs/libellés/ordre = Prospect.jsx fn MesDonnees (web).
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { Card, QueryGate, ScrollScreen } from "../../components/screen";
import {
  useProspectDonnees,
  usePatchDonnees,
  useTierAction,
  type TierKey,
} from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

const FIELDS: Record<TierKey, { key: string; label: string; readOnly?: boolean; hint?: string }[]> = {
  identity: [
    { key: "prenom", label: "Prénom" },
    { key: "nom", label: "Nom" },
    { key: "email", label: "Email" },
    { key: "telephone", label: "Téléphone", readOnly: true, hint: "Modifiable via Préférences (vérification SMS)" },
    { key: "naissance", label: "Date de naissance" },
  ],
  localisation: [
    { key: "adresse", label: "Adresse postale" },
    { key: "ville", label: "Ville" },
    { key: "codePostal", label: "Code postal" },
  ],
  vie: [
    { key: "foyer", label: "Composition du foyer" },
    { key: "logement", label: "Type de logement" },
    { key: "mobilite", label: "Mobilité" },
    { key: "vehicule", label: "Véhicule" },
    { key: "sports", label: "Sports / loisirs" },
    { key: "animaux", label: "Animaux" },
  ],
  pro: [
    { key: "poste", label: "Poste" },
    { key: "statut", label: "Statut" },
    { key: "secteur", label: "Secteur" },
    { key: "revenus", label: "Revenus déclarés" },
  ],
  patrimoine: [
    { key: "residence", label: "Résidence principale" },
    { key: "epargne", label: "Épargne disponible" },
    { key: "projets", label: "Projets à 3–5 ans" },
  ],
};

const TIERS: { key: TierKey; n: number; label: string }[] = [
  { key: "identity", n: 1, label: "Identification" },
  { key: "localisation", n: 2, label: "Localisation" },
  { key: "vie", n: 3, label: "Style de vie" },
  { key: "pro", n: 4, label: "Données professionnelles" },
  { key: "patrimoine", n: 5, label: "Patrimoine & projets" },
];

export default function Donnees() {
  const q = useProspectDonnees();
  const patch = usePatchDonnees();
  const tierAction = useTierAction();
  useRefetchOnFocus(q);
  const [editing, setEditing] = useState<TierKey | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  return (
    <ScrollScreen
      onRefresh={q.refetch}
      hero={{
        eyebrow: "Mes données — RGPD art. 15 à 22",
        title: "Vos paliers",
        desc: "Plus vous renseignez de données, plus votre BUUPP Score et vos gains augmentent. Vous restez maître de ce que vous partagez.",
      }}
    >
      {/* Bannière droits RGPD — texte statique aligné sur le web (art. 15 à 22) */}
      <Card badge={{ icon: "shield-checkmark-outline", tone: "teal" }}>
        <Text className="font-serif text-lg text-ink">
          Vos droits sur vos données — articles 15 à 22 du RGPD
        </Text>
        <Text className="mt-2 text-sm leading-5 text-ink-3">
          Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, de
          limitation du traitement, de portabilité et d&apos;opposition sur
          l&apos;intégralité de vos données personnelles. Ces droits s&apos;exercent
          directement depuis cette page — chaque action est horodatée et tracée.
        </Text>
        <Text className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink-4">
          RGPD · Articles 15 à 22 · Règlement (UE) 2016/679
        </Text>
      </Card>

      <QueryGate query={q}>
        {(d) => {
          // Récap complétude — même définition que le web (Prospect.jsx
          // fn MesDonnees) : les paliers supprimés définitivement
          // (removedTiers) sont exclus du calcul ; un palier masqué
          // (hiddenTiers) reste compté mais avec 0 champ rempli ; un
          // palier est "atteint" dès qu'au moins un champ est renseigné.
          const isFilled = (v: unknown) =>
            v != null && String(v).trim() !== "";
          const visibleTiers = TIERS.filter(
            (t) => !d.removedTiers.includes(t.key),
          );
          const tierStats = visibleTiers.map((t) => {
            const row = (d[t.key] ?? {}) as Record<string, unknown>;
            const isHidden = d.hiddenTiers.includes(t.key);
            const total = FIELDS[t.key].length;
            const filled = isHidden
              ? 0
              : FIELDS[t.key].filter((f) => isFilled(row[f.key])).length;
            const reached = !isHidden && filled > 0;
            return { t, total, filled, reached, isHidden };
          });
          const reachedTiers = tierStats.filter((s) => s.reached).length;
          const completeness =
            visibleTiers.length === 0
              ? 0
              : Math.round((reachedTiers / visibleTiers.length) * 100);
          const totalFields = tierStats.reduce((a, s) => a + s.total, 0);
          const filledFields = tierStats.reduce((a, s) => a + s.filled, 0);
          return (
          <View className="gap-3">
            {/* Récap complétude — % global + paliers atteints + champs renseignés */}
            <Card badge={{ icon: "stats-chart-outline", tone: "violet" }}>
              <Text className="font-mono text-[10px] uppercase text-ink-4">
                Niveau de palier
              </Text>
              <Text className="font-serif text-3xl text-ink">
                {completeness}
                <Text className="text-lg text-ink-4">%</Text>
              </Text>
              <Text className="mt-1 text-xs text-ink-3">
                <Text className="text-ink-2">
                  {reachedTiers}/{visibleTiers.length} paliers atteints
                </Text>
                {"  ·  "}
                {filledFields}/{totalFields} champs renseignés
              </Text>
              <Text className="mt-1 text-[11px] leading-4 text-ink-4">
                Un palier est atteint dès qu&apos;au moins une donnée y est
                renseignée. Plus vous remplissez de champs, plus votre BUUPP
                Score augmente.
              </Text>
              <View className="mt-3 gap-2">
                {tierStats.map((s) => {
                  const pct =
                    s.total === 0
                      ? 0
                      : Math.round((s.filled / s.total) * 100);
                  return (
                    <View key={s.t.key}>
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-ink-4">
                          P{s.t.n} · {s.t.label}
                        </Text>
                        <Text className="font-mono text-xs text-ink-3">
                          {s.filled}/{s.total}
                        </Text>
                      </View>
                      <View className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                        <View
                          className={`h-full rounded-full ${s.isHidden ? "bg-ink-4" : "bg-ink"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>

            {TIERS.map((t) => {
              const row = (d[t.key] ?? {}) as Record<string, unknown>;
              const hidden = d.hiddenTiers.includes(t.key);
              const removed = d.removedTiers.includes(t.key);
              const isEditing = editing === t.key;
              return (
                <Card
                  key={t.key}
                  className={removed ? "opacity-60" : ""}
                  badge={{ icon: "albums-outline", tone: "violet" }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="font-serif text-lg text-ink">
                      P{t.n} · {t.label}
                    </Text>
                    <Text className="font-mono text-xs text-ink-4">
                      {removed ? "supprimé" : hidden ? "masqué" : ""}
                    </Text>
                  </View>

                  {isEditing ? (
                    <View className="mt-2 gap-2">
                      {FIELDS[t.key].map((f) =>
                        f.readOnly ? (
                          <View key={f.key} className="gap-1">
                            <Text className="text-[11px] uppercase text-ink-4">
                              {f.label}
                            </Text>
                            <Text className="text-sm text-ink-3">
                              {row[f.key] != null && String(row[f.key]).trim() !== "" ? String(row[f.key]) : "—"}
                            </Text>
                            {f.hint ? (
                              <Text className="text-[10px] text-ink-4">{f.hint}</Text>
                            ) : null}
                          </View>
                        ) : (
                          <View key={f.key} className="gap-1">
                            <Text className="text-[11px] uppercase text-ink-4">
                              {f.label}
                            </Text>
                            <TextInput
                              defaultValue={String(row[f.key] ?? "")}
                              onChangeText={(v) =>
                                setDraft((s) => ({ ...s, [f.key]: v }))
                              }
                              className="rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink"
                            />
                          </View>
                        ),
                      )}
                      <View className="mt-1 flex-row gap-2">
                        <Pressable
                          disabled={patch.isPending}
                          className="flex-1 items-center rounded-full border border-line py-2.5"
                          onPress={() => {
                            setEditing(null);
                            setDraft({});
                          }}
                        >
                          <Text className="text-sm text-ink-3">Annuler</Text>
                        </Pressable>
                        <Pressable
                          disabled={patch.isPending}
                          className="flex-1 items-center rounded-full bg-ink py-2.5"
                          onPress={async () => {
                            await patch.mutateAsync({ tier: t.key, fields: draft });
                            setEditing(null);
                            setDraft({});
                          }}
                        >
                          <Text className="text-sm font-semibold text-paper">
                            {patch.isPending ? "…" : "Enregistrer"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View className="mt-2 gap-1">
                      {FIELDS[t.key].map((f) => (
                        <View key={f.key} className="flex-row justify-between">
                          <Text className="text-xs text-ink-4">{f.label}</Text>
                          <Text
                            className="max-w-[55%] text-right text-xs text-ink-2"
                            numberOfLines={1}
                          >
                            {row[f.key] != null && String(row[f.key]).trim() !== ""
                              ? String(row[f.key])
                              : "—"}
                          </Text>
                        </View>
                      ))}
                      {!removed && (
                        <View className="mt-2 flex-row gap-2">
                          <Pressable
                            className="rounded-full border border-line px-4 py-2"
                            onPress={() => setEditing(t.key)}
                          >
                            <Text className="text-xs text-ink-2">Modifier</Text>
                          </Pressable>
                          <Pressable
                            className="rounded-full border border-line px-4 py-2"
                            onPress={() =>
                              tierAction.mutate({
                                tier: t.key,
                                action: hidden ? "restore" : "hide",
                              })
                            }
                          >
                            <Text className="text-xs text-ink-2">
                              {hidden ? "Réafficher" : "Masquer"}
                            </Text>
                          </Pressable>
                        </View>
                      )}
                      {(hidden || removed) && (
                        <View className="mt-2">
                          <Pressable
                            disabled={tierAction.isPending}
                            className="self-start rounded-full border border-bad px-4 py-2"
                            onPress={() =>
                              Alert.alert(
                                "Supprimer définitivement ?",
                                "Cette action est irréversible (RGPD art. 17 — droit à l'effacement). Toutes les données de ce palier seront supprimées et ne pourront pas être restaurées.",
                                [
                                  { text: "Annuler", style: "cancel" },
                                  {
                                    text: "Supprimer",
                                    style: "destructive",
                                    onPress: () =>
                                      tierAction.mutate({
                                        tier: t.key,
                                        action: "delete",
                                      }),
                                  },
                                ],
                              )
                            }
                          >
                            <Text className="text-xs text-bad">
                              Supprimer définitivement
                            </Text>
                          </Pressable>
                          {tierAction.isError && (
                            <Text className="mt-1 text-[11px] text-bad">
                              Échec de la suppression. Réessayez.
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
          );
        }}
      </QueryGate>
    </ScrollScreen>
  );
}
