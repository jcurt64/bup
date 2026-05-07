/**
 * GET /api/status — page d'état temps réel.
 * Renvoie l'état (operational / degraded / down) de chaque dépendance
 * critique : Postgres (Supabase), Auth (Clerk), Paiements (Stripe), SMS &
 * Email (Brevo). Les checks restent légers (no-op SELECT, balance.retrieve)
 * pour pouvoir être appelés très fréquemment depuis /status sans coût.
 *
 * Format de retour :
 *   {
 *     overall: 'operational' | 'degraded' | 'down',
 *     components: [{ id, name, status, latencyMs?, message? }],
 *     checkedAt: ISO string,
 *   }
 */
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { isBrevoConfigured } from "@/lib/brevo/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Status = "operational" | "degraded" | "down";
type ComponentResult = {
  id: string;
  name: string;
  status: Status;
  latencyMs?: number;
  message?: string;
};

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms),
    ),
  ]);
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: true; ms: number; value: T } | { ok: false; ms: number; error: string }> {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - t0, value };
  } catch (e: unknown) {
    return { ok: false, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

async function checkSupabase(): Promise<ComponentResult> {
  const r = await timed(() =>
    withTimeout(
      (async () => {
        const admin = createSupabaseAdminClient();
        const { error } = await admin.from("prospects").select("id", { count: "exact", head: true }).limit(1);
        if (error) throw new Error(error.message);
        return true;
      })(),
      4000,
    ),
  );
  if (!r.ok) return { id: "db", name: "Base de données", status: "down", latencyMs: r.ms, message: r.error };
  return {
    id: "db",
    name: "Base de données",
    status: r.ms > 1500 ? "degraded" : "operational",
    latencyMs: r.ms,
  };
}

async function checkStripe(): Promise<ComponentResult> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { id: "stripe", name: "Paiements (Stripe)", status: "down", message: "STRIPE_SECRET_KEY absent" };
  }
  const r = await timed(() =>
    withTimeout(
      (async () => {
        const stripe = await getStripe();
        await stripe.balance.retrieve();
        return true;
      })(),
      4000,
    ),
  );
  if (!r.ok) return { id: "stripe", name: "Paiements (Stripe)", status: "down", latencyMs: r.ms, message: r.error };
  return {
    id: "stripe",
    name: "Paiements (Stripe)",
    status: r.ms > 1500 ? "degraded" : "operational",
    latencyMs: r.ms,
  };
}

async function checkClerk(): Promise<ComponentResult> {
  // Pas d'appel réseau : on inspecte simplement la présence des secrets
  // côté serveur. Un check plus robuste appellerait l'API Clerk Backend,
  // mais le fail-fast sur la config couvre 99 % des incidents prod.
  const ok = Boolean(process.env.CLERK_SECRET_KEY);
  return ok
    ? { id: "auth", name: "Authentification (Clerk)", status: "operational" }
    : { id: "auth", name: "Authentification (Clerk)", status: "down", message: "CLERK_SECRET_KEY absent" };
}

async function checkBrevo(): Promise<ComponentResult> {
  // Idem : config-only check pour limiter les appels payants. Brevo
  // ne facture pas l'introspection mais on évite quand même.
  return isBrevoConfigured()
    ? { id: "messaging", name: "SMS & Email (Brevo)", status: "operational" }
    : { id: "messaging", name: "SMS & Email (Brevo)", status: "degraded", message: "BREVO_API_KEY absent — mode dev (pas d'envoi réel)" };
}

function aggregate(components: ComponentResult[]): Status {
  if (components.some((c) => c.status === "down")) return "down";
  if (components.some((c) => c.status === "degraded")) return "degraded";
  return "operational";
}

export async function GET() {
  // Le check API (cette route elle-même) est marqué operational par
  // construction : si tu reçois une réponse, c'est qu'elle l'est.
  const apiComp: ComponentResult = {
    id: "api",
    name: "API applicative",
    status: "operational",
  };

  const [db, stripe, clerk, brevo] = await Promise.all([
    checkSupabase(),
    checkStripe(),
    checkClerk(),
    checkBrevo(),
  ]);

  const components = [apiComp, db, clerk, stripe, brevo];
  return NextResponse.json({
    overall: aggregate(components),
    components,
    checkedAt: new Date().toISOString(),
  });
}
