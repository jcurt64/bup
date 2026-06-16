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
              {/* Transparence prix (parité page d'accueil) : coût d'acquisition
                  prospect à part (bleu accent), puis commission BUUPP sur le
                  budget de campagne (vert). */}
              <Text
                className="text-right text-[12px] font-semibold"
                style={{ color: c.accent, marginTop: -4 }}
              >
                hors coût d&apos;acquisition prospect
              </Text>
              <Text
                className="text-right text-[12px] font-semibold"
                style={{ color: "#22C55E", marginTop: 1 }}
              >
                +10% commission buupp / budget de campagne
              </Text>
              <View className="gap-2">
                {p.features.map((f, i) => (
                  <View key={i} className="flex-row items-start" style={{ gap: 8 }}>
                    <View
                      style={{
                        width: 20, height: 20, borderRadius: 999, marginTop: 1,
                        alignItems: "center", justifyContent: "center",
                        backgroundColor: accent + "26",
                      }}
                    >
                      <Ionicons name="checkmark" size={12} color={accent} />
                    </View>
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
                  backgroundColor: isCurrent ? "#16A34A1F" : isPro ? c.accent : c.btnBg,
                  borderWidth: isCurrent ? 1.5 : 0,
                  borderColor: isCurrent ? "#16A34A" : "transparent",
                  opacity: choosing !== null && !busy ? 0.5 : 1,
                }}
              >
                {busy ? (
                  <ActivityIndicator color={isPro ? "#FFFFFF" : c.btnText} />
                ) : (
                  <Text className="text-[14px] font-semibold" style={{ color: isCurrent ? "#16A34A" : isPro ? "#FFFFFF" : c.btnText }}>
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

const FIELDS: {
  key: FormKey;
  label: string;
  placeholder?: string;
  keyboard?: "default" | "numeric";
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { key: "raisonSociale", label: "Raison sociale *", placeholder: "Nom de votre entreprise", icon: "business-outline", color: "#4F46E5" },
  { key: "secteur", label: "Secteur d'activité", icon: "pricetags-outline", color: "#7C3AED" },
  { key: "formeJuridique", label: "Forme juridique", placeholder: "SAS, SARL…", icon: "document-text-outline", color: "#7C3AED" },
  { key: "adresse", label: "Adresse", icon: "location-outline", color: "#0D9488" },
  { key: "codePostal", label: "Code postal", keyboard: "numeric", icon: "location-outline", color: "#0891B2" },
  { key: "ville", label: "Ville", icon: "location-outline", color: "#0D9488" },
  { key: "siren", label: "SIREN", placeholder: "9 chiffres", keyboard: "numeric", icon: "shield-checkmark-outline", color: "#D97706" },
  { key: "siret", label: "SIRET", placeholder: "14 chiffres", keyboard: "numeric", icon: "shield-checkmark-outline", color: "#D97706" },
  { key: "rcsVille", label: "Ville d'immatriculation RCS", icon: "document-text-outline", color: "#DB2777" },
  { key: "rmNumber", label: "N° Répertoire des Métiers", icon: "document-text-outline", color: "#E11D48" },
];

// Champs requis pour la complétude (miroir des champs non-optionnels du web).
const REQUIRED_KEYS: FormKey[] = [
  "raisonSociale",
  "formeJuridique",
  "adresse",
  "ville",
  "codePostal",
  "secteur",
];

function Field({
  label,
  value,
  placeholder,
  keyboard,
  icon,
  color,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  keyboard?: "default" | "numeric";
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  onChange: (v: string) => void;
}) {
  const { c } = useTheme();
  return (
    <View>
      <View className="mb-1 flex-row items-center" style={{ gap: 7 }}>
        {icon ? (
          <View
            style={{
              width: 22, height: 22, borderRadius: 6,
              alignItems: "center", justifyContent: "center",
              backgroundColor: (color ?? c.accent) + "26",
            }}
          >
            <Ionicons name={icon} size={13} color={color ?? c.accent} />
          </View>
        ) : null}
        <Text className="text-[12px] font-semibold text-ink-3">{label}</Text>
      </View>
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

  const filledRequired = REQUIRED_KEYS.filter((k) => (form[k] ?? "").trim()).length;
  const totalRequired = REQUIRED_KEYS.length;

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
      {/* Bannière confidentialité SIREN (accent) */}
      <View
        style={{
          backgroundColor: c.accentSoft,
          borderColor: c.accent,
          borderWidth: 1,
          borderRadius: 16,
          padding: 16,
        }}
      >
        <View className="flex-row items-start" style={{ gap: 12 }}>
          <View
            style={{
              width: 36, height: 36, borderRadius: 999,
              backgroundColor: c.accent, alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="font-serif text-[15px] text-ink" style={{ marginBottom: 3 }}>
              Votre SIREN reste strictement confidentiel
            </Text>
            <Text className="text-[12.5px] leading-5" style={{ color: c.ink2 }}>
              Le numéro SIREN n&apos;est jamais diffusé aux utilisateurs ni affiché
              publiquement. Il sert uniquement à BUUPP pour vérifier l&apos;existence
              légale de votre société et accélérer la validation de votre compte.
            </Text>
          </View>
        </View>
      </View>

      <PlanSection />

      {/* Complétude du profil — badge circulaire + checklist à coches vertes */}
      <Card>
        <View className="flex-row items-center" style={{ gap: 16 }}>
          <View
            style={{
              width: 72, height: 72, borderRadius: 999,
              backgroundColor: c.accentSoft, borderWidth: 3, borderColor: c.accent,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text className="font-serif" style={{ fontSize: 22, color: c.text, lineHeight: 24 }}>
              {filledRequired}
            </Text>
            <Text className="font-mono" style={{ fontSize: 9, color: c.textMuted }}>
              / {totalRequired}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="font-mono" style={{ fontSize: 10, letterSpacing: 0.8, color: c.textMuted, marginBottom: 8 }}>
              COMPLÉTUDE DU PROFIL
            </Text>
            <View style={{ gap: 6 }}>
              {REQUIRED_KEYS.map((k) => {
                const filled = !!(form[k] ?? "").trim();
                const f = FIELDS.find((x) => x.key === k)!;
                return (
                  <View key={k} className="flex-row items-center" style={{ gap: 8 }}>
                    <View
                      style={{
                        width: 18, height: 18, borderRadius: 999,
                        alignItems: "center", justifyContent: "center",
                        backgroundColor: filled ? "#16A34A" : c.surface2,
                      }}
                    >
                      <Ionicons
                        name={filled ? "checkmark" : "ellipse"}
                        size={filled ? 11 : 5}
                        color={filled ? "#FFFFFF" : c.textMuted}
                      />
                    </View>
                    <Text className="text-[12.5px]" style={{ color: filled ? c.text : c.textSub }}>
                      {f.label.replace(" *", "")}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </Card>

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
                  icon={f.icon}
                  color={f.color}
                  onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
                />
              ))}
              <Field
                label="Capital social (€)"
                value={capital}
                placeholder="0"
                keyboard="numeric"
                icon="cash-outline"
                color="#16A34A"
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
