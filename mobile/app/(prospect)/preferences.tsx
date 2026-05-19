// Préférences — miroir de la section Prefs du dashboard web
// (Prospect.jsx fn Prefs). Données : /api/prospect/donnees,
// /api/prospect/verification, /api/prospect/payout/status,
// /api/me/email-tracking. Actions : phone/rib/payout/email-tracking,
// zone géographique (rayon + nationalOptIn via patchDonnees),
// paliers partageables (tierAction hide/restore),
// types de campagne et catégories (note: pas d'endpoint dédié côté API
// — blocs rendus read-only, voir concern en bas).
import { useState } from "react";
import { Alert, Pressable, Switch, Text, TextInput, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import {
  Card,
  eur,
  QueryGate,
  ScrollScreen,
} from "../../components/screen";
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

export default function Preferences() {
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

  // NaN-guard sur le montant de retrait
  const amountCents = Math.round(
    parseFloat(amount.replace(",", ".")) * 100,
  );
  const withdrawDisabled =
    withdraw.isPending ||
    !Number.isFinite(amountCents) ||
    amountCents <= 0;

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
      hero={{
        eyebrow: "Préférences",
        title: "Qui peut vous contacter",
        desc: "Types de campagne, catégories, zone, paliers de données, téléphone, coordonnées bancaires et communications.",
      }}
    >
      {/* ── 1. Types de campagne acceptés ───────────────────────────────
          Bloc web : ctx.profile.allCampaignTypes / campaignTypes.
          Pas d'endpoint dédié en production → affiché en lecture seule
          (cf. concern : l'API /api/prospect/donnees ne retourne pas
          ces champs). */}
      <Card className="gap-3" badge={{ icon: "megaphone-outline", tone: "sky" }}>
        <Text className="font-serif text-lg text-ink">
          Types de campagne acceptés
        </Text>
        <Text className="text-xs text-ink-4">
          Choisissez pour quels types de campagne vous acceptez d&apos;être
          sollicité.
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {CAMPAIGN_TYPE_LIST.map((t) => (
            <View
              key={t}
              className="rounded-full border border-line bg-paper px-3 py-1.5"
            >
              <Text className="text-xs text-ink-3">{t}</Text>
            </View>
          ))}
        </View>
        <Text className="text-[10px] italic text-ink-4">
          Préférence non modifiable pour le moment.
        </Text>
      </Card>

      {/* ── 2. Catégories autorisées ─────────────────────────────────────
          Même situation : pas d'endpoint API dédié → lecture seule. */}
      <Card className="gap-3" badge={{ icon: "pricetags-outline", tone: "amber" }}>
        <Text className="font-serif text-lg text-ink">
          Catégories autorisées
        </Text>
        <Text className="text-xs text-ink-4">
          Seuls les professionnels de ces secteurs pourront vous adresser
          une demande.
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {CATEGORY_LIST.map((c) => (
            <View
              key={c}
              className="rounded-full border border-line bg-paper px-3 py-1.5"
            >
              <Text className="text-xs text-ink-3">{c}</Text>
            </View>
          ))}
        </View>
        <Text className="text-[10px] italic text-ink-4">
          Préférence non modifiable pour le moment.
        </Text>
      </Card>

      {/* ── 3. Zone géographique ─────────────────────────────────────────
          Données : localisation.targetingRadiusKm + nationalOptIn
          depuis /api/prospect/donnees. Mutation : PATCH donnees tier
          localisation. Le slider est remplacé par +/- boutons (pas de
          Slider natif inclus dans la spec Expo). */}
      <Card className="gap-3" badge={{ icon: "location-outline", tone: "coral" }}>
        <Text className="font-serif text-lg text-ink">Zone géographique</Text>
        <QueryGate query={don}>
          {(d) => {
            const loc = (d.localisation ?? {}) as Record<string, unknown>;
            const ville      = String(loc.ville ?? "").trim();
            const codePostal = String(loc.codePostal ?? "").trim();
            const persisted  = parseInt(String(loc.targetingRadiusKm ?? "25"), 10);
            const radius     = Number.isFinite(persisted) && persisted >= 5 && persisted <= 100
              ? persisted
              : 25;
            // rowToUi serialises the boolean column as the string "true"/"false"
            // (TierFields = Record<string,string|null>). Compare against "false"
            // to recover the real boolean; absent/null → default true.
            const nationalOptIn =
              loc.nationalOptIn !== "false" && loc.nationalOptIn !== null;
            const zoneLocked = !ville;

            return (
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-[10px] text-ink-4">Centrée sur</Text>
                    <Text className="text-sm font-medium text-ink">
                      {zoneLocked
                        ? "Ville non renseignée"
                        : codePostal
                          ? `${ville}, ${codePostal}`
                          : ville}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[10px] text-ink-4">Rayon</Text>
                    <Text className="font-serif text-xl text-violet">
                      {nationalOptIn ? "National" : `${radius} km`}
                    </Text>
                  </View>
                </View>

                {/* Boutons +/- en remplacement du slider */}
                {!nationalOptIn && !zoneLocked && (
                  <View className="flex-row items-center gap-3">
                    <Pressable
                      disabled={radius <= 5 || patchDon.isPending}
                      className="flex-1 items-center rounded-xl border border-line bg-paper py-2"
                      onPress={() =>
                        patchDon.mutate({
                          tier: "localisation",
                          fields: {
                            targetingRadiusKm: Math.max(5, radius - 5),
                          },
                        })
                      }
                    >
                      <Text className="text-base font-semibold text-ink">−5 km</Text>
                    </Pressable>
                    <Pressable
                      disabled={radius >= 100 || patchDon.isPending}
                      className="flex-1 items-center rounded-xl border border-line bg-paper py-2"
                      onPress={() =>
                        patchDon.mutate({
                          tier: "localisation",
                          fields: {
                            targetingRadiusKm: Math.min(100, radius + 5),
                          },
                        })
                      }
                    >
                      <Text className="text-base font-semibold text-ink">+5 km</Text>
                    </Pressable>
                  </View>
                )}
                {zoneLocked && (
                  <Text className="text-xs text-ink-4">
                    Renseignez votre ville dans &quot;Mes données&quot; → Localisation
                    pour activer le rayon de ciblage.
                  </Text>
                )}

                {/* Étendre au niveau national */}
                <Pressable
                  disabled={zoneLocked || patchDon.isPending}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: nationalOptIn }}
                  accessibilityLabel="Ciblage national"
                  className={`flex-row items-start gap-3 rounded-xl border p-3 ${
                    nationalOptIn ? "border-violet bg-violet/5" : "border-line bg-paper"
                  } ${zoneLocked ? "opacity-50" : ""}`}
                  onPress={() => {
                    if (zoneLocked) return;
                    patchDon.mutate({
                      tier: "localisation",
                      fields: { nationalOptIn: !nationalOptIn },
                    });
                  }}
                >
                  <View
                    className={`mt-0.5 h-4 w-4 items-center justify-center rounded ${
                      nationalOptIn ? "bg-violet" : "border border-line bg-paper"
                    }`}
                  >
                    {nationalOptIn && (
                      <Text className="text-[9px] font-bold text-paper">✓</Text>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-ink">
                      Étendre au niveau national
                    </Text>
                    <Text className="text-[11px] leading-4 text-ink-4">
                      J&apos;accepte d&apos;être contacté par des pros partout en
                      France, indépendamment du rayon local.
                    </Text>
                  </View>
                </Pressable>
              </View>
            );
          }}
        </QueryGate>
        {patchDon.isError && (
          <Text className="text-xs text-bad">Échec — réessayez.</Text>
        )}
      </Card>

      {/* ── 4. Paliers partageables ───────────────────────────────────────
          Données : hiddenTiers + removedTiers depuis /api/prospect/donnees.
          Mutation : POST /api/prospect/tier (action: hide | restore). */}
      <Card className="gap-3" badge={{ icon: "layers-outline", tone: "violet" }}>
        <Text className="font-serif text-lg text-ink">Paliers partageables</Text>
        <Text className="text-xs text-ink-4">
          Tous vos paliers sont partagés par défaut. Décochez ceux que vous
          ne souhaitez pas voir transmis (réversible — aucune donnée n&apos;est
          effacée).
        </Text>
        <QueryGate query={don}>
          {(d) => {
            const hiddenSet  = new Set(d.hiddenTiers ?? []);
            const removedSet = new Set(d.removedTiers ?? []);
            return (
              <View>
                {TIER_ROWS.map((row, idx) => {
                  const hidden  = hiddenSet.has(row.key);
                  const removed = removedSet.has(row.key);
                  const shared  = !hidden && !removed;
                  return (
                    <Pressable
                      key={row.key}
                      disabled={removed || tierAction.isPending}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: shared }}
                      accessibilityLabel={`Palier ${row.n} — ${row.name}`}
                      className={`flex-row items-center justify-between py-3 ${
                        idx < TIER_ROWS.length - 1
                          ? "border-b border-line"
                          : ""
                      } ${removed ? "opacity-50" : ""}`}
                      onPress={() => {
                        if (removed) return;
                        tierAction.mutate({
                          tier: row.key,
                          action: shared ? "hide" : "restore",
                        });
                      }}
                    >
                      <View className="flex-row items-center gap-3">
                        <View
                          className={`h-4 w-4 items-center justify-center rounded ${
                            shared ? "bg-violet" : "border border-line bg-paper"
                          }`}
                        >
                          {shared && (
                            <Text className="text-[9px] font-bold text-paper">
                              ✓
                            </Text>
                          )}
                        </View>
                        <Text className="font-serif text-base text-ink">
                          Palier {row.n}
                        </Text>
                        <Text className="text-xs text-ink-4">{row.name}</Text>
                        {removed && (
                          <View className="rounded-full bg-line px-2 py-0.5">
                            <Text className="text-[9px] text-ink-4">
                              supprimé
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text className="font-mono text-[10px] text-ink-4">
                        {row.range}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          }}
        </QueryGate>
        {tierAction.isError && (
          <Text className="text-xs text-bad">Échec — réessayez.</Text>
        )}
      </Card>

      {/* ── 5. Téléphone & vérification SMS ─────────────────────────────
          Données : identityMeta.phoneVerifiedAt depuis /api/prospect/donnees.
          Mutations : POST /api/prospect/phone/start + /verify. */}
      <Card className="gap-3" badge={{ icon: "call-outline", tone: "sky" }}>
        <Text className="font-serif text-lg text-ink">Téléphone</Text>
        <QueryGate query={don}>
          {(d) =>
            d.identityMeta.phoneVerifiedAt ? (
              <Text className="text-sm text-good">✓ Numéro vérifié</Text>
            ) : (
              <View className="gap-2">
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+33612345678"
                  keyboardType="phone-pad"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink"
                />
                <Pressable
                  disabled={phoneStart.isPending}
                  className="items-center rounded-full bg-ink py-3"
                  onPress={() => phoneStart.mutate({ phone })}
                >
                  <Text className="text-sm font-semibold text-paper">
                    {phoneStart.isPending ? "…" : "Recevoir un code SMS"}
                  </Text>
                </Pressable>
                {phoneStart.isSuccess && (
                  <>
                    <TextInput
                      value={code}
                      onChangeText={setCode}
                      placeholder="Code à 6 chiffres"
                      keyboardType="number-pad"
                      className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink"
                    />
                    <Pressable
                      disabled={phoneVerify.isPending}
                      className="items-center rounded-full border border-line py-3"
                      onPress={() => phoneVerify.mutate({ code })}
                    >
                      <Text className="text-sm text-ink-2">
                        {phoneVerify.isPending ? "…" : "Valider le code"}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            )
          }
        </QueryGate>
      </Card>

      {/* ── 6. RIB / IBAN ────────────────────────────────────────────────
          Données : ver.rib depuis /api/prospect/verification.
          Mutation : POST /api/prospect/rib { iban, bic, holderName }. */}
      <Card className="gap-3" badge={{ icon: "card-outline", tone: "teal" }}>
        <Text className="font-serif text-lg text-ink">
          Coordonnées bancaires
        </Text>
        <QueryGate query={ver}>
          {(v) =>
            v.rib ? (
              <View>
                <Text className="text-sm text-ink-2">{v.rib.ibanMasked}</Text>
                <Text className="text-xs text-ink-4">
                  {v.rib.holderName} · {v.rib.bic} ·{" "}
                  {v.rib.validated ? "validé" : "en attente"}
                </Text>
                <Pressable
                  disabled={delRib.isPending}
                  className="mt-2 self-start rounded-full border border-line px-4 py-2"
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
                  <Text className="text-xs text-bad">
                    {delRib.isPending ? "…" : "Supprimer le RIB"}
                  </Text>
                </Pressable>
                {delRib.isError && (
                  <Text className="text-xs text-bad">Échec — réessayez.</Text>
                )}
              </View>
            ) : (
              <View className="gap-2">
                <TextInput
                  value={iban}
                  onChangeText={setIban}
                  placeholder="IBAN"
                  autoCapitalize="characters"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink"
                />
                <TextInput
                  value={bic}
                  onChangeText={setBic}
                  placeholder="BIC"
                  autoCapitalize="characters"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink"
                />
                <TextInput
                  value={holder}
                  onChangeText={setHolder}
                  placeholder="Titulaire du compte"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink"
                />
                <Pressable
                  disabled={saveRib.isPending}
                  className="items-center rounded-full bg-ink py-3"
                  onPress={() =>
                    saveRib.mutate({ iban, bic, holderName: holder })
                  }
                >
                  <Text className="text-sm font-semibold text-paper">
                    {saveRib.isPending ? "…" : "Enregistrer le RIB"}
                  </Text>
                </Pressable>
              </View>
            )
          }
        </QueryGate>
      </Card>

      {/* ── 7. Retrait des gains (Stripe Connect) ───────────────────────
          Données : pay (PayoutStatus) + wal.availableEur.
          Mutations : POST /api/prospect/payout/onboarding (URL Stripe)
                     POST /api/prospect/payout/withdraw { amountCents, method }. */}
      <Card className="gap-3" badge={{ icon: "cash-outline", tone: "violet" }}>
        <Text className="font-serif text-lg text-ink">Retrait des gains</Text>
        <QueryGate query={pay}>
          {(p) =>
            !p.detailsSubmitted ? (
              <Pressable
                disabled={onboard.isPending}
                className="items-center rounded-full bg-ink py-3"
                onPress={async () => {
                  const r = await onboard.mutateAsync();
                  await WebBrowser.openBrowserAsync(r.url);
                }}
              >
                <Text className="text-sm font-semibold text-paper">
                  {onboard.isPending ? "…" : "Configurer les paiements"}
                </Text>
              </Pressable>
            ) : (
              <View className="gap-2">
                <Text className="text-xs text-ink-4">
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
                  keyboardType="decimal-pad"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink"
                />
                <Pressable
                  disabled={withdrawDisabled}
                  className={`items-center rounded-full py-3 ${
                    withdrawDisabled ? "bg-ink/40" : "bg-ink"
                  }`}
                  onPress={() => withdraw.mutate({ amountCents })}
                >
                  <Text className="text-sm font-semibold text-paper">
                    {withdraw.isPending ? "…" : "Demander un retrait"}
                  </Text>
                </Pressable>
              </View>
            )
          }
        </QueryGate>
      </Card>

      {/* ── 8. Suivi des emails BUUPP ────────────────────────────────────
          Données : mail.consent depuis /api/me/email-tracking (GET).
          Mutation : POST /api/me/email-tracking { consent }.
          Conformité CNIL n° 2026-042 (cf. web EmailTrackingConsentCard). */}
      <Card className="flex-row items-center justify-between" badge={{ icon: "mail-outline", tone: "amber" }}>
        <View className="flex-1 pr-3">
          <Text className="font-serif text-lg text-ink">
            Suivi des emails BUUPP
          </Text>
          <Text className="text-xs leading-4 text-ink-4">
            Les communications BUUPP peuvent inclure un pixel transparent
            pour mesurer le taux d&apos;ouverture de façon agrégée. Aucune IP,
            aucun fingerprint stocké.{"\n"}
            <Text className="text-[10px] text-ink-4">
              Recommandation CNIL n° 2026-042 — modifiable à tout moment.
            </Text>
          </Text>
        </View>
        <QueryGate query={mail}>
          {(m) => (
            <Switch
              value={m.consent}
              onValueChange={(v) => setMail.mutate({ consent: v })}
              accessibilityLabel="Suivi des emails BUUPP"
            />
          )}
        </QueryGate>
      </Card>
    </ScrollScreen>
  );
}
