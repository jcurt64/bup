// Mes informations — société & facturation. GET/PATCH /api/pro/info.
// raison_sociale est obligatoire côté serveur (NOT NULL).
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { Card, QueryGate, ScrollScreen } from "../../components/screen";
import { useProInfo, usePatchProInfo, type ProInfo } from "../../lib/queries";
import { useTheme } from "../../lib/theme";

type FormKey = Exclude<keyof ProInfo, "capitalSocialEur">;

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
        nav: "back",
        eyebrow: "Mes informations",
        title: "Société",
        desc: "Utilisées sur vos factures et pour vos campagnes.",
      }}
      onRefresh={q.refetch}
    >
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
