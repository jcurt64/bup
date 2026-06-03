// Couche de synchro (cf. MOBILE_APP_SPEC.md §6) : React Query au-dessus
// du wrapper /api/*. 1 queryKey par endpoint ; invalidation après
// mutation = équivalent mobile des events web. Refetch on focus/reconnect
// réglé dans _layout. Shapes alignées sur les routes réelles du web.
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ApiError, useApi } from "./api";

export type Role = "prospect" | "pro" | null;

// Helper générique : un hook de requête GET sur un endpoint.
//
// placeholderData: keepPreviousData → quand la query est invalidée puis
// refetchée, les données précédentes restent affichées pendant que le
// background fetch tourne, au lieu d'un saut vers l'état isPending.
// Concrètement, plus de flash blanc / loader visible sur Accueil et
// Relations quand on revient sur l'écran ou après une mutation.
function useGet<T>(key: (string | number)[], path: string, staleMs = 30_000) {
  const api = useApi();
  return useQuery({
    queryKey: key,
    queryFn: () => api<T>(path),
    staleTime: staleMs,
    placeholderData: keepPreviousData,
  });
}

// — Session / rôle —
export const useMe = () =>
  useGet<Record<string, unknown>>(["me"], "/api/me");
export const useRole = () =>
  useGet<{ role: Role }>(["me", "role"], "/api/me/role", 60_000);

// — Notifications (prospect ET pro : /api/me/notifications) —
export type Notif = {
  id: string;
  title: string;
  body: string | null;
  audience: string;
  hasAttachment: boolean;
  attachmentFilename: string | null;
  createdAt: string;
  unread: boolean;
  /** Catégorie d'affichage forcée (mocks DEV) ; sinon dérivée du contenu. */
  category?: "annonce" | "alerte" | "communication";
};

// DEV : injecte des messages fictifs (cf. maquettes mes2/mes3) pour
// visualiser la liste de messages + la page de détail sans dépendre de
// broadcasts réels. Mettre à `false` (ou supprimer) avant la prod.
const SHOW_MOCK_NOTIFICATIONS = true;

function buildMockNotifications(): Notif[] {
  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const base = { audience: "prospects", hasAttachment: false, attachmentFilename: null };
  return [
    {
      ...base,
      id: "mock-notif-1",
      title: "Nouveau flash deal près de chez vous",
      body: "Solaria propose un bilan énergétique — gains ×3 pendant 45 min. Saisissez-le avant la fin du compte à rebours pour empocher 10,20 € au lieu de 3,40 €.",
      createdAt: iso(2 * 3600_000),
      unread: true,
      category: "annonce",
    },
    {
      ...base,
      id: "mock-notif-2",
      title: "Récompense bientôt créditée",
      body: "Votre mise en relation avec FitOne est en séquestre. Le crédit arrive sous 24 h sur votre portefeuille, dès la validation du professionnel.",
      createdAt: iso(3 * 3600_000 + 27 * 60_000),
      unread: true,
      category: "alerte",
    },
    {
      ...base,
      id: "mock-notif-3",
      title: "Bienvenue chez buupp 👋",
      body: "Bienvenue très cher buupper ! Complétez votre profil pour débloquer davantage de mises en relation rémunérées et faire grimper votre BUUPP Score.",
      createdAt: iso(26 * 3600_000),
      unread: true,
      category: "communication",
    },
    {
      ...base,
      id: "mock-notif-4",
      title: "Votre relevé de mai est disponible",
      body: "7,50 € de récompenses cumulées ce mois-ci. Consultez le détail de vos mouvements depuis votre portefeuille.",
      createdAt: iso(50 * 3600_000),
      unread: false,
      category: "communication",
    },
  ];
}

const MOCK_NOTIFICATIONS: Notif[] = SHOW_MOCK_NOTIFICATIONS
  ? buildMockNotifications()
  : [];
// État simulé des mocks (lecture / suppression) — appliqué dans le queryFn.
const mockReadNotifs = new Set<string>();
const mockDeletedNotifs = new Set<string>();
export function isMockNotif(id: string): boolean {
  return id.startsWith("mock-notif-");
}
export function markMockNotifRead(id: string): void {
  mockReadNotifs.add(id);
}
export function deleteMockNotif(id: string): void {
  mockDeletedNotifs.add(id);
}

type NotifsResponse = { notifications: Notif[]; unreadCount: number };
export const useNotifications = () => {
  const api = useApi();
  return useQuery({
    queryKey: ["me", "notifications"],
    // Fusion des mocks DANS le queryFn (cf. note structuralSharing ailleurs).
    queryFn: async () => {
      const d = await api<NotifsResponse>("/api/me/notifications");
      if (!SHOW_MOCK_NOTIFICATIONS) return d;
      const mocks = MOCK_NOTIFICATIONS.filter(
        (n) => !mockDeletedNotifs.has(n.id),
      ).map((n) => (mockReadNotifs.has(n.id) ? { ...n, unread: false } : n));
      const mockUnread = mocks.filter((n) => n.unread).length;
      return {
        notifications: [...mocks, ...d.notifications],
        unreadCount: d.unreadCount + mockUnread,
      };
    },
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
};

// ───────── Prospect ─────────
export type ProspectWallet = {
  monthGainsEur: number;
  lifetimeGainsEur: number;
  availableEur: number;
  escrowEur: number;
  canWithdraw: boolean;
  withdrawThresholdEur: number;
  relationsCount: number;
  accountCreatedAt: string | null;
  // Cents bruts renvoyés par /api/prospect/wallet (route.ts L125-139),
  // utilisés pour la ligne "BUUPP Coins" sous chaque solde (parité web :
  // coins = Math.round(cents), cf. Prospect.jsx fn Portefeuille).
  monthGainsCents: number;
  lifetimeGainsCents: number;
  availableCents: number;
  escrowCents: number;
};
export const useProspectWallet = () => {
  const api = useApi();
  return useQuery({
    queryKey: ["prospect", "wallet"],
    // DEV : ajoute le séquestre des flash deals fictifs acceptés DANS le
    // queryFn (cf. note structuralSharing sur useFlashDeals).
    queryFn: async () => {
      const w = await api<ProspectWallet>("/api/prospect/wallet");
      return applyMockEscrow(w);
    },
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
};

export type Relation = {
  // Champs communs pending + history
  id: string;
  campaignId: string;
  pro: string;
  sector: string;
  motif: string;
  brief: string | null;
  reward: number;
  tier: number;
  timer: string;
  startDate: string;
  endDate: string;
  isFlashDeal: boolean;
  reported: boolean;
  // Champs spécifiques pending
  expiresAt?: string;
  // Champs spécifiques history
  date?: string;
  /** Label décision affiché : "Acceptée" | "Refusée" | "Expirée" */
  decision?: string;
  /** Label statut affiché : "Crédité" | "En séquestre" | "—" */
  status?: string;
  /** Statut brut DB : "accepted" | "settled" | "refused" | "pending" */
  relationStatus?: string;
  gain?: number | null;
  campaignStatus?: string | null;
  // Champs renvoyés par l'API conservés pour parité de shape — non affichés sur mobile :
  proName?: string;
  campaignOpen?: boolean;
  campaignActive?: boolean;
};
// DEV : 3 sollicitations (demandes en attente) fictives pour visualiser le
// carrousel de la page Relations. Mettre à `false` avant la prod.
const SHOW_MOCK_SOLLICITATIONS = true;

function buildMockSollicitations(): Relation[] {
  const now = Date.now();
  const iso = (ms: number) => new Date(now + ms).toISOString();
  const hms = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };
  const base = {
    isFlashDeal: false,
    reported: false,
    relationStatus: "pending",
    campaignOpen: true,
    campaignActive: true,
  };
  const mk = (
    id: string,
    pro: string,
    sector: string,
    motif: string,
    brief: string,
    reward: number,
    tier: number,
    expMs: number,
  ): Relation => ({
    ...base,
    id,
    campaignId: id,
    pro,
    proName: pro,
    sector,
    motif,
    brief,
    reward,
    tier,
    timer: hms(expMs),
    startDate: iso(-6 * 3600_000),
    endDate: iso(expMs),
    expiresAt: iso(expMs),
  });
  return [
    mk(
      "mock-soll-1",
      "Studio Verde",
      "Architecture & déco",
      "Projet de rénovation d’un loft — recherche de propriétaires.",
      "Nous accompagnons les particuliers dans la rénovation de leur intérieur.",
      2.5,
      2,
      12 * 3600_000,
    ),
    mk(
      "mock-soll-2",
      "NutriCoach",
      "Nutrition & bien-être",
      "Bilan nutritionnel personnalisé offert.",
      "Coaching nutritionnel à distance pour reprendre de bonnes habitudes.",
      1.8,
      1,
      5 * 3600_000 + 21 * 60_000,
    ),
    mk(
      "mock-soll-3",
      "Hexa Immo",
      "Immobilier",
      "Estimation gratuite de votre bien.",
      "Agence locale : estimation et accompagnement à la vente.",
      3.2,
      3,
      20 * 3600_000,
    ),
  ];
}

const MOCK_SOLLICITATIONS: Relation[] = SHOW_MOCK_SOLLICITATIONS
  ? buildMockSollicitations()
  : [];

// État simulé des sollicitations fictives (accept/refuse) — appliqué au
// queryFn. Une sollicitation acceptée RESTE dans le carrousel mais passe en
// statut « accepted » (badge ✓) ; une refusée disparaît.
const acceptedMockSoll = new Set<string>();
const refusedMockSoll = new Set<string>();
export function isMockSollicitation(id: string): boolean {
  return id.startsWith("mock-soll-");
}
export function recordMockSollicitationAccepted(id: string): void {
  acceptedMockSoll.add(id);
  refusedMockSoll.delete(id);
}
export function recordMockSollicitationRefused(id: string): void {
  refusedMockSoll.add(id);
  acceptedMockSoll.delete(id);
}

export const useProspectRelations = () => {
  const api = useApi();
  return useQuery({
    queryKey: ["prospect", "relations"],
    // Fusion des sollicitations fictives DANS le queryFn (cf. note
    // structuralSharing ailleurs).
    queryFn: async () => {
      const d = await api<{ pending: Relation[]; history: Relation[] }>(
        "/api/prospect/relations",
      );
      if (!SHOW_MOCK_SOLLICITATIONS) return d;
      const mockPending = MOCK_SOLLICITATIONS.filter(
        (s) => !refusedMockSoll.has(s.id),
      ).map((s) =>
        acceptedMockSoll.has(s.id)
          ? { ...s, relationStatus: "accepted", decision: "Acceptée" }
          : s,
      );
      return { ...d, pending: [...mockPending, ...d.pending] };
    },
    staleTime: 90_000,
    placeholderData: keepPreviousData,
  });
};

export type Score = {
  score: number;
  breakdown: {
    completeness: { pct: number; filled: number; total: number };
    freshness: { pct: number; ageDays: number };
    acceptance: { pct: number; accepted: number; total: number };
  };
};
export const useProspectScore = () =>
  useGet<Score>(["prospect", "score"], "/api/prospect/score", 60_000);

export type Parrainage = {
  refCode: string;
  launchAt: string | null;
  cap: number;
  count: number;
  remaining: number;
  badgeTier: "cuivre" | "argent" | "or" | null;
  founderNumber: number | null;
  isFounder: boolean;
  filleuls: {
    prenom: string | null;
    nom: string | null;
    ville: string | null;
    createdAt: string;
  }[];
};
export const useParrainage = () =>
  useGet<Parrainage>(["prospect", "parrainage"], "/api/prospect/parrainage", 60_000);

/** Accepter / refuser une mise en relation (body réel : { action }). */
export function useDecideRelation() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; action: "accept" | "refuse" | "undo" }) =>
      api(`/api/prospect/relations/${v.id}/decision`, {
        method: "POST",
        body: JSON.stringify({ action: v.action }),
      }),
    onSuccess: () => {
      // Équivalent mobile de l'event web : resync des vues impactées.
      // `movements` est inclus pour que la modale détail ouverte depuis
      // l'historique Portefeuille reflète l'accept/refuse immédiatement.
      qc.invalidateQueries({ queryKey: ["prospect", "relations"] });
      qc.invalidateQueries({ queryKey: ["prospect", "wallet"] });
      qc.invalidateQueries({ queryKey: ["prospect", "score"] });
      qc.invalidateQueries({ queryKey: ["prospect", "movements"] });
    },
  });
}

/** Signaler un professionnel pour une relation donnée.
 *  Body : { reason: 'sollicitation_multiple' | 'faux_compte' | 'echange_abusif',
 *           comment?: string }. 409 = déjà signalé, traité comme succès. */
export type ReportReason =
  | "sollicitation_multiple"
  | "faux_compte"
  | "echange_abusif";

export function useReportRelation() {
  const api = useApi();
  return useMutation({
    mutationFn: async (v: {
      id: string;
      reason: ReportReason;
      comment?: string;
    }) => {
      try {
        await api(`/api/prospect/relations/${v.id}/report`, {
          method: "POST",
          body: JSON.stringify({
            reason: v.reason,
            comment: v.comment?.trim() || undefined,
          }),
        });
      } catch (e) {
        // 409 (déjà signalé) doit remonter en succès silencieux côté UI.
        if (e instanceof ApiError && e.status === 409) return;
        throw e;
      }
    },
  });
}

// — Mouvements financiers — GET /api/prospect/movements

/** Forme exacte du sous-objet `relation` renvoyé par buildRelation côté
 *  API (cf. app/api/prospect/movements/route.ts). Ré-utilisé tel quel
 *  par la modale de détail mobile pour rendre les mêmes infos que le
 *  RelationDetailModal web. */
export type MovementRelation = {
  id: string;
  date: string | null;
  pro: string;
  proName: string;
  sector: string;
  motif: string;
  brief: string | null;
  /** Titre de la campagne (campaigns.name) — « objet de la demande »,
   *  distinct du brief. Optionnel : absent tant que l'API prod n'expose
   *  pas encore le champ. */
  campaignName?: string | null;
  reward: number;
  tier: number;
  tiers?: number[] | null;
  timer: string;
  startDate: string | null;
  endDate: string | null;
  decision: string;
  status: string;
  /** ISO de la date de fin de campagne pour les relations en séquestre
   *  (status='accepted'). Date à laquelle l'escrow basculera en crédit.
   *  null si la relation n'est pas en séquestre (refused/settled/etc.). */
  availableAt: string | null;
  relationStatus: string;
  gain: number | null;
  campaignStatus: string | null;
  campaignOpen: boolean;
  campaignActive: boolean;
  /** Le prospect a-t-il déjà signalé cette relation ? Annotation côté
   *  serveur (cf. lib/prospect/reports.ts). Utilisé pour cacher le
   *  bouton « Signaler » de la modale détail au lieu d'envoyer un POST
   *  qui ferait 409 silencieux. */
  reported?: boolean;
  /** Référence lisible "BPP-XXXX-XXXX" dérivée de l'id relation (API
   *  movements). Affichée dans le tableau de la modale détail. */
  reference?: string;
  /** Solde disponible du portefeuille juste après cette opération (même
   *  définition que /api/prospect/wallet). null quand la relation ne
   *  provient pas d'une transaction (ex. écran Relations). */
  balanceAfterCents?: number | null;
  balanceAfterEur?: number | null;
};

export type Movement = {
  id: string;
  date: string;
  origin: string;
  /** Palier "principal" rétrocompatible (max de campaigns.targeting.requiredTiers). */
  tier: number | null;
  /** Optionnel : liste triée des paliers couverts par la campagne (1..5).
   *  Si fourni et de longueur > 1, l'UI affiche un format groupé
   *  (« Palier 1-2,5 ») au lieu d'un palier unique. */
  tiers?: number[] | null;
  statusLabel: string;
  statusChip: string;
  amountCents: number;
  amountEur: number;
  sign: string;
  relation: MovementRelation | null;
};
type MovementsResponse = { movements: Movement[] };
export const useProspectMovements = () => {
  const api = useApi();
  return useQuery({
    queryKey: ["prospect", "movements"],
    // DEV : préfixe les mouvements des flash deals fictifs acceptés dans le
    // queryFn (cf. note structuralSharing sur useFlashDeals).
    queryFn: async () => {
      const d = await api<MovementsResponse>("/api/prospect/movements");
      return SHOW_MOCK_FLASH_DEALS
        ? { ...d, movements: [...buildMockAcceptedMovements(), ...d.movements] }
        : d;
    },
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
};

// — Mes données — GET /api/prospect/donnees
export type TierKey = "identity" | "localisation" | "vie" | "pro" | "patrimoine";
export type DonneesResp = {
  identity: Record<string, unknown> | null;
  localisation: Record<string, unknown> | null;
  vie: Record<string, unknown> | null;
  pro: Record<string, unknown> | null;
  patrimoine: Record<string, unknown> | null;
  identityMeta: { phoneVerifiedAt: string | null };
  hiddenTiers: TierKey[];
  removedTiers: TierKey[];
  isFounder: boolean;
};
export const useProspectDonnees = () =>
  useGet<DonneesResp>(["prospect", "donnees"], "/api/prospect/donnees", 15_000);

// — Vérification — GET /api/prospect/verification
export type Verification = {
  tier: string;
  rib: {
    ibanMasked: string;
    bic: string;
    holderName: string;
    validated: boolean;
    validatedAt: string | null;
  } | null;
  physicalAcceptances: number;
  progress: number;
};
export const useProspectVerification = () =>
  useGet<Verification>(
    ["prospect", "verification"],
    "/api/prospect/verification",
    30_000,
  );

// — Score history — GET /api/prospect/score/history?range=1M|3M|6M|12M
export type ScoreHistory = {
  range: string;
  since: string;
  points: {
    date: string;
    score: number;
    completenessPct: number;
    freshnessPct: number;
    acceptancePct: number;
  }[];
};
export const useProspectScoreHistory = (range: "1M" | "3M" | "6M" | "12M" = "3M") =>
  useGet<ScoreHistory>(
    ["prospect", "score", "history", range],
    `/api/prospect/score/history?range=${range}`,
    60_000,
  );

// — Fiscal — GET /api/prospect/fiscal
export type Fiscal = {
  thresholdEur: number;
  thresholdTransactions: number;
  currentYear: {
    year: number;
    totalCents: number;
    totalEur: number;
    transactionCount: number;
    thresholdReached: boolean;
  };
  previousYear: {
    year: number;
    totalCents: number;
    totalEur: number;
    transactionCount: number;
    reportedToDgfip: boolean;
  };
};
export const useProspectFiscal = () =>
  useGet<Fiscal>(["prospect", "fiscal"], "/api/prospect/fiscal", 60_000);

// — Statut payout (Stripe Connect) — GET /api/prospect/payout/status
export type PayoutStatus = {
  hasAccount: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
};
export const usePayoutStatus = () =>
  useGet<PayoutStatus>(
    ["prospect", "payout", "status"],
    "/api/prospect/payout/status",
    30_000,
  );

// — Consentement tracking e-mail — GET /api/me/email-tracking
export type EmailTracking = { consent: boolean; role: Role };
export const useEmailTracking = () =>
  useGet<EmailTracking>(
    ["me", "email-tracking"],
    "/api/me/email-tracking",
    60_000,
  );

// — Identité (prénom/nom/email) — GET /api/me
export type Me = {
  prenom: string | null;
  nom: string | null;
  email: string | null;
  initials: string;
  role: "prospect" | "pro" | null;
  displayName: string;
};
// `useMe` existe déjà (ligne ~25) typé Record<string,unknown> ; on ajoute
// une variante typée pour les écrans qui en ont besoin.
export const useMeTyped = () => useGet<Me>(["me"], "/api/me", 60_000);

// ── Mutations prospect/me ──────────────────────────────────────────
export function usePatchDonnees() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { tier: TierKey; fields: Record<string, unknown> }) =>
      api("/api/prospect/donnees", {
        method: "PATCH",
        body: JSON.stringify(v),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospect", "donnees"] });
      qc.invalidateQueries({ queryKey: ["prospect", "score"] });
      qc.invalidateQueries({ queryKey: ["prospect", "verification"] });
    },
  });
}

export function useTierAction() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { tier: TierKey; action: "hide" | "restore" | "delete" }) =>
      api("/api/prospect/tier", { method: "POST", body: JSON.stringify(v) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospect", "donnees"] });
      qc.invalidateQueries({ queryKey: ["prospect", "score"] });
      qc.invalidateQueries({ queryKey: ["prospect", "verification"] });
    },
  });
}

export function usePhoneStart() {
  const api = useApi();
  return useMutation({
    mutationFn: (v: { phone: string }) =>
      api("/api/prospect/phone/start", {
        method: "POST",
        body: JSON.stringify(v),
      }),
  });
}

export function usePhoneVerify() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { code: string }) =>
      api("/api/prospect/phone/verify", {
        method: "POST",
        body: JSON.stringify(v),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospect", "donnees"] });
      qc.invalidateQueries({ queryKey: ["prospect", "verification"] });
      qc.invalidateQueries({ queryKey: ["prospect", "score"] });
    },
  });
}

export function useSaveRib() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { iban: string; bic: string; holderName: string }) =>
      api("/api/prospect/rib", { method: "POST", body: JSON.stringify(v) }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["prospect", "verification"] }),
  });
}

export function useDeleteRib() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("/api/prospect/rib", { method: "DELETE" }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["prospect", "verification"] }),
  });
}

export function usePayoutOnboarding() {
  const api = useApi();
  return useMutation({
    mutationFn: () =>
      api<{ url: string; accountId: string }>(
        "/api/prospect/payout/onboarding",
        { method: "POST" },
      ),
  });
}

export function usePayoutWithdraw() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    // `method: "iban"` est volontairement figé : la route /payout/withdraw rejette toute autre valeur (seul l'IBAN est supporté côté serveur).
    mutationFn: (v: { amountCents: number }) =>
      api("/api/prospect/payout/withdraw", {
        method: "POST",
        body: JSON.stringify({ amountCents: v.amountCents, method: "iban" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospect", "wallet"] });
      qc.invalidateQueries({ queryKey: ["prospect", "movements"] });
    },
  });
}

export function useSetEmailTracking() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { consent: boolean }) =>
      api("/api/me/email-tracking", {
        method: "PATCH",
        body: JSON.stringify(v),
      }),
    // Mise à jour optimiste : le toggle bascule instantanément sans
    // attendre l'aller-retour serveur (sinon il paraît « ne pas réagir »).
    // Rollback en cas d'erreur, resync via invalidate au settled.
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["me", "email-tracking"] });
      const prev = qc.getQueryData<EmailTracking>(["me", "email-tracking"]);
      if (prev) {
        qc.setQueryData<EmailTracking>(["me", "email-tracking"], {
          ...prev,
          consent: v.consent,
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData<EmailTracking>(["me", "email-tracking"], ctx.prev);
      }
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: ["me", "email-tracking"] }),
  });
}

export function useSendSuggestion() {
  const api = useApi();
  return useMutation({
    mutationFn: (v: { subject: string | null; message: string }) =>
      api<{ ok: true }>("/api/me/suggestions", {
        method: "POST",
        body: JSON.stringify(v),
      }),
  });
}

export function useDeleteAccount() {
  const api = useApi();
  return useMutation({
    mutationFn: () => api("/api/me", { method: "DELETE" }),
  });
}

// — Versions des pages légales / ressources — GET /api/page-versions
// (Source unique partagée avec le badge PageVersion web et le tableau
// Versionning du Centre d'aide.)
export type PageVersionItem = {
  slug: string;
  href: string;
  title: string;
  section: "ressources" | "legal";
  version: string;
  date: string;
};
export const usePageVersions = () =>
  useGet<{ items: PageVersionItem[] }>(
    ["page-versions"],
    "/api/page-versions",
    300_000,
  );

export function useMarkNotificationRead() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string }) =>
      api(`/api/me/notifications/${v.id}/read`, { method: "POST" }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["me", "notifications"] }),
  });
}

// — Flash deals (campagnes durationKey='1h') — GET /api/landing/flash-deals
// Public, optionnellement auth-aware. Mêmes données que la bannière
// défilante du site web. Rafraîchi toutes les 10 s pour que le timer
// HH:MM:SS reste vivant côté UI.
export type FlashDeal = {
  id: string;
  name: string;
  endsAt: string;
  /** Date de lancement (création campagne) — pour la barre de progression. */
  startsAt?: string;
  brief: string | null;
  multiplier: number;
  costPerContactCents: number;
  founderBonusApplied: boolean;
  founderVipBonusApplied: boolean;
  requiredTiers: number[];
  requiredTierKeys: string[];
  proName: string | null;
  proSector: string | null;
  isAuthenticated: boolean;
  relationId: string | null;
  relationStatus: string | null;
  missingTierKeys: string[];
};
type FlashDealsResponse = {
  deals: FlashDeal[];
  stats?: {
    lastSevenDaysCount?: number;
    /** Flash deals que CE prospect a acceptés sur les 7 derniers jours. */
    acceptedLast7DaysCount?: number;
  };
};

// DEV : injecte 5 flash deals fictifs (durée ~24 h) pour visualiser le
// carrousel et la sheet de détail sans dépendre de campagnes réelles en
// base. Mettre à `false` (ou supprimer) avant la mise en prod. Les états
// (pending / accepted / refused / fill_data) sont variés pour montrer
// toutes les vues. Note : les actions Accepter/Refuser sur ces deals
// échouent (relationId fictif) — c'est uniquement pour l'affichage.
const SHOW_MOCK_FLASH_DEALS = true;

function buildMockFlashDeals(): FlashDeal[] {
  const now = Date.now();
  // endsAt ≈ 24 h, légèrement échelonné pour des timers distincts.
  const endsIn = (i: number) =>
    new Date(now + 24 * 60 * 60_000 - i * 11 * 60_000).toISOString();
  // startsAt échelonné (lancé il y a 1 h à ~13 h) → barres de progression
  // variées dans le carrousel.
  const startedAt = (i: number) =>
    new Date(now - (i * 3 + 1) * 60 * 60_000).toISOString();
  const base = {
    // Flash deal = durationKey '1h' → multiplicateur ×3 (cf. web
    // DURATION_MULTIPLIERS : 1h→3, 24h→2, 48h→1.5, 7d→1).
    multiplier: 3,
    founderBonusApplied: false,
    founderVipBonusApplied: false,
    isAuthenticated: true,
  };
  return [
    {
      ...base,
      id: "mock-fd-1",
      name: "Bilan énergétique solaire offert",
      endsAt: endsIn(0),
      startsAt: startedAt(0),
      brief:
        "Installateur photovoltaïque : prospects propriétaires intéressés par l'auto-consommation solaire.",
      costPerContactCents: 1020,
      requiredTiers: [1, 2, 5],
      requiredTierKeys: ["identity", "localisation", "patrimoine"],
      proName: "Solaria",
      proSector: "Énergies renouvelables",
      relationId: "mock-rel-1",
      relationStatus: "pending",
      missingTierKeys: [],
    },
    {
      ...base,
      id: "mock-fd-2",
      name: "Devis dépannage prioritaire",
      endsAt: endsIn(1),
      startsAt: startedAt(1),
      brief:
        "Dépannage et rénovation : foyers cherchant un artisan de confiance près de chez eux.",
      costPerContactCents: 760,
      requiredTiers: [1, 2],
      requiredTierKeys: ["identity", "localisation"],
      proName: "Plomberie Martin",
      proSector: "Chauffage & sanitaire",
      relationId: "mock-rel-2",
      relationStatus: "pending",
      missingTierKeys: [],
    },
    {
      ...base,
      id: "mock-fd-3",
      name: "Séance découverte offerte",
      endsAt: endsIn(2),
      startsAt: startedAt(2),
      brief:
        "Coaching sportif à domicile : profils actifs souhaitant reprendre une activité régulière.",
      costPerContactCents: 580,
      requiredTiers: [1, 3],
      requiredTierKeys: ["identity", "vie"],
      proName: "Coach Attitude",
      proSector: "Bien-être & santé",
      relationId: "mock-rel-3",
      relationStatus: "accepted",
      missingTierKeys: [],
    },
    {
      ...base,
      id: "mock-fd-4",
      name: "Shooting portrait évènement",
      endsAt: endsIn(3),
      startsAt: startedAt(3),
      brief:
        "Shooting portrait : particuliers à la recherche d'un photographe pour un évènement.",
      costPerContactCents: 940,
      requiredTiers: [1, 2],
      requiredTierKeys: ["identity", "localisation"],
      proName: "Studio Lumen",
      proSector: "Photographie",
      relationId: "mock-rel-4",
      relationStatus: "refused",
      missingTierKeys: [],
    },
    {
      ...base,
      id: "mock-fd-5",
      name: "Essai vélo électrique",
      endsAt: endsIn(4),
      startsAt: startedAt(4),
      brief:
        "Vélos électriques : urbains envisageant de passer à la mobilité douce.",
      costPerContactCents: 1240,
      requiredTiers: [1, 2, 5],
      requiredTierKeys: ["identity", "localisation", "patrimoine"],
      proName: "Greenmove",
      proSector: "Mobilité durable",
      relationId: null,
      relationStatus: null,
      missingTierKeys: ["patrimoine"],
    },
  ];
}

// Mocks calculés UNE fois au chargement du module : endsAt fixés au démarrage
// de l'app (+24 h) → les timers décomptent normalement. Un `select` stable
// (défini hors du hook) évite que react-query ne régénère les deals à chaque
// render (ce qui réinitialiserait les compteurs à chaque tick).
const MOCK_FLASH_DEALS: FlashDeal[] = SHOW_MOCK_FLASH_DEALS
  ? buildMockFlashDeals()
  : [];
const MOCK_DEAL_BY_ID = new Map(MOCK_FLASH_DEALS.map((d) => [d.id, d]));

// ── DEV : décisions simulées sur les flash deals fictifs ───────────────
// Les deals fictifs n'ont pas de relation réelle en base : on simule
// l'accept/refuse côté client (pas d'appel API), et un deal accepté est
// injecté dans les Mouvements du portefeuille (escrow « En séquestre »).
// `acceptedMockDeals` : id deal fictif → ISO de la décision d'acceptation.
const acceptedMockDeals = new Map<string, string>();
// Mocks explicitement refusés (statut « refused » dans la liste → bouton
// « Accepter finalement » tant que la campagne n'est pas clôturée).
const refusedMockDeals = new Set<string>();
// Pré-remplit selon le statut de base : accepted/settled → séquestre +
// Mouvements d'emblée ; refused → bascule « Accepter finalement ».
MOCK_FLASH_DEALS.forEach((d) => {
  if (d.relationStatus === "accepted" || d.relationStatus === "settled") {
    acceptedMockDeals.set(d.id, new Date().toISOString());
  } else if (d.relationStatus === "refused") {
    refusedMockDeals.add(d.id);
  }
});

export function isMockDeal(id: string): boolean {
  return id.startsWith("mock-");
}
export function recordMockDealAccepted(id: string): void {
  acceptedMockDeals.set(id, new Date().toISOString());
  refusedMockDeals.delete(id);
}
export function recordMockDealRefused(id: string): void {
  acceptedMockDeals.delete(id);
  refusedMockDeals.add(id);
}

// Montant total (cents) des flash deals fictifs acceptés — injecté dans le
// séquestre du portefeuille (parité avec les Mouvements fictifs).
function mockAcceptedEscrowCents(): number {
  let c = 0;
  acceptedMockDeals.forEach((_iso, id) => {
    const d = MOCK_DEAL_BY_ID.get(id);
    if (d) c += d.costPerContactCents;
  });
  return c;
}
// Ajoute le séquestre fictif au wallet (DEV). No-op si le flag est désactivé
// ou si aucun mock n'est accepté.
function applyMockEscrow(w: ProspectWallet): ProspectWallet {
  if (!SHOW_MOCK_FLASH_DEALS) return w;
  const extra = mockAcceptedEscrowCents();
  if (extra <= 0) return w;
  const escrowCents = w.escrowCents + extra;
  return {
    ...w,
    escrowCents,
    escrowEur: Math.round(escrowCents) / 100,
    relationsCount: w.relationsCount + acceptedMockDeals.size,
  };
}

// Construit la relation détaillée d'un mouvement fictif (réutilisée par la
// modale détail des Mouvements).
function buildMockMovementRelation(d: FlashDeal, iso: string): MovementRelation {
  const reward = d.costPerContactCents / 100;
  const tier =
    d.requiredTiers && d.requiredTiers.length > 0
      ? Math.max(...d.requiredTiers)
      : 1;
  return {
    // On expose l'id du deal fictif (mock-fd-*) comme id de relation : la
    // modale détail des Mouvements peut ainsi simuler un refus directement.
    id: d.id,
    date: iso,
    pro: d.proName ?? "Un professionnel",
    proName: d.proName ?? "Un professionnel",
    sector: d.proSector ?? "",
    motif: d.name,
    brief: d.brief,
    campaignName: d.name,
    reward,
    tier,
    tiers: d.requiredTiers ?? null,
    timer: "",
    startDate: d.startsAt ?? null,
    endDate: d.endsAt,
    decision: "Acceptée",
    status: "En séquestre",
    availableAt: d.endsAt,
    relationStatus: "accepted",
    gain: reward,
    campaignStatus: "active",
    campaignOpen: true,
    campaignActive: true,
    reported: false,
    balanceAfterCents: null,
    balanceAfterEur: null,
  };
}

// Mouvements fictifs « En séquestre » pour chaque deal fictif accepté
// (plus récent d'abord), à préfixer aux vrais mouvements.
function buildMockAcceptedMovements(): Movement[] {
  const out: Movement[] = [];
  acceptedMockDeals.forEach((iso, id) => {
    const d = MOCK_DEAL_BY_ID.get(id);
    if (!d) return;
    out.push({
      id: `mockmov-${id}`,
      date: iso,
      origin: d.proName ?? "Un professionnel",
      tier:
        d.requiredTiers && d.requiredTiers.length > 0
          ? Math.max(...d.requiredTiers)
          : null,
      tiers: d.requiredTiers ?? null,
      statusLabel: "En séquestre",
      statusChip: "warn",
      amountCents: d.costPerContactCents,
      amountEur: d.costPerContactCents / 100,
      sign: "+",
      relation: buildMockMovementRelation(d, iso),
    });
  });
  return out.reverse();
}

// Deals fictifs avec leur statut simulé (accepté / refusé) appliqué, pour
// que le bon bouton « Refuser / Accepter finalement » s'affiche.
function mockDealsForList(): FlashDeal[] {
  return MOCK_FLASH_DEALS.map((m) => {
    if (acceptedMockDeals.has(m.id)) return { ...m, relationStatus: "accepted" };
    if (refusedMockDeals.has(m.id)) return { ...m, relationStatus: "refused" };
    return m;
  });
}

export const useFlashDeals = () => {
  const api = useApi();
  return useQuery({
    queryKey: ["landing", "flash-deals"],
    // Fusion des mocks DANS le queryFn (pas en `select`) : sinon, quand le
    // serveur renvoie des données identiques, `structuralSharing` garde la
    // même référence et le `select` mémoïsé ne reflète pas le nouvel état
    // mock (séquestre / accepté / refusé).
    queryFn: async () => {
      const d = await api<FlashDealsResponse>("/api/landing/flash-deals");
      return SHOW_MOCK_FLASH_DEALS
        ? { ...d, deals: [...mockDealsForList(), ...d.deals] }
        : d;
    },
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });
};

/** Marque toutes les notifications non lues passées en argument comme lues
 *  (parité web markAll : POST /api/me/notifications/[id]/read en parallèle
 *  + invalidation du cache). Les erreurs unitaires sont avalées —
 *  l'objectif est d'aller le plus loin possible. */
export function useMarkAllNotificationsRead() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { ids: string[] }) => {
      await Promise.allSettled(
        v.ids.map((id) =>
          api(`/api/me/notifications/${id}/read`, { method: "POST" }),
        ),
      );
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["me", "notifications"] }),
  });
}

/** Suppression d'un message côté inbox utilisateur (parité web :
 *  DELETE /api/me/notifications/[id] → row admin_broadcast_dismissals).
 *  Le broadcast en base reste intact (audience partagée). */
export function useDeleteNotification() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string }) =>
      api(`/api/me/notifications/${v.id}`, { method: "DELETE" }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["me", "notifications"] }),
  });
}

// ───────── Pro ─────────
export type ProOverview = {
  contactsAccepted30d: number;
  contactsAcceptedThisMonth: number;
  activeCampaignsCount: number;
  acceptanceRate: number;
  avgCostCents: number;
  spent30dCents: number;
  roi: {
    pct: number | null;
    spentCents: number;
    potentialRevenueCents: number;
    /** Hypothèses appliquées (cf. lib/pro/roi.ts) — renvoyées pour la
     *  transparence du popup explicatif. Défauts : 10 % et 100 €. */
    assumedConversionPct: number;
    assumedValuePerClientCents: number;
  } | null;
  lastAcceptances: {
    name: string;
    score: number;
    campaign: string;
    tier: number;
    receivedAt: string | null;
    costCents: number;
  }[];
  tierBreakdown: { tier: number; label: string; contacts: number; totalCents: number }[];
};
export const useProOverview = () =>
  useGet<ProOverview>(["pro", "overview"], "/api/pro/overview", 30_000);

export type Campaign = {
  id: string;
  name: string;
  status: string;
  objectiveLabel: string;
  budgetEur: number;
  spentEur: number;
  contactsCount: number;
  reachedCount: number;
  createdAt: string;
  avgCostEur: number;
  code?: string | null;
  authCode?: string | null;
  durationKey?: string | null;
  endsAt?: string | null;
};
export const useProCampaigns = () =>
  useGet<{ campaigns: Campaign[] }>(["pro", "campaigns"], "/api/pro/campaigns", 30_000);

// — Détail d'une campagne — GET /api/pro/campaigns/[id]
export type CampaignFunnel = {
  matched: number;
  sent: number;
  pending: number;
  accepted: number;
  refused: number;
  expired: number;
  settled: number;
};
export type CampaignContact = {
  id: string;
  prospectId: string;
  name: string;
  score: number | null;
  tierLabel: string;
  decidedAt: string;
  statusLabel: string;
  statusChip: string;
};
export type ProCampaignDetail = {
  id: string;
  name: string;
  status: string;
  brief: string | null;
  objectiveLabel: string;
  objectiveId: string | null;
  startsAtLabel: string;
  endsAtLabel: string | null;
  createdAtLabel: string;
  budgetEur: number;
  spentEur: number;
  remainingEur: number;
  costPerContactEur: number;
  avgCostEur: number;
  targeting: {
    subTypes: string[];
    requiredTiers: number[];
    tierLabels: string[];
    geo: string | null;
    geoLabel: string;
    ages: string[];
    verifLevel: string | null;
    verifLabel: string;
    keywords: string[];
    kwFilter: boolean;
    poolLabel: string;
    days: number | null;
    durationKey: string | null;
    excludeCertified: boolean;
  };
  plannedContacts: number;
  funnel: CampaignFunnel;
  acceptanceRate: number | null;
  decidedCount: number;
  winCount: number;
  contacts: CampaignContact[];
  activity: { ts: string; kind: string; label: string }[];
};
export function useProCampaign(id?: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["pro", "campaign", id ?? ""],
    queryFn: () => api<ProCampaignDetail>(`/api/pro/campaigns/${id}`),
    enabled: !!id,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export type ProContact = {
  relationId: string;
  name: string;
  score: number;
  campaign: string;
  tier: number;
  email: string | null;
  telephone: string | null;
  receivedAt: string | null;
};
export const useProContacts = () =>
  useGet<{ rows: ProContact[] }>(["pro", "contacts"], "/api/pro/contacts", 30_000);

export type ProWallet = {
  walletBalanceEur: number;
  walletReservedEur: number;
  walletAvailableEur: number;
  raisonSociale: string | null;
};
export const useProWallet = () =>
  useGet<ProWallet>(["pro", "wallet"], "/api/pro/wallet", 30_000);

export type Invoice = {
  number: string;
  date: string;
  label: string;
  description: string | null;
  amountEur: number;
  statusLabel: string;
};
export const useProInvoices = () =>
  useGet<{ invoices: Invoice[] }>(["pro", "invoices"], "/api/pro/invoices", 60_000);

// — Plan tarifaire — GET/POST /api/pro/plan
export type ProPlan = {
  plan: "starter" | "pro";
  label: string;
  monthlyEur: number;
  monthlyCents: number;
  maxProspects: number;
  maxCampaigns: number;
  specs: Record<
    string,
    { label: string; monthlyEur: number; monthlyCents: number; maxProspects: number; maxCampaigns: number }
  >;
  cycleCount: number;
  cap: number;
  capReached: boolean;
};
export const useProPlan = () =>
  useGet<ProPlan>(["pro", "plan"], "/api/pro/plan", 60_000);

export function useSetProPlan() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { plan: "starter" | "pro" }) =>
      api<ProPlan>("/api/pro/plan", { method: "POST", body: JSON.stringify(v) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pro", "plan"] }),
  });
}

// — Informations société — GET/PATCH /api/pro/info
export type ProInfo = {
  raisonSociale: string;
  adresse: string;
  ville: string;
  codePostal: string;
  siren: string;
  secteur: string;
  formeJuridique: string;
  capitalSocialEur: number | null;
  siret: string;
  rcsVille: string;
  rmNumber: string;
};
export const useProInfo = () =>
  useGet<ProInfo>(["pro", "info"], "/api/pro/info", 60_000);

export function usePatchProInfo() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Partial<ProInfo>) =>
      api<{ ok: true; updated: number }>("/api/pro/info", {
        method: "PATCH",
        body: JSON.stringify(v),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pro", "info"] }),
  });
}

// — Analytics — GET /api/pro/analytics?campaignId&period
export type ProAnalytics = {
  acceptanceByTier: { tier: number; label: string; pct: number }[];
  geoBreakdown: { ville: string; contacts: number; pct: number }[];
  ageBreakdown: { label: string; pct: number }[];
  sexBreakdown: { label: string; pct: number }[];
  creneauHeatmap: {
    hourLabels: number[];
    counts: number[][];
    total: number;
    max: number;
  };
  sampleSize: { rows: number; wins: number };
  campaigns: { id: string; name: string; status: string }[];
  filters: { campaignId: string | null; period: string };
};
export const useProAnalytics = (
  campaignId?: string,
  period: "7d" | "30d" | "90d" | "all" = "30d",
) => {
  const qs = new URLSearchParams();
  if (campaignId) qs.set("campaignId", campaignId);
  qs.set("period", period);
  return useGet<ProAnalytics>(
    ["pro", "analytics", campaignId ?? "all", period],
    `/api/pro/analytics?${qs.toString()}`,
    60_000,
  );
};

// — Création de campagne — POST /api/pro/campaigns
export type CreateCampaignInput = {
  objectiveId: string;
  subTypes: string[];
  requiredTiers: number[];
  geo: string;
  ages: string[];
  verifLevel: string;
  contacts: number;
  startDate: string;
  endDate: string;
  durationKey: string;
  brief: string;
  costPerContactCents: number;
  budgetCents: number;
  keywords: string[];
  kwFilter: boolean;
  poolMode: string;
  excludeCertified: boolean;
  founder_bonus_enabled: boolean;
};
export type CreateCampaignResult = {
  campaignId: string;
  matchedCount: number;
  code: string;
  warning: string | null;
};
export function useCreateCampaign() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: CreateCampaignInput) =>
      api<CreateCampaignResult>("/api/pro/campaigns", {
        method: "POST",
        body: JSON.stringify(v),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro", "campaigns"] });
      qc.invalidateQueries({ queryKey: ["pro", "wallet"] });
      qc.invalidateQueries({ queryKey: ["pro", "overview"] });
    },
  });
}

// — Recharge crédit (Stripe Checkout) —
// POST /api/stripe/checkout { amountCents } → { url } (URL Checkout Stripe).
export function useCreateTopupCheckout() {
  const api = useApi();
  return useMutation({
    mutationFn: (v: { amountCents: number }) =>
      api<{ url: string }>("/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ amountCents: v.amountCents }),
      }),
  });
}

// POST /api/pro/topup/reconcile { sessionId } → crédite (idempotent).
export function useReconcileTopup() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { sessionId: string }) =>
      api<{ ok: true; alreadyCredited: boolean; amountCents: number }>(
        "/api/pro/topup/reconcile",
        { method: "POST", body: JSON.stringify({ sessionId: v.sessionId }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro", "wallet"] });
      qc.invalidateQueries({ queryKey: ["pro", "invoices"] });
    },
  });
}

// — Timeseries acceptations — GET /api/pro/timeseries?range
export type ProTimeseries = {
  range: "7d" | "30d" | "90d";
  buckets: { start: string; end: string; label: string; count: number }[];
};
export const useProTimeseries = (range: "7d" | "30d" | "90d" = "7d") =>
  useGet<ProTimeseries>(
    ["pro", "timeseries", range],
    `/api/pro/timeseries?range=${range}`,
    60_000,
  );
