// Wizard de création de campagne (8 étapes, miroir du dashboard web) :
// 1 Objectif (sous-types) · 2 Dates (durée) · 3 Données (paliers) ·
// 4 Ciblage (géo/vérif) · 5 Budget (coût/contacts) · 6 Mots-clés ·
// 7 Description · 8 Récap (+ lancement réel POST /api/pro/campaigns).
// L'objectif est passé via ?id= depuis la grille « Créer une campagne ».
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  useCreateCampaign,
  useProCampaigns,
  useProInfo,
  useProPlan,
  useProWallet,
  type CreateCampaignResult,
} from "../../lib/queries";
import { ApiError } from "../../lib/api";
import { clearDraft, loadDraft, saveDraft } from "../../lib/campaign-draft";
import { clearPlanAck, getPlanAck } from "../../lib/plan-ack";
import { BottomSheet } from "../../components/bottom-sheet";
import { Confetti } from "../../components/confetti";
import { PlanSelectorSheet } from "../../components/plan-selector-sheet";
import { Slider } from "../../components/slider";
import { useTheme, type ThemeMode } from "../../lib/theme";

// Dégradé violet de l'en-tête/succès (115deg du design), thémé.
const HERO_GRADIENT: Record<ThemeMode, readonly [string, string, string]> = {
  light: ["#7C5CFF", "#5B3FE0", "#211B52"],
  dark: ["#3A2F7A", "#241E4A", "#14192B"],
  forest: ["#34A86A", "#2F8D5B", "#103A26"],
  fushia: ["#E84F98", "#D63B80", "#7A2350"],
};

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

// « La Vitrine » — popup d'offre du service lien-du-site (réplique de
// VitrineOfferModal côté web). `free` ⇒ offert (1re campagne), sinon 2 €.
// Le champ est préfixé `https://` en dur ; on ne renvoie que l'hôte/chemin.
function VitrineOfferSheet({
  visible,
  free,
  initialUrl,
  onSkip,
  onConfirm,
}: {
  visible: boolean;
  free: boolean;
  initialUrl: string;
  onSkip: () => void;
  onConfirm: (host: string) => void;
}) {
  const { c } = useTheme();
  const [val, setVal] = useState("");
  useEffect(() => {
    if (visible) setVal((initialUrl || "").replace(/^https?:\/\//i, ""));
  }, [visible, initialUrl]);
  const clean = val.trim().replace(/^https?:\/\//i, "");
  // Domaine plausible : au moins `xxx.tld` (tld ≥ 2 caractères).
  const valid = /^[^\s./]+\.[^\s/]{2,}/.test(clean);
  return (
    <BottomSheet visible={visible} onClose={onSkip}>
      <Text style={{ fontSize: 38, lineHeight: 42, textAlign: "center" }}>{free ? "🎁" : "✨"}</Text>
      <Text className="mt-2 font-serif" style={{ fontSize: 22, lineHeight: 28, textAlign: "center", color: c.text }}>
        {free ? "Bonne nouvelle — La Vitrine vous est offerte !" : "Ouvrez La Vitrine de votre campagne"}
      </Text>
      <Text style={{ fontSize: 13.5, lineHeight: 21, textAlign: "center", color: c.textSub, marginTop: 10 }}>
        {free
          ? "Pour votre première campagne, on vous offre La Vitrine. Ajoutez le lien de votre site : les prospects découvrent ce que vous proposez, et vous voyez combien ont cliqué. Normalement à 2 €, aujourd'hui c'est cadeau."
          : "Affichez le lien de votre site sur l'annonce — les prospects découvrent votre univers, et vous suivez le nombre de visites. +2,00 €, une fois, pour cette campagne."}
      </Text>
      <Text className="mt-4 font-mono uppercase text-ink-4" style={{ fontSize: 10, letterSpacing: 0.6 }}>
        Adresse de votre site
      </Text>
      <View
        className="mt-1.5 flex-row items-stretch overflow-hidden rounded-xl border"
        style={{ borderColor: c.borderSoft, backgroundColor: c.surface }}
      >
        <View className="justify-center px-2.5" style={{ backgroundColor: c.surface2, borderRightWidth: 1, borderRightColor: c.borderSoft }}>
          <Text className="font-mono text-[13px] text-ink-4">https://</Text>
        </View>
        <TextInput
          value={val}
          onChangeText={(t) => setVal(t.replace(/^https?:\/\//i, ""))}
          placeholder="mon-entreprise.fr"
          placeholderTextColor={c.ink5}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={{ flex: 1, minWidth: 0, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: c.text }}
        />
      </View>
      <Text className="mt-1.5 text-[11px] text-ink-4">https uniquement · ex. mon-entreprise.fr/offre</Text>
      <View className="mt-5 flex-row" style={{ gap: 10 }}>
        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          className="flex-1 items-center rounded-full border border-navy bg-paper py-3.5 active:opacity-70"
        >
          <Text className="text-sm font-semibold text-navy">Non merci</Text>
        </Pressable>
        <Pressable
          disabled={!valid}
          onPress={() => onConfirm(clean)}
          accessibilityRole="button"
          className="items-center rounded-full bg-ink py-3.5 active:opacity-80"
          style={{ flex: 2, opacity: valid ? 1 : 0.5 }}
        >
          <Text className="text-sm font-semibold text-paper">
            {free ? "Ajouter ma vitrine (offert)" : "Ajouter ma vitrine (+2 €)"}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

export default function ProWizard() {
  const { c, mode } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const obj = OBJECTIVES.find((o) => o.id === id) ?? null;

  const plan = useProPlan();
  const wallet = useProWallet();
  const info = useProInfo();
  const create = useCreateCampaign();
  // « La Vitrine » — nb de campagnes déjà créées par le pro : 0 ⇒ option
  // offerte (1re campagne), sinon 2 €. Le serveur recalcule le tarif de
  // toute façon ; ceci ne sert qu'au message/total affichés.
  const campaigns = useProCampaigns();

  // Gate « informations société » : la création de campagne est refusée
  // côté backend sans raison sociale + ville → on bloque le lancement et on
  // l'indique dès l'étape 1, avec un raccourci vers « Mes informations ».
  const infoLoaded = info.isSuccess;
  // Miroir backend : une raison sociale contenant « @ » = placeholder e-mail
  // résiduel → considérée non renseignée. Ville requise aussi.
  const rawRaison = info.data?.raisonSociale?.trim() ?? "";
  const infoComplete = rawRaison.length > 0 && !rawRaison.includes("@") && !!info.data?.ville?.trim();

  const planTierCap = plan.data?.plan === "pro" ? 5 : 3;
  const planMaxProspects = plan.data?.maxProspects ?? (plan.data?.plan === "pro" ? 500 : 50);
  const cycleCount = plan.data?.cycleCount ?? 0;
  const capReached = plan.data?.capReached ?? false;
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
  const [minFiab, setMinFiab] = useState(0); // fiabilité minimum (0/60/80)
  const [excludeCertified, setExcludeCertified] = useState(false);
  const [cpcCents, setCpcCents] = useState(100);
  const [contacts, setContacts] = useState("50");
  const [keywords, setKeywords] = useState("");
  const [kwFilter, setKwFilter] = useState(false);
  const [brief, setBrief] = useState("");
  const [cgu, setCgu] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  // ─── « La Vitrine » — option lien du site web sur l'annonce ────────
  // `vitrineUrl` = partie saisie APRÈS le préfixe https:// (affiché en dur).
  // `vitrineAdded` = option retenue. Le popup d'offre s'ouvre une seule fois
  // à l'arrivée sur le récap (étape 8).
  const [vitrineUrl, setVitrineUrl] = useState("");
  const [vitrineAdded, setVitrineAdded] = useState(false);
  const [vitrineModalOpen, setVitrineModalOpen] = useState(false);
  const [vitrineModalSeen, setVitrineModalSeen] = useState(false);
  const [result, setResult] = useState<CreateCampaignResult | null>(null);
  // Formule : la popup de choix s'ouvre avant lancement à la 1re campagne du
  // cycle ou si le quota est atteint ; sinon elle ne réapparaît pas.
  const [planChosen, setPlanChosen] = useState(false);
  const [showPlanSheet, setShowPlanSheet] = useState(false);

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
        setMinFiab(d.minFiab ?? 0);
        setExcludeCertified(d.excludeCertified);
        setCpcCents(d.cpcCents);
        setContacts(d.contacts);
        setKeywords(d.keywords);
        setKwFilter(d.kwFilter);
        setBrief(d.brief);
        // Ne pas reprendre à une étape avancée si les sous-types (étape 1)
        // sont vides — sinon on peut atteindre « Lancer » avec un payload
        // invalide (invalid_sub_types). On repart alors de l'étape 1.
        const safeStep = (d.subTypes?.length ?? 0) >= 1 ? d.step : 1;
        setStep(safeStep);
        setMaxStep(Math.max(safeStep, 1));
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
      minFiab,
      excludeCertified,
      cpcCents,
      contacts,
      keywords,
      kwFilter,
      brief,
      updatedAt: Date.now(),
    });
  }, [hydrated, id, step, subTypes, duration, tiers, geo, ages, verif, minFiab, excludeCertified, cpcCents, contacts, keywords, kwFilter, brief]);

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

  // Décision d'ouverture de la popup formule (miroir web) : quota atteint →
  // forcée ; 1re campagne du cycle sans brouillon ni acquittement → ouverte ;
  // sinon → formule déjà active, on ne montre rien.
  useEffect(() => {
    if (!plan.isSuccess || !hydrated) return;
    let alive = true;
    (async () => {
      if (capReached) {
        await clearPlanAck();
        if (!alive) return;
        setShowPlanSheet(true);
        setPlanChosen(false);
        return;
      }
      const ack = await getPlanAck();
      if (!alive) return;
      if (cycleCount === 0 && !restored && !ack) {
        setShowPlanSheet(true);
        setPlanChosen(false);
      } else {
        setPlanChosen(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [plan.isSuccess, hydrated, restored, capReached, cycleCount]);

  // Valeur PAR DÉFAUT du slider selon la formule (Starter → 25, Pro → 50),
  // appliquée une fois sur un wizard frais (pas de brouillon restauré).
  const defaultApplied = useRef(false);
  useEffect(() => {
    if (!plan.isSuccess || !hydrated || defaultApplied.current) return;
    defaultApplied.current = true;
    if (restored) return; // on garde la valeur du brouillon
    setContacts(String(plan.data?.plan === "pro" ? 50 : 25));
  }, [plan.isSuccess, hydrated, restored, plan.data?.plan]);

  // Plafonne le nombre de contacts au max de la formule (50 Starter / 500 Pro)
  // — ex. après un passage Pro → Starter.
  useEffect(() => {
    const n = Math.floor(Number(contacts) || 0);
    if (n > planMaxProspects) setContacts(String(planMaxProspects));
  }, [planMaxProspects, contacts]);

  // « La Vitrine » — popup d'offre : s'ouvre UNE fois à l'arrivée sur le récap
  // (étape 8), tant que l'option n'a pas déjà été retenue et que le nombre de
  // campagnes est connu (message offert vs 2 €).
  useEffect(() => {
    if (step === 8 && !vitrineModalSeen && !vitrineAdded && campaigns.isSuccess) {
      setVitrineModalOpen(true);
      setVitrineModalSeen(true);
    }
  }, [step, vitrineModalSeen, vitrineAdded, campaigns.isSuccess]);

  const contactsNum = Math.max(0, Math.floor(Number(contacts) || 0));
  const budgetCents = contactsNum * cpcCents;
  const commissionCents = Math.round(budgetCents * 0.1);
  // « La Vitrine » : offerte à la 1re campagne du pro (0 campagne antérieure),
  // 2 € ensuite. Le coût s'ajoute au total seulement si l'option est retenue.
  const vitrineFree = (campaigns.data?.campaigns.length ?? 0) === 0;
  const vitrineFeeCents = vitrineAdded ? (vitrineFree ? 0 : 200) : 0;
  const neededCents = budgetCents + commissionCents + planFeeCents + vitrineFeeCents;
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

  // Écran de succès — affiché après le lancement (au lieu d'une alerte).
  if (result) {
    return (
      <ScrollScreen headerVariant="pro">
        <Confetti />
        <View className="items-center" style={{ paddingTop: 8 }}>
          <LinearGradient
            colors={HERO_GRADIENT[mode]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: "100%", borderRadius: 24, paddingVertical: 28, paddingHorizontal: 20, alignItems: "center", overflow: "hidden" }}
          >
            <View
              className="items-center justify-center"
              style={{ width: 64, height: 64, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)" }}
            >
              <Ionicons name="checkmark" size={34} color="#FFFFFF" />
            </View>
            <Text className="mt-3.5 font-serif" style={{ fontSize: 23, color: "#FFFFFF" }}>
              Campagne lancée
            </Text>
            <Text className="mt-1 text-[14px]" style={{ color: "rgba(255,255,255,0.85)" }}>
              {result.matchedCount} prospect{result.matchedCount > 1 ? "s" : ""} ciblé
              {result.matchedCount > 1 ? "s" : ""}.
            </Text>
            <View
              className="mt-3 flex-row items-center"
              style={{ gap: 7, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.16)" }}
            >
              <Text className="font-mono uppercase" style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.4, color: "rgba(255,255,255,0.78)" }}>
                Réf.
              </Text>
              <Text className="font-mono" style={{ fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>
                {result.code}
              </Text>
            </View>
          </LinearGradient>

          {result.warning ? (
            <View className="mt-3 w-full flex-row items-center gap-2 rounded-2xl px-4 py-3" style={{ backgroundColor: c.amberSoft }}>
              <Ionicons name="information-circle-outline" size={18} color={c.accAmber} />
              <Text className="flex-1 text-[12.5px]" style={{ color: c.accAmber }}>
                {result.warning}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => router.replace("/(pro)/campagnes")}
            accessibilityRole="button"
            className="mt-4 w-full flex-row items-center justify-center gap-2 rounded-full py-3.5 active:opacity-80"
            style={{ backgroundColor: c.btnBg }}
          >
            <Ionicons name="megaphone-outline" size={16} color={c.btnText} />
            <Text className="text-base font-semibold" style={{ color: c.btnText }}>
              Voir mes campagnes
            </Text>
          </Pressable>
        </View>
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
    // Formule non choisie pour ce cycle (ou quota atteint) → on (ré)ouvre la
    // popup au lieu de lancer.
    if (!planChosen) {
      setShowPlanSheet(true);
      return;
    }
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
        minFiabilite: minFiab,
        founder_bonus_enabled: true,
        // « La Vitrine » — URL https du site (le serveur re-valide et recalcule
        // le tarif : offert à la 1re campagne, 2 € sinon).
        websiteUrl:
          vitrineAdded && vitrineUrl.trim()
            ? "https://" + vitrineUrl.trim().replace(/^https?:\/\//i, "")
            : undefined,
      });
      void clearDraft(); // campagne lancée → on jette le brouillon
      setResult(res); // affiche l'écran de succès dédié
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
      hero={{ nav: "back", eyebrow: `Étape ${step}/8 · ${STEPS[step - 1]}`, title: obj.name, gradient: HERO_GRADIENT[mode] }}
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
                className="overflow-hidden rounded-3xl p-4 active:opacity-80"
                style={{
                  borderWidth: 2,
                  borderColor: on ? c.amber : c.amberSoft,
                }}
              >
                {/* Dégradé doux cream → rosé (design flash deal), thémé. */}
                <LinearGradient
                  colors={[c.amberSoft, c.coralSoft]}
                  start={{ x: 0.85, y: 0 }}
                  end={{ x: 0.15, y: 1 }}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                />
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
          <View>
            <Text className="mb-1 text-[13px] text-ink-3">Fiabilité minimum</Text>
            <Text className="mb-2 text-[11.5px] text-ink-4">
              Ne sollicitez que les prospects suffisamment bien notés par les professionnels. « Toutes » inclut ceux jamais notés.
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 10 }}>
              {[
                { v: 0, label: "Toutes", sub: "Aucun filtre" },
                { v: 60, label: "Taux de fiabilité des prospects - Bonne", sub: "≥ 60 / 100" },
                { v: 80, label: "Taux de fiabilité des prospects - Excellente", sub: "≥ 80 / 100" },
              ].map((o) => (
                <Chip key={o.v} label={o.label} sub={o.sub} on={minFiab === o.v} onPress={() => setMinFiab(o.v)} flex />
              ))}
            </View>
            {minFiab > 0 ? (
              <Text className="mt-2 text-[11.5px] text-ink-4">
                Bassin réduit : les prospects jamais notés par un pro sont exclus.
              </Text>
            ) : null}
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
          <Card>
            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] text-ink-3">Nombre de contacts souhaités</Text>
              <Text className="font-serif text-2xl text-ink">{contactsNum}</Text>
            </View>
            <Text className="text-[11px] text-ink-4">
              Maximum {planMaxProspects} ({plan.data?.label ?? "Starter"})
            </Text>
            <View className="mt-3">
              <Slider
                value={contactsNum}
                min={1}
                max={planMaxProspects}
                step={1}
                onChange={(v) => setContacts(String(v))}
              />
            </View>
            <View className="mt-1 flex-row justify-between">
              <Text className="font-mono text-[11px] text-ink-4">1</Text>
              <Text className="font-mono text-[11px] text-ink-4">{planMaxProspects}</Text>
            </View>
          </Card>
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
            {([
              ["Objectif", obj.name],
              ["Opérations", `${subTypes.size} sélectionnée(s)`],
              ["Durée", DURATIONS.find((d) => d.key === duration)?.label ?? duration],
              ["Paliers", tiers.join(", ")],
              ["Zone", GEO_ZONES.find((z) => z.key === geo)?.label ?? geo],
              ["Vérification", VERIF_LEVELS.find((v) => v.key === verif)?.label ?? verif],
              ["Fiabilité minimum", minFiab === 0 ? "Toutes (aucun filtre)" : `≥ ${minFiab} / 100`],
              ["Coût / contact", `${(cpcCents / 100).toFixed(2)} €`],
              ["Contacts", String(contactsNum)],
              ["Budget", eur(budgetCents / 100)],
              ...(vitrineAdded
                ? [["Option La Vitrine", vitrineFree ? "Offert" : eur(2)] as [string, string]]
                : []),
              ["Total requis", eur(neededCents / 100)],
            ] as [string, string][]).map(([k, v], i) => (
              <View key={i} className={`flex-row justify-between ${i > 0 ? "mt-1.5" : ""}`}>
                <Text className="text-[13px] text-ink-4">{k}</Text>
                <Text className="text-[13px] font-medium text-ink">{v}</Text>
              </View>
            ))}
          </Card>

          {/* « La Vitrine » — gestion depuis le récap (ajouter / modifier /
              retirer). Le popup d'offre s'est ouvert à l'arrivée sur l'étape. */}
          <View
            className="rounded-2xl border p-4"
            style={{
              borderColor: vitrineAdded ? c.violetSoft : c.borderSoft,
              backgroundColor: vitrineAdded ? c.tintViolet : c.surface,
            }}
          >
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Ionicons name="globe-outline" size={16} color={c.accVioletDeep} />
              <Text className="text-[14px] font-semibold text-ink">La Vitrine</Text>
              <View
                className="rounded-md px-1.5 py-0.5"
                style={{ backgroundColor: vitrineFree ? c.tintGreen : c.surface2 }}
              >
                <Text className="text-[10px] font-bold" style={{ color: vitrineFree ? c.accGreen : c.accVioletDeep }}>
                  {vitrineFree ? "Offert · 1ʳᵉ campagne" : "+2,00 €"}
                </Text>
              </View>
            </View>
            {vitrineAdded ? (
              <Text className="mt-2 text-[12.5px] text-ink-2">
                Lien affiché sur l&apos;annonce :{" "}
                <Text style={{ color: c.accVioletDeep, fontWeight: "600" }}>https://{vitrineUrl}</Text>
              </Text>
            ) : (
              <Text className="mt-2 text-[12px] leading-4 text-ink-4">
                Affichez le lien de votre site sur l&apos;annonce — les prospects découvrent ce que
                vous proposez, et vous suivez le nombre de visites.
              </Text>
            )}
            <View className="mt-3 flex-row" style={{ gap: 8 }}>
              {vitrineAdded ? (
                <>
                  <Pressable
                    onPress={() => setVitrineModalOpen(true)}
                    className="rounded-full border border-navy bg-paper px-4 py-2 active:opacity-70"
                  >
                    <Text className="text-[13px] font-semibold text-navy">Modifier</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setVitrineAdded(false);
                      setVitrineUrl("");
                    }}
                    className="rounded-full border border-navy bg-paper px-4 py-2 active:opacity-70"
                  >
                    <Text className="text-[13px] font-semibold text-navy">Retirer</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={() => setVitrineModalOpen(true)}
                  className="rounded-full bg-ink px-4 py-2 active:opacity-80"
                >
                  <Text className="text-[13px] font-semibold text-paper">Ajouter mon site</Text>
                </Pressable>
              )}
            </View>
          </View>

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
            disabled={!cgu || !fundsOk || !infoComplete || subTypes.size < 1 || create.isPending}
            onPress={launch}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-2 rounded-full py-3.5 active:opacity-80"
            style={{ backgroundColor: c.btnBg, opacity: !cgu || !fundsOk || !infoComplete || subTypes.size < 1 ? 0.5 : 1 }}
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

      <PlanSelectorSheet
        visible={showPlanSheet}
        capReached={capReached}
        onClose={() => setShowPlanSheet(false)}
        onChosen={(chosen) => {
          setPlanChosen(true);
          setShowPlanSheet(false);
          // Curseur par défaut selon la formule choisie : Starter → 25, Pro → 50.
          setContacts(String(chosen === "pro" ? 50 : 25));
          void plan.refetch();
        }}
      />

      <VitrineOfferSheet
        visible={vitrineModalOpen}
        free={vitrineFree}
        initialUrl={vitrineUrl}
        onSkip={() => setVitrineModalOpen(false)}
        onConfirm={(host) => {
          setVitrineUrl(host);
          setVitrineAdded(true);
          setVitrineModalOpen(false);
        }}
      />
    </ScrollScreen>
  );
}
