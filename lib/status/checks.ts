/**
 * Checks de santé partagés — SOURCE UNIQUE pour :
 *   - `GET /api/status`         (détaillé, AUTHENTIFIÉ : messages d'erreur,
 *                                latence, noms de variables d'env manquantes)
 *   - `GET /api/status/public`  (ASSAINI, public : uniquement id/name/status)
 *
 * Garantit qu'il n'y a jamais de divergence entre la vue interne et la
 * vue publique : les deux dérivent du même calcul, la version publique
 * ne fait que masquer les champs sensibles.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { isBrevoConfigured } from "@/lib/brevo/sms";

export type Status = "operational" | "degraded" | "down";

export type ComponentResult = {
  id: string;
  name: string;
  status: Status;
  /** Sensible — jamais exposé publiquement. */
  latencyMs?: number;
  /** Sensible (peut contenir nom de var d'env / erreur brute) — jamais public. */
  message?: string;
};

/** Vue publique assainie : aucun détail interne. */
export type PublicComponent = { id: string; name: string; status: Status };

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms),
    ),
  ]);
}

async function timed<T>(
  fn: () => Promise<T>,
): Promise<
  { ok: true; ms: number; value: T } | { ok: false; ms: number; error: string }
> {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - t0, value };
  } catch (e: unknown) {
    return {
      ok: false,
      ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function checkSupabase(): Promise<ComponentResult> {
  const r = await timed(() =>
    withTimeout(
      (async () => {
        const admin = createSupabaseAdminClient();
        const { error } = await admin
          .from("prospects")
          .select("id", { count: "exact", head: true })
          .limit(1);
        if (error) throw new Error(error.message);
        return true;
      })(),
      4000,
    ),
  );
  if (!r.ok)
    return {
      id: "db",
      name: "Base de données",
      status: "down",
      latencyMs: r.ms,
      message: r.error,
    };
  return {
    id: "db",
    name: "Base de données",
    status: r.ms > 1500 ? "degraded" : "operational",
    latencyMs: r.ms,
  };
}

async function checkStripe(): Promise<ComponentResult> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      id: "stripe",
      name: "Paiements (Stripe)",
      status: "down",
      message: "STRIPE_SECRET_KEY absent",
    };
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
  if (!r.ok)
    return {
      id: "stripe",
      name: "Paiements (Stripe)",
      status: "down",
      latencyMs: r.ms,
      message: r.error,
    };
  // La clé publishable est inlinée au build : si elle manque, le
  // paiement côté client est cassé silencieusement alors que l'API
  // serveur répond. On le signale en "degraded" plutôt que masquer.
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return {
      id: "stripe",
      name: "Paiements (Stripe)",
      status: "degraded",
      latencyMs: r.ms,
      message: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY absent — paiement client KO",
    };
  }
  return {
    id: "stripe",
    name: "Paiements (Stripe)",
    status: r.ms > 1500 ? "degraded" : "operational",
    latencyMs: r.ms,
  };
}

async function checkEmail(): Promise<ComponentResult> {
  // Config-only : le transport e-mail (lib/email/transport.ts) n'envoie
  // réellement que si BREVO_API_KEY OU SMTP_USER+SMTP_PASS sont présents.
  const ok =
    Boolean(process.env.BREVO_API_KEY) ||
    (Boolean(process.env.SMTP_USER) && Boolean(process.env.SMTP_PASS));
  return ok
    ? {
        id: "email",
        name: "E-mails transactionnels",
        status: "operational",
      }
    : {
        id: "email",
        name: "E-mails transactionnels",
        status: "degraded",
        message:
          "Ni BREVO_API_KEY ni SMTP_USER/SMTP_PASS — emails désactivés",
      };
}

async function checkClerk(): Promise<ComponentResult> {
  const ok = Boolean(process.env.CLERK_SECRET_KEY);
  return ok
    ? { id: "auth", name: "Authentification (Clerk)", status: "operational" }
    : {
        id: "auth",
        name: "Authentification (Clerk)",
        status: "down",
        message: "CLERK_SECRET_KEY absent",
      };
}

async function checkBrevo(): Promise<ComponentResult> {
  return isBrevoConfigured()
    ? { id: "messaging", name: "SMS & Email (Brevo)", status: "operational" }
    : {
        id: "messaging",
        name: "SMS & Email (Brevo)",
        status: "degraded",
        message: "BREVO_API_KEY absent — mode dev (pas d'envoi réel)",
      };
}

export function aggregate(components: { status: Status }[]): Status {
  if (components.some((c) => c.status === "down")) return "down";
  if (components.some((c) => c.status === "degraded")) return "degraded";
  return "operational";
}

/**
 * Exécute tous les checks et renvoie la liste DÉTAILLÉE (interne).
 * Inclut le composant "API applicative" (operational par construction :
 * si on exécute ce code, l'API répond).
 */
export async function runStatusChecks(): Promise<ComponentResult[]> {
  const apiComp: ComponentResult = {
    id: "api",
    name: "API applicative",
    status: "operational",
  };
  const [db, stripe, clerk, brevo, email] = await Promise.all([
    checkSupabase(),
    checkStripe(),
    checkClerk(),
    checkBrevo(),
    checkEmail(),
  ]);
  return [apiComp, db, clerk, stripe, brevo, email];
}

/** Réduit un résultat détaillé à sa forme publique (sans champ sensible). */
export function sanitize(c: ComponentResult): PublicComponent {
  return { id: c.id, name: c.name, status: c.status };
}
