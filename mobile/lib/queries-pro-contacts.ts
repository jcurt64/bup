// Hooks « Mes contacts » + « Détail campagne » (espace pro) — parité web
// Pro.jsx. Séparés de lib/queries.ts pour limiter les conflits d'édition ;
// les types de base (ProContact, ProCampaignDetail, Campaign) restent dans
// queries.ts et sont ENRICHIS ici des champs que l'API renvoie déjà mais que
// le mobile n'exploitait pas encore (locked, evaluation, emailsSent, pause…).
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";

import { ApiError, useApi } from "./api";
import type { Campaign, CampaignContact, ProCampaignDetail, ProContact } from "./queries";

// ── Types enrichis ─────────────────────────────────────────────────────────

export type ContactEvaluation = "atteint" | "non_atteint";

/** Ligne de GET /api/pro/contacts, avec les champs exposés par l'API. */
export type ProContactRow = ProContact & {
  /** Statut de la campagne (active / paused / completed). */
  campaignStatus?: string | null;
  /** Campagne non clôturée → ligne verrouillée (séquestre) : aucune
   *  coordonnée, pas de détail ni d'action (cf. proCanSeeContacts). */
  locked?: boolean;
  /** Canaux déclarés par la campagne (email/phone/sms/whatsapp/linkedin). */
  campaignChannels?: string[];
  /** Raison sociale du pro (token {{pro}} des modèles d'e-mail). */
  proName?: string;
  emailAvailable?: boolean;
  telephoneAvailable?: boolean;
  /** Signalement du pro après tentative de contact (alimente l'escalade
   *  non-réponse côté prospect). */
  evaluation?: ContactEvaluation | null;
  evaluatedAt?: string | null;
  /** E-mails déjà envoyés via BUUPP pour ce couple prospect × campagne
   *  (quota 1). */
  emailsSent?: number;
};

/** Campagne de la liste GET /api/pro/campaigns (champs complémentaires). */
export type ProCampaignListItem = Campaign & {
  objectiveId?: string | null;
  pauseEligible?: boolean;
  extendEligible?: boolean;
};

export type CampaignContactRow = CampaignContact & { status?: string };

/** GET /api/pro/campaigns/[id] — champs non typés dans queries.ts. */
export type ProCampaignDetailFull = Omit<ProCampaignDetail, "targeting" | "contacts"> & {
  targeting: ProCampaignDetail["targeting"] & {
    /** Seuil de Fiabilité minimum (0 / 60 / 80). */
    minFiabilite?: number;
  };
  contacts: CampaignContactRow[];
  startsAt?: string | null;
  endsAt?: string | null;
  extensionUsed?: boolean;
  extendedAtLabel?: string | null;
  extendEligible?: boolean;
  pauseUsed?: boolean;
  pausedAt?: string | null;
  autoResumeAt?: string | null;
  pauseEligible?: boolean;
  durationKey?: string | null;
};

/** Filtres de la liste « Contacts obtenus » du détail campagne (serveur). */
export type CampaignContactFilters = {
  status: "all" | "accepted" | "settled";
  scoreMin: string;
  period: "all" | "7d" | "30d" | "90d";
};
export const NO_CAMPAIGN_CONTACT_FILTERS: CampaignContactFilters = {
  status: "all",
  scoreMin: "",
  period: "all",
};

/** Extrait le code d'erreur JSON (`{ error }`) d'une ApiError. */
export function apiErrorCode(e: unknown): string | null {
  if (!(e instanceof ApiError)) return null;
  try {
    const j = JSON.parse(e.body) as { error?: unknown };
    return typeof j?.error === "string" ? j.error : null;
  } catch {
    return null;
  }
}

// ── Helpers cache (lignes de contacts) ─────────────────────────────────────

type RowsData = { rows: ProContactRow[] } | undefined;

/** Applique `fn` à la ligne `relationId` dans toutes les requêtes
 *  ["pro","contacts",…] (liste globale + listes filtrées de l'atelier). */
function patchContactRow(
  qc: ReturnType<typeof useQueryClient>,
  relationId: string,
  fn: (r: ProContactRow) => ProContactRow,
) {
  qc.setQueriesData<RowsData>({ queryKey: ["pro", "contacts"] }, (old) => {
    if (!old || !Array.isArray(old.rows)) return old;
    return {
      ...old,
      rows: old.rows.map((r) => (r.relationId === relationId ? fn(r) : r)),
    };
  });
}

// ── Mes contacts ───────────────────────────────────────────────────────────

/**
 * Signalement « Atteint / Non atteint » (ou reset = null).
 * POST /api/pro/contacts/[id]/evaluation — mise à jour optimiste (parité web),
 * rollback en cas d'échec.
 */
export function useContactEvaluation() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { relationId: string; evaluation: ContactEvaluation | null }) =>
      api<{ ok: true; evaluation: ContactEvaluation | null }>(
        `/api/pro/contacts/${encodeURIComponent(v.relationId)}/evaluation`,
        { method: "POST", body: JSON.stringify({ evaluation: v.evaluation }) },
      ),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["pro", "contacts"] });
      const snapshot = qc.getQueriesData<RowsData>({ queryKey: ["pro", "contacts"] });
      patchContactRow(qc, v.relationId, (r) => ({ ...r, evaluation: v.evaluation }));
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, data] of (ctx?.snapshot ?? []) as [QueryKey, RowsData][]) {
        qc.setQueryData(key, data);
      }
    },
  });
}

/**
 * E-mail individuel envoyé PAR BUUPP (Reply-To = e-mail du pro, adresse du
 * prospect jamais exposée). Quota 1 / campagne → 409 quota_reached.
 */
export function useContactEmail() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { relationId: string; subject: string; body: string }) =>
      api<{ ok: true; quotaRemaining: number }>(
        `/api/pro/contacts/${encodeURIComponent(v.relationId)}/email`,
        { method: "POST", body: JSON.stringify({ subject: v.subject, body: v.body }) },
      ),
    onSuccess: (_d, v) => {
      patchContactRow(qc, v.relationId, (r) => ({
        ...r,
        emailsSent: (r.emailsSent ?? 0) + 1,
      }));
    },
  });
}

/**
 * Révélation auditée (fail-closed) d'une coordonnée : e-mail → alias
 * watermarqué, téléphone → numéro réel (affiché masqué). 404 = non partagé.
 */
export function useContactReveal() {
  const api = useApi();
  return useMutation({
    mutationFn: (v: { relationId: string; field: "email" | "telephone" }) =>
      api<{ value: string }>(
        `/api/pro/contacts/${encodeURIComponent(v.relationId)}/reveal`,
        { method: "POST", body: JSON.stringify({ field: v.field }) },
      ),
  });
}

// ── Détail campagne ────────────────────────────────────────────────────────

function campaignQs(f: CampaignContactFilters): string {
  const qs = new URLSearchParams();
  if (f.status !== "all") qs.set("cstatus", f.status);
  const n = Number(f.scoreMin);
  if (f.scoreMin.trim() !== "" && Number.isFinite(n)) {
    qs.set("cscoremin", String(Math.max(0, Math.floor(n))));
  }
  if (f.period !== "all") qs.set("cperiod", f.period);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** GET /api/pro/campaigns/[id] avec filtres optionnels de la liste contacts.
 *  Clé préfixée par ["pro","campaign",id] → invalidée par les mutations
 *  existantes (édition) comme par celles ci-dessous. */
export function useProCampaignDetail(id: string | undefined, filters: CampaignContactFilters) {
  const api = useApi();
  const qs = campaignQs(filters);
  return useQuery({
    queryKey: ["pro", "campaign", id ?? "", qs],
    queryFn: () => api<ProCampaignDetailFull>(`/api/pro/campaigns/${id}${qs}`),
    enabled: !!id,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

function invalidateCampaign(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ["pro", "campaign", id] });
  qc.invalidateQueries({ queryKey: ["pro", "campaigns"] });
  qc.invalidateQueries({ queryKey: ["pro", "overview"] });
}

/** Pause 48 h (une seule fois) / Relancer — PATCH { status }. */
export function useCampaignPauseToggle(id: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: "active" | "paused") =>
      api<{ ok: true; status: string }>(`/api/pro/campaigns/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => invalidateCampaign(qc, id),
  });
}

/** Prolongation unique (10 € HT débités du solde) — POST /extend. */
export function useCampaignExtend(id: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ ok: true; newEndsAt: string; feeCents: number }>(
        `/api/pro/campaigns/${id}/extend`,
        { method: "POST" },
      ),
    onSuccess: () => {
      invalidateCampaign(qc, id);
      qc.invalidateQueries({ queryKey: ["pro", "wallet"] });
      qc.invalidateQueries({ queryKey: ["pro", "invoices"] });
    },
  });
}
