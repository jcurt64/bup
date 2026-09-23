// Wizard de création de campagne (8 étapes, miroir du dashboard web) :
// 1 Objectif (sous-types) · 2 Dates (durée) · 3 Données (paliers) ·
// 4 Ciblage (géo/vérif) · 5 Budget (coût/contacts) · 6 Mots-clés ·
// 7 Description · 8 Récap (+ lancement réel POST /api/pro/campaigns).
// L'objectif est passé via ?id= depuis la grille « Créer une campagne ».
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Switch, Text, TextInput, View } from "react-native";

import { Card, eur, ScrollScreen } from "../../components/screen";
import { OBJECTIVES } from "../../lib/pro-objectives";
import {
  AGE_RANGES,
  AGE_RANGES_NO_TOUS,
  AROUND_RADII,
  BRIEF_MAX_LENGTH,
  cpcRange,
  DURATIONS,
  durMs,
  GEO_ZONES,
  geoSummary,
  KW_SUGGESTIONS,
  TIER_REWARDS,
  TIER_SUBS,
  VERIF_LEVELS,
  type DurationKey,
  type GeoTarget,
  type TierNum,
  type VerifLevel,
} from "../../lib/pro-pricing";
import {
  useCreateCampaign,
  useProCampaign,
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
import {
  ExcludeCertifiedSheet,
  InsufficientBalanceSheet,
  MultiTierSheet,
  type InsufficientDetails,
} from "../../components/campaign-wizard-sheets";
import { Confetti } from "../../components/confetti";
import { GeoTargetAutocomplete } from "../../components/geo-target-autocomplete";
import { PlanSelectorSheet } from "../../components/plan-selector-sheet";
import { RechargeSheet } from "../../components/recharge-sheet";
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

const BRIEF_PLACEHOLDER = "Ex : offre de remise de 10% les 10 premiers clients du jour…";

// — Date de lancement (étape 2) : jour local « AAAA-MM-JJ », comme l'input
// date du web. Défaut = demain (web : isoPlusDays(1)). —
const pad2 = (n: number) => String(n).padStart(2, "0");
function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function dayIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function dayFromOffset(n: number): string {
  const d = todayMidnight();
  d.setDate(d.getDate() + n);
  return dayIso(d);
}
function parseDay(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
function dayOffset(iso: string): number {
  const d = parseDay(iso);
  if (!d) return 1;
  return Math.round((d.getTime() - todayMidnight().getTime()) / 86_400_000);
}
/** Horodatage de début : maintenant si lancement aujourd'hui, sinon minuit local. */
function startTimestamp(iso: string): number {
  const d = parseDay(iso);
  if (!d || dayOffset(iso) <= 0) return Date.now();
  return d.getTime();
}
function fmtDayLong(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
/** « JJ/MM » ou « JJ/MM/AAAA » → « AAAA-MM-JJ » (jour passé ⇒ année suivante). */
function parseJjMm(input: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(input.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const today = todayMidnight();
  let year = m[3] ? Number(m[3]) : today.getFullYear();
  const build = (y: number) => new Date(y, month - 1, day);
  let d = build(year);
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null; // 31/02…
  if (!m[3] && d.getTime() < today.getTime()) {
    year += 1;
    d = build(year);
  }
  if (d.getTime() < today.getTime()) return null;
  return dayIso(d);
}
const START_PRESETS: { n: number; label: string }[] = [
  { n: 0, label: "Aujourd'hui" },
  { n: 1, label: "Demain" },
  { n: 2, label: "Dans 2 jours" },
  { n: 7, label: "Dans 7 jours" },
];

/** Relit une liste de mots-clés (tableau, ou ancienne chaîne « a, b »). */
function readKeywords(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((k): k is string => typeof k === "string" && !!k.trim());
  if (typeof v === "string") {
    return v
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  }
  return [];
}
/** Valide grossièrement une cible géo relue (brouillon / duplication). */
function readGeoTarget(v: unknown): GeoTarget | null {
  if (!v || typeof v !== "object") return null;
  const t = v as { type?: unknown; nom?: unknown; code?: unknown };
  if ((t.type === "ville" || t.type === "dept" || t.type === "region") && typeof t.nom === "string" && typeof t.code === "string") {
    const g = v as GeoTarget;
    if (g.type === "ville" && !Array.isArray(g.codesPostaux)) return null;
    if (g.type === "region" && !Array.isArray(g.deptCodes)) return null;
    return g;
  }
  return null;
}

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
  // `duplicate` = id d'une campagne à dupliquer (reprise de tous ses
  // paramètres, arrivée directe sur le récap — miroir du web).
  const { id: idParam, duplicate } = useLocalSearchParams<{ id?: string; duplicate?: string }>();
  const dupSource = useProCampaign(duplicate || undefined);
  const id = idParam ?? dupSource.data?.objectiveId ?? undefined;
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
  // Paliers accessibles = ceux autorisés par la finalité (minimisation RGPD)
  // ∩ plafond du plan (Starter 1-3, Pro 1-5) — miroir de `allowedTiers` web.
  const objAllowedTiers = useMemo(() => obj?.allowedTiers ?? [1, 2, 3, 4, 5], [obj]);
  const allowedTiers = useMemo(
    () => objAllowedTiers.filter((t) => t <= planTierCap),
    [objAllowedTiers, planTierCap],
  );
  const planMaxProspects = plan.data?.maxProspects ?? (plan.data?.plan === "pro" ? 500 : 50);
  const cycleCount = plan.data?.cycleCount ?? 0;
  const capReached = plan.data?.capReached ?? false;
  const planFeeCents = cycleCount === 0 ? plan.data?.monthlyCents ?? 0 : 0;
  const availableCents = Math.round((wallet.data?.walletAvailableEur ?? 0) * 100);
  // Adresse de l'établissement — requise par le ciblage « Autour de moi ».
  const proAddress = info.data?.adresse?.trim() ?? "";

  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [subTypes, setSubTypes] = useState<Set<string>>(new Set());
  const [startDay, setStartDay] = useState(() => dayFromOffset(1));
  const [customDate, setCustomDate] = useState("");
  const [duration, setDuration] = useState<DurationKey>("7d");
  const [tiers, setTiers] = useState<number[]>([1]);
  const [tier1Notice, setTier1Notice] = useState(false);
  const [multiTierOpen, setMultiTierOpen] = useState(false);
  const [multiTierShown, setMultiTierShown] = useState(false);
  const [geo, setGeo] = useState("national");
  const [geoTarget, setGeoTarget] = useState<GeoTarget | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [ages, setAges] = useState<Set<string>>(new Set());
  const [verif, setVerif] = useState<VerifLevel>("p0");
  const [minFiab, setMinFiab] = useState(0); // fiabilité minimum (0/60/80)
  const [excludeCertified, setExcludeCertified] = useState(false);
  const [confirmExclude, setConfirmExclude] = useState(false);
  const [cpcCents, setCpcCents] = useState(100);
  const [contacts, setContacts] = useState("50");
  // Mode de campagne — le web envoie `standard` (mise en relation
  // individuelle) ; « BUUPP Pool » est affiché mais « À venir ». Le serveur
  // stocke la valeur telle quelle dans targeting.poolMode (libellé détail).
  const [poolMode, setPoolMode] = useState("standard");
  // Bonus parrain v2 (étendre aux filleuls) — opt-in, désactivé par défaut.
  const [founderBonus, setFounderBonus] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState("");
  const [kwFilter, setKwFilter] = useState(false);
  const [brief, setBrief] = useState("");
  const [briefError, setBriefError] = useState(false);
  const [cgu, setCgu] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  // Duplication : paramètres de la campagne source appliqués (une fois).
  const [dupApplied, setDupApplied] = useState(false);
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
  // Quota refusé par le serveur (403 mode_cap_reached) alors que le plan
  // local le croyait disponible → on force l'écran « quota atteint ».
  const [capForced, setCapForced] = useState(false);
  // Solde insuffisant (pré-contrôle local ou 402 serveur) + recharge.
  const [insufficient, setInsufficient] = useState<InsufficientDetails | null>(null);
  // Montant suggéré à l'ouverture de la recharge (manque à combler, en €).
  const [rechargeSuggestEur, setRechargeSuggestEur] = useState<number | undefined>(undefined);
  const [showRecharge, setShowRecharge] = useState(false);

  // Message « palier 1 obligatoire » transitoire (4 s, comme le web).
  useEffect(() => {
    if (!tier1Notice) return;
    const t = setTimeout(() => setTier1Notice(false), 4000);
    return () => clearTimeout(t);
  }, [tier1Notice]);

  // Restaure le brouillon au montage (si c'est le même objectif). Tant que
  // l'hydratation n'est pas finie, on NE sauvegarde PAS (sinon l'état par
  // défaut écraserait le brouillon). En mode duplication, le brouillon est
  // ignoré : c'est la campagne source qui hydrate le wizard (effet suivant).
  useEffect(() => {
    if (duplicate) return;
    let alive = true;
    loadDraft().then((d) => {
      if (!alive) return;
      if (d && d.objectiveId === id) {
        setSubTypes(new Set(d.subTypes));
        setDuration(d.duration as DurationKey);
        setTiers(d.tiers);
        setGeo(d.geo);
        setGeoTarget(readGeoTarget(d.geoTarget));
        if (typeof d.radiusKm === "number") setRadiusKm(d.radiusKm);
        if (d.startDay && dayOffset(d.startDay) >= 0) setStartDay(d.startDay);
        setAges(new Set(d.ages ?? []));
        setVerif(d.verif as VerifLevel);
        setMinFiab(d.minFiab ?? 0);
        setExcludeCertified(d.excludeCertified);
        setCpcCents(d.cpcCents);
        setContacts(d.contacts);
        setPoolMode(d.poolMode === "pool" ? "pool" : "standard");
        setFounderBonus(d.founderBonusEnabled === true);
        setKeywords(readKeywords(d.keywords));
        setKwFilter(d.kwFilter);
        setBrief((d.brief ?? "").slice(0, BRIEF_MAX_LENGTH));
        setVitrineUrl(d.vitrineUrl ?? "");
        setVitrineAdded(d.vitrineAdded === true && !!d.vitrineUrl);
        setVitrineModalSeen(d.vitrineModalSeen === true);
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
  }, [id, duplicate]);

  // Duplication — hydrate tous les paramètres depuis GET /api/pro/campaigns/:id
  // puis saute au récap (web : duplicateSourceId). Le contrôle quota reste
  // actif (popup formule si le cycle est plein).
  useEffect(() => {
    if (!duplicate || dupApplied) return;
    if (dupSource.isError) {
      setDupApplied(true);
      setHydrated(true);
      return;
    }
    const d = dupSource.data;
    if (!d) return;
    const tg = d.targeting;
    const src = OBJECTIVES.find((o) => o.id === d.objectiveId);
    if (src) {
      const known = new Set(src.sub.map((s) => s.id));
      setSubTypes(new Set((tg.subTypes ?? []).filter((s) => known.has(s))));
    }
    const reqTiers = (tg.requiredTiers ?? []).map(Number).filter((n) => n >= 1 && n <= 5);
    if (reqTiers.length) setTiers([...new Set([1, ...reqTiers])].sort((a, b) => a - b));
    if (tg.geo) setGeo(tg.geo);
    // `geoTarget` n'est pas (encore) exposé par l'API détail ; repris s'il l'est.
    setGeoTarget(readGeoTarget((tg as { geoTarget?: unknown }).geoTarget));
    if (typeof tg.radiusKm === "number") setRadiusKm(tg.radiusKm);
    if (Array.isArray(tg.ages) && tg.ages.length) setAges(new Set(tg.ages));
    if (tg.verifLevel === "p0" || tg.verifLevel === "p1" || tg.verifLevel === "p2") setVerif(tg.verifLevel);
    const fiab = Number((tg as { minFiabilite?: unknown }).minFiabilite ?? 0);
    setMinFiab([0, 60, 80].includes(fiab) ? fiab : 0);
    if (tg.durationKey && DURATIONS.some((x) => x.key === tg.durationKey)) {
      setDuration(tg.durationKey as DurationKey);
    }
    const pm = (tg as { poolMode?: unknown }).poolMode;
    setPoolMode(pm === "pool" ? "pool" : "standard");
    setKeywords(readKeywords(tg.keywords));
    setKwFilter(!!tg.kwFilter && (tg.keywords ?? []).length > 0);
    setExcludeCertified(!!tg.excludeCertified);
    if (d.plannedContacts > 0) setContacts(String(d.plannedContacts));
    if (d.costPerContactEur > 0) setCpcCents(Math.round(d.costPerContactEur * 100));
    setBrief((d.brief ?? "").slice(0, BRIEF_MAX_LENGTH));
    setStep(8);
    setMaxStep(8);
    setDupApplied(true);
    setHydrated(true);
  }, [duplicate, dupApplied, dupSource.data, dupSource.isError]);

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
      geoTarget,
      radiusKm,
      startDay,
      ages: [...ages],
      verif,
      minFiab,
      excludeCertified,
      cpcCents,
      contacts,
      poolMode,
      founderBonusEnabled: founderBonus,
      keywords,
      kwFilter,
      brief,
      vitrineUrl,
      vitrineAdded,
      vitrineModalSeen,
      updatedAt: Date.now(),
    });
  }, [hydrated, id, step, subTypes, duration, tiers, geo, geoTarget, radiusKm, startDay, ages, verif, minFiab, excludeCertified, cpcCents, contacts, poolMode, founderBonus, keywords, kwFilter, brief, vitrineUrl, vitrineAdded, vitrineModalSeen]);

  // RGPD + plan : on ne garde que les paliers autorisés ; le palier 1
  // (identification) est toujours présent (miroir de l'effet web).
  // Attend le plan réel : sinon le plafond Starter par défaut (3) purgerait
  // les paliers 4-5 d'un brouillon Pro avant la réponse de /api/pro/plan.
  useEffect(() => {
    if (!hydrated || !plan.isSuccess) return;
    setTiers((prev) => {
      const next = prev.filter((t) => allowedTiers.includes(t));
      if (allowedTiers.includes(1) && !next.includes(1)) next.unshift(1);
      if (next.length === 0 && allowedTiers.length > 0) next.push(allowedTiers[0]);
      const sorted = [...new Set(next)].sort((a, b) => a - b);
      return sorted.length === prev.length && sorted.every((t, i) => t === prev[i]) ? prev : sorted;
    });
  }, [allowedTiers, hydrated, plan.isSuccess]);

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
      if (cycleCount === 0 && !restored && !duplicate && !ack) {
        setShowPlanSheet(true);
        setPlanChosen(false);
      } else {
        setPlanChosen(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [plan.isSuccess, hydrated, restored, duplicate, capReached, cycleCount]);

  // Valeur PAR DÉFAUT du slider selon la formule (Starter → 25, Pro → 50),
  // appliquée une fois sur un wizard frais (pas de brouillon restauré).
  const defaultApplied = useRef(false);
  useEffect(() => {
    if (!plan.isSuccess || !hydrated || defaultApplied.current) return;
    defaultApplied.current = true;
    if (restored || duplicate) return; // on garde la valeur du brouillon / de la source
    setContacts(String(plan.data?.plan === "pro" ? 50 : 25));
  }, [plan.isSuccess, hydrated, restored, duplicate, plan.data?.plan]);

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
  // Palier 1 verrouillé (identification = socle de toute mise en relation) :
  // un tap affiche l'explication au lieu de le décocher. Au 1er ajout d'un
  // 2ᵉ palier → popup « matching cumulatif » (une fois par campagne).
  const toggleTier = (t: number) => {
    if (!allowedTiers.includes(t)) return;
    if (t === 1) {
      setTier1Notice(true);
      return;
    }
    const willAdd = !tiers.includes(t);
    setTiers((cur) =>
      cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t].sort((a, b) => a - b),
    );
    if (willAdd && !multiTierShown && tiers.length + 1 >= 2) {
      setMultiTierShown(true);
      setMultiTierOpen(true);
    }
  };
  // Mots-clés en puces (miroir web addKw/removeKw).
  const addKw = (val?: string) => {
    const kw = (val ?? kwInput).trim().slice(0, 40);
    if (kw && !keywords.includes(kw)) setKeywords((prev) => [...prev, kw]);
    if (val === undefined) setKwInput("");
  };
  const removeKw = (kw: string) => {
    const next = keywords.filter((k) => k !== kw);
    setKeywords(next);
    if (!next.length) setKwFilter(false);
  };
  // Changement de portée géo : la cible précise n'a plus de sens.
  const pickGeo = (g: string) => {
    if (g !== geo) setGeoTarget(null);
    setGeo(g);
  };
  // Ouvre la recharge après fermeture de la popup « solde insuffisant »
  // (deux Modal RN enchaînés : on laisse l'animation de sortie se finir).
  const openRechargeFromInsufficient = () => {
    if (insufficient) {
      setRechargeSuggestEur(
        Math.max(0, insufficient.neededCents - insufficient.balanceCents) / 100,
      );
    }
    setInsufficient(null);
    setTimeout(() => setShowRecharge(true), 350);
  };
  const insufficientDetails = (balanceCents: number, needed: number): InsufficientDetails => ({
    balanceCents,
    budgetCents,
    commissionCents,
    planFeeCents,
    planLabel: plan.data?.label ?? (plan.data?.plan === "pro" ? "Pro" : "Starter"),
    vitrineFeeCents,
    neededCents: needed,
  });
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

  // Duplication en cours de chargement : on attend la campagne source.
  if (!obj && duplicate && !dupSource.isError) {
    return (
      <ScrollScreen headerVariant="pro" hero={{ nav: "back", eyebrow: "Duplication", title: "Chargement…" }}>
        <View className="items-center py-16">
          <ActivityIndicator color={c.accent} />
        </View>
      </ScrollScreen>
    );
  }

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

  const startValid = !!parseDay(startDay) && dayOffset(startDay) >= 0;
  const briefValid = brief.trim().length > 0 && brief.length <= BRIEF_MAX_LENGTH;
  const startTs = startTimestamp(startDay);
  const endTs = startTs + durMs(duration);

  const canNext = (): boolean => {
    switch (step) {
      case 1:
        return subTypes.size >= 1;
      case 2:
        return startValid;
      case 3:
        return tiers.length >= 1;
      case 5:
        return contactsNum >= 1 && cpcCents >= range.effMin && cpcCents <= range.effMax;
      default:
        return true;
    }
  };

  const goNext = () => {
    // Étape 7 : brief obligatoire → bordure rouge + message (comme le web).
    if (step === 7 && !briefValid) {
      setBriefError(true);
      return;
    }
    if (!canNext()) return;
    const next = Math.min(STEPS.length, step + 1);
    setStep(next);
    setMaxStep((m) => Math.max(m, next));
  };
  const goPrev = () => setStep((s) => Math.max(1, s - 1));
  const goTo = (s: number) => s <= maxStep && setStep(s);

  async function launch() {
    if (!obj || !cgu || !infoComplete) return;
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
        : !startValid
          ? 2
          : tiers.length < 1
            ? 3
            : contactsNum < 1 || cpcCents < range.effMin || cpcCents > range.effMax
              ? 5
              : !briefValid
                ? 7
                : null;
    if (firstInvalid) {
      setStep(firstInvalid);
      if (firstInvalid === 7) setBriefError(true);
      Alert.alert("Étape incomplète", "Complétez cette étape avant de lancer votre campagne.");
      return;
    }
    // Pré-contrôle du solde (web : InsufficientBalanceModal avant le POST).
    if (!fundsOk) {
      void wallet.refetch();
      setInsufficient(insufficientDetails(availableCents, neededCents));
      return;
    }
    try {
      const res = await create.mutateAsync({
        objectiveId: obj.id,
        subTypes: [...subTypes],
        requiredTiers: tiers,
        geo,
        // Cible précise seulement pour ville/dept/région (web : masquée
        // pour national et « autour de moi »).
        geoTarget: geo === "ville" || geo === "dept" || geo === "region" ? geoTarget : null,
        radiusKm,
        ages: [...ages],
        verifLevel: verif,
        contacts: contactsNum,
        startDate: new Date(startTs).toISOString(),
        endDate: new Date(endTs).toISOString(),
        durationKey: duration,
        brief: brief.trim(),
        costPerContactCents: cpcCents,
        budgetCents,
        keywords,
        kwFilter: kwFilter && keywords.length > 0,
        poolMode,
        excludeCertified,
        minFiabilite: minFiab,
        founder_bonus_enabled: founderBonus,
        // « La Vitrine » — URL https du site (le serveur re-valide et recalcule
        // le tarif : offert à la 1re campagne, 2 € sinon).
        websiteUrl:
          vitrineAdded && vitrineUrl.trim()
            ? "https://" + vitrineUrl.trim().replace(/^https?:\/\//i, "")
            : undefined,
      });
      void clearDraft(); // campagne lancée → on jette le brouillon
      void clearPlanAck(); // nouveau cycle possible → popup formule normale ensuite
      setResult(res); // affiche l'écran de succès dédié
    } catch (e) {
      let msg = "Réessayez dans un instant.";
      if (e instanceof ApiError) {
        let b: {
          error?: string;
          message?: string;
          walletCents?: number;
          walletAvailableCents?: number;
          neededCents?: number;
          planTierCap?: number;
        } = {};
        try {
          b = JSON.parse(e.body) as typeof b;
        } catch {
          /* corps non-JSON */
        }
        if (e.status === 402 || b.error === "insufficient_funds") {
          void wallet.refetch();
          setInsufficient(
            insufficientDetails(
              typeof b.walletAvailableCents === "number"
                ? b.walletAvailableCents
                : typeof b.walletCents === "number"
                  ? b.walletCents
                  : availableCents,
              typeof b.neededCents === "number" ? b.neededCents : neededCents,
            ),
          );
          return;
        }
        if (b.error === "mode_cap_reached") {
          // Quota du cycle atteint côté serveur → on rouvre le sélecteur de
          // formule pour démarrer un nouveau cycle (web : setPlanModalOpen).
          void clearPlanAck();
          setCapForced(true);
          setPlanChosen(false);
          setShowPlanSheet(true);
          void plan.refetch();
          return;
        }
        if (b.message) msg = b.message;
        else if (b.error === "tiers_above_plan_cap")
          msg = `Votre formule ne donne pas accès à ce palier (max. ${b.planTierCap ?? "?"}). Passez en Pro pour le débloquer.`;
        else if (b.error === "budget_mismatch") msg = "Le budget ne correspond pas au coût × nombre de contacts.";
        else if (b.error === "invalid_dates") msg = "Les dates choisies sont invalides.";
        else if (b.error === "invalid_body") msg = "Certains champs sont invalides ou manquants.";
        else if (b.error) msg = b.error;
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

      {/* Duplication — rappel de la campagne source (web : récap « Duplication »). */}
      {duplicate && dupApplied && dupSource.data ? (
        <View className="flex-row rounded-2xl px-4 py-3" style={{ gap: 8, backgroundColor: c.accentSoft }}>
          <Ionicons name="copy-outline" size={17} color={c.accentInk} />
          <Text className="flex-1 text-[12.5px] leading-5" style={{ color: c.accentInk }}>
            <Text style={{ fontWeight: "700" }}>Voici ce que vous aviez choisi lors de cette campagne</Text>
            {dupSource.data.name ? ` — « ${dupSource.data.name} »` : ""}. Modifiez ce que vous voulez via
            les étapes ci-dessus, ou lancez tel quel.
          </Text>
        </View>
      ) : null}
      {duplicate && dupSource.isError ? (
        <View className="flex-row rounded-2xl px-4 py-3" style={{ gap: 8, backgroundColor: c.amberSoft }}>
          <Ionicons name="alert-circle-outline" size={17} color={c.accAmber} />
          <Text className="flex-1 text-[12.5px]" style={{ color: c.accAmber }}>
            Impossible de charger la campagne à dupliquer — vous pouvez la recréer manuellement.
          </Text>
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
                    <Text className="font-mono text-[11px] text-ink-4">
                      {s.cost > 0 ? `${s.cost.toFixed(2)} €` : "Libre"}
                    </Text>
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
          {/* Date de lancement (web : input date, min = aujourd'hui, défaut demain). */}
          <View>
            <View className="mb-2 flex-row items-center" style={{ gap: 6 }}>
              <Ionicons name="calendar-outline" size={14} color={c.textMuted} />
              <Text className="font-mono text-[11px] uppercase text-ink-4" style={{ letterSpacing: 0.8 }}>
                Date de lancement
              </Text>
            </View>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {START_PRESETS.map((p) => (
                <Chip
                  key={p.n}
                  label={p.label}
                  on={dayOffset(startDay) === p.n && !customDate}
                  onPress={() => {
                    setCustomDate("");
                    setStartDay(dayFromOffset(p.n));
                  }}
                />
              ))}
            </View>
            <View className="mt-2 flex-row items-center" style={{ gap: 8 }}>
              <Text className="text-[12.5px] text-ink-3">Autre date :</Text>
              <TextInput
                value={customDate}
                onChangeText={(t) => {
                  // Saisie JJ/MM (ou JJ/MM/AAAA) — « / » inséré automatiquement.
                  let v = t.replace(/[^\d/]/g, "");
                  if (/^\d{3,}$/.test(v)) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                  v = v.slice(0, 10);
                  setCustomDate(v);
                  const iso = parseJjMm(v);
                  if (iso) setStartDay(iso);
                }}
                placeholder="JJ/MM"
                placeholderTextColor={c.textMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                style={{
                  width: 120,
                  backgroundColor: c.field,
                  borderColor: customDate && !parseJjMm(customDate) ? c.bad : customDate ? c.accent : c.borderSoft,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  fontSize: 15,
                  color: c.text,
                }}
              />
            </View>
            {customDate && !parseJjMm(customDate) ? (
              <Text className="mt-1 text-[11.5px]" style={{ color: c.bad }}>
                Date invalide ou passée (format JJ/MM).
              </Text>
            ) : null}
            <Text className="mt-2 text-[12.5px] text-ink-3">
              Lancement : <Text style={{ color: c.text, fontWeight: "600" }}>{fmtDayLong(startTs)}</Text>
            </Text>
          </View>

          <Text className="mt-1 text-[13px] text-ink-3">
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
          <Text className="mt-1 text-[12px] leading-5 text-ink-4">
            Plus la fenêtre est courte, plus la rémunération du prospect (et le coût) est élevée. Date
            de fin estimée : <Text style={{ color: c.text, fontWeight: "600" }}>{fmtDayLong(endTs)}</Text>.
          </Text>
        </View>
      ) : null}

      {/* ÉTAPE 3 — Données / paliers requis (finalité RGPD ∩ plafond du plan). */}
      {step === 3 ? (
        <View className="gap-2">
          <Text className="text-[13px] text-ink-3">
            Sélectionnez un ou plusieurs paliers parmi ceux autorisés pour cette finalité.
          </Text>

          {/* Encart minimisation RGPD (art. 5.1.c). */}
          <View
            className="flex-row rounded-2xl p-3"
            style={{ gap: 10, borderWidth: 1, borderColor: c.accentSoft, backgroundColor: c.surface }}
          >
            <View
              className="items-center justify-center"
              style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: c.accentSoft }}
            >
              <Text style={{ color: c.accentInk, fontWeight: "700", fontSize: 13 }}>§</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[12.5px] font-semibold text-ink">
                Principe de minimisation — Article 5.1.c du RGPD
              </Text>
              <Text className="mt-1 text-[12px] leading-[18px] text-ink-2">
                Les données accessibles dépendent de la finalité de la campagne. Vous ne recevrez que
                les données <Text style={{ fontWeight: "700" }}>strictement nécessaires</Text> à
                l&apos;objectif déclaré.
              </Text>
              <Text className="mt-1 text-[11px] leading-4 text-ink-4">
                Ex. : prise de RDV → identité (Palier 1) · livre blanc → e-mail (Palier 1) · étude
                rémunérée → Paliers 1 à 5 selon les questions.
              </Text>
            </View>
          </View>

          {plan.data?.plan !== "pro" ? (
            <View
              className="flex-row rounded-2xl p-3"
              style={{ gap: 10, borderWidth: 1, borderColor: c.amber, backgroundColor: c.amberSoft }}
            >
              <Ionicons name="lock-closed-outline" size={15} color={c.accAmber} />
              <Text className="flex-1 text-[12px] leading-[18px]" style={{ color: c.accAmber }}>
                La formule <Text style={{ fontWeight: "700" }}>Starter</Text> ne vous autorise
                qu&apos;à obtenir les informations des paliers 1 à 3. Pour accéder aux paliers 4 et 5,
                passez en formule{" "}
                <Text
                  onPress={() => router.push("/(pro)/informations")}
                  style={{ fontWeight: "700", textDecorationLine: "underline" }}
                >
                  Pro
                </Text>
                .
              </Text>
            </View>
          ) : null}

          <View className="gap-2">
            {([1, 2, 3, 4, 5] as const).map((t: TierNum) => {
              const allowed = allowedTiers.includes(t);
              const blockedByPlan = !allowed && t > planTierCap && objAllowedTiers.includes(t);
              const on = tiers.includes(t) && allowed;
              const r = TIER_REWARDS[t];
              return (
                <Pressable
                  key={t}
                  disabled={!allowed}
                  onPress={() => toggleTier(t)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: !allowed }}
                  className="flex-row items-center rounded-2xl p-3 active:opacity-80"
                  style={{
                    gap: 10,
                    opacity: allowed ? 1 : 0.5,
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
                    {!allowed ? <Ionicons name="lock-closed" size={11} color={c.ink5} /> : null}
                  </View>
                  <View className="flex-1">
                    <View className="flex-row flex-wrap items-center" style={{ gap: 6 }}>
                      <Text className="text-[14px] font-semibold text-ink">
                        Palier {t} · {r.label}
                      </Text>
                      {t === 1 ? (
                        <View className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: c.accentSoft }}>
                          <Text className="text-[9px] font-bold uppercase" style={{ color: c.accentInk, letterSpacing: 0.6 }}>
                            Requis
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text className="text-[11px] text-ink-4">{TIER_SUBS[t]}</Text>
                    <Text className="text-[11px]" style={{ color: allowed ? c.accentInk : blockedByPlan ? c.accAmber : c.textMuted }}>
                      {allowed
                        ? r.minCents === r.maxCents
                          ? `dès ${(r.minCents / 100).toFixed(2)} € / contact`
                          : `${(r.minCents / 100).toFixed(2)} – ${(r.maxCents / 100).toFixed(2)} € / contact`
                        : blockedByPlan
                          ? "Réservé à la formule Pro"
                          : "Non autorisé pour cette finalité (RGPD)"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {tier1Notice ? (
            <View
              accessibilityRole="alert"
              className="flex-row rounded-2xl px-3.5 py-2.5"
              style={{ gap: 8, backgroundColor: c.amberSoft, borderWidth: 1, borderColor: c.amber }}
            >
              <Ionicons name="information-circle-outline" size={16} color={c.accAmber} />
              <Text className="flex-1 text-[12px] leading-[18px]" style={{ color: c.accAmber }}>
                Le <Text style={{ fontWeight: "700" }}>palier 1 — Identification</Text> est nécessaire à
                l&apos;identification du prospect et à toute entrée en relation. Il ne peut pas être
                décoché ; les autres paliers s&apos;ajoutent par-dessus de façon cumulative.
              </Text>
            </View>
          ) : null}

          <View
            className="flex-row items-center rounded-2xl px-3.5 py-2.5"
            style={{ gap: 8, borderWidth: 1, borderStyle: "dashed", borderColor: c.accent, backgroundColor: c.surface }}
          >
            <Ionicons name="lock-closed-outline" size={14} color={c.accentInk} />
            <Text className="flex-1 text-[12px] text-ink-2">
              <Text style={{ fontWeight: "700" }}>{obj.name}</Text> autorise{" "}
              {allowedTiers.length === 1 ? (
                <>
                  uniquement le <Text style={{ fontWeight: "700" }}>Palier {allowedTiers[0]}</Text>
                </>
              ) : (
                <>
                  les{" "}
                  <Text style={{ fontWeight: "700" }}>
                    Paliers {allowedTiers[0]} à {allowedTiers[allowedTiers.length - 1]}
                  </Text>
                </>
              )}
              .
            </Text>
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
                <Chip key={z.key} label={z.label} sub={z.sub} on={geo === z.key} onPress={() => pickGeo(z.key)} flex />
              ))}
            </View>

            {/* Cible précise (ville / département / région) via geo.api.gouv.fr. */}
            {geo === "ville" || geo === "dept" || geo === "region" ? (
              <View className="mt-3">
                <Text className="mb-1.5 text-[12.5px] font-semibold text-ink-2">
                  {geo === "ville" ? "Ville ciblée" : geo === "dept" ? "Département ciblé" : "Région ciblée"}
                </Text>
                <GeoTargetAutocomplete key={geo} geo={geo} value={geoTarget} onPick={setGeoTarget} />
              </View>
            ) : null}

            {/* « Autour de moi » — rayon autour de l'adresse de l'établissement. */}
            <Pressable
              onPress={() => pickGeo("around")}
              accessibilityRole="button"
              accessibilityState={{ selected: geo === "around" }}
              className="mt-3 flex-row items-center rounded-2xl p-3 active:opacity-80"
              style={{
                gap: 10,
                borderWidth: 1.5,
                borderColor: geo === "around" ? c.accent : c.borderSoft,
                backgroundColor: geo === "around" ? c.accentSoft : c.surface,
              }}
            >
              <Ionicons name="navigate-circle-outline" size={20} color={geo === "around" ? c.accentInk : c.textMuted} />
              <View className="flex-1">
                <Text className="text-[14px] font-semibold" style={{ color: geo === "around" ? c.accentInk : c.text }}>
                  Autour de moi
                </Text>
                <Text className="text-[11px]" style={{ color: geo === "around" ? c.accentInk : c.textMuted }}>
                  Prospects situés dans un rayon autour de votre établissement
                </Text>
              </View>
              {geo === "around" ? <Ionicons name="checkmark-circle" size={18} color={c.accent} /> : null}
            </Pressable>

            {geo === "around" ? (
              <View className="mt-3">
                <Text className="mb-2 text-[12.5px] font-semibold text-ink-2">Zone d&apos;extension</Text>
                <View className="flex-row" style={{ gap: 8 }}>
                  {AROUND_RADII.map((km) => {
                    const on = radiusKm === km;
                    return (
                      <Pressable
                        key={km}
                        onPress={() => setRadiusKm(km)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        className="flex-1 items-center rounded-xl py-2.5 active:opacity-80"
                        style={{ borderWidth: 1.5, borderColor: on ? c.accent : c.borderSoft, backgroundColor: on ? c.accent : c.surface }}
                      >
                        <Text className="text-[13px] font-semibold" style={{ color: on ? c.btnText : c.textSub }}>
                          {km} km
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {proAddress ? (
                  <View className="mt-3 flex-row rounded-2xl p-3" style={{ gap: 8, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.borderSoft }}>
                    <Ionicons name="information-circle-outline" size={16} color={c.accentInk} />
                    <Text className="flex-1 text-[12px] leading-[18px] text-ink-2">
                      Le ciblage se base sur l&apos;adresse de votre établissement (
                      <Text style={{ fontWeight: "700" }}>{proAddress}</Text>). Vous pouvez la consulter
                      ou la modifier dans{" "}
                      <Text
                        onPress={() => router.push("/(pro)/informations")}
                        style={{ color: c.accentInk, fontWeight: "700", textDecorationLine: "underline" }}
                      >
                        Mes informations
                      </Text>
                      .
                    </Text>
                  </View>
                ) : (
                  <View className="mt-3 rounded-2xl p-3" style={{ backgroundColor: c.amberSoft, borderWidth: 1, borderColor: c.amber }}>
                    <View className="flex-row" style={{ gap: 8 }}>
                      <Ionicons name="alert-circle-outline" size={16} color={c.accAmber} />
                      <Text className="flex-1 text-[12px] leading-[18px]" style={{ color: c.accAmber }}>
                        <Text style={{ fontWeight: "700" }}>Adresse requise.</Text> Pour cibler autour de
                        vous, renseignez d&apos;abord l&apos;adresse de votre établissement.
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => router.push("/(pro)/informations")}
                      accessibilityRole="button"
                      className="mt-2 flex-row items-center justify-center gap-1.5 self-start rounded-full px-4 py-2 active:opacity-80"
                      style={{ backgroundColor: c.btnBg }}
                    >
                      <Text className="text-[12.5px] font-semibold" style={{ color: c.btnText }}>
                        Renseigner mon adresse
                      </Text>
                      <Ionicons name="arrow-forward" size={13} color={c.btnText} />
                    </Pressable>
                  </View>
                )}
              </View>
            ) : null}
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
        </View>
      ) : null}

      {/* ÉTAPE 5 — Budget : coût par contact + nombre. */}
      {step === 5 ? (
        <View className="gap-3">
          {/* Bandeau « bonus ×2 certifié confiance » + option d'exclusion
              (confirmation obligatoire, comme le web). */}
          <View className="rounded-2xl p-3.5" style={{ backgroundColor: c.tintViolet, borderWidth: 1, borderColor: c.violetSoft }}>
            <View className="flex-row" style={{ gap: 8 }}>
              <Text style={{ fontSize: 16 }}>✨</Text>
              <Text className="flex-1 text-[12.5px] leading-[19px] text-ink-2">
                Petit bonus à connaître 😉 — si certains de vos contacts ont un profil{" "}
                <Text style={{ color: c.accVioletDeep, fontWeight: "700" }}>vérifié à 100 % (certifié confiance)</Text>,{" "}
                <Text style={{ fontWeight: "700" }}>leurs gains sont automatiquement doublés</Text> et
                viennent s&apos;imputer sur le budget de la campagne. Prévoyez une petite marge !
              </Text>
            </View>
            <Pressable
              onPress={() => (excludeCertified ? setExcludeCertified(false) : setConfirmExclude(true))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: excludeCertified }}
              className="mt-2.5 flex-row items-center justify-center rounded-full px-3 py-2.5 active:opacity-80"
              style={{
                gap: 8,
                borderWidth: 1.5,
                borderColor: c.accVioletDeep,
                backgroundColor: excludeCertified ? c.accVioletDeep : c.surface,
              }}
            >
              <Ionicons
                name={excludeCertified ? "checkbox" : "square-outline"}
                size={16}
                color={excludeCertified ? "#FFFFFF" : c.accVioletDeep}
              />
              <Text className="text-[12.5px] font-semibold" style={{ color: excludeCertified ? "#FFFFFF" : c.text }}>
                Retirer les « certifié confiance » de ma cible
              </Text>
            </Pressable>
          </View>
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
            {!fundsOk ? (
              <Pressable
                onPress={() => setShowRecharge(true)}
                accessibilityRole="button"
                className="mt-2 flex-row items-center justify-center gap-1.5 rounded-full py-2.5 active:opacity-80"
                style={{ backgroundColor: c.bad }}
              >
                <Ionicons name="add" size={15} color="#FFFFFF" />
                <Text className="text-[13px] font-semibold text-white">Recharger votre crédit</Text>
              </Pressable>
            ) : null}
          </Card>

          {/* Mode de campagne — seul « standard » est actif (Pool « À venir »). */}
          <View>
            <Text className="mb-2 text-[13px] text-ink-3">Mode de campagne</Text>
            {[
              { id: "standard", name: "Mise en relation individuelle", sub: "Contact direct avec chaque prospect — immédiat", icon: "people-outline" as const, disabled: false },
              { id: "pool", name: "BUUPP Pool — enchère groupée", sub: "Groupez des prospects ayant un besoin commun", icon: "git-merge-outline" as const, disabled: true },
            ].map((m) => {
              const on = poolMode === m.id;
              return (
                <Pressable
                  key={m.id}
                  disabled={m.disabled}
                  onPress={() => setPoolMode(m.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on, disabled: m.disabled }}
                  className="mb-2 flex-row items-center rounded-2xl p-3 active:opacity-80"
                  style={{
                    gap: 10,
                    opacity: m.disabled ? 0.55 : 1,
                    borderWidth: 1.5,
                    borderColor: on ? c.accent : c.borderSoft,
                    backgroundColor: on ? c.accentSoft : c.surface,
                  }}
                >
                  <Ionicons name={m.icon} size={19} color={m.disabled ? c.textMuted : c.accentInk} />
                  <View className="flex-1">
                    <View className="flex-row items-center" style={{ gap: 6 }}>
                      <Text className="text-[13.5px] font-semibold text-ink">{m.name}</Text>
                      {m.disabled ? (
                        <View className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: c.surface2 }}>
                          <Text className="text-[9.5px] font-semibold text-ink-4">À venir</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text className="text-[11.5px] text-ink-4">{m.sub}</Text>
                  </View>
                  {on ? <Ionicons name="checkmark-circle" size={18} color={c.accent} /> : null}
                </Pressable>
              );
            })}
          </View>

          {/* Bonus parrain v2 — opt-in (désactivé par défaut, comme le web). */}
          <View className="flex-row rounded-2xl p-3.5" style={{ gap: 10, borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.surface }}>
            <View className="flex-1">
              <Text className="text-[14px] font-semibold text-ink">
                Activer le bonus parrain (étendre à leurs filleuls)
              </Text>
              <Text className="mt-1 text-[12px] leading-[18px] text-ink-4">
                Lorsqu&apos;un de vos prospects ciblés est un parrain,{" "}
                <Text style={{ fontWeight: "700", color: c.textSub }}>tous ses filleuls reçoivent aussi votre sollicitation</Text>{" "}
                (mail + message), même hors cible — plus de portée. À chaque acceptation d&apos;un
                filleul, son <Text style={{ fontWeight: "700", color: c.textSub }}>parrain touche +50 %</Text> de
                sa récompense (à votre charge) ; le filleul perçoit la récompense normale. Le quota de
                la campagne n&apos;est jamais dépassé.
              </Text>
            </View>
            <Switch
              value={founderBonus}
              onValueChange={setFounderBonus}
              trackColor={{ false: c.track, true: c.accent }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Activer le bonus parrain"
            />
          </View>
        </View>
      ) : null}

      {/* ÉTAPE 6 — Mots-clés (optionnel) : puces + suggestions rapides. */}
      {step === 6 ? (
        <View className="gap-3">
          <Text className="text-[13px] leading-5 text-ink-3">
            Mots-clés (optionnel) — BUUPP vérifie leur présence dans les données déclarées des
            prospects : centres d&apos;intérêt, profession, projets de vie, logement, véhicule…
          </Text>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <TextInput
              value={kwInput}
              onChangeText={setKwInput}
              onSubmitEditing={() => addKw()}
              submitBehavior="submit"
              returnKeyType="done"
              maxLength={40}
              placeholder="Ex : véhicule, immobilier, retraite…"
              placeholderTextColor={c.textMuted}
              style={{ flex: 1, minWidth: 0, backgroundColor: c.field, borderColor: c.borderSoft, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: c.text }}
            />
            <Pressable
              onPress={() => addKw()}
              disabled={!kwInput.trim()}
              accessibilityRole="button"
              className="flex-row items-center rounded-full px-3.5 py-2.5 active:opacity-80"
              style={{ gap: 4, backgroundColor: c.btnBg, opacity: kwInput.trim() ? 1 : 0.5 }}
            >
              <Ionicons name="add" size={15} color={c.btnText} />
              <Text className="text-[13px] font-semibold" style={{ color: c.btnText }}>
                Ajouter
              </Text>
            </Pressable>
          </View>

          {keywords.length > 0 ? (
            <View className="flex-row flex-wrap" style={{ gap: 6 }}>
              {keywords.map((kw) => (
                <Pressable
                  key={kw}
                  onPress={() => removeKw(kw)}
                  accessibilityRole="button"
                  accessibilityLabel={`Retirer ${kw}`}
                  className="flex-row items-center rounded-full py-1.5 pl-3 pr-2 active:opacity-70"
                  style={{ gap: 5, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accent }}
                >
                  <Text className="text-[12.5px] font-semibold" style={{ color: c.accentInk }}>
                    {kw}
                  </Text>
                  <Ionicons name="close-circle" size={15} color={c.accentInk} />
                </Pressable>
              ))}
            </View>
          ) : null}

          {KW_SUGGESTIONS.some((kw) => !keywords.includes(kw)) ? (
            <View>
              <Text className="mb-2 font-mono text-[10px] uppercase text-ink-4" style={{ letterSpacing: 1 }}>
                Suggestions rapides
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {KW_SUGGESTIONS.filter((kw) => !keywords.includes(kw)).map((kw) => (
                  <Pressable
                    key={kw}
                    onPress={() => addKw(kw)}
                    accessibilityRole="button"
                    className="rounded-full px-2.5 py-1.5 active:opacity-70"
                    style={{ borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.surface }}
                  >
                    <Text className="text-[12px] text-ink-2">+ {kw}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {keywords.length > 0 ? (
            <>
              <Pressable
                onPress={() => setKwFilter((v) => !v)}
                accessibilityRole="switch"
                accessibilityState={{ checked: kwFilter }}
                className="flex-row items-start rounded-2xl border bg-paper p-3 active:opacity-80"
                style={{ gap: 10, borderColor: kwFilter ? c.accent : c.borderSoft }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: kwFilter ? c.accent : c.ink5, backgroundColor: kwFilter ? c.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                  {kwFilter ? <Ionicons name="checkmark" size={14} color={c.btnText} /> : null}
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] font-semibold text-ink">
                    Filtrer uniquement si le mot-clé est contenu dans les données du prospect
                  </Text>
                  <Text className="mt-0.5 text-[11.5px] leading-4 text-ink-4">
                    Seuls les prospects dont le profil contient au moins l&apos;un de vos mots-clés
                    recevront votre mise en relation. Volume réduit, précision améliorée.
                  </Text>
                </View>
              </Pressable>
              {kwFilter ? (
                <View className="flex-row rounded-2xl px-3 py-2.5" style={{ gap: 8, backgroundColor: c.amberSoft }}>
                  <Ionicons name="warning-outline" size={14} color={c.accAmber} />
                  <Text className="flex-1 text-[11.5px] leading-4" style={{ color: c.accAmber }}>
                    Le filtre strict peut réduire le nombre de prospects disponibles. BUUPP vous
                    notifiera si le volume ciblé est insuffisant.
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}

          <View className="rounded-2xl p-3.5" style={{ backgroundColor: c.surface2, borderWidth: 1, borderColor: c.borderSoft }}>
            <Text className="mb-2 font-mono text-[10px] font-semibold uppercase text-ink-3" style={{ letterSpacing: 1 }}>
              Comment fonctionne le matching par mots-clés ?
            </Text>
            <Text className="text-[12px] leading-[18px] text-ink-4">
              <Text style={{ fontWeight: "700", color: c.text }}>Sans filtre</Text> — les mots-clés sont
              un signal de priorité : les prospects correspondants remontent en tête sans exclure les
              autres.
            </Text>
            <Text className="mt-1.5 text-[12px] leading-[18px] text-ink-4">
              <Text style={{ fontWeight: "700", color: c.text }}>Filtre strict</Text> — seuls les
              prospects dont le profil contient l&apos;un des mots-clés sont ciblés.
            </Text>
          </View>
        </View>
      ) : null}

      {/* ÉTAPE 7 — Description / brief (50 caractères max, comme le web). */}
      {step === 7 ? (
        <View className="gap-2">
          <Text className="text-[13px] leading-5 text-ink-3">
            Rédigez un message court et percutant, affiché aux prospects dans le détail de votre
            campagne. Limité à <Text style={{ fontWeight: "700" }}>{BRIEF_MAX_LENGTH} caractères</Text>.
          </Text>
          <Text className="font-mono text-[10px] uppercase text-ink-4" style={{ letterSpacing: 1 }}>
            Le mot du professionnel
          </Text>
          <TextInput
            value={brief}
            onChangeText={(t) => {
              setBrief(t.slice(0, BRIEF_MAX_LENGTH));
              if (briefError) setBriefError(false);
            }}
            placeholder={BRIEF_PLACEHOLDER}
            placeholderTextColor={c.textMuted}
            multiline
            maxLength={BRIEF_MAX_LENGTH}
            style={{ backgroundColor: c.field, borderColor: briefError ? c.bad : c.borderSoft, borderWidth: briefError ? 1.5 : 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: c.text, minHeight: 84, textAlignVertical: "top" }}
          />
          <View className="flex-row items-center justify-between">
            {briefError ? (
              <Text accessibilityRole="alert" className="text-[12.5px] font-semibold" style={{ color: c.bad }}>
                ⚠ Information obligatoire
              </Text>
            ) : (
              <Text className="flex-1 pr-3 text-[11.5px] text-ink-4">
                Conseil : un appel à l&apos;action ou une remise concrète améliorent le taux d&apos;acceptation.
              </Text>
            )}
            <Text
              className="font-mono text-[12px]"
              style={{ color: brief.length >= BRIEF_MAX_LENGTH ? c.bad : c.textMuted, fontWeight: brief.length >= BRIEF_MAX_LENGTH ? "600" : "400" }}
            >
              {brief.length} / {BRIEF_MAX_LENGTH}
            </Text>
          </View>
          <View className="mt-2 rounded-2xl p-3.5" style={{ backgroundColor: c.accentSoft }}>
            <Text className="mb-1 font-mono text-[10px] uppercase" style={{ color: c.accentInk, letterSpacing: 1 }}>
              Aperçu côté prospect
            </Text>
            <Text className="text-[14px] italic" style={{ color: brief ? c.text : c.textMuted }}>
              « {brief || BRIEF_PLACEHOLDER} »
            </Text>
          </View>
        </View>
      ) : null}

      {/* ÉTAPE 8 — Récapitulatif + lancement. */}
      {step === 8 ? (
        <View className="gap-3">
          <Card>
            {([
              ["Objectif", obj.name],
              [
                "Opérations",
                [...subTypes].map((sid) => obj.sub.find((x) => x.id === sid)?.name).filter(Boolean).join(", ") || "—",
              ],
              ["Date de lancement", fmtDayLong(startTs)],
              ["Date de fin estimée", fmtDayLong(endTs)],
              ["Durée", DURATIONS.find((d) => d.key === duration)?.label ?? duration],
              ["Paliers", tiers.map((t) => TIER_REWARDS[t as TierNum]?.label ?? t).join(", ")],
              ["Zone", geoSummary(geo, geoTarget, radiusKm)],
              ["Tranches d'âge", ages.size === 0 ? "Toutes" : [...ages].filter((a) => a !== "Tous").join(", ") || "Toutes"],
              ["Vérification", VERIF_LEVELS.find((v) => v.key === verif)?.label ?? verif],
              ["Certifiés confiance", excludeCertified ? "Exclus" : "Inclus (gains ×2)"],
              ["Fiabilité minimum", minFiab === 0 ? "Toutes (aucun filtre)" : `≥ ${minFiab} / 100`],
              ["Mode", poolMode === "pool" ? "BUUPP Pool — enchère groupée" : "Mise en relation individuelle"],
              ["Mots-clés", keywords.length ? `${keywords.join(", ")}${kwFilter ? " (filtre strict)" : ""}` : "Aucun"],
              ["Le mot du pro", brief ? `« ${brief} »` : "—"],
              ["Coût / contact", `${(cpcCents / 100).toFixed(2)} €`],
              ["Contacts", String(contactsNum)],
              ["Budget", eur(budgetCents / 100)],
              ...(vitrineAdded
                ? [["Option La Vitrine", vitrineFree ? "Offert" : eur(2)] as [string, string]]
                : []),
              ["Total requis", eur(neededCents / 100)],
            ] as [string, string][]).map(([k, v], i) => (
              <View key={i} className={`flex-row justify-between ${i > 0 ? "mt-1.5" : ""}`} style={{ gap: 12 }}>
                <Text className="text-[13px] text-ink-4">{k}</Text>
                <Text className="flex-1 text-right text-[13px] font-medium text-ink">{v}</Text>
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

          {/* Bonus parrain — rappel de l'état choisi à l'étape 5. */}
          <View className="rounded-2xl p-3.5" style={{ backgroundColor: c.surface2, borderWidth: 1, borderColor: c.borderSoft }}>
            <Text className="mb-1 font-mono text-[10px] uppercase text-ink-4" style={{ letterSpacing: 1 }}>
              Bonus parrain (à vie)
            </Text>
            {founderBonus ? (
              <Text className="text-[12.5px] leading-[19px] text-ink-2">
                Activé — les <Text style={{ fontWeight: "700" }}>filleuls</Text> des parrains ciblés sont
                sollicités en plus. À chaque acceptation d&apos;un filleul, son parrain touche{" "}
                <Text style={{ fontWeight: "700" }}>+50 %</Text> de la récompense du filleul (soit{" "}
                <Text style={{ fontWeight: "700" }}>+{eur(cpcCents / 200)}</Text>), à vie. Les acceptations
                restent plafonnées au quota de la campagne.
              </Text>
            ) : (
              <Text className="text-[12.5px] leading-[19px] text-ink-3">
                Désactivé pour cette campagne — les filleuls ne seront pas sollicités et aucun bonus
                parrain ne sera versé.
              </Text>
            )}
          </View>

          {!fundsOk ? (
            <View className="rounded-2xl px-4 py-3" style={{ backgroundColor: c.badSoft }}>
              <View className="flex-row items-center gap-2">
                <Ionicons name="alert-circle-outline" size={18} color={c.bad} />
                <Text className="flex-1 text-[12.5px]" style={{ color: c.bad }}>
                  Solde indisponible — {eur(availableCents / 100)} disponibles, {eur(neededCents / 100)} requis
                  (budget + commission max.).
                </Text>
              </View>
              <Pressable
                onPress={() => setShowRecharge(true)}
                accessibilityRole="button"
                className="mt-2 flex-row items-center justify-center gap-1.5 rounded-full py-2.5 active:opacity-80"
                style={{ backgroundColor: c.bad }}
              >
                <Ionicons name="add" size={15} color="#FFFFFF" />
                <Text className="text-[13px] font-semibold text-white">Recharger votre crédit</Text>
              </Pressable>
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
            disabled={!cgu || !infoComplete || subTypes.size < 1 || create.isPending}
            onPress={launch}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-2 rounded-full py-3.5 active:opacity-80"
            style={{ backgroundColor: c.btnBg, opacity: !cgu || !infoComplete || subTypes.size < 1 ? 0.5 : 1 }}
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
        capReached={capReached || capForced}
        onClose={() => setShowPlanSheet(false)}
        onChosen={(chosen) => {
          setPlanChosen(true);
          setCapForced(false);
          setShowPlanSheet(false);
          // Curseur par défaut selon la formule choisie : Starter → 25, Pro → 50.
          setContacts(String(chosen === "pro" ? 50 : 25));
          void plan.refetch();
        }}
      />

      <InsufficientBalanceSheet
        details={insufficient}
        onCancel={() => setInsufficient(null)}
        onRecharge={openRechargeFromInsufficient}
      />
      <RechargeSheet
        visible={showRecharge}
        initialAmount={rechargeSuggestEur}
        onClose={() => {
          setShowRecharge(false);
          setRechargeSuggestEur(undefined);
          void wallet.refetch();
        }}
      />
      <ExcludeCertifiedSheet
        visible={confirmExclude}
        onCancel={() => setConfirmExclude(false)}
        onConfirm={() => {
          setExcludeCertified(true);
          setConfirmExclude(false);
        }}
      />
      <MultiTierSheet visible={multiTierOpen} tiers={tiers} onClose={() => setMultiTierOpen(false)} />

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
