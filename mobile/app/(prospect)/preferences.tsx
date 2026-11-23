// Préférences — refonte visuelle alignée pixel sur pre.html (prototype
// design). Données : /api/prospect/donnees, /api/prospect/verification,
// /api/prospect/payout/status, /api/me/email-tracking. Actions :
// phone/rib/payout/email-tracking. Pivot mise en relation : plus de zone
// géographique ni de paliers partageables.
// Types de campagne et catégories = hydratés depuis /api/prospect/donnees
// (bloc preferences) et persistés via /api/prospect/preferences (patchPrefs).
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { FunCard as PrefCard } from "../../components/fun-card";
import { QueryGate, ScrollScreen } from "../../components/screen";
import type { CompactExtra } from "../../lib/header-scroll";
import { useTheme } from "../../lib/theme";
import { HERO_GRADIENT } from "../../lib/pro-theme";
import {
  useDeleteRib,
  useEmailTracking,
  usePatchPreferences,
  useProspectDonnees,
  useProspectVerification,
  useSaveRib,
  useSetEmailTracking,
} from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";
import { PhoneVerifySheet } from "../../components/phone-verify-sheet";


// Listes source-of-truth alignées sur Prospect.jsx (web)
const CAMPAIGN_TYPE_LIST = [
  "Prise de contact",
  "Prise de rendez-vous",
  "Événement",
  "Téléchargement",
  "Enquête & avis",
  "Promotion",
] as const;

const CATEGORY_LIST = [
  "Bien-être",
  "Coaching",
  "Artisanat",
  "Immobilier",
  "Finance",
  "Assurance",
  "Auto",
  "Éducation",
  "Beauté",
  "Alimentation",
  "Juridique",
  "Santé",
  "Énergie",
  "Maison & jardin",
  "Mode",
  "Loisirs & voyages",
  "High-tech & télécom",
  "Services à la personne",
] as const;

// ── Primitives de style (pre.html) ──────────────────────────────────────

// Bouton « Tous / Toutes » (parité web Prospect.jsx) — bascule le mode
// « tout sélectionné ». Violet plein quand actif, contour sinon.
function AllButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className="flex-row items-center active:opacity-80"
      style={{
        gap: 5,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: active ? c.violet : c.surface,
        borderWidth: 1.5,
        borderColor: active ? c.violet : c.borderSoft,
      }}
    >
      <Ionicons
        name="checkmark"
        size={13}
        color={active ? "#FFFFFF" : c.accVioletDeep}
      />
      <Text
        style={{
          fontSize: 12.5,
          fontWeight: "600",
          color: active ? "#FFFFFF" : c.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Chip sélectionnable (types de campagne / catégories) — parité web :
// fond ink + ✓ quand actif, contour clair sinon.
function SelectChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className="flex-row items-center active:opacity-70"
      style={{
        gap: 5,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: active ? c.btnBg : c.surface,
        borderWidth: active ? 1 : 1.5,
        borderColor: active ? c.btnBg : c.borderSoft,
      }}
    >
      {active ? <Ionicons name="checkmark" size={13} color={c.btnText} /> : null}
      <Text
        style={{
          fontSize: 13.5,
          fontWeight: "500",
          color: active ? c.btnText : c.textSub,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function H3({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return (
    <Text
      className="font-serif"
      style={{ fontSize: 21, color: c.text, marginTop: 15 }}
    >
      {children}
    </Text>
  );
}

function Desc({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return (
    <Text
      style={{ fontSize: 13, lineHeight: 19, color: c.textSub, marginTop: 7 }}
    >
      {children}
    </Text>
  );
}

// Bouton plein sombre (pre.html) — actions principales (SMS, RIB, payout).
function DarkButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className="items-center active:opacity-90"
      style={{
        marginTop: 13,
        paddingVertical: 15,
        borderRadius: 13,
        backgroundColor: c.btnBg,
        shadowColor: "#000000",
        shadowOpacity: 0.2,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 5,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ fontSize: 14.5, fontWeight: "600", color: c.btnText }}>
        {label}
      </Text>
    </Pressable>
  );
}

// Champ texte façon pre.html (fond ivoire, bordure douce, rounded 13).
function fieldStyle(c: ReturnType<typeof useTheme>["c"]) {
  return {
    marginTop: 11,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 13,
    backgroundColor: c.field,
    borderWidth: 1,
    borderColor: c.borderSoft,
    fontSize: 14.5,
    color: c.text,
  } as const;
}

// Toggle pill 48×28 (pre.html) — suivi des emails.
function PrefToggle({
  value,
  onPress,
  disabled,
  label,
}: {
  value: boolean;
  onPress: () => void;
  disabled?: boolean;
  label: string;
}) {
  const { c, isDark } = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={{
        width: 48,
        height: 28,
        borderRadius: 999,
        backgroundColor: value ? c.violet : isDark ? c.ink5 : "#D8D1C0",
        flexShrink: 0,
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 3,
          left: value ? 23 : 3,
          width: 22,
          height: 22,
          borderRadius: 999,
          backgroundColor: c.surface,
          shadowColor: "#000000",
          shadowOpacity: 0.2,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        }}
      />
    </Pressable>
  );
}

export default function Preferences() {
  const { c, mode } = useTheme();
  const don = useProspectDonnees();
  const ver = useProspectVerification();
  const mail = useEmailTracking();
  useRefetchOnFocus(don, ver, mail);

  const saveRib     = useSaveRib();
  const delRib      = useDeleteRib();
  const setMail     = useSetEmailTracking();
  const patchPrefs  = usePatchPreferences();

  const [phoneSheet, setPhoneSheet] = useState(false);
  const [iban,    setIban]    = useState("");
  const [bic,     setBic]     = useState("");
  const [holder,  setHolder]  = useState("");

  // Types de campagne & catégories acceptés — hydratés depuis
  // /api/prospect/donnees (bloc `preferences`) puis persistés à chaque
  // changement via /api/prospect/preferences. `allX` = mode « tout
  // sélectionné » ; sinon le Set `selX` fait foi. Parité web Prospect.jsx.
  const [allTypes, setAllTypes] = useState(true);
  const [selTypes, setSelTypes] = useState<Set<string>>(new Set());
  const [allCats, setAllCats] = useState(true);
  const [selCats, setSelCats] = useState<Set<string>>(new Set());

  // Hydratation UNE FOIS quand le bloc preferences arrive : ensuite le state
  // local fait foi (les invalidations post-PATCH ne re-clobberent pas une
  // sélection en cours — évite la course refetch/optimiste).
  const prefsHydrated = useRef(false);
  useEffect(() => {
    const p = don.data?.preferences;
    if (!p || prefsHydrated.current) return;
    prefsHydrated.current = true;
    setAllTypes(p.allCampaignTypes !== false);
    setSelTypes(new Set(Array.isArray(p.campaignTypes) ? p.campaignTypes : []));
    setAllCats(p.allCategories !== false);
    setSelCats(new Set(Array.isArray(p.categories) ? p.categories : []));
  }, [don.data?.preferences]);

  // Toggle d'un chip : depuis le mode « Tous », un clic désélectionne ce
  // chip (et conserve les autres) en basculant en mode partiel = liste
  // entière sauf celui-ci (parité toggleCampaignType/toggleCategory web).
  // On calcule l'état suivant de façon déterministe pour le répliquer à la
  // fois dans le state local et côté API (optimiste).
  const toggleType = (t: string) => {
    const next = allTypes
      ? new Set(CAMPAIGN_TYPE_LIST.filter((x) => x !== t))
      : (() => {
          const n = new Set(selTypes);
          if (n.has(t)) n.delete(t);
          else n.add(t);
          return n;
        })();
    setSelTypes(next);
    setAllTypes(false);
    patchPrefs.mutate({ allCampaignTypes: false, campaignTypes: [...next] });
  };
  const setAllTypesPersist = (on: boolean) => {
    setAllTypes(on);
    patchPrefs.mutate({ allCampaignTypes: on, campaignTypes: [...selTypes] });
  };
  const toggleCat = (cat: string) => {
    const next = allCats
      ? new Set(CATEGORY_LIST.filter((x) => x !== cat))
      : (() => {
          const n = new Set(selCats);
          if (n.has(cat)) n.delete(cat);
          else n.add(cat);
          return n;
        })();
    setSelCats(next);
    setAllCats(false);
    patchPrefs.mutate({ allCategories: false, categories: [...next] });
  };
  const setAllCatsPersist = (on: boolean) => {
    setAllCats(on);
    patchPrefs.mutate({ allCategories: on, categories: [...selCats] });
  };

  // ── Extras du header compact (au scroll) ───────────────────────────────
  // 1) Téléphone : icône pleine si vérifié, barrée sinon.
  const d0 = don.data;
  const phoneVerified = Boolean(d0?.identityMeta?.phoneVerifiedAt);
  const compactExtras: CompactExtra[] | undefined = d0
    ? [
        phoneVerified
          ? {
              iconLib: "material",
              icon: "phone-check",
              color: c.good,
              bg: c.goodSoft,
              accessibilityLabel: "Téléphone vérifié",
            }
          : {
              iconLib: "material",
              icon: "phone-off",
              color: c.textMuted,
              bg: c.surface2,
              accessibilityLabel: "Téléphone non vérifié",
            },
      ]
    : undefined;

  return (
    <ScrollScreen
      onRefresh={() =>
        Promise.all([
          don.refetch(),
          ver.refetch(),
          mail.refetch(),
        ])
      }
      compactExtras={compactExtras}
    >
      {/* Hero — card gradient thémé (pre.html). */}
      <LinearGradient
        colors={HERO_GRADIENT[mode]}
        locations={[0, 0.6, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.85 }}
        style={{
          borderRadius: 22,
          padding: 22,
          shadowColor: "#5B3FE0",
          shadowOpacity: 0.26,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: 14 },
          elevation: 6,
        }}
      >
        <Text
          className="text-[11px] font-bold uppercase text-white/70"
          style={{ letterSpacing: 1.6 }}
        >
          Préférences
        </Text>
        <Text
          className="font-serif text-white"
          style={{ fontSize: 25, lineHeight: 28, marginTop: 4 }}
        >
          Qui peut vous contacter
        </Text>
        <Text className="mt-2 text-[14px] leading-5 text-white/80">
          Types de campagne, catégories, téléphone, coordonnées bancaires et
          communications.
        </Text>
      </LinearGradient>

      {/* ── 1. Types de campagne acceptés ──────────────────────────────── */}
      <PrefCard
        iconBg={c.tintBlue}
        icon="megaphone-outline"
        iconColor={c.accBlue}
        right={
          <AllButton
            active={allTypes}
            label="Tous types de campagne"
            onPress={() => setAllTypesPersist(!allTypes)}
          />
        }
      >
        <H3>Types de campagne acceptés</H3>
        <Desc>
          Choisissez pour quels types de campagne vous acceptez d&apos;être
          sollicité.
        </Desc>
        <View
          className="flex-row flex-wrap"
          style={{ gap: 9, marginTop: 15 }}
        >
          {CAMPAIGN_TYPE_LIST.map((t) => (
            <SelectChip
              key={t}
              label={t}
              active={allTypes || selTypes.has(t)}
              onPress={() => toggleType(t)}
            />
          ))}
        </View>
      </PrefCard>

      {/* ── 2. Catégories autorisées ───────────────────────────────────── */}
      <PrefCard
        iconBg={c.tintAmber}
        icon="pricetags-outline"
        iconColor={c.accAmber}
        right={
          <AllButton
            active={allCats}
            label="Tous"
            onPress={() => setAllCatsPersist(!allCats)}
          />
        }
      >
        <H3>Domaines d&apos;activité</H3>
        <Desc>
          Choisissez le ou les domaines dans lesquels vous acceptez d&apos;être
          sollicité, ou « Tous ».
        </Desc>
        <View
          className="flex-row flex-wrap"
          style={{ gap: 9, marginTop: 15 }}
        >
          {CATEGORY_LIST.map((c) => (
            <SelectChip
              key={c}
              label={c}
              active={allCats || selCats.has(c)}
              onPress={() => toggleCat(c)}
            />
          ))}
        </View>
      </PrefCard>

      {/* ── 3. Téléphone & vérification SMS ────────────────────────────── */}
      <PrefCard iconBg={c.tintViolet} icon="call-outline" iconColor={c.accVioletDeep}>
        <H3>Téléphone</H3>
        <QueryGate query={don}>
          {(d) => {
            const tel = String(
              (d.identity as Record<string, unknown> | null)?.telephone ?? "",
            ).trim();
            const verified = !!d.identityMeta.phoneVerifiedAt;
            return (
              <View>
                {tel ? (
                  <View
                    className="flex-row items-center justify-between"
                    style={fieldStyle(c)}
                  >
                    <Text style={{ fontSize: 14.5, color: c.text }}>{tel}</Text>
                    <View
                      className="flex-row items-center"
                      style={{
                        gap: 5,
                        paddingVertical: 3,
                        paddingHorizontal: 9,
                        borderRadius: 999,
                        backgroundColor: verified ? c.goodSoft : c.surface2,
                      }}
                    >
                      <Ionicons
                        name={verified ? "checkmark-circle" : "alert-circle-outline"}
                        size={13}
                        color={verified ? c.good : c.textMuted}
                      />
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: "600",
                          color: verified ? c.good : c.textSub,
                        }}
                      >
                        {verified ? "Vérifié" : "Non vérifié"}
                      </Text>
                    </View>
                  </View>
                ) : null}
                <DarkButton
                  label={
                    !tel
                      ? "Ajouter et vérifier par SMS"
                      : verified
                        ? "Changer de numéro"
                        : "Vérifier par SMS"
                  }
                  onPress={() => setPhoneSheet(true)}
                />
                <PhoneVerifySheet
                  visible={phoneSheet}
                  initialPhone={verified ? "" : tel}
                  onClose={() => setPhoneSheet(false)}
                  onDone={() => setPhoneSheet(false)}
                />
              </View>
            );
          }}
        </QueryGate>
      </PrefCard>

      {/* ── 4. Coordonnées bancaires (RIB / IBAN) ──────────────────────── */}
      <PrefCard iconBg={c.tintGreen} icon="card-outline" iconColor={c.accGreen}>
        <H3>Coordonnées bancaires</H3>
        <QueryGate query={ver}>
          {(v) =>
            v.rib ? (
              <View style={{ marginTop: 4 }}>
                <View style={fieldStyle(c)}>
                  <Text style={{ fontSize: 14.5, color: c.text }}>
                    {v.rib.ibanMasked}
                  </Text>
                </View>
                <Text style={{ marginTop: 8, fontSize: 12.5, color: c.textSub }}>
                  {v.rib.holderName} · {v.rib.bic} ·{" "}
                  {v.rib.validated ? "validé" : "en attente"}
                </Text>
                <Pressable
                  disabled={delRib.isPending}
                  className="self-start active:opacity-70"
                  style={{
                    marginTop: 12,
                    paddingVertical: 9,
                    paddingHorizontal: 16,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: c.borderSoft,
                  }}
                  onPress={() =>
                    Alert.alert(
                      "Supprimer le RIB ?",
                      "Vous devrez le ressaisir pour tout retrait.",
                      [
                        { text: "Annuler", style: "cancel" },
                        {
                          text: "Supprimer",
                          style: "destructive",
                          onPress: () => delRib.mutate(),
                        },
                      ],
                    )
                  }
                >
                  <Text style={{ fontSize: 12.5, fontWeight: "600", color: c.bad }}>
                    {delRib.isPending ? "…" : "Supprimer le RIB"}
                  </Text>
                </Pressable>
                {delRib.isError && (
                  <Text style={{ marginTop: 8, fontSize: 12.5, color: c.bad }}>
                    Échec — réessayez.
                  </Text>
                )}
              </View>
            ) : (
              <View>
                <TextInput
                  value={iban}
                  onChangeText={setIban}
                  placeholder="IBAN"
                  placeholderTextColor={c.textMuted}
                  autoCapitalize="characters"
                  style={fieldStyle(c)}
                />
                <TextInput
                  value={bic}
                  onChangeText={setBic}
                  placeholder="BIC"
                  placeholderTextColor={c.textMuted}
                  autoCapitalize="characters"
                  style={fieldStyle(c)}
                />
                <TextInput
                  value={holder}
                  onChangeText={setHolder}
                  placeholder="Titulaire du compte"
                  placeholderTextColor={c.textMuted}
                  style={fieldStyle(c)}
                />
                <DarkButton
                  label={saveRib.isPending ? "…" : "Enregistrer le RIB"}
                  disabled={saveRib.isPending}
                  onPress={() => saveRib.mutate({ iban, bic, holderName: holder })}
                />
              </View>
            )
          }
        </QueryGate>
      </PrefCard>

      {/* ── 5. Suivi des emails BUUPP (CNIL n° 2026-042) ───────────────── */}
      <PrefCard
        iconBg={c.tintAmber}
        icon="mail-outline"
        iconColor={c.accAmber}
        right={
          <QueryGate query={mail}>
            {(m) => (
              <PrefToggle
                value={m.consent}
                disabled={setMail.isPending}
                label="Suivi des emails BUUPP"
                onPress={() => setMail.mutate({ consent: !m.consent })}
              />
            )}
          </QueryGate>
        }
      >
        <H3>Suivi des emails BUUPP</H3>
        <Desc>
          Les communications BUUPP peuvent inclure un pixel transparent pour
          mesurer le taux d&apos;ouverture de façon agrégée. Aucune IP, aucun
          fingerprint stocké.{"\n"}
          Recommandation CNIL n° 2026-042 — modifiable à tout moment.
        </Desc>
      </PrefCard>
    </ScrollScreen>
  );
}
