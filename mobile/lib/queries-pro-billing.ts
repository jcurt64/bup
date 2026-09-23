// Hooks Facturation / Mes informations (espace pro) — parité web
// (Pro.jsx Facturation + InvoiceFieldsModal, Objectives.jsx RechargeModal).
// Routes consommées (backend inchangé) :
//   GET   /api/pro/wallet/payment-method            → carte enregistrée
//   POST  /api/stripe/setup                         → Checkout mode setup
//   POST  /api/pro/wallet/payment-method/reconcile  → filet retour setup
//   GET   /api/pro/wallet/auto-recharge             → état recharge auto
//   PATCH /api/pro/wallet/auto-recharge             → seuil / montant / on-off
//   POST  /api/stripe/checkout (+ enableAutoRecharge)
//   GET   /api/pro/info/verify-company?siren|siret  → registre SIRENE
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ApiError, useApi } from "./api";

/** Extrait `message` (ou `error`) d'un corps d'erreur JSON de l'API. */
export function apiErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    try {
      const j = JSON.parse(e.body) as { message?: string; error?: string };
      if (j.message) return j.message;
      if (j.error) return `${fallback} (${j.error})`;
    } catch {
      /* corps non-JSON */
    }
    if (e.status === 401) return "Session expirée — reconnectez-vous.";
    return `${fallback} (erreur ${e.status})`;
  }
  return e instanceof Error && e.message ? e.message : fallback;
}

/** Id de session Checkout (cs_…) présent dans l'URL Stripe hébergée. */
export function checkoutSessionId(url: string): string | null {
  return url.match(/cs_[A-Za-z0-9_]+/)?.[0] ?? null;
}

// — Carte bancaire enregistrée —
export type SavedCard = {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
};

export function useProPaymentMethod() {
  const api = useApi();
  return useQuery({
    queryKey: ["pro", "payment-method"],
    queryFn: () => api<{ card: SavedCard | null }>("/api/pro/wallet/payment-method"),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

/** POST /api/stripe/setup → { url } (Checkout 0 €, mode setup). */
export function useStartCardSetup() {
  const api = useApi();
  return useMutation({
    mutationFn: () => api<{ url: string }>("/api/stripe/setup", { method: "POST" }),
  });
}

/** Filet de sécurité au retour du setup (idempotent, le webhook persiste aussi). */
export function useReconcileCardSetup() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { sessionId: string }) =>
      api<{ ok: boolean; card?: SavedCard | null }>(
        "/api/pro/wallet/payment-method/reconcile",
        { method: "POST", body: JSON.stringify(v) },
      ),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["pro", "payment-method"] });
      qc.invalidateQueries({ queryKey: ["pro", "auto-recharge"] });
    },
  });
}

// — Recharge automatique —
export type AutoRecharge = {
  enabled: boolean;
  thresholdCents: number | null;
  amountCents: number | null;
  hasPaymentMethod: boolean;
  lastTriggeredAt: string | null;
  lastFailedAt: string | null;
  lastFailureReason: string | null;
};

export function useAutoRecharge() {
  const api = useApi();
  return useQuery({
    queryKey: ["pro", "auto-recharge"],
    queryFn: () => api<AutoRecharge>("/api/pro/wallet/auto-recharge"),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/** Bornes serveur (auto-recharge/route.ts). */
export const AUTO_THRESHOLD_MIN_EUR = 10;
export const AUTO_AMOUNT_MIN_EUR = 50;
export const AUTO_MAX_EUR = 10_000;

export function usePatchAutoRecharge() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { enabled?: boolean; thresholdCents?: number; amountCents?: number }) =>
      api<{ ok: true }>("/api/pro/wallet/auto-recharge", {
        method: "PATCH",
        body: JSON.stringify(v),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pro", "auto-recharge"] }),
  });
}

/**
 * POST /api/stripe/checkout avec option recharge auto (parité RechargeModal
 * web) : `enableAutoRecharge` sauvegarde le moyen de paiement
 * (setup_future_usage=off_session) et active la recharge au seuil donné.
 */
export function useTopupCheckout() {
  const api = useApi();
  return useMutation({
    mutationFn: (v: {
      amountCents: number;
      enableAutoRecharge?: boolean;
      autoRechargeThresholdCents?: number;
    }) =>
      api<{ url: string }>("/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify(v),
      }),
  });
}

// — Vérification SIREN / SIRET (registre SIRENE via data.gouv.fr) —
export type CompanyRecord = {
  found: true;
  siren: string;
  siret: string | null;
  raisonSociale: string | null;
  adresse: string | null;
  ville: string | null;
  codePostal: string | null;
  formeJuridique: string | null;
  actif: boolean;
};

export type VerifyState =
  | { status: "idle" | "loading" | "not_found" | "error"; data: null }
  | { status: "found"; data: CompanyRecord };

/**
 * Vérification auto (debounce 350 ms) dès qu'un identifiant atteint sa
 * longueur valide : SIRET (14) prioritaire, sinon SIREN (9). Même logique
 * que InvoiceFieldsModal (web).
 */
export function useCompanyVerification(siren: string, siret: string): VerifyState {
  const api = useApi();
  const [state, setState] = useState<VerifyState>({ status: "idle", data: null });

  const cleanSiren = siren.replace(/\s+/g, "");
  const cleanSiret = siret.replace(/\s+/g, "");
  const target = /^\d{14}$/.test(cleanSiret)
    ? `siret=${cleanSiret}`
    : /^\d{9}$/.test(cleanSiren)
      ? `siren=${cleanSiren}`
      : null;

  useEffect(() => {
    if (!target) {
      setState({ status: "idle", data: null });
      return;
    }
    setState({ status: "loading", data: null });
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const j = await api<{ found: boolean } & Partial<CompanyRecord>>(
          `/api/pro/info/verify-company?${target}`,
        );
        if (cancelled) return;
        if (!j?.found) setState({ status: "not_found", data: null });
        else setState({ status: "found", data: j as CompanyRecord });
      } catch {
        if (!cancelled) setState({ status: "error", data: null });
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [target, api]);

  return state;
}

/** Comparaison souple (trim + casse + espaces) saisie ↔ registre officiel. */
const norm = (s: string | null | undefined) =>
  (s ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ");

export type CompanyDiff = { key: string; label: string; user: string; official: string };

export function companyDiffs(
  form: {
    raisonSociale?: string;
    adresse?: string;
    ville?: string;
    codePostal?: string;
    formeJuridique?: string;
  },
  data: CompanyRecord,
): CompanyDiff[] {
  const rows: [string, string, string | undefined, string | null][] = [
    ["raisonSociale", "Raison sociale", form.raisonSociale, data.raisonSociale],
    ["adresse", "Adresse", form.adresse, data.adresse],
    ["ville", "Ville", form.ville, data.ville],
    ["codePostal", "Code postal", form.codePostal, data.codePostal],
    ["formeJuridique", "Forme juridique", form.formeJuridique, data.formeJuridique],
  ];
  return rows
    .filter(([, , user, off]) => !!off && !!user && norm(user) !== norm(off))
    .map(([key, label, user, off]) => ({ key, label, user: user ?? "", official: off ?? "" }));
}
