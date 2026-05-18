// Mes données — /api/prospect/donnees (lecture + édition par palier via
// PATCH /api/prospect/donnees) + masquer/supprimer (POST /api/prospect/tier).
// Champs/libellés/ordre = Prospect.jsx fn MesDonnees (web).
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Card, QueryGate, ScrollScreen, SectionTitle } from "../../components/screen";
import {
  useProspectDonnees,
  usePatchDonnees,
  useTierAction,
  type TierKey,
} from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

const FIELDS: Record<TierKey, { key: string; label: string }[]> = {
  identity: [
    { key: "prenom", label: "Prénom" },
    { key: "nom", label: "Nom" },
    { key: "email", label: "Email" },
    { key: "telephone", label: "Téléphone" },
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
  { key: "pro", n: 4, label: "Professionnel" },
  { key: "patrimoine", n: 5, label: "Patrimoine" },
];

export default function Donnees() {
  const q = useProspectDonnees();
  const patch = usePatchDonnees();
  const tierAction = useTierAction();
  useRefetchOnFocus(q);
  const [editing, setEditing] = useState<TierKey | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  return (
    <ScrollScreen onRefresh={q.refetch}>
      <SectionTitle
        eyebrow="Mes données — RGPD art. 15 à 22"
        title="Vos paliers"
        desc="Plus vous renseignez de données, plus votre BUUPP Score et vos gains augmentent. Vous restez maître de ce que vous partagez."
      />
      <QueryGate query={q}>
        {(d) => (
          <View className="gap-3">
            {TIERS.map((t) => {
              const row = (d[t.key] ?? {}) as Record<string, unknown>;
              const hidden = d.hiddenTiers.includes(t.key);
              const removed = d.removedTiers.includes(t.key);
              const isEditing = editing === t.key;
              return (
                <Card key={t.n} className={removed ? "opacity-60" : ""}>
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
                      {FIELDS[t.key].map((f) => (
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
                      ))}
                      <View className="mt-1 flex-row gap-2">
                        <Pressable
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
                      <View className="mt-2 flex-row gap-2">
                        {!removed && (
                          <Pressable
                            className="rounded-full border border-line px-4 py-2"
                            onPress={() => setEditing(t.key)}
                          >
                            <Text className="text-xs text-ink-2">Modifier</Text>
                          </Pressable>
                        )}
                        {!removed && (
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
                        )}
                      </View>
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        )}
      </QueryGate>
    </ScrollScreen>
  );
}
