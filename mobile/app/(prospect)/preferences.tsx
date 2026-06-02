// Préférences — refonte visuelle alignée pixel sur pre.html (prototype
// design). Données : /api/prospect/donnees, /api/prospect/verification,
// /api/prospect/payout/status, /api/me/email-tracking. Actions :
// phone/rib/payout/email-tracking, zone géographique (rayon + nationalOptIn
// via patchDonnees), paliers partageables (tierAction hide/restore).
// Types de campagne et catégories = pas d'endpoint dédié côté API → blocs
// rendus en lecture seule (badge « Verrouillé »).
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { type ReactNode, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { eur, QueryGate, ScrollScreen } from "../../components/screen";
import type { CompactExtra } from "../../lib/header-scroll";
import { useTheme } from "../../lib/theme";
import { HERO_GRADIENT } from "../../lib/pro-theme";
import {
  useDeleteRib,
  useEmailTracking,
  usePayoutOnboarding,
  usePayoutStatus,
  usePayoutWithdraw,
  usePhoneStart,
  usePhoneVerify,
  usePatchDonnees,
  useProspectDonnees,
  useProspectVerification,
  useProspectWallet,
  useSaveRib,
  useSetEmailTracking,
  useTierAction,
  type TierKey,
} from "../../lib/queries";
import { useRefetchOnFocus } from "../../lib/use-refetch-on-focus";

// Accent violet global (pre.html)
const VIOLET = "#7C5CFF";

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
] as const;

const TIER_ROWS: { n: number; key: TierKey; name: string; range: string }[] = [
  { n: 1, key: "identity",    name: "Identification", range: "minimum 1,00 €" },
  { n: 2, key: "localisation",name: "Localisation",   range: "1,00 – 2,00 €" },
  { n: 3, key: "vie",         name: "Style de vie",   range: "2,00 – 3,50 €" },
  { n: 4, key: "pro",         name: "Données pro",    range: "3,50 – 5,00 €" },
  { n: 5, key: "patrimoine",  name: "Patrimoine",     range: "5,00 – 10,00 €" },
];

// ── Primitives de style (pre.html) ──────────────────────────────────────

// Carte blanche standard : rounded 20, bordure thème, padding 20, ombre.
function PrefCard({
  iconBg,
  icon,
  iconColor,
  right,
  children,
}: {
  iconBg: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  /** Slot à droite de l'en-tête (badge « Verrouillé », toggle…). */
  right?: ReactNode;
  children: ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View
      className="bg-paper"
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor: c.borderSoft,
        padding: 20,
        shadowColor: "#000000",
        shadowOpacity: 0.05,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 5 },
        elevation: 2,
      }}
    >
      <View
        className="flex-row items-center justify-between"
        style={{ gap: 12 }}
      >
        <View
          className="items-center justify-center"
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            backgroundColor: iconBg,
            flexShrink: 0,
          }}
        >
          <Ionicons name={icon} size={21} color={iconColor} />
        </View>
        {right ?? null}
      </View>
      {children}
    </View>
  );
}

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
        backgroundColor: active ? VIOLET : c.surface,
        borderWidth: 1.5,
        borderColor: active ? VIOLET : c.borderSoft,
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

// Case à cocher carrée arrondie 22×22 (violette une fois cochée).
function CheckBox({ checked }: { checked: boolean }) {
  const { c, isDark } = useTheme();
  return (
    <View
      className="items-center justify-center"
      style={{
        width: 22,
        height: 22,
        borderRadius: 7,
        flexShrink: 0,
        backgroundColor: checked ? VIOLET : c.surface,
        borderWidth: 1.5,
        borderColor: checked ? VIOLET : isDark ? c.ink5 : "#D8D1C0",
      }}
    >
      {checked ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
    </View>
  );
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
        backgroundColor: value ? VIOLET : isDark ? c.ink5 : "#D8D1C0",
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
  const pay = usePayoutStatus();
  const wal = useProspectWallet();
  const mail = useEmailTracking();
  useRefetchOnFocus(don, ver, pay, wal, mail);

  const phoneStart  = usePhoneStart();
  const phoneVerify = usePhoneVerify();
  const saveRib     = useSaveRib();
  const delRib      = useDeleteRib();
  const onboard     = usePayoutOnboarding();
  const withdraw    = usePayoutWithdraw();
  const setMail     = useSetEmailTracking();
  const patchDon    = usePatchDonnees();
  const tierAction  = useTierAction();

  const [phone,   setPhone]   = useState("");
  const [code,    setCode]    = useState("");
  const [iban,    setIban]    = useState("");
  const [bic,     setBic]     = useState("");
  const [holder,  setHolder]  = useState("");
  const [amount,  setAmount]  = useState("");

  // Types de campagne & catégories acceptés — state LOCAL (parité web
  // Prospect.jsx : pas d'endpoint API dédié, sélection non persistée).
  // `allX` = mode « tout sélectionné » ; sinon le Set `selX` fait foi.
  const [allTypes, setAllTypes] = useState(true);
  const [selTypes, setSelTypes] = useState<Set<string>>(new Set());
  const [allCats, setAllCats] = useState(true);
  const [selCats, setSelCats] = useState<Set<string>>(new Set());

  // Toggle d'un chip : depuis le mode « Tous », un clic désélectionne ce
  // chip (et conserve les autres) en basculant en mode partiel = liste
  // entière sauf celui-ci (parité toggleCampaignType/toggleCategory web).
  const toggleType = (t: string) => {
    if (allTypes) {
      setSelTypes(new Set(CAMPAIGN_TYPE_LIST.filter((x) => x !== t)));
      setAllTypes(false);
      return;
    }
    setSelTypes((prev) => {
      const n = new Set(prev);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  };
  const toggleCat = (c: string) => {
    if (allCats) {
      setSelCats(new Set(CATEGORY_LIST.filter((x) => x !== c)));
      setAllCats(false);
      return;
    }
    setSelCats((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  };

  // NaN-guard sur le montant de retrait
  const amountCents = Math.round(
    parseFloat(amount.replace(",", ".")) * 100,
  );
  const withdrawDisabled =
    withdraw.isPending ||
    !Number.isFinite(amountCents) ||
    amountCents <= 0;

  // ── Extras du header compact (au scroll) ───────────────────────────────
  // 1) Téléphone : icône pleine si vérifié, barrée sinon.
  // 2) Zone géographique renseignée (National ou rayon en km).
  const d0 = don.data;
  const loc0 = (d0?.localisation ?? {}) as Record<string, unknown>;
  const phoneVerified = Boolean(d0?.identityMeta?.phoneVerifiedAt);
  const national0 = loc0.nationalOptIn !== "false" && loc0.nationalOptIn !== null;
  const radius0 = (() => {
    const p = parseInt(String(loc0.targetingRadiusKm ?? "25"), 10);
    return Number.isFinite(p) && p >= 5 && p <= 100 ? p : 25;
  })();
  const zoneLabel = national0 ? "National" : `${radius0} km`;
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
        {
          iconLib: "ionicons",
          icon: "location-outline",
          value: zoneLabel,
          color: c.accViolet,
          bg: c.accentSoft,
        },
      ]
    : undefined;

  return (
    <ScrollScreen
      onRefresh={() =>
        Promise.all([
          don.refetch(),
          ver.refetch(),
          pay.refetch(),
          wal.refetch(),
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
          Types de campagne, catégories, zone, paliers de données, téléphone,
          coordonnées bancaires et communications.
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
            label="Tous"
            onPress={() => setAllTypes((v) => !v)}
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
            label="Toutes"
            onPress={() => setAllCats((v) => !v)}
          />
        }
      >
        <H3>Catégories autorisées</H3>
        <Desc>
          Seuls les professionnels de ces secteurs pourront vous adresser une
          demande.
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

      {/* ── 3. Zone géographique ───────────────────────────────────────── */}
      <PrefCard iconBg={c.tintCoral} icon="location-outline" iconColor={c.accCoral}>
        <H3>Zone géographique</H3>
        <QueryGate query={don}>
          {(d) => {
            const loc = (d.localisation ?? {}) as Record<string, unknown>;
            const ville      = String(loc.ville ?? "").trim();
            const codePostal = String(loc.codePostal ?? "").trim();
            const persisted  = parseInt(String(loc.targetingRadiusKm ?? "25"), 10);
            const radius     = Number.isFinite(persisted) && persisted >= 5 && persisted <= 100
              ? persisted
              : 25;
            const nationalOptIn =
              loc.nationalOptIn !== "false" && loc.nationalOptIn !== null;
            const zoneLocked = !ville;

            return (
              <View>
                {/* Centrée sur / Rayon */}
                <View
                  className="flex-row items-end justify-between"
                  style={{ gap: 14, marginTop: 16 }}
                >
                  <View>
                    <Text style={{ fontSize: 12, color: c.textSub }}>
                      Centrée sur
                    </Text>
                    <Text
                      className="font-serif"
                      style={{ fontSize: 16, color: c.text, marginTop: 3 }}
                    >
                      {zoneLocked
                        ? "Ville non renseignée"
                        : codePostal
                          ? `${ville}, ${codePostal}`
                          : ville}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 12, color: c.textSub }}>Rayon</Text>
                    <Text
                      className="font-serif"
                      style={{ fontSize: 17, color: c.accVioletDeep, marginTop: 3 }}
                    >
                      {nationalOptIn ? "National" : `${radius} km`}
                    </Text>
                  </View>
                </View>

                {/* Boutons +/- (remplacent le slider — pas de Slider Expo) */}
                {!nationalOptIn && !zoneLocked && (
                  <View
                    className="flex-row items-center"
                    style={{ gap: 10, marginTop: 14 }}
                  >
                    <Pressable
                      disabled={radius <= 5 || patchDon.isPending}
                      className="flex-1 items-center active:opacity-70"
                      style={{
                        paddingVertical: 11,
                        borderRadius: 13,
                        backgroundColor: c.surface,
                        borderWidth: 1,
                        borderColor: c.borderSoft,
                      }}
                      onPress={() =>
                        patchDon.mutate({
                          tier: "localisation",
                          fields: { targetingRadiusKm: Math.max(5, radius - 5) },
                        })
                      }
                    >
                      <Text style={{ fontSize: 14.5, fontWeight: "600", color: c.text }}>
                        −5 km
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={radius >= 100 || patchDon.isPending}
                      className="flex-1 items-center active:opacity-70"
                      style={{
                        paddingVertical: 11,
                        borderRadius: 13,
                        backgroundColor: c.surface,
                        borderWidth: 1,
                        borderColor: c.borderSoft,
                      }}
                      onPress={() =>
                        patchDon.mutate({
                          tier: "localisation",
                          fields: { targetingRadiusKm: Math.min(100, radius + 5) },
                        })
                      }
                    >
                      <Text style={{ fontSize: 14.5, fontWeight: "600", color: c.text }}>
                        +5 km
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* Note ville à renseigner */}
                {zoneLocked && (
                  <Text
                    style={{
                      marginTop: 12,
                      fontSize: 12.5,
                      lineHeight: 19,
                      color: c.textSub,
                    }}
                  >
                    Renseignez votre ville dans « Mes données » → Localisation
                    pour activer le rayon de ciblage.
                  </Text>
                )}

                {/* Étendre au niveau national — box violette + checkbox */}
                <Pressable
                  disabled={zoneLocked || patchDon.isPending}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: nationalOptIn }}
                  accessibilityLabel="Étendre au niveau national"
                  className="flex-row items-start active:opacity-80"
                  style={{
                    gap: 12,
                    marginTop: 14,
                    paddingVertical: 14,
                    paddingHorizontal: 15,
                    borderRadius: 14,
                    backgroundColor: c.tintViolet,
                    borderWidth: 1,
                    borderColor: c.violetSoft,
                    opacity: zoneLocked ? 0.5 : 1,
                  }}
                  onPress={() => {
                    if (zoneLocked) return;
                    patchDon.mutate({
                      tier: "localisation",
                      fields: { nationalOptIn: !nationalOptIn },
                    });
                  }}
                >
                  <CheckBox checked={nationalOptIn} />
                  <View className="flex-1">
                    <Text style={{ fontSize: 14, fontWeight: "600", color: c.text }}>
                      Étendre au niveau national
                    </Text>
                    <Text
                      style={{
                        fontSize: 12.5,
                        lineHeight: 18,
                        color: c.textSub,
                        marginTop: 3,
                      }}
                    >
                      J&apos;accepte d&apos;être contacté par des pros partout
                      en France, indépendamment du rayon local.
                    </Text>
                  </View>
                </Pressable>
              </View>
            );
          }}
        </QueryGate>
        {patchDon.isError && (
          <Text style={{ marginTop: 10, fontSize: 12.5, color: c.bad }}>
            Échec — réessayez.
          </Text>
        )}
      </PrefCard>

      {/* ── 4. Paliers partageables ────────────────────────────────────── */}
      <PrefCard iconBg={c.tintViolet} icon="layers-outline" iconColor={c.accVioletDeep}>
        <H3>Paliers partageables</H3>
        <Desc>
          Tous vos paliers sont partagés par défaut. Décochez ceux que vous ne
          souhaitez pas voir transmis (réversible — aucune donnée n&apos;est
          effacée).
        </Desc>
        <QueryGate query={don}>
          {(d) => {
            const hiddenSet  = new Set(d.hiddenTiers ?? []);
            const removedSet = new Set(d.removedTiers ?? []);
            return (
              <View style={{ marginTop: 16 }}>
                {TIER_ROWS.map((row, idx) => {
                  const hidden  = hiddenSet.has(row.key);
                  const removed = removedSet.has(row.key);
                  const shared  = !hidden && !removed;
                  const isLast  = idx === TIER_ROWS.length - 1;
                  return (
                    <Pressable
                      key={row.key}
                      disabled={removed || tierAction.isPending}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: shared }}
                      accessibilityLabel={`Palier ${row.n} — ${row.name}`}
                      className="flex-row items-center active:opacity-70"
                      style={{
                        gap: 12,
                        paddingVertical: 13,
                        borderBottomWidth: isLast ? 0 : 1,
                        borderBottomColor: c.track,
                        opacity: removed ? 0.5 : 1,
                      }}
                      onPress={() => {
                        if (removed) return;
                        tierAction.mutate({
                          tier: row.key,
                          action: shared ? "hide" : "restore",
                        });
                      }}
                    >
                      <CheckBox checked={shared} />
                      <Text
                        className="font-serif"
                        style={{ fontSize: 16, color: c.text }}
                      >
                        Palier {row.n}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ flex: 1, fontSize: 13, color: c.textSub }}
                      >
                        {row.name}
                      </Text>
                      {removed ? (
                        <View
                          style={{
                            borderRadius: 999,
                            backgroundColor: c.track,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                          }}
                        >
                          <Text style={{ fontSize: 10, color: c.textMuted }}>
                            supprimé
                          </Text>
                        </View>
                      ) : (
                        <Text
                          style={{ fontSize: 12.5, fontWeight: "500", color: c.textMuted }}
                        >
                          {row.range}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            );
          }}
        </QueryGate>
        {tierAction.isError && (
          <Text style={{ marginTop: 10, fontSize: 12.5, color: c.bad }}>
            Échec — réessayez.
          </Text>
        )}
      </PrefCard>

      {/* ── 5. Téléphone & vérification SMS ────────────────────────────── */}
      <PrefCard iconBg={c.tintViolet} icon="call-outline" iconColor={c.accVioletDeep}>
        <H3>Téléphone</H3>
        <QueryGate query={don}>
          {(d) => {
            const tel = String(
              (d.identity as Record<string, unknown> | null)?.telephone ?? "",
            ).trim();
            return d.identityMeta.phoneVerifiedAt ? (
              <View>
                <View
                  className="flex-row items-center justify-between"
                  style={fieldStyle(c)}
                >
                  <Text style={{ fontSize: 14.5, color: c.text }}>
                    {tel || "Numéro vérifié"}
                  </Text>
                  <View
                    className="flex-row items-center"
                    style={{
                      gap: 5,
                      paddingVertical: 3,
                      paddingHorizontal: 9,
                      borderRadius: 999,
                      backgroundColor: c.goodSoft,
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={13} color={c.good} />
                    <Text style={{ fontSize: 11.5, fontWeight: "600", color: c.good }}>
                      Vérifié
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+33 6 12 34 56 78"
                  placeholderTextColor={c.textMuted}
                  keyboardType="phone-pad"
                  style={fieldStyle(c)}
                />
                <DarkButton
                  label={phoneStart.isPending ? "…" : "Recevoir un code SMS"}
                  disabled={phoneStart.isPending}
                  onPress={() => phoneStart.mutate({ phone })}
                />
                {phoneStart.isSuccess && (
                  <>
                    <TextInput
                      value={code}
                      onChangeText={setCode}
                      placeholder="Code à 6 chiffres"
                      placeholderTextColor={c.textMuted}
                      keyboardType="number-pad"
                      style={fieldStyle(c)}
                    />
                    <Pressable
                      disabled={phoneVerify.isPending}
                      onPress={() => phoneVerify.mutate({ code })}
                      className="items-center active:opacity-70"
                      style={{
                        marginTop: 11,
                        paddingVertical: 14,
                        borderRadius: 13,
                        borderWidth: 1,
                        borderColor: c.borderSoft,
                        backgroundColor: c.surface,
                      }}
                    >
                      <Text style={{ fontSize: 14.5, fontWeight: "600", color: c.text }}>
                        {phoneVerify.isPending ? "…" : "Valider le code"}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            );
          }}
        </QueryGate>
      </PrefCard>

      {/* ── 6. Coordonnées bancaires (RIB / IBAN) ──────────────────────── */}
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

      {/* ── 7. Retrait des gains (Stripe Connect) ──────────────────────── */}
      <PrefCard iconBg={c.tintViolet} icon="cash-outline" iconColor={c.accVioletDeep}>
        <H3>Retrait des gains</H3>
        <QueryGate query={pay}>
          {(p) =>
            !p.detailsSubmitted ? (
              <DarkButton
                label={onboard.isPending ? "…" : "Configurer les paiements"}
                disabled={onboard.isPending}
                onPress={async () => {
                  const r = await onboard.mutateAsync();
                  await WebBrowser.openBrowserAsync(r.url);
                }}
              />
            ) : (
              <View>
                <Text style={{ marginTop: 11, fontSize: 12.5, color: c.textSub }}>
                  Disponible :{" "}
                  {wal.isPending
                    ? "…"
                    : wal.isError
                      ? "—"
                      : eur(wal.data?.availableEur ?? 0)}
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Montant en €"
                  placeholderTextColor={c.textMuted}
                  keyboardType="decimal-pad"
                  style={fieldStyle(c)}
                />
                <DarkButton
                  label={withdraw.isPending ? "…" : "Demander un retrait"}
                  disabled={withdrawDisabled}
                  onPress={() => withdraw.mutate({ amountCents })}
                />
              </View>
            )
          }
        </QueryGate>
      </PrefCard>

      {/* ── 8. Suivi des emails BUUPP (CNIL n° 2026-042) ───────────────── */}
      <View
        className="bg-paper flex-row"
        style={{
          borderRadius: 20,
          borderWidth: 1,
          borderColor: c.borderSoft,
          padding: 20,
          gap: 14,
          shadowColor: "#000000",
          shadowOpacity: 0.05,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 5 },
          elevation: 2,
        }}
      >
        <View
          className="items-center justify-center"
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            backgroundColor: c.tintAmber,
            flexShrink: 0,
          }}
        >
          <Ionicons name="mail-outline" size={21} color={c.accAmber} />
        </View>
        <View className="flex-1">
          <View
            className="flex-row items-start justify-between"
            style={{ gap: 12 }}
          >
            <Text
              className="flex-1 font-serif"
              style={{ fontSize: 19, color: c.text }}
            >
              Suivi des emails BUUPP
            </Text>
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
          </View>
          <Text
            style={{
              marginTop: 8,
              fontSize: 12.5,
              lineHeight: 19,
              color: c.textSub,
            }}
          >
            Les communications BUUPP peuvent inclure un pixel transparent pour
            mesurer le taux d&apos;ouverture de façon agrégée. Aucune IP, aucun
            fingerprint stocké.{"\n"}
            Recommandation CNIL n° 2026-042 — modifiable à tout moment.
          </Text>
        </View>
      </View>
    </ScrollScreen>
  );
}
