// Couche de synchro (cf. MOBILE_APP_SPEC.md §6) : React Query au-dessus
// du wrapper /api/*. 1 queryKey par endpoint ; invalidation après
// mutation = équivalent mobile des events web. Refetch on focus/reconnect
// réglé dans _layout. Shapes alignées sur les routes réelles du web.
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useApi } from "./api";

export type Role = "prospect" | "pro" | null;

// Helper générique : un hook de requête GET sur un endpoint.
function useGet<T>(key: (string | number)[], path: string, staleMs = 30_000) {
  const api = useApi();
  return useQuery({
    queryKey: key,
    queryFn: () => api<T>(path),
    staleTime: staleMs,
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
};
export const useNotifications = () =>
  useGet<{ notifications: Notif[]; unreadCount: number }>(
    ["me", "notifications"],
    "/api/me/notifications",
    15_000,
  );

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
};
export const useProspectWallet = () =>
  useGet<ProspectWallet>(["prospect", "wallet"], "/api/prospect/wallet", 15_000);

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
export const useProspectRelations = () =>
  useGet<{ pending: Relation[]; history: Relation[] }>(
    ["prospect", "relations"],
    "/api/prospect/relations",
    15_000,
  );

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
  vipEligible: boolean;
  vipThreshold: number;
  vipBudgetMinEur: number;
  vipFlatBonusEur: number;
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
      qc.invalidateQueries({ queryKey: ["prospect", "relations"] });
      qc.invalidateQueries({ queryKey: ["prospect", "wallet"] });
      qc.invalidateQueries({ queryKey: ["prospect", "score"] });
    },
  });
}

// — Mouvements financiers — GET /api/prospect/movements
export type Movement = {
  id: string;
  date: string;
  origin: string;
  tier: number | null;
  statusLabel: string;
  statusChip: string;
  amountCents: number;
  amountEur: number;
  sign: string;
  relation: Record<string, unknown> | null;
};
export const useProspectMovements = () =>
  useGet<{ movements: Movement[] }>(
    ["prospect", "movements"],
    "/api/prospect/movements",
    15_000,
  );

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
    onSuccess: () =>
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

// ───────── Pro ─────────
export type ProOverview = {
  contactsAccepted30d: number;
  contactsAcceptedThisMonth: number;
  activeCampaignsCount: number;
  acceptanceRate: number;
  avgCostCents: number;
  roi: { pct: number | null } | null;
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
};
export const useProCampaigns = () =>
  useGet<{ campaigns: Campaign[] }>(["pro", "campaigns"], "/api/pro/campaigns", 30_000);

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
