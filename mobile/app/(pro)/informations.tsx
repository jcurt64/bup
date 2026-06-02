// Mes informations — société & facturation. GET/PATCH /api/pro/info.
// raison_sociale est obligatoire côté serveur (NOT NULL).
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";

import { Card, QueryGate, ScrollScreen } from "../../components/screen";
import { setPlanAck } from "../../lib/plan-ack";
import { PLAN_DEFS, type PlanId } from "../../lib/pro-plans";
import {
  useProInfo,
  usePatchProInfo,
  useProPlan,
  useSetProPlan,
  type ProInfo,
} from "../../lib/queries";
import { useTheme } from "../../lib/theme";

type FormKey = Exclude<keyof ProInfo, "capitalSocialEur">;

// Section « Formule d'abonnement » — choix Starter / Pro (POST /api/pro/plan).
// Porté du web (Mes informations). Choisir une formule (ré)initialise le cycle.
function PlanSection() {
  const { c } = useTheme();
  const plan = useProPlan();
  const setPlan = useSetProPlan();
  const [choosing, setChoosing] = useState<PlanId | null>(null);
  const current = plan.data?.plan;

  async function choose(id: PlanId) {
    setChoosing(id);
    try {
      await setPlan.mutateAsync({ plan: id });
      await setPlanAck();
    } catch {
      Alert.alert("Erreur", "Impossible de changer de formule. Réessayez.");
    } finally {
      setChoosing(null);
    }
  }

  return (
    <Card>
      <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
        <View className="flex-1">
          <Text className="font-serif text-lg text-ink">Formule d&apos;abonnement</Text>
          <Text className="mt-1 text-[12.5px] leading-5 text-ink-4">
            Détermine le nombre de prospects par campagne, de campagnes par cycle
            et les paliers accessibles.
          </Text>
        </View>
        {current ? (
          <View
            className="rounded-full px-2.5 py-1"
            style={{ backgroundColor: current === "pro" ? c.accentSoft : c.surface2, borderWidth: 1, borderColor: current === "pro" ? c.accent : c.borderSoft }}
          >
            <Text className="text-[11px] font-semibold" style={{ color: current === "pro" ? c.accentInk : c.ink2 }}>
              {current === "pro" ? "Pro" : "Starter"}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="mt-4 gap-3">
        {PLAN_DEFS.map((p) => {
          const spec = plan.data?.specs?.[p.id];
          const isCurrent = current === p.id;
          const isPro = p.id === "pro";
          const accent = isPro ? c.accent : c.ink;
          const busy = choosing === p.id;
          return (
            <View
              key={p.id}
              style={{
                position: "relative",
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: isCurrent ? accent : c.borderSoft,
                backgroundColor: isCurrent ? c.accentSoft : c.surface,
                padding: 16,
                gap: 10,
              }}
            >
              {p.badge ? (
                <View style={{ position: "absolute", top: -10, right: 12, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: accent }}>
                  <Text className="font-mono" style={{ fontSize: 10, letterSpacing: 1, color: "#FFFFFF" }}>
                    {p.badge}
                  </Text>
                </View>
              ) : null}
              <View className="flex-row items-baseline justify-between" style={{ gap: 8 }}>
                <Text className="font-serif text-2xl" style={{ color: accent }}>
                  {p.label}
                </Text>
                <Text className="text-[13px] text-ink-3">
                  <Text className="font-serif text-xl text-ink">{spec?.monthlyEur ?? 0} €</Text>
                  {`  / ${spec?.maxCampaigns ?? (isPro ? 10 : 2)} campagnes`}
                </Text>
              </View>
              <View className="gap-2">
                {p.features.map((f, i) => (
                  <View key={i} className="flex-row" style={{ gap: 8 }}>
                    <Ionicons name="checkmark" size={14} color={accent} style={{ marginTop: 2 }} />
                    <Text className="flex-1 text-[13px] leading-4 text-ink-2">{f}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                disabled={isCurrent || choosing !== null}
                onPress={() => choose(p.id)}
                accessibilityRole="button"
                className="mt-1 flex-row items-center justify-center gap-2 rounded-full py-3 active:opacity-80"
                style={{
                  backgroundColor: isCurrent ? c.surface2 : isPro ? c.accent : c.btnBg,
                  opacity: choosing !== null && !busy ? 0.5 : 1,
                }}
              >
                {busy ? (
                  <ActivityIndicator color={isPro ? "#FFFFFF" : c.btnText} />
                ) : (
                  <Text className="text-[14px] font-semibold" style={{ color: isCurrent ? c.textSub : isPro ? "#FFFFFF" : c.btnText }}>
                    {isCurrent ? "✓ Formule actuelle" : `Passer en ${p.label}`}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const FIELDS: { key: FormKey; label: string; placeholder?: string; keyboard?: "default" | "numeric" }[] = [
  { key: "raisonSociale", label: "Raison sociale *", placeholder: "Nom de votre entreprise" },
  { key: "secteur", label: "Secteur d'activité" },
  { key: "formeJuridique", label: "Forme juridique", placeholder: "SAS, SARL…" },
  { key: "adresse", label: "Adresse" },
  { key: "codePostal", label: "Code postal", keyboard: "numeric" },
  { key: "ville", label: "Ville" },
  { key: "siren", label: "SIREN", placeholder: "9 chiffres", keyboard: "numeric" },
  { key: "siret", label: "SIRET", placeholder: "14 chiffres", keyboard: "numeric" },
  { key: "rcsVille", label: "Ville d'immatriculation RCS" },
  { key: "rmNumber", label: "N° Répertoire des Métiers" },
];

function Field({
  label,
  value,
  placeholder,
  keyboard,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  keyboard?: "default" | "numeric";
  onChange: (v: string) => void;
}) {
  const { c } = useTheme();
  return (
    <View>
      <Text className="mb-1 text-[12px] font-semibold text-ink-3">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        keyboardType={keyboard ?? "default"}
        style={{
          backgroundColor: c.field,
          borderColor: c.borderSoft,
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 11,
          fontSize: 15,
          color: c.text,
        }}
      />
    </View>
  );
}

export default function ProInformations() {
  const { c } = useTheme();
  const q = useProInfo();
  const patch = usePatchProInfo();
  const [form, setForm] = useState<Record<FormKey, string>>(
    {} as Record<FormKey, string>,
  );
  const [capital, setCapital] = useState("");

  // Hydrate le formulaire une fois les données chargées.
  useEffect(() => {
    if (!q.data) return;
    const next = {} as Record<FormKey, string>;
    FIELDS.forEach((f) => {
      let v = (q.data?.[f.key] as string) ?? "";
      // La raison sociale par défaut = l'e-mail Clerk (placeholder résiduel) :
      // on vide le champ pour forcer la saisie d'un vrai nom (sans « @ »).
      if (f.key === "raisonSociale" && v.includes("@")) v = "";
      next[f.key] = v;
    });
    setForm(next);
    setCapital(
      q.data.capitalSocialEur != null ? String(q.data.capitalSocialEur) : "",
    );
  }, [q.data]);

  async function save() {
    if (!form.raisonSociale?.trim()) {
      Alert.alert("Champ requis", "La raison sociale est obligatoire.");
      return;
    }
    if (form.raisonSociale.includes("@")) {
      Alert.alert(
        "Raison sociale invalide",
        "Indiquez le nom de votre entreprise (pas une adresse e-mail).",
      );
      return;
    }
    const payload: Partial<ProInfo> = { ...form };
    const capNum = Number(capital.replace(",", "."));
    if (capital.trim() && !Number.isNaN(capNum)) payload.capitalSocialEur = capNum;
    try {
      await patch.mutateAsync(payload);
      Alert.alert("Enregistré", "Vos informations ont été mises à jour.");
    } catch (e) {
      Alert.alert(
        "Enregistrement impossible",
        e instanceof Error && e.message
          ? e.message
          : "Vérifiez les formats (SIREN 9 chiffres, SIRET 14 chiffres).",
      );
    }
  }

  return (
    <ScrollScreen
      headerVariant="pro"
      hero={{
        nav: "drawer",
        eyebrow: "Mes informations",
        title: "Société",
        desc: "Utilisées sur vos factures et pour vos campagnes.",
      }}
      onRefresh={q.refetch}
    >
      <PlanSection />

      <QueryGate query={q}>
        {() => (
          <Card>
            <View className="gap-3">
              {FIELDS.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  value={form[f.key] ?? ""}
                  placeholder={f.placeholder}
                  keyboard={f.keyboard}
                  onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
                />
              ))}
              <Field
                label="Capital social (€)"
                value={capital}
                placeholder="0"
                keyboard="numeric"
                onChange={setCapital}
              />
            </View>
          </Card>
        )}
      </QueryGate>

      <Pressable
        disabled={patch.isPending}
        onPress={save}
        accessibilityRole="button"
        className="mt-1 flex-row items-center justify-center gap-2 rounded-full py-3 active:opacity-80"
        style={{ backgroundColor: c.btnBg }}
      >
        <Text className="text-base font-semibold" style={{ color: c.btnText }}>
          {patch.isPending ? "Enregistrement…" : "Enregistrer"}
        </Text>
      </Pressable>
    </ScrollScreen>
  );
}
