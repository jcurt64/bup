// Wizard de création de campagne (8 étapes, miroir du dashboard web) :
// 1 Objectif (sous-types) · 2 Dates (durée) · 3 Données (paliers) ·
// 4 Ciblage (géo/vérif) · 5 Budget (coût/contacts) · 6 Mots-clés ·
// 7 Description · 8 Récap (+ lancement réel POST /api/pro/campaigns).
// L'objectif est passé via ?id= depuis la grille « Créer une campagne ».
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";

import { Card, eur, ScrollScreen } from "../../components/screen";
import { OBJECTIVES } from "../../lib/pro-objectives";
import {
  AGE_RANGES,
  AGE_RANGES_NO_TOUS,
  cpcRange,
  DURATIONS,
  durMs,
  GEO_ZONES,
  TIER_REWARDS,
  VERIF_LEVELS,
  type DurationKey,
  type VerifLevel,
} from "../../lib/pro-pricing";
import { useCreateCampaign, useProInfo, useProPlan, useProWallet } from "../../lib/queries";
import { ApiError } from "../../lib/api";
import { clearDraft, loadDraft, saveDraft } from "../../lib/campaign-draft";
import { useTheme } from "../../lib/theme";

const STEPS = ["Objectif", "Dates", "Données", "Ciblage", "Budget", "Mots-clés", "Description", "Récap"];

// — Petite pastille sélectionnable réutilisée par les étapes (chips). —
function Chip({
  label,
  sub,
  on,
  onPress,
  flex,
}: {
  label: string;
  sub?: string;
  on: boolean;
  onPress: () => void;
  flex?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      className="rounded-2xl px-3 py-2.5 active:opacity-80"
      style={{
        flexGrow: flex ? 1 : 0,
        borderWidth: 1.5,
        borderColor: on ? c.accent : c.borderSoft,
        backgroundColor: on ? c.accentSoft : c.surface,
      }}
    >
      <Text className="text-[14px] font-semibold" style={{ color: on ? c.accentInk : c.text }}>
        {label}
      </Text>
      {sub ? (
        <Text className="text-[11px]" style={{ color: on ? c.accentInk : c.textMuted }}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

function StepHeader({ step, max, go }: { step: number; max: number; go: (s: number) => void }) {
  const { c } = useTheme();
  return (
    <View className="flex-row items-center justify-between" style={{ marginBottom: 4 }}>
      {STEPS.map((_, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        const reachable = n <= max;
        return (
          <Pressable
            key={n}
            disabled={!reachable}
            onPress={() => reachable && go(n)}
            className="items-center justify-center"
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              backgroundColor: active || done ? c.accent : c.surface,
              borderWidth: 1.5,
              borderColor: active || done ? c.accent : c.borderSoft,
            }}
          >
            {done ? (
              <Ionicons name="checkmark" size={15} color={c.btnText} />
            ) : (
              <Text
                className="text-[12px] font-bold"
                style={{ color: active ? c.btnText : c.textMuted }}
              >
                {n}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ProWizard() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const obj = OBJECTIVES.find((o) => o.id === id) ?? null;

  const plan = useProPlan();
  const wallet = useProWallet();
  const info = useProInfo();
  const create = useCreateCampaign();

  // Gate « informations société » : la création de campagne est refusée
  // côté backend sans raison sociale + ville → on bloque le lancement et on
  // l'indique dès l'étape 1, avec un raccourci vers « Mes informations ».
  const infoLoaded = info.isSuccess;
  // Miroir backend : une raison sociale contenant « @ » = placeholder e-mail
  // résiduel → considérée non renseignée. Ville requise aussi.
  const rawRaison = info.data?.raisonSociale?.trim() ?? "";
  const infoComplete = rawRaison.length > 0 && !rawRaison.includes("@") && !!info.data?.ville?.trim();

  const planTierCap = plan.data?.plan === "pro" ? 5 : 3;
  const cycleCount = plan.data?.cycleCount ?? 0;
  const planFeeCents = cycleCount === 0 ? plan.data?.monthlyCents ?? 0 : 0;
  const availableCents = Math.round((wallet.data?.walletAvailableEur ?? 0) * 100);

  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [subTypes, setSubTypes] = useState<Set<string>>(new Set());
  const [duration, setDuration] = useState<DurationKey>("7d");
  const [tiers, setTiers] = useState<number[]>([1]);
  const [geo, setGeo] = useState("national");
  const [ages, setAges] = useState<Set<string>>(new Set());
  const [verif, setVerif] = useState<VerifLevel>("p0");
  const [excludeCertified, setExcludeCertified] = useState(false);
  const [cpcCents, setCpcCents] = useState(100);
  const [contacts, setContacts] = useState("50");
  const [keywords, setKeywords] = useState("");
  const [kwFilter, setKwFilter] = useState(false);
  const [brief, setBrief] = useState("");
  const [cgu, setCgu] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);

  // Restaure le brouillon au montage (si c'est le même objectif). Tant que
  // l'hydratation n'est pas finie, on NE sauvegarde PAS (sinon l'état par
  // défaut écraserait le brouillon).
  useEffect(() => {
    let alive = true;
    loadDraft().then((d) => {
      if (!alive) return;
      if (d && d.objectiveId === id) {
        setSubTypes(new Set(d.subTypes));
        setDuration(d.duration as DurationKey);
        setTiers(d.tiers);
        setGeo(d.geo);
        setAges(new Set(d.ages ?? []));
        setVerif(d.verif as VerifLevel);
        setExcludeCertified(d.excludeCertified);
        setCpcCents(d.cpcCents);
        setContacts(d.contacts);
        setKeywords(d.keywords);
        setKwFilter(d.kwFilter);
        setBrief(d.brief);
        setStep(d.step);
        setMaxStep(Math.max(d.step, 1));
        setRestored(true);
      }
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  // Sauvegarde continue du brouillon après hydratation.
  useEffect(() => {
    if (!hydrated || !id) return;
    void saveDraft({
      objectiveId: id,
      step,
      subTypes: [...subTypes],
      duration,
      tiers,
      geo,
      ages: [...ages],
      verif,
      excludeCertified,
      cpcCents,
      contacts,
      keywords,
      kwFilter,
      brief,
      updatedAt: Date.now(),
    });
  }, [hydrated, id, step, subTypes, duration, tiers, geo, ages, verif, excludeCertified, cpcCents, contacts, keywords, kwFilter, brief]);

  const range = useMemo(() => cpcRange(tiers, duration, verif), [tiers, duration, verif]);
  // Recale le coût par contact dans la fourchette autorisée à chaque
  // changement de paliers / durée / vérification (défaut = minimum garanti).
  useEffect(() => {
    setCpcCents((cur) => {
      if (range.effMin === 0) return cur;
      if (cur < range.effMin || cur > range.effMax) return range.effMin;
      return cur;
    });
  }, [range]);

  const contactsNum = Math.max(0, Math.floor(Number(contacts) || 0));
  const budgetCents = contactsNum * cpcCents;
  const commissionCents = Math.round(budgetCents * 0.1);
  const neededCents = budgetCents + commissionCents + planFeeCents;
  const fundsOk = availableCents >= neededCents;

  const toggleSet = (set: Set<string>, k: string) => {
    const n = new Set(set);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    return n;
  };
  const toggleTier = (t: number) =>
    setTiers((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t].sort()));
  // Tranches d'âge — « Tous » coche/décoche tout ; tout cocher ajoute « Tous »
  // (logique miroir du wizard web).
  const toggleAge = (a: string) =>
    setAges((prev) => {
      if (a === "Tous") {
        const allOn = AGE_RANGES_NO_TOUS.every((r) => prev.has(r));
        return allOn ? new Set() : new Set(AGE_RANGES);
      }
      const n = new Set(prev);
      if (n.has(a)) n.delete(a);
      else n.add(a);
      if (AGE_RANGES_NO_TOUS.every((r) => n.has(r))) n.add("Tous");
      else n.delete("Tous");
      return n;
    });

  if (!obj) {
    return (
      <ScrollScreen headerVariant="pro" hero={{ nav: "back", eyebrow: "Campagne", title: "Objectif introuvable" }}>
        <Card>
          <Text className="text-sm text-ink-4">Cet objectif n&apos;existe pas.</Text>
        </Card>
      </ScrollScreen>
    );
  }

  const canNext = (): boolean => {
    switch (step) {
      case 1:
        return subTypes.size >= 1;
      case 3:
        return tiers.length >= 1;
      case 5:
        return contactsNum >= 1 && cpcCents >= range.effMin && cpcCents <= range.effMax;
      case 7:
        return brief.trim().length > 0;
      default:
        return true;
    }
  };

  const goNext = () => {
    if (!canNext()) return;
    const next = Math.min(STEPS.length, step + 1);
    setStep(next);
    setMaxStep((m) => Math.max(m, next));
  };
  const goPrev = () => setStep((s) => Math.max(1, s - 1));
  const goTo = (s: number) => s <= maxStep && setStep(s);

  async function launch() {
    if (!obj || !cgu || !fundsOk || !infoComplete) return;
    // Garde-fou (notamment après restauration d'un brouillon qui aurait sauté
    // à l'étape 8) : on vérifie chaque étape requise et on y renvoie si vide.
    const firstInvalid =
      subTypes.size < 1
        ? 1
        : tiers.length < 1
          ? 3
          : contactsNum < 1 || cpcCents < range.effMin || cpcCents > range.effMax
            ? 5
            : brief.trim().length < 1
              ? 7
              : null;
    if (firstInvalid) {
      setStep(firstInvalid);
      Alert.alert("Étape incomplète", "Complétez cette étape avant de lancer votre campagne.");
      return;
    }
    const now = Date.now();
    try {
      const res = await create.mutateAsync({
        objectiveId: obj.id,
        subTypes: [...subTypes],
        requiredTiers: tiers,
        geo,
        ages: [...ages],
        verifLevel: verif,
        contacts: contactsNum,
        startDate: new Date(now).toISOString(),
        endDate: new Date(now + durMs(duration)).toISOString(),
        durationKey: duration,
        brief: brief.trim(),
        costPerContactCents: cpcCents,
        budgetCents,
        keywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        kwFilter,
        poolMode: "all",
        excludeCertified,
        founder_bonus_enabled: true,
      });
      void clearDraft(); // campagne lancée → on jette le brouillon
      Alert.alert(
        "Campagne lancée 🎉",
        `${res.matchedCount} prospect${res.matchedCount > 1 ? "s" : ""} ciblé${res.matchedCount > 1 ? "s" : ""}.\nRéférence : ${res.code}`,
        [{ text: "Voir mes campagnes", onPress: () => router.replace("/(pro)/campagnes") }],
      );
    } catch (e) {
      let msg = "Réessayez dans un instant.";
      if (e instanceof ApiError) {
        try {
          const b = JSON.parse(e.body) as { error?: string; message?: string };
          if (b.message) msg = b.message;
          else if (b.error === "insufficient_funds") msg = "Crédit insuffisant — rechargez votre compte.";
          else if (b.error === "mode_cap_reached") msg = "Quota de campagnes atteint pour ce cycle (changez de plan).";
          else if (b.error === "tiers_above_plan_cap") msg = "Ces paliers dépassent votre plan.";
          else if (b.error) msg = b.error;
        } catch {
          /* corps non-JSON */
        }
      }
      Alert.alert("Lancement impossible", msg);
    }
  }

  return (
    <ScrollScreen
      headerVariant="pro"
      hero={{ nav: "back", eyebrow: `Étape ${step}/8 · ${STEPS[step - 1]}`, title: obj.name }}
    >
      <StepHeader step={step} max={maxStep} go={goTo} />

      {/* Brouillon restauré — message « tout gardé pour vous » + recommencer. */}
      {restored ? (
        <View className="rounded-2xl px-4 py-3" style={{ backgroundColor: c.accentSoft }}>
          <View className="flex-row items-center gap-2">
            <Ionicons name="bookmark" size={18} color={c.accentInk} />
            <Text className="flex-1 text-[12.5px]" style={{ color: c.accentInk }}>
              Nous avons tout gardé pour vous — reprenez où vous en étiez.
            </Text>
            <Pressable onPress={() => setRestored(false)} hitSlop={8} accessibilityLabel="Fermer">
              <Ionicons name="close" size={16} color={c.accentInk} />
            </Pressable>
          </View>
          <Pressable
            onPress={() => {
              void clearDraft();
              router.replace("/(pro)/creation");
            }}
            accessibilityRole="button"
            className="mt-1 self-start active:opacity-70"
          >
            <Text className="text-[12px] font-semibold underline" style={{ color: c.accentInk }}>
              Recommencer une nouvelle campagne
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Gate informations société — visible dès l'étape 1, bloque le lancement. */}
      {infoLoaded && !infoComplete ? (
        <View
          className="rounded-2xl px-4 py-3"
          style={{ backgroundColor: c.amberSoft, borderWidth: 1, borderColor: c.amber }}
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="business-outline" size={18} color={c.accAmber} />
            <Text className="flex-1 text-[12.5px] font-semibold" style={{ color: c.accAmber }}>
              Renseignez une raison sociale valide (pas un e-mail) et votre ville avant de lancer.
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/(pro)/informations")}
            accessibilityRole="button"
            className="mt-2 flex-row items-center justify-center gap-1.5 rounded-full py-2.5 active:opacity-80"
            style={{ backgroundColor: c.btnBg }}
          >
            <Ionicons name="arrow-forward" size={15} color={c.btnText} />
            <Text className="text-[14px] font-semibold" style={{ color: c.btnText }}>
              Compléter mes informations
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* ÉTAPE 1 — Objectif : sous-types en grille 2 colonnes. */}
      {step === 1 ? (
        <View className="gap-2">
          <Text className="text-[13px] text-ink-3">
            Sélectionnez la ou les opérations souhaitées.
          </Text>
          <View className="flex-row flex-wrap justify-between">
            {obj.sub.map((s) => {
              const on = subTypes.has(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSubTypes((cur) => toggleSet(cur, s.id))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  className="rounded-2xl p-3 active:opacity-80"
                  style={{
                    width: "48%",
                    marginBottom: 10,
                    borderWidth: 1.5,
                    borderColor: on ? c.accent : c.borderSoft,
                    backgroundColor: on ? c.accentSoft : c.surface,
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="font-mono text-[11px] text-ink-4">{s.cost.toFixed(2)} €</Text>
                    {on ? <Ionicons name="checkmark-circle" size={16} color={c.accent} /> : null}
                  </View>
                  <Text className="mt-1 text-[13.5px] font-semibold" style={{ color: on ? c.accentInk : c.text }}>
                    {s.name}
                  </Text>
                  <Text className="mt-0.5 text-[11px] leading-4 text-ink-4" numberOfLines={3}>
                    {s.desc}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* ÉTAPE 2 — Durée de diffusion. Le « flash deal » (1h) est mis en
          avant ; les durées standard (24h/48h/7d) en dessous. */}
      {step === 2 ? (
        <View className="gap-3">
          <Text className="text-[13px] text-ink-3">
            Durée de diffusion (et fenêtre de réponse du prospect).
          </Text>

          {/* Flash deal — 1 heure, mis en valeur. */}
          {(() => {
            const on = duration === "1h";
            return (
              <Pressable
                onPress={() => setDuration("1h")}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                className="rounded-3xl p-4 active:opacity-80"
                style={{
                  borderWidth: 2,
                  borderColor: on ? c.amber : c.amberSoft,
                  backgroundColor: c.amberSoft,
                }}
              >
                <View className="flex-row items-center" style={{ gap: 10 }}>
                  <View
                    className="items-center justify-center"
                    style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.amber }}
                  >
                    <Ionicons name="flash" size={22} color="#FFFFFF" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center" style={{ gap: 6 }}>
                      <Text className="font-serif text-lg" style={{ color: c.accAmber }}>
                        Flash deal · 1 heure
                      </Text>
                      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: c.amber }}>
                        <Text className="text-[10px] font-bold text-white">×3</Text>
                      </View>
                    </View>
                    <Text className="mt-0.5 text-[12px] leading-4" style={{ color: c.accAmber }}>
                      Diffusion express — rémunération prospect maximale, visibilité prioritaire dans l&apos;app.
                    </Text>
                  </View>
                  {on ? <Ionicons name="checkmark-circle" size={22} color={c.amber} /> : null}
                </View>
              </Pressable>
            );
          })()}

          <Text className="mt-1 text-[11px] font-bold uppercase text-ink-4" style={{ letterSpacing: 1 }}>
            Durées standard
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            {DURATIONS.filter((d) => d.key !== "1h").map((d) => (
              <Chip
                key={d.key}
                label={d.label}
                sub={`coût ×${d.mult}`}
                on={duration === d.key}
                onPress={() => setDuration(d.key)}
                flex
              />
            ))}
          </View>
          <Text className="mt-1 text-[12px] text-ink-4">
            Plus la fenêtre est courte, plus la rémunération du prospect (et le coût) est élevée.
          </Text>
        </View>
      ) : null}

      {/* ÉTAPE 3 — Données / paliers requis. */}
      {step === 3 ? (
        <View className="gap-2">
          <Text className="text-[13px] text-ink-3">
            Paliers de données demandés (votre plan autorise 1 à {planTierCap}).
          </Text>
          <View className="gap-2">
            {([1, 2, 3, 4, 5] as const).map((t) => {
              const locked = t > planTierCap;
              const on = tiers.includes(t);
              const r = TIER_REWARDS[t];
              return (
                <Pressable
                  key={t}
                  disabled={locked}
                  onPress={() => toggleTier(t)}
                  className="flex-row items-center rounded-2xl p-3 active:opacity-80"
                  style={{
                    gap: 10,
                    opacity: locked ? 0.45 : 1,
                    borderWidth: 1.5,
                    borderColor: on ? c.accent : c.borderSoft,
                    backgroundColor: on ? c.accentSoft : c.surface,
                  }}
                >
                  <View
                    className="items-center justify-center"
                    style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: on ? c.accent : c.ink5, backgroundColor: on ? c.accent : "transparent" }}
                  >
                    {on ? <Ionicons name="checkmark" size={14} color={c.btnText} /> : null}
                  </View>
                  <View className="flex-1">
                    <Text className="text-[14px] font-semibold text-ink">
                      Palier {t} · {r.label}
                    </Text>
                    <Text className="text-[11px] text-ink-4">
                      {(r.minCents / 100).toFixed(2)} – {(r.maxCents / 100).toFixed(2)} € {locked ? "· plan supérieur requis" : ""}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* ÉTAPE 4 — Ciblage : zone + vérification. */}
      {step === 4 ? (
        <View className="gap-3">
          <View>
            <Text className="mb-2 text-[13px] text-ink-3">Zone géographique</Text>
            <View className="flex-row flex-wrap" style={{ gap: 10 }}>
              {GEO_ZONES.map((z) => (
                <Chip key={z.key} label={z.label} sub={z.sub} on={geo === z.key} onPress={() => setGeo(z.key)} flex />
              ))}
            </View>
          </View>
          <View>
            <Text className="mb-2 text-[13px] text-ink-3">Tranche d&apos;âge (multi-sélection)</Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {AGE_RANGES.map((a) => {
                const on = ages.has(a);
                return (
                  <Pressable
                    key={a}
                    onPress={() => toggleAge(a)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    className="rounded-full px-3.5 py-2 active:opacity-80"
                    style={{
                      borderWidth: 1.5,
                      borderColor: on ? c.accent : c.borderSoft,
                      backgroundColor: on ? c.accent : c.surface,
                    }}
                  >
                    <Text className="text-[13px] font-semibold" style={{ color: on ? c.btnText : c.textSub }}>
                      {a}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View>
            <Text className="mb-2 text-[13px] text-ink-3">Niveau de vérification minimum</Text>
            <View className="flex-row flex-wrap" style={{ gap: 10 }}>
              {VERIF_LEVELS.map((v) => (
                <Chip key={v.key} label={v.label} sub={`×${v.mult}`} on={verif === v.key} onPress={() => setVerif(v.key)} flex />
              ))}
            </View>
          </View>
          <Pressable
            onPress={() => setExcludeCertified((v) => !v)}
            className="flex-row items-center rounded-2xl border bg-paper p-3 active:opacity-80"
            style={{ gap: 10, borderColor: excludeCertified ? c.accent : c.borderSoft }}
          >
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: excludeCertified ? c.accent : c.ink5, backgroundColor: excludeCertified ? c.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
              {excludeCertified ? <Ionicons name="checkmark" size={14} color={c.btnText} /> : null}
            </View>
            <Text className="flex-1 text-[13px] text-ink-2">Exclure les profils « certifié confiance »</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ÉTAPE 5 — Budget : coût par contact + nombre. */}
      {step === 5 ? (
        <View className="gap-3">
          <Card>
            <Text className="text-[13px] text-ink-3">Coût par contact</Text>
            <Text className="text-[11px] text-ink-4">
              Autorisé : {(range.effMin / 100).toFixed(2)} – {(range.effMax / 100).toFixed(2)} €
            </Text>
            <View className="mt-2 flex-row items-center justify-between">
              <Pressable
                onPress={() => setCpcCents((v) => Math.max(range.effMin, v - 10))}
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: c.surface2 }}
              >
                <Ionicons name="remove" size={20} color={c.ink} />
              </Pressable>
              <Text className="font-serif text-3xl text-ink">{(cpcCents / 100).toFixed(2)} €</Text>
              <Pressable
                onPress={() => setCpcCents((v) => Math.min(range.effMax, v + 10))}
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: c.surface2 }}
              >
                <Ionicons name="add" size={20} color={c.ink} />
              </Pressable>
            </View>
          </Card>
          <View>
            <Text className="mb-1 text-[13px] text-ink-3">Nombre de contacts souhaités</Text>
            <TextInput
              value={contacts}
              onChangeText={setContacts}
              keyboardType="number-pad"
              placeholder="50"
              placeholderTextColor={c.textMuted}
              style={{ backgroundColor: c.field, borderColor: c.borderSoft, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: c.text }}
            />
          </View>
          <Card>
            <View className="flex-row justify-between">
              <Text className="text-[13px] text-ink-3">Budget campagne</Text>
              <Text className="font-mono text-[13px] text-ink">{eur(budgetCents / 100)}</Text>
            </View>
            <View className="mt-1 flex-row justify-between">
              <Text className="text-[12px] text-ink-4">Commission BUUPP (10 %)</Text>
              <Text className="font-mono text-[12px] text-ink-4">{eur(commissionCents / 100)}</Text>
            </View>
            {planFeeCents > 0 ? (
              <View className="mt-1 flex-row justify-between">
                <Text className="text-[12px] text-ink-4">Accès cycle ({plan.data?.label})</Text>
                <Text className="font-mono text-[12px] text-ink-4">{eur(planFeeCents / 100)}</Text>
              </View>
            ) : null}
            <View className="mt-2 flex-row justify-between border-t border-line pt-2">
              <Text className="text-[13px] font-semibold text-ink">Total requis</Text>
              <Text className="font-mono text-[13px] font-semibold text-ink">{eur(neededCents / 100)}</Text>
            </View>
            <Text className="mt-1 text-[11px]" style={{ color: fundsOk ? c.textMuted : c.bad }}>
              Crédit disponible : {eur(availableCents / 100)} {fundsOk ? "" : "— insuffisant"}
            </Text>
          </Card>
        </View>
      ) : null}

      {/* ÉTAPE 6 — Mots-clés (optionnel). */}
      {step === 6 ? (
        <View className="gap-3">
          <Text className="text-[13px] text-ink-3">
            Mots-clés (optionnel) — séparés par des virgules. Affinent le ciblage par centres d&apos;intérêt.
          </Text>
          <TextInput
            value={keywords}
            onChangeText={setKeywords}
            placeholder="rénovation, énergie, propriétaire…"
            placeholderTextColor={c.textMuted}
            style={{ backgroundColor: c.field, borderColor: c.borderSoft, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: c.text }}
          />
          <Pressable
            onPress={() => setKwFilter((v) => !v)}
            className="flex-row items-center rounded-2xl border bg-paper p-3 active:opacity-80"
            style={{ gap: 10, borderColor: kwFilter ? c.accent : c.borderSoft }}
          >
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: kwFilter ? c.accent : c.ink5, backgroundColor: kwFilter ? c.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
              {kwFilter ? <Ionicons name="checkmark" size={14} color={c.btnText} /> : null}
            </View>
            <Text className="flex-1 text-[13px] text-ink-2">Filtrer strictement sur ces mots-clés</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ÉTAPE 7 — Description / brief. */}
      {step === 7 ? (
        <View className="gap-2">
          <Text className="text-[13px] text-ink-3">
            Décrivez votre offre — ce texte est présenté au prospect.
          </Text>
          <TextInput
            value={brief}
            onChangeText={setBrief}
            placeholder="Ex. Bilan énergétique offert pour les propriétaires…"
            placeholderTextColor={c.textMuted}
            multiline
            maxLength={280}
            style={{ backgroundColor: c.field, borderColor: c.borderSoft, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: c.text, minHeight: 120, textAlignVertical: "top" }}
          />
          <Text className="text-right text-[11px] text-ink-4">{brief.length}/280</Text>
        </View>
      ) : null}

      {/* ÉTAPE 8 — Récapitulatif + lancement. */}
      {step === 8 ? (
        <View className="gap-3">
          <Card>
            {[
              ["Objectif", obj.name],
              ["Opérations", `${subTypes.size} sélectionnée(s)`],
              ["Durée", DURATIONS.find((d) => d.key === duration)?.label ?? duration],
              ["Paliers", tiers.join(", ")],
              ["Zone", GEO_ZONES.find((z) => z.key === geo)?.label ?? geo],
              ["Vérification", VERIF_LEVELS.find((v) => v.key === verif)?.label ?? verif],
              ["Coût / contact", `${(cpcCents / 100).toFixed(2)} €`],
              ["Contacts", String(contactsNum)],
              ["Budget", eur(budgetCents / 100)],
              ["Total requis", eur(neededCents / 100)],
            ].map(([k, v], i) => (
              <View key={i} className={`flex-row justify-between ${i > 0 ? "mt-1.5" : ""}`}>
                <Text className="text-[13px] text-ink-4">{k}</Text>
                <Text className="text-[13px] font-medium text-ink">{v}</Text>
              </View>
            ))}
          </Card>

          {!fundsOk ? (
            <View className="flex-row items-center gap-2 rounded-2xl px-4 py-3" style={{ backgroundColor: c.badSoft }}>
              <Ionicons name="alert-circle-outline" size={18} color={c.bad} />
              <Text className="flex-1 text-[12.5px]" style={{ color: c.bad }}>
                Crédit insuffisant ({eur(availableCents / 100)}). Rechargez via le « + » bleu du header.
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => setCgu((v) => !v)}
            className="flex-row items-center rounded-2xl border bg-paper p-3 active:opacity-80"
            style={{ gap: 10, borderColor: cgu ? c.accent : c.borderSoft }}
          >
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: cgu ? c.accent : c.ink5, backgroundColor: cgu ? c.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
              {cgu ? <Ionicons name="checkmark" size={14} color={c.btnText} /> : null}
            </View>
            <Text className="flex-1 text-[12.5px] text-ink-2">
              J&apos;accepte les CGU/CGV et la politique RGPD.
            </Text>
          </Pressable>

          <Pressable
            disabled={!cgu || !fundsOk || !infoComplete || create.isPending}
            onPress={launch}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-2 rounded-full py-3.5 active:opacity-80"
            style={{ backgroundColor: c.btnBg, opacity: !cgu || !fundsOk || !infoComplete ? 0.5 : 1 }}
          >
            {create.isPending ? (
              <ActivityIndicator color={c.btnText} />
            ) : (
              <Text className="text-base font-semibold" style={{ color: c.btnText }}>
                Lancer la campagne · {eur(neededCents / 100)}
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {/* Navigation Précédent / Suivant (sauf le lancement à l'étape 8). */}
      <View className="mt-2 flex-row gap-3">
        {step > 1 ? (
          <Pressable
            onPress={goPrev}
            className="flex-1 items-center rounded-full border py-3 active:opacity-80"
            style={{ borderColor: c.borderSoft }}
          >
            <Text className="text-[15px] font-medium text-ink-3">Précédent</Text>
          </Pressable>
        ) : null}
        {step < 8 ? (
          <Pressable
            disabled={!canNext()}
            onPress={goNext}
            className="flex-1 items-center rounded-full py-3 active:opacity-80"
            style={{ backgroundColor: c.btnBg, opacity: canNext() ? 1 : 0.5 }}
          >
            <Text className="text-[15px] font-semibold" style={{ color: c.btnText }}>
              Suivant
            </Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollScreen>
  );
}
