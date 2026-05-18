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
  id: string;
  pro: string;
  sector: string;
  motif: string;
  reward: number;
  tier: number;
  timer: string;
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
  count: number;
  cap: number;
  remaining: number;
  vipEligible: boolean;
  filleuls: { prenom: string | null; nom: string | null; ville: string | null; createdAt: string }[];
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
