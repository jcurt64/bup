# BUUPP Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer la V1 du dashboard interne `/buupp-admin` (lecture seule + notifications live + mails admin) à partir des données déjà collectées en base.

**Architecture:** Pages Next.js 16 (App Router, `runtime: nodejs`) gardées par un helper `lib/admin/access.ts` qui combine Clerk + allowlist d'emails (`ADMIN_EMAILS`). Lecture via `createSupabaseAdminClient()` (service_role). Une seule table neuve `admin_events` alimentée fire-and-forget par un helper `recordEvent` exposé partout où un signal métier mérite d'être tracé. Live-feed via SSE serveur adossé à Supabase Realtime (la table reste fermée à toute policy). Mails admin stratifiés par sévérité (critical immédiat / warning digest horaire / info digest 2×/jour) via `lib/email/transport.ts`.

**Tech Stack:** Next.js 16.2.4 + React 19.2.4, Clerk 7, Supabase JS 2.105 (service_role + Realtime), Stripe 22, Nodemailer (SMTP Gmail), Tailwind 4. Tests : Vitest 2 + `@vitest/coverage-v8` (à installer en Lot 0 — le projet n'a pas encore d'infra de test).

**Spec source:** `docs/superpowers/specs/2026-05-10-buupp-admin-dashboard-design.md`

**Conventions du projet** :
- Le middleware Next 16 vit dans `proxy.ts` (et **pas** `middleware.ts`).
- Les routes API tournent en `runtime: nodejs` quand elles touchent à `service_role`.
- Les commentaires de fichiers sont en français, en bloc `/** … */` en tête, expliquant le **pourquoi** (cf. AGENTS.md & exemples dans `lib/`).
- Tous les paths sont relatifs à `/Users/mjlk_blockchain/Desktop/buupp`.

---

## Lot 0 — Fondations (test infra + DB + access helper + recordEvent)

### Task 0.1 — Installer Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Installer les dépendances**

```bash
npm install --save-dev vitest@^2 @vitest/coverage-v8@^2 happy-dom@^15
```

- [ ] **Step 2: Ajouter le script `test` dans `package.json`**

Modifie le bloc `scripts` :

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Créer `vitest.config.ts` à la racine**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    globals: false,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules/**", "tests/**", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 4: Créer `tests/setup.ts` (vide pour l'instant, point d'extension futur)**

```ts
// Setup global Vitest. Pas d'init particulière en V1 — placeholder pour
// brancher plus tard des mocks SMTP, des fixtures Supabase, etc.
export {};
```

- [ ] **Step 5: Vérifier que la commande tourne sans test**

Run: `npm test`
Expected: `No test files found` (exit 0).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/setup.ts
git commit -m "chore(test): install Vitest 2 + happy-dom + coverage"
```

---

### Task 0.2 — Migration `admin_events`

**Files:**
- Create: `supabase/migrations/20260510120000_admin_events.sql`

- [ ] **Step 1: Créer la migration**

```sql
-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Table d'évènements pour le dashboard admin (back-office)
-- ════════════════════════════════════════════════════════════════════
-- Append-only. Alimentée fire-and-forget par `lib/admin/events/record.ts`
-- depuis les chemins métier (signups, campagnes, relations, transactions,
-- erreurs SMTP/Stripe). Lue uniquement par les Route Handlers admin en
-- service_role + relayée au navigateur via SSE (cf. spec §4.2).
--
-- Aucune policy RLS : toute lecture/écriture passe par service_role.
-- Le live-feed UI passe par /api/admin/events/stream (SSE) qui souscrit
-- côté serveur à Realtime — donc pas besoin d'ouvrir la table aux
-- clients authentifiés.
-- ════════════════════════════════════════════════════════════════════

create type public.admin_event_severity as enum ('info', 'warning', 'critical');

create table public.admin_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  severity public.admin_event_severity not null default 'info',
  payload jsonb not null default '{}'::jsonb,
  prospect_id uuid references public.prospects(id) on delete set null,
  pro_account_id uuid references public.pro_accounts(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  relation_id uuid references public.relations(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  -- { "<clerkUserId>": "<iso ts>" } — read-state par admin.
  read_by jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_events_created_at_idx on public.admin_events (created_at desc);
create index admin_events_type_idx on public.admin_events (type);
create index admin_events_severity_unread_idx
  on public.admin_events (severity, created_at desc)
  where (read_by = '{}'::jsonb);

alter table public.admin_events enable row level security;
-- Aucune policy : seul service_role accède directement.

-- Activation Realtime pour permettre la souscription côté serveur dans
-- le SSE handler. La publication `supabase_realtime` est créée par
-- défaut par Supabase ; on lui ajoute la table.
alter publication supabase_realtime add table public.admin_events;
```

- [ ] **Step 2: Appliquer la migration en local**

Run: `npx supabase db push`
Expected: la migration s'applique sans erreur, `admin_events` apparaît dans `\dt`.

- [ ] **Step 3: Régénérer les types TS Supabase**

Run: `npx supabase gen types typescript --linked > lib/supabase/types.ts`
Expected: `lib/supabase/types.ts` contient désormais `admin_events` et l'enum `admin_event_severity`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260510120000_admin_events.sql lib/supabase/types.ts
git commit -m "feat(db): add admin_events table + Realtime publication"
```

---

### Task 0.3 — Helper d'accès admin (`lib/admin/access.ts`)

**Files:**
- Create: `lib/admin/access.ts`
- Test: `tests/lib/admin/access.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
// tests/lib/admin/access.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAdminEmail } from "@/lib/admin/access";

describe("isAdminEmail", () => {
  const original = process.env.ADMIN_EMAILS;
  afterEach(() => {
    process.env.ADMIN_EMAILS = original;
  });

  it("retourne false si ADMIN_EMAILS est vide (fail-closed)", () => {
    process.env.ADMIN_EMAILS = "";
    expect(isAdminEmail("jjlex64@gmail.com")).toBe(false);
  });

  it("retourne false si l'env n'est pas définie", () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail("jjlex64@gmail.com")).toBe(false);
  });

  it("matche un email exact dans la liste", () => {
    process.env.ADMIN_EMAILS = "jjlex64@gmail.com,other@buupp.fr";
    expect(isAdminEmail("jjlex64@gmail.com")).toBe(true);
    expect(isAdminEmail("other@buupp.fr")).toBe(true);
  });

  it("est insensible à la casse et trim les espaces", () => {
    process.env.ADMIN_EMAILS = " JJlex64@Gmail.com , other@buupp.fr ";
    expect(isAdminEmail("jjlex64@gmail.com")).toBe(true);
    expect(isAdminEmail("OTHER@BUUPP.FR")).toBe(true);
  });

  it("rejette un email non listé", () => {
    process.env.ADMIN_EMAILS = "jjlex64@gmail.com";
    expect(isAdminEmail("attacker@evil.com")).toBe(false);
  });

  it("retourne false pour input vide/null", () => {
    process.env.ADMIN_EMAILS = "jjlex64@gmail.com";
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Faire échouer le test**

Run: `npm test -- tests/lib/admin/access.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implémenter `lib/admin/access.ts`**

```ts
/**
 * Garde d'accès au back-office BUUPP.
 *
 * Deux mécanismes coexistent :
 *
 *  1. **Clerk + allowlist d'emails** (`isAdminEmail`) — utilisé par les
 *     pages `/buupp-admin/**` et les Route Handlers `/api/admin/stats/**`,
 *     `/api/admin/events/**`. L'admin se connecte avec son compte Clerk
 *     normal ; le middleware vérifie que son email primaire figure dans
 *     l'env `ADMIN_EMAILS` (séparée par virgules, insensible à la casse).
 *
 *  2. **Header `x-admin-secret`** (`hasAdminSecret`) — utilisé pour les
 *     déclencheurs machine (cron Vercel pour les digests, scripts CLI).
 *     L'env `BUUPP_ADMIN_SECRET` doit être définie côté serveur.
 *
 * Politique fail-closed : si une env est manquante, l'accès est refusé.
 */

import { auth, currentUser } from "@/lib/clerk/server";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return false;
  const allowed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}

export function hasAdminSecret(req: Request): boolean {
  const expected = process.env.BUUPP_ADMIN_SECRET;
  if (!expected) return false;
  const provided = req.headers.get("x-admin-secret");
  return Boolean(provided) && provided === expected;
}

/**
 * Garde Server Component / RSC. Lève `notFound()` (404) si non admin —
 * on ne révèle pas l'existence du dashboard à un user non habilité.
 */
export async function requireAdminUserOrNotFound(): Promise<{
  userId: string;
  email: string;
}> {
  const { notFound } = await import("next/navigation");
  const { userId } = await auth();
  if (!userId) notFound();
  const user = await currentUser();
  const email = user?.emailAddresses?.find(
    (e) => e.id === user.primaryEmailAddressId,
  )?.emailAddress ?? null;
  if (!isAdminEmail(email)) notFound();
  return { userId, email: email! };
}

/**
 * Garde Route Handler. Accepte EITHER `x-admin-secret` (machine) EITHER
 * un user Clerk dont l'email est dans l'allowlist. Renvoie une `Response`
 * 404 si refus, sinon `null`.
 *
 *   const denied = await requireAdminRequest(req);
 *   if (denied) return denied;
 */
export async function requireAdminRequest(req: Request): Promise<Response | null> {
  if (hasAdminSecret(req)) return null;
  const { userId } = await auth();
  if (!userId) return new Response("Not Found", { status: 404 });
  const user = await currentUser();
  const email = user?.emailAddresses?.find(
    (e) => e.id === user.primaryEmailAddressId,
  )?.emailAddress ?? null;
  if (!isAdminEmail(email)) return new Response("Not Found", { status: 404 });
  return null;
}
```

- [ ] **Step 4: Re-run tests**

Run: `npm test -- tests/lib/admin/access.test.ts`
Expected: PASS (les 6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/access.ts tests/lib/admin/access.test.ts
git commit -m "feat(admin): isAdminEmail / requireAdmin helpers (Clerk + allowlist)"
```

---

### Task 0.4 — Helper `recordEvent` (fire-and-forget)

**Files:**
- Create: `lib/admin/events/record.ts`
- Test: `tests/lib/admin/events/record.test.ts`

- [ ] **Step 1: Écrire le test (mock léger du client Supabase)**

```ts
// tests/lib/admin/events/record.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock du module Supabase server BEFORE l'import de record.
const insertMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({ insert: insertMock }),
  }),
}));

import { recordEvent } from "@/lib/admin/events/record";

describe("recordEvent", () => {
  beforeEach(() => {
    insertMock.mockReset();
    insertMock.mockResolvedValue({ data: null, error: null });
  });

  it("insert avec les champs minimums (type + severity par défaut info)", async () => {
    await recordEvent({ type: "prospect.signup" });
    expect(insertMock).toHaveBeenCalledWith({
      type: "prospect.signup",
      severity: "info",
      payload: {},
      prospect_id: null,
      pro_account_id: null,
      campaign_id: null,
      relation_id: null,
      transaction_id: null,
    });
  });

  it("propage severity, payload et toutes les FK fournies", async () => {
    await recordEvent({
      type: "campaign.created",
      severity: "warning",
      payload: { name: "X" },
      proAccountId: "p1",
      campaignId: "c1",
    });
    expect(insertMock).toHaveBeenCalledWith({
      type: "campaign.created",
      severity: "warning",
      payload: { name: "X" },
      prospect_id: null,
      pro_account_id: "p1",
      campaign_id: "c1",
      relation_id: null,
      transaction_id: null,
    });
  });

  it("ne throw jamais — log et avale en cas d'erreur DB", async () => {
    insertMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      recordEvent({ type: "system.cron_failed", severity: "critical" }),
    ).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
```

- [ ] **Step 2: Faire échouer**

Run: `npm test -- tests/lib/admin/events/record.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implémenter `lib/admin/events/record.ts`**

```ts
/**
 * Helper d'insertion fire-and-forget dans `admin_events`.
 *
 * Appelé depuis les chemins métier (signups, campagnes, relations,
 * transactions, erreurs SMTP/Stripe). Ne bloque jamais le chemin
 * critique : les exceptions sont logguées et avalées (sinon on risque
 * d'aggraver l'incident qu'on essaie de tracer).
 *
 *   void recordEvent({ type: "prospect.signup", prospectId });
 *
 * Ne jamais `await` côté handler métier — utiliser `void` pour que
 * l'IDE et eslint ne rouspètent pas, et passer à la suite.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Severity = Database["public"]["Enums"]["admin_event_severity"];

export type RecordEventInput = {
  type: string;
  severity?: Severity;
  payload?: Record<string, unknown>;
  prospectId?: string | null;
  proAccountId?: string | null;
  campaignId?: string | null;
  relationId?: string | null;
  transactionId?: string | null;
};

export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("admin_events").insert({
      type: input.type,
      severity: input.severity ?? "info",
      payload: input.payload ?? {},
      prospect_id: input.prospectId ?? null,
      pro_account_id: input.proAccountId ?? null,
      campaign_id: input.campaignId ?? null,
      relation_id: input.relationId ?? null,
      transaction_id: input.transactionId ?? null,
    });
    if (error) {
      console.error("[admin/events/record] insert failed", {
        type: input.type,
        error,
      });
    }
  } catch (err) {
    console.error("[admin/events/record] unexpected", {
      type: input.type,
      err,
    });
  }
}
```

- [ ] **Step 4: Re-run tests**

Run: `npm test -- tests/lib/admin/events/record.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/events/record.ts tests/lib/admin/events/record.test.ts
git commit -m "feat(admin): recordEvent fire-and-forget helper"
```

---

### Task 0.5 — Helpers de période (`lib/admin/periods.ts`)

**Files:**
- Create: `lib/admin/periods.ts`
- Test: `tests/lib/admin/periods.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
// tests/lib/admin/periods.test.ts
import { describe, it, expect } from "vitest";
import {
  PERIOD_KEYS,
  rangeFor,
  previousRangeOf,
  bucketize,
  type PeriodKey,
} from "@/lib/admin/periods";

const REF = new Date("2026-05-10T12:00:00Z");

describe("rangeFor", () => {
  it("today = aujourd'hui 00:00 → maintenant", () => {
    const r = rangeFor("today", REF);
    expect(r.start.toISOString()).toBe("2026-05-10T00:00:00.000Z");
    expect(r.end.toISOString()).toBe(REF.toISOString());
  });

  it("7d = J-7 00:00 → maintenant", () => {
    const r = rangeFor("7d", REF);
    expect(r.start.toISOString()).toBe("2026-05-03T00:00:00.000Z");
  });

  it("30d = J-30 00:00 → maintenant", () => {
    const r = rangeFor("30d", REF);
    expect(r.start.toISOString()).toBe("2026-04-10T00:00:00.000Z");
  });

  it("quarter = début trimestre courant → maintenant", () => {
    // Mai → trimestre Q2 (avril-juin) → 1er avril 2026
    const r = rangeFor("quarter", REF);
    expect(r.start.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("12m = il y a 12 mois → maintenant", () => {
    const r = rangeFor("12m", REF);
    expect(r.start.toISOString()).toBe("2025-05-10T00:00:00.000Z");
  });

  it("all = epoch → maintenant", () => {
    const r = rangeFor("all", REF);
    expect(r.start.getTime()).toBe(0);
  });
});

describe("previousRangeOf", () => {
  it("renvoie une fenêtre de même durée juste avant", () => {
    const cur = rangeFor("30d", REF);
    const prev = previousRangeOf(cur);
    expect(prev.end.getTime()).toBe(cur.start.getTime());
    expect(cur.start.getTime() - prev.start.getTime()).toBe(
      cur.end.getTime() - cur.start.getTime(),
    );
  });
});

describe("bucketize", () => {
  it("≤30 j → buckets jour (label YYYY-MM-DD)", () => {
    const buckets = bucketize(rangeFor("7d", REF));
    expect(buckets).toHaveLength(8); // J-7 inclus + aujourd'hui = 8 jours
    expect(buckets[0].label).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(buckets.at(-1)!.label).toBe("2026-05-10");
  });

  it("≤90 j → buckets semaine (label W##)", () => {
    const buckets = bucketize(rangeFor("quarter", REF));
    expect(buckets.length).toBeGreaterThan(0);
    expect(buckets.length).toBeLessThanOrEqual(14);
    expect(buckets[0].label).toMatch(/^W\d{1,2}$/);
  });

  it("12m → buckets mois (label YYYY-MM)", () => {
    const buckets = bucketize(rangeFor("12m", REF));
    expect(buckets).toHaveLength(13); // mai 2025 → mai 2026 inclusif
    expect(buckets[0].label).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("PERIOD_KEYS", () => {
  it("contient les 6 valeurs canoniques", () => {
    const expected: PeriodKey[] = ["today", "7d", "30d", "quarter", "12m", "all"];
    expect([...PERIOD_KEYS]).toEqual(expected);
  });
});
```

- [ ] **Step 2: Faire échouer**

Run: `npm test -- tests/lib/admin/periods.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

```ts
// lib/admin/periods.ts
/**
 * Périodes globales du dashboard admin et helpers d'arithmétique
 * temporelle pour les agrégations.
 *
 * Toutes les fonctions acceptent un `now` injectable pour pouvoir être
 * testées de manière déterministe (sinon `new Date()` rendrait les tests
 * dépendants de l'horloge).
 */

export const PERIOD_KEYS = ["today", "7d", "30d", "quarter", "12m", "all"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export type DateRange = { start: Date; end: Date };

const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function startOfQuarter(d: Date): Date {
  const x = new Date(d);
  const month = x.getUTCMonth(); // 0..11
  const qStart = Math.floor(month / 3) * 3;
  return new Date(Date.UTC(x.getUTCFullYear(), qStart, 1, 0, 0, 0, 0));
}

export function rangeFor(period: PeriodKey, now: Date = new Date()): DateRange {
  switch (period) {
    case "today":
      return { start: startOfDay(now), end: now };
    case "7d":
      return { start: new Date(startOfDay(now).getTime() - 7 * DAY_MS), end: now };
    case "30d":
      return { start: new Date(startOfDay(now).getTime() - 30 * DAY_MS), end: now };
    case "quarter":
      return { start: startOfQuarter(now), end: now };
    case "12m": {
      const x = new Date(now);
      x.setUTCFullYear(x.getUTCFullYear() - 1);
      return { start: startOfDay(x), end: now };
    }
    case "all":
      return { start: new Date(0), end: now };
  }
}

export function previousRangeOf(cur: DateRange): DateRange {
  const span = cur.end.getTime() - cur.start.getTime();
  return { start: new Date(cur.start.getTime() - span), end: new Date(cur.start.getTime()) };
}

export type Bucket = { start: Date; end: Date; label: string };

export function bucketize(range: DateRange): Bucket[] {
  const span = range.end.getTime() - range.start.getTime();
  const days = Math.ceil(span / DAY_MS);

  if (days <= 30) {
    // Buckets jour.
    const buckets: Bucket[] = [];
    let cursor = startOfDay(range.start);
    const last = startOfDay(range.end);
    while (cursor.getTime() <= last.getTime()) {
      const next = new Date(cursor.getTime() + DAY_MS);
      buckets.push({
        start: new Date(cursor),
        end: next,
        label: cursor.toISOString().slice(0, 10),
      });
      cursor = next;
    }
    return buckets;
  }

  if (days <= 100) {
    // Buckets semaine ISO (lundi → dimanche). Label W## (numéro semaine ISO).
    const buckets: Bucket[] = [];
    const cursor = mondayOf(startOfDay(range.start));
    while (cursor.getTime() < range.end.getTime()) {
      const next = new Date(cursor.getTime() + 7 * DAY_MS);
      buckets.push({
        start: new Date(cursor),
        end: new Date(Math.min(next.getTime(), range.end.getTime())),
        label: `W${isoWeek(cursor)}`,
      });
      cursor.setTime(next.getTime());
    }
    return buckets;
  }

  // Sinon : buckets mois.
  const buckets: Bucket[] = [];
  const cursor = new Date(
    Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), 1),
  );
  const lastMonth = new Date(
    Date.UTC(range.end.getUTCFullYear(), range.end.getUTCMonth(), 1),
  );
  while (cursor.getTime() <= lastMonth.getTime()) {
    const next = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
    buckets.push({
      start: new Date(cursor),
      end: next,
      label: `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`,
    });
    cursor.setTime(next.getTime());
  }
  return buckets;
}

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = x.getUTCDay() || 7; // dim=7
  x.setUTCDate(x.getUTCDate() - (day - 1));
  return startOfDay(x);
}

function isoWeek(d: Date): number {
  // Algorithme ISO-8601.
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * DAY_MS));
}
```

- [ ] **Step 4: Re-run tests**

Run: `npm test -- tests/lib/admin/periods.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/periods.ts tests/lib/admin/periods.test.ts
git commit -m "feat(admin): periods + bucketize helpers (today/7d/30d/quarter/12m/all)"
```

---

## Lot 1 — Garde middleware + chrome admin

### Task 1.1 — Garde `/buupp-admin/**` dans `proxy.ts`

**Files:**
- Modify: `proxy.ts`

- [ ] **Step 1: Lire le contexte**

Ouvrir `proxy.ts` (déjà lu en exploration). On va :
- garder `/api/admin/(.*)` dans `isPublicRoute` (les handlers se gardent eux-mêmes via `requireAdminRequest` — ça permet aux crons d'utiliser `x-admin-secret` sans session Clerk),
- ajouter une garde explicite pour `/buupp-admin(.*)` qui rewrite vers `/404` si non admin (anonyme OU email pas dans l'allowlist).

- [ ] **Step 2: Ajouter l'import + la garde**

En haut de `proxy.ts`, ajouter à côté des autres imports :

```ts
import { isAdminEmail } from "@/lib/admin/access";
```

Juste après `if (isPublicRoute(request)) return;` et avant `const { userId, sessionClaims, redirectToSignIn } = await auth();`, insérer la garde admin :

```ts
  // ─── Garde back-office /buupp-admin ──────────────────────────────
  // 404 (et pas 403/redirect signin) pour ne pas révéler l'existence
  // du dashboard. La page elle-même re-vérifie via
  // requireAdminUserOrNotFound() (ceinture + bretelles).
  if (request.nextUrl.pathname.startsWith("/buupp-admin")) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.rewrite(new URL("/404", request.url));
    }
    // Email primaire : pas de claim custom dans le JWT par défaut → on
    // appelle Clerk côté serveur. Edge runtime OK pour clerkClient.
    const { clerkClient } = await import("@clerk/nextjs/server");
    const cc = await clerkClient();
    const u = await cc.users.getUser(userId);
    const email = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ?? null;
    if (!isAdminEmail(email)) {
      return NextResponse.rewrite(new URL("/404", request.url));
    }
    return; // admin OK, laisser passer
  }
```

- [ ] **Step 3: Ajouter `ADMIN_EMAILS` à `.env.example`**

Si `.env.example` existe, ajouter :

```
# Liste blanche d'emails admin pour /buupp-admin (séparés par virgule).
# Fail-closed : si vide, personne ne peut accéder au dashboard.
ADMIN_EMAILS=jjlex64@gmail.com
```

Sinon créer `.env.example` avec uniquement cette ligne.

- [ ] **Step 4: Vérification manuelle**

Run dev : `npm run dev`
- Visiter `/buupp-admin` non connecté → 404.
- Se connecter avec un compte non-admin → `/buupp-admin` → 404.
- Se connecter avec `jjlex64@gmail.com` → `/buupp-admin` → 200 (page placeholder en attendant Lot 1.2).

(Pour cette étape, créer un `app/buupp-admin/page.tsx` minimal `export default function() { return <div>OK admin</div>; }` puis le supprimer après vérif — il sera réécrit en 1.2.)

- [ ] **Step 5: Commit**

```bash
git add proxy.ts .env.example
git commit -m "feat(admin): proxy guard for /buupp-admin (404 fail-closed)"
```

---

### Task 1.2 — Layout admin + composant `PeriodPicker`

**Files:**
- Create: `app/buupp-admin/layout.tsx`
- Create: `app/buupp-admin/_components/AdminShell.tsx` (client)
- Create: `app/buupp-admin/_components/PeriodPicker.tsx` (client)
- Create: `app/buupp-admin/page.tsx` (placeholder de la vue d'ensemble)

- [ ] **Step 1: Créer le layout serveur (garde + meta noindex)**

```tsx
// app/buupp-admin/layout.tsx
/**
 * Layout du back-office BUUPP. Garde admin re-checkée côté RSC (le
 * middleware fait déjà la même chose — ceinture + bretelles, en cas de
 * config matcher cassée). Métadonnées `noindex, nofollow` pour éviter
 * toute indexation accidentelle.
 */
import type { Metadata } from "next";
import { requireAdminUserOrNotFound } from "@/lib/admin/access";
import AdminShell from "./_components/AdminShell";

export const metadata: Metadata = {
  title: "BUUPP Admin",
  robots: { index: false, follow: false, nocache: true },
};

export default async function BuuppAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { email } = await requireAdminUserOrNotFound();
  return <AdminShell adminEmail={email}>{children}</AdminShell>;
}
```

- [ ] **Step 2: Créer le shell client (sidebar + topbar)**

```tsx
// app/buupp-admin/_components/AdminShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import PeriodPicker from "./PeriodPicker";

const NAV = [
  { href: "/buupp-admin", label: "Vue d'ensemble" },
  { href: "/buupp-admin/prospects", label: "Prospects" },
  { href: "/buupp-admin/pros", label: "Professionnels" },
  { href: "/buupp-admin/campagnes", label: "Campagnes" },
  { href: "/buupp-admin/transactions", label: "Transactions" },
  { href: "/buupp-admin/waitlist", label: "Waitlist" },
  { href: "/buupp-admin/sante", label: "Santé" },
];

export default function AdminShell({
  adminEmail,
  children,
}: {
  adminEmail: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 grid grid-cols-[240px_1fr]">
      <aside className="border-r border-neutral-200 bg-white p-4 flex flex-col gap-2">
        <div className="font-semibold mb-4">BUUPP Admin</div>
        {NAV.map((item) => {
          const active =
            item.href === "/buupp-admin"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded px-3 py-2 text-sm ${active ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}
            >
              {item.label}
            </Link>
          );
        })}
        <div className="mt-auto text-xs text-neutral-500 pt-4">{adminEmail}</div>
      </aside>
      <main className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">{NAV.find((n) => n.href === pathname)?.label ?? "Admin"}</h1>
          <PeriodPicker />
        </div>
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Créer `PeriodPicker` (state via URL `?period=`)**

```tsx
// app/buupp-admin/_components/PeriodPicker.tsx
"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";

const OPTIONS: { value: string; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "quarter", label: "Trimestre" },
  { value: "12m", label: "12 mois" },
  { value: "all", label: "Tout" },
];

export default function PeriodPicker() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const current = sp.get("period") ?? "30d";

  return (
    <select
      value={current}
      onChange={(e) => {
        const next = new URLSearchParams(sp.toString());
        next.set("period", e.target.value);
        router.push(`${pathname}?${next.toString()}`);
      }}
      className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 4: Créer la page d'accueil (placeholder pour Lot 2)**

```tsx
// app/buupp-admin/page.tsx
/**
 * Vue d'ensemble du dashboard admin. Placeholder — sera étoffée au Lot 2
 * (KPIs, timeseries, live-feed).
 */
export default function BuuppAdminHomePage() {
  return (
    <div className="text-sm text-neutral-600">
      Bandeau KPI + 3 timeseries arrivent au Lot 2. Sélecteur de période
      en haut à droite, persisté via `?period=`.
    </div>
  );
}
```

- [ ] **Step 5: Vérification**

Run: `npm run dev`
- `/buupp-admin` rend la sidebar + le topbar avec sélecteur.
- Cliquer sur les liens → 404 pour les pages pas encore créées (normal).
- Changer la période dans le picker → URL met à jour `?period=...`.

- [ ] **Step 6: Commit**

```bash
git add app/buupp-admin/
git commit -m "feat(admin): layout + AdminShell + PeriodPicker (period via URL)"
```

---

## Lot 2 — Vue d'ensemble (KPIs + 3 timeseries)

### Task 2.1 — Query helper `lib/admin/queries/overview.ts`

**Files:**
- Create: `lib/admin/queries/overview.ts`
- Test: `tests/lib/admin/queries/overview.test.ts`

- [ ] **Step 1: Écrire le test (mock Supabase)**

```ts
// tests/lib/admin/queries/overview.test.ts
import { describe, it, expect, vi } from "vitest";

const counters = {
  waitlist: 124,
  prospects: 33,
  pros: 5,
  activeCampaigns: 4,
  campaignsCreated: 7,
  relationsSent: 50,
  relationsAccepted: 18,
  budgetCents: 200_00,
  spentCents: 80_00,
  creditedCents: 40_00,
  topupCents: 250_00,
  campaignChargeCents: 100_00,
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({
    rpc: vi.fn(async (fn: string) => {
      if (fn === "admin_overview_kpis") return { data: counters, error: null };
      return { data: null, error: { message: "unknown rpc " + fn } };
    }),
  }),
}));

import { fetchOverviewKpis } from "@/lib/admin/queries/overview";
import { rangeFor } from "@/lib/admin/periods";

describe("fetchOverviewKpis", () => {
  it("agrège la sortie de la RPC + applique le take-rate", async () => {
    process.env.BUUPP_TAKE_RATE = "0.20";
    const r = rangeFor("30d", new Date("2026-05-10T12:00:00Z"));
    const out = await fetchOverviewKpis(r);
    expect(out.waitlist).toBe(124);
    expect(out.prospects).toBe(33);
    expect(out.pros).toBe(5);
    expect(out.acceptanceRatePct).toBe(36); // 18/50 * 100
    // Revenu BUUPP : 0.20 * campaignChargeCents = 2000 cents = 20 €
    expect(out.estimatedRevenueCents).toBe(2000);
  });

  it("ne casse pas si BUUPP_TAKE_RATE absent (fallback 0.20)", async () => {
    delete process.env.BUUPP_TAKE_RATE;
    const r = rangeFor("30d", new Date("2026-05-10T12:00:00Z"));
    const out = await fetchOverviewKpis(r);
    expect(out.estimatedRevenueCents).toBe(2000);
  });
});
```

- [ ] **Step 2: Faire échouer**

Run: `npm test -- tests/lib/admin/queries/overview.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter la RPC SQL (migration)**

Créer `supabase/migrations/20260510130000_admin_overview_rpc.sql` :

```sql
-- ════════════════════════════════════════════════════════════════════
-- BUUPP — RPC d'agrégation pour la vue d'ensemble admin
-- ════════════════════════════════════════════════════════════════════
-- Compte en une seule passe les agrégats utilisés par
-- /api/admin/stats/overview. Accepte la fenêtre [p_start, p_end[.
-- SECURITY DEFINER → ne lit que les compteurs, jamais de PII.
-- Réservée à service_role.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.admin_overview_kpis(
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_waitlist int;
  v_prospects int;
  v_pros int;
  v_active_campaigns int;
  v_campaigns_created int;
  v_relations_sent int;
  v_relations_accepted int;
  v_budget_cents bigint;
  v_spent_cents bigint;
  v_credited_cents bigint;
  v_topup_cents bigint;
  v_campaign_charge_cents bigint;
begin
  select count(*) into v_waitlist from public.waitlist
   where created_at >= p_start and created_at < p_end;

  select count(*) into v_prospects from public.prospects
   where created_at >= p_start and created_at < p_end;

  select count(*) into v_pros from public.pro_accounts
   where created_at >= p_start and created_at < p_end;

  select count(*) into v_active_campaigns from public.campaigns
   where status = 'active';

  select count(*) into v_campaigns_created from public.campaigns
   where created_at >= p_start and created_at < p_end;

  select count(*) into v_relations_sent from public.relations
   where sent_at >= p_start and sent_at < p_end;

  select count(*) into v_relations_accepted from public.relations
   where sent_at >= p_start and sent_at < p_end
     and status in ('accepted', 'settled');

  select coalesce(sum(budget_cents), 0) into v_budget_cents from public.campaigns
   where created_at >= p_start and created_at < p_end;

  select coalesce(sum(spent_cents), 0) into v_spent_cents from public.campaigns
   where created_at >= p_start and created_at < p_end;

  select coalesce(sum(amount_cents), 0) into v_credited_cents from public.transactions
   where type = 'credit' and account_kind = 'prospect'
     and created_at >= p_start and created_at < p_end
     and status = 'completed';

  select coalesce(sum(amount_cents), 0) into v_topup_cents from public.transactions
   where type = 'topup' and account_kind = 'pro'
     and created_at >= p_start and created_at < p_end
     and status = 'completed';

  select coalesce(sum(abs(amount_cents)), 0) into v_campaign_charge_cents from public.transactions
   where type = 'campaign_charge' and account_kind = 'pro'
     and created_at >= p_start and created_at < p_end
     and status = 'completed';

  return jsonb_build_object(
    'waitlist', v_waitlist,
    'prospects', v_prospects,
    'pros', v_pros,
    'activeCampaigns', v_active_campaigns,
    'campaignsCreated', v_campaigns_created,
    'relationsSent', v_relations_sent,
    'relationsAccepted', v_relations_accepted,
    'budgetCents', v_budget_cents,
    'spentCents', v_spent_cents,
    'creditedCents', v_credited_cents,
    'topupCents', v_topup_cents,
    'campaignChargeCents', v_campaign_charge_cents
  );
end;
$$;

revoke all on function public.admin_overview_kpis(timestamptz, timestamptz) from public;
grant execute on function public.admin_overview_kpis(timestamptz, timestamptz) to service_role;
```

Appliquer : `npx supabase db push` puis `npx supabase gen types typescript --linked > lib/supabase/types.ts`.

- [ ] **Step 4: Implémenter le helper TS**

```ts
// lib/admin/queries/overview.ts
/**
 * Lit les KPIs de la vue d'ensemble via la RPC `admin_overview_kpis`.
 * Le revenu BUUPP est dérivé en TS à partir d'une env (take-rate
 * configurable sans toucher à la DB).
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/admin/periods";

export type OverviewKpis = {
  waitlist: number;
  prospects: number;
  pros: number;
  activeCampaigns: number;
  campaignsCreated: number;
  relationsSent: number;
  relationsAccepted: number;
  acceptanceRatePct: number;
  budgetCents: number;
  spentCents: number;
  creditedCents: number;
  topupCents: number;
  campaignChargeCents: number;
  estimatedRevenueCents: number;
};

export async function fetchOverviewKpis(range: DateRange): Promise<OverviewKpis> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_overview_kpis", {
    p_start: range.start.toISOString(),
    p_end: range.end.toISOString(),
  });
  if (error) {
    console.error("[admin/queries/overview] rpc failed", error);
    throw error;
  }
  const raw = (data as Record<string, number>) ?? {};

  const relationsSent = raw.relationsSent ?? 0;
  const relationsAccepted = raw.relationsAccepted ?? 0;
  const acceptanceRatePct =
    relationsSent === 0 ? 0 : Math.round((relationsAccepted / relationsSent) * 100);

  const takeRate = Number(process.env.BUUPP_TAKE_RATE ?? "0.20") || 0.2;
  const estimatedRevenueCents = Math.round((raw.campaignChargeCents ?? 0) * takeRate);

  return {
    waitlist: raw.waitlist ?? 0,
    prospects: raw.prospects ?? 0,
    pros: raw.pros ?? 0,
    activeCampaigns: raw.activeCampaigns ?? 0,
    campaignsCreated: raw.campaignsCreated ?? 0,
    relationsSent,
    relationsAccepted,
    acceptanceRatePct,
    budgetCents: raw.budgetCents ?? 0,
    spentCents: raw.spentCents ?? 0,
    creditedCents: raw.creditedCents ?? 0,
    topupCents: raw.topupCents ?? 0,
    campaignChargeCents: raw.campaignChargeCents ?? 0,
    estimatedRevenueCents,
  };
}
```

- [ ] **Step 5: Re-run tests**

Run: `npm test -- tests/lib/admin/queries/overview.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/queries/overview.ts tests/lib/admin/queries/overview.test.ts \
        supabase/migrations/20260510130000_admin_overview_rpc.sql lib/supabase/types.ts
git commit -m "feat(admin): admin_overview_kpis RPC + fetchOverviewKpis helper"
```

---

### Task 2.2 — Route handler `GET /api/admin/stats/overview`

**Files:**
- Create: `app/api/admin/stats/overview/route.ts`

- [ ] **Step 1: Implémenter le handler**

```ts
/**
 * GET /api/admin/stats/overview?period=<today|7d|30d|quarter|12m|all>
 * Renvoie les KPIs courants + ceux de la période précédente (pour delta).
 */
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { fetchOverviewKpis } from "@/lib/admin/queries/overview";
import { PERIOD_KEYS, rangeFor, previousRangeOf, type PeriodKey } from "@/lib/admin/periods";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const raw = url.searchParams.get("period") ?? "30d";
  const period = (PERIOD_KEYS as readonly string[]).includes(raw)
    ? (raw as PeriodKey)
    : ("30d" as PeriodKey);

  const now = new Date();
  const cur = rangeFor(period, now);
  const prev = previousRangeOf(cur);

  const [current, previous] = await Promise.all([
    fetchOverviewKpis(cur),
    fetchOverviewKpis(prev),
  ]);

  return NextResponse.json(
    { period, current, previous },
    { headers: { "cache-control": "no-store" } },
  );
}
```

- [ ] **Step 2: Vérification curl (avec un Clerk session cookie ou x-admin-secret)**

Run :
```bash
curl -H "x-admin-secret: $BUUPP_ADMIN_SECRET" \
     http://localhost:3000/api/admin/stats/overview?period=30d | jq
```
Expected : JSON `{ period: "30d", current: {...}, previous: {...} }`.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/stats/overview/route.ts
git commit -m "feat(admin): GET /api/admin/stats/overview with period + previous"
```

---

### Task 2.3 — Composants `KpiCard` + `Sparkline` + `Delta`

**Files:**
- Create: `app/buupp-admin/_components/KpiCard.tsx`
- Create: `app/buupp-admin/_components/Sparkline.tsx`
- Create: `app/buupp-admin/_components/Delta.tsx`

- [ ] **Step 1: `Delta.tsx`**

```tsx
// app/buupp-admin/_components/Delta.tsx
export default function Delta({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  if (previous === 0) {
    return <span className="text-xs text-neutral-400">—</span>;
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const sign = pct > 0 ? "+" : "";
  const tone = pct > 0 ? "text-emerald-600" : pct < 0 ? "text-rose-600" : "text-neutral-500";
  return <span className={`text-xs font-medium ${tone}`}>{sign}{pct}%</span>;
}
```

- [ ] **Step 2: `Sparkline.tsx` (SVG simple, points équidistants)**

```tsx
// app/buupp-admin/_components/Sparkline.tsx
export default function Sparkline({
  values,
  width = 80,
  height = 24,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / Math.max(values.length - 1, 1);
  const path = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} className="text-neutral-700">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}
```

- [ ] **Step 3: `KpiCard.tsx`**

```tsx
// app/buupp-admin/_components/KpiCard.tsx
import Delta from "./Delta";
import Sparkline from "./Sparkline";

export default function KpiCard({
  label,
  value,
  unit,
  current,
  previous,
  spark,
}: {
  label: string;
  value: string;
  unit?: string;
  current: number;
  previous: number;
  spark?: number[];
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 flex flex-col gap-2">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-semibold tabular-nums">
          {value}
          {unit && <span className="text-sm font-normal text-neutral-500 ml-1">{unit}</span>}
        </div>
        <Delta current={current} previous={previous} />
      </div>
      {spark && <Sparkline values={spark} />}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/buupp-admin/_components/KpiCard.tsx \
        app/buupp-admin/_components/Sparkline.tsx \
        app/buupp-admin/_components/Delta.tsx
git commit -m "feat(admin): KpiCard + Sparkline + Delta presentational components"
```

---

### Task 2.4 — Page `app/buupp-admin/page.tsx` câblée aux KPIs

**Files:**
- Modify: `app/buupp-admin/page.tsx`

- [ ] **Step 1: Implémenter la page (Server Component)**

```tsx
/**
 * Vue d'ensemble du back-office BUUPP. Lit la RPC d'overview directement
 * (pas de fetch HTTP rond-trip) puis rend le bandeau KPI.
 *
 * Les 3 timeseries arrivent en Task 2.5.
 */
import { fetchOverviewKpis } from "@/lib/admin/queries/overview";
import {
  PERIOD_KEYS,
  rangeFor,
  previousRangeOf,
  type PeriodKey,
} from "@/lib/admin/periods";
import KpiCard from "./_components/KpiCard";

export const dynamic = "force-dynamic";

function fmtInt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}
function fmtEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const raw = sp.period ?? "30d";
  const period = (PERIOD_KEYS as readonly string[]).includes(raw)
    ? (raw as PeriodKey)
    : ("30d" as PeriodKey);

  const now = new Date();
  const cur = rangeFor(period, now);
  const prev = previousRangeOf(cur);
  const [c, p] = await Promise.all([
    fetchOverviewKpis(cur),
    fetchOverviewKpis(prev),
  ]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Inscrits prospects" value={fmtInt(c.prospects)} current={c.prospects} previous={p.prospects} />
        <KpiCard label="Inscrits pros" value={fmtInt(c.pros)} current={c.pros} previous={p.pros} />
        <KpiCard label="Waitlist" value={fmtInt(c.waitlist)} current={c.waitlist} previous={p.waitlist} />
        <KpiCard label="Campagnes actives" value={fmtInt(c.activeCampaigns)} current={c.activeCampaigns} previous={p.activeCampaigns} />
        <KpiCard label="Sollicitations envoyées" value={fmtInt(c.relationsSent)} current={c.relationsSent} previous={p.relationsSent} />
        <KpiCard label="Taux d'acceptation" value={`${c.acceptanceRatePct}`} unit="%" current={c.acceptanceRatePct} previous={p.acceptanceRatePct} />
        <KpiCard label="Budget engagé" value={fmtEur(c.budgetCents)} current={c.budgetCents} previous={p.budgetCents} />
        <KpiCard label="Dépensé réel" value={fmtEur(c.spentCents)} current={c.spentCents} previous={p.spentCents} />
        <KpiCard label="Crédité prospects" value={fmtEur(c.creditedCents)} current={c.creditedCents} previous={p.creditedCents} />
        <KpiCard label="Recharges Stripe" value={fmtEur(c.topupCents)} current={c.topupCents} previous={p.topupCents} />
        <KpiCard label="Revenu BUUPP estimé" value={fmtEur(c.estimatedRevenueCents)} current={c.estimatedRevenueCents} previous={p.estimatedRevenueCents} />
      </section>
      <section className="text-sm text-neutral-600">
        Les 3 timeseries (inscriptions / sollicitations / money flow) arrivent en Task 2.5.
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Vérification visuelle**

Run: `npm run dev`, ouvrir `/buupp-admin?period=30d`. Les cards doivent afficher des valeurs (probablement 0 si DB vide) sans 500.

- [ ] **Step 3: Commit**

```bash
git add app/buupp-admin/page.tsx
git commit -m "feat(admin): overview KPI bandeau wired to fetchOverviewKpis"
```

---

### Task 2.5 — Timeseries (RPC + endpoint + composant)

**Files:**
- Create: `supabase/migrations/20260510140000_admin_overview_timeseries_rpc.sql`
- Create: `lib/admin/queries/overview-timeseries.ts`
- Create: `app/api/admin/stats/overview/timeseries/route.ts`
- Create: `app/buupp-admin/_components/TimeseriesChart.tsx` (client)
- Modify: `app/buupp-admin/page.tsx` (ajout des 3 graphes)

- [ ] **Step 1: RPC SQL (3 séries en une passe)**

`supabase/migrations/20260510140000_admin_overview_timeseries_rpc.sql` :

```sql
-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Timeseries pour la vue d'ensemble admin
-- ════════════════════════════════════════════════════════════════════
-- Renvoie 3 séries quotidiennes pour [p_start, p_end[ :
--   - prospects, pros (count par jour de création)
--   - relations_sent / relations_accepted / relations_refused / relations_expired
--   - budget_cents, spent_cents, credited_cents (sum par jour)
-- Le bucket par semaine/mois est fait en TS (lib/admin/periods).
-- ════════════════════════════════════════════════════════════════════

create or replace function public.admin_overview_timeseries(
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  d date,
  prospects int,
  pros int,
  relations_sent int,
  relations_accepted int,
  relations_refused int,
  relations_expired int,
  budget_cents bigint,
  spent_cents bigint,
  credited_cents bigint
)
language sql
security definer
set search_path = public
as $$
  with days as (
    select generate_series(date_trunc('day', p_start), date_trunc('day', p_end), '1 day')::date as d
  ),
  pros_d as (
    select date_trunc('day', created_at)::date as d, count(*) as n
      from public.prospects where created_at >= p_start and created_at < p_end group by 1
  ),
  pa_d as (
    select date_trunc('day', created_at)::date as d, count(*) as n
      from public.pro_accounts where created_at >= p_start and created_at < p_end group by 1
  ),
  rel_d as (
    select date_trunc('day', sent_at)::date as d,
           count(*) as sent,
           count(*) filter (where status in ('accepted','settled')) as accepted,
           count(*) filter (where status = 'refused') as refused,
           count(*) filter (where status = 'expired') as expired
      from public.relations where sent_at >= p_start and sent_at < p_end group by 1
  ),
  camp_d as (
    select date_trunc('day', created_at)::date as d,
           coalesce(sum(budget_cents),0) as b,
           coalesce(sum(spent_cents),0) as s
      from public.campaigns where created_at >= p_start and created_at < p_end group by 1
  ),
  credit_d as (
    select date_trunc('day', created_at)::date as d,
           coalesce(sum(amount_cents),0) as c
      from public.transactions
      where type='credit' and account_kind='prospect' and status='completed'
        and created_at >= p_start and created_at < p_end
      group by 1
  )
  select
    days.d,
    coalesce(pros_d.n, 0)::int,
    coalesce(pa_d.n, 0)::int,
    coalesce(rel_d.sent, 0)::int,
    coalesce(rel_d.accepted, 0)::int,
    coalesce(rel_d.refused, 0)::int,
    coalesce(rel_d.expired, 0)::int,
    coalesce(camp_d.b, 0)::bigint,
    coalesce(camp_d.s, 0)::bigint,
    coalesce(credit_d.c, 0)::bigint
  from days
  left join pros_d on pros_d.d = days.d
  left join pa_d on pa_d.d = days.d
  left join rel_d on rel_d.d = days.d
  left join camp_d on camp_d.d = days.d
  left join credit_d on credit_d.d = days.d
  order by days.d;
$$;

revoke all on function public.admin_overview_timeseries(timestamptz, timestamptz) from public;
grant execute on function public.admin_overview_timeseries(timestamptz, timestamptz) to service_role;
```

Appliquer + regen types.

- [ ] **Step 2: Helper TS qui agrège selon les buckets**

```ts
// lib/admin/queries/overview-timeseries.ts
/**
 * Agrège les rows quotidiennes de `admin_overview_timeseries` selon les
 * buckets demandés (jour/semaine/mois) côté Node — la RPC reste en jour
 * pour rester simple et indexable.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { bucketize, type DateRange, type Bucket } from "@/lib/admin/periods";

export type OverviewSeriesPoint = {
  label: string;
  prospects: number;
  pros: number;
  relationsSent: number;
  relationsAccepted: number;
  relationsRefused: number;
  relationsExpired: number;
  budgetCents: number;
  spentCents: number;
  creditedCents: number;
};

export async function fetchOverviewTimeseries(
  range: DateRange,
): Promise<OverviewSeriesPoint[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_overview_timeseries", {
    p_start: range.start.toISOString(),
    p_end: range.end.toISOString(),
  });
  if (error) {
    console.error("[admin/queries/overview-timeseries] rpc failed", error);
    throw error;
  }

  const buckets = bucketize(range);
  return buckets.map((b) => mergeRowsForBucket(b, (data ?? []) as DailyRow[]));
}

type DailyRow = {
  d: string;
  prospects: number;
  pros: number;
  relations_sent: number;
  relations_accepted: number;
  relations_refused: number;
  relations_expired: number;
  budget_cents: number | string;
  spent_cents: number | string;
  credited_cents: number | string;
};

function mergeRowsForBucket(b: Bucket, rows: DailyRow[]): OverviewSeriesPoint {
  let prospects = 0, pros = 0;
  let relationsSent = 0, relationsAccepted = 0, relationsRefused = 0, relationsExpired = 0;
  let budgetCents = 0, spentCents = 0, creditedCents = 0;
  for (const r of rows) {
    const t = new Date(r.d).getTime();
    if (t < b.start.getTime() || t >= b.end.getTime()) continue;
    prospects += r.prospects;
    pros += r.pros;
    relationsSent += r.relations_sent;
    relationsAccepted += r.relations_accepted;
    relationsRefused += r.relations_refused;
    relationsExpired += r.relations_expired;
    budgetCents += Number(r.budget_cents);
    spentCents += Number(r.spent_cents);
    creditedCents += Number(r.credited_cents);
  }
  return {
    label: b.label,
    prospects, pros,
    relationsSent, relationsAccepted, relationsRefused, relationsExpired,
    budgetCents, spentCents, creditedCents,
  };
}
```

- [ ] **Step 3: Endpoint `GET /api/admin/stats/overview/timeseries`**

```ts
// app/api/admin/stats/overview/timeseries/route.ts
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { PERIOD_KEYS, rangeFor, type PeriodKey } from "@/lib/admin/periods";
import { fetchOverviewTimeseries } from "@/lib/admin/queries/overview-timeseries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const raw = url.searchParams.get("period") ?? "30d";
  const period = (PERIOD_KEYS as readonly string[]).includes(raw)
    ? (raw as PeriodKey) : ("30d" as PeriodKey);

  const range = rangeFor(period, new Date());
  const points = await fetchOverviewTimeseries(range);
  return NextResponse.json({ period, points }, { headers: { "cache-control": "no-store" } });
}
```

- [ ] **Step 4: Composant `TimeseriesChart` (SVG multi-series)**

```tsx
// app/buupp-admin/_components/TimeseriesChart.tsx
"use client";

type Series = { label: string; values: number[]; color: string };

export default function TimeseriesChart({
  title,
  labels,
  series,
  height = 160,
}: {
  title: string;
  labels: string[];
  series: Series[];
  height?: number;
}) {
  const width = 600;
  const all = series.flatMap((s) => s.values);
  const max = Math.max(...all, 1);
  const stepX = width / Math.max(labels.length - 1, 1);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="text-sm font-medium mb-3">{title}</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {series.map((s) => {
          const path = s.values
            .map((v, i) => {
              const x = i * stepX;
              const y = height - (v / max) * (height - 10);
              return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
          return <path key={s.label} d={path} fill="none" stroke={s.color} strokeWidth={1.5} />;
        })}
      </svg>
      <div className="flex gap-3 mt-2 text-xs">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Étendre `app/buupp-admin/page.tsx` avec les 3 graphes**

Ajouter en bas de la page (avant la fin du component), après le bandeau KPI :

```tsx
import { fetchOverviewTimeseries } from "@/lib/admin/queries/overview-timeseries";
import TimeseriesChart from "./_components/TimeseriesChart";

// … dans le component, AFTER `[c, p] = await Promise.all([...])` :
const points = await fetchOverviewTimeseries(cur);
const labels = points.map((pt) => pt.label);

// Rendu (remplacer la section "timeseries arrivent en Task 2.5") :
<section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
  <TimeseriesChart
    title="Inscriptions"
    labels={labels}
    series={[
      { label: "Prospects", values: points.map((pt) => pt.prospects), color: "#0ea5e9" },
      { label: "Pros", values: points.map((pt) => pt.pros), color: "#f59e0b" },
    ]}
  />
  <TimeseriesChart
    title="Sollicitations"
    labels={labels}
    series={[
      { label: "Envoyées", values: points.map((pt) => pt.relationsSent), color: "#64748b" },
      { label: "Acceptées", values: points.map((pt) => pt.relationsAccepted), color: "#10b981" },
      { label: "Refusées", values: points.map((pt) => pt.relationsRefused), color: "#ef4444" },
      { label: "Expirées", values: points.map((pt) => pt.relationsExpired), color: "#a3a3a3" },
    ]}
  />
  <TimeseriesChart
    title="Money flow (€)"
    labels={labels}
    series={[
      { label: "Budget", values: points.map((pt) => pt.budgetCents / 100), color: "#7c3aed" },
      { label: "Dépensé", values: points.map((pt) => pt.spentCents / 100), color: "#0ea5e9" },
      { label: "Crédité prospects", values: points.map((pt) => pt.creditedCents / 100), color: "#10b981" },
    ]}
  />
</section>
```

- [ ] **Step 6: Vérification**

Ouvrir `/buupp-admin?period=30d` → les 3 graphes apparaissent (vides si DB vide).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260510140000_admin_overview_timeseries_rpc.sql \
        lib/admin/queries/overview-timeseries.ts \
        app/api/admin/stats/overview/timeseries/route.ts \
        app/buupp-admin/_components/TimeseriesChart.tsx \
        app/buupp-admin/page.tsx \
        lib/supabase/types.ts
git commit -m "feat(admin): overview timeseries RPC + chart (3 series)"
```

---

## Lot 3 — Section Prospects

### Task 3.1 — RPC + helper `prospects` (KPIs section + listes)

**Files:**
- Create: `supabase/migrations/20260510150000_admin_prospects_rpc.sql`
- Create: `lib/admin/queries/prospects.ts`
- Create: `app/api/admin/stats/prospects/route.ts`

- [ ] **Step 1: RPC SQL**

```sql
-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Agrégats section Prospects (admin dashboard)
-- ════════════════════════════════════════════════════════════════════
-- Renvoie en un seul appel : funnel, distribution paliers, distribution
-- score, distribution vérification, top motifs refus, totaux retraits +
-- crédits + founders + parrainage. p_start/p_end pour fenêtrer ce qui
-- est "périodique" (signups, crédits, etc.) — les distributions sont
-- toujours globales (tous les prospects existants).
-- ════════════════════════════════════════════════════════════════════

create or replace function public.admin_prospects_kpis(
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funnel jsonb;
  v_paliers jsonb;
  v_score_buckets jsonb;
  v_verification jsonb;
  v_phone_verified_pct numeric;
  v_top_villes jsonb;
  v_top_secteurs jsonb;
  v_refusal_reasons jsonb;
  v_founders int;
  v_founders_bonus_count int;
  v_founders_bonus_eur numeric;
  v_credited_eur numeric;
  v_withdrawals_count int;
  v_withdrawals_eur numeric;
  v_top_referrers jsonb;
begin
  -- Funnel : waitlist → prospects → palier1 → tel verif → 1ère acceptation → 1er retrait
  select jsonb_build_object(
    'waitlist', (select count(*) from public.waitlist where created_at >= p_start and created_at < p_end),
    'signup', (select count(*) from public.prospects where created_at >= p_start and created_at < p_end),
    'tier1', (select count(*) from public.prospect_identity pi
              join public.prospects p on p.id = pi.prospect_id
              where p.created_at >= p_start and p.created_at < p_end and pi.email is not null),
    'phone', (select count(*) from public.prospect_identity pi
              join public.prospects p on p.id = pi.prospect_id
              where p.created_at >= p_start and p.created_at < p_end and pi.phone_verified_at is not null),
    'firstAccept', (select count(distinct r.prospect_id) from public.relations r
                    join public.prospects p on p.id = r.prospect_id
                    where p.created_at >= p_start and p.created_at < p_end and r.status in ('accepted','settled')),
    'firstWithdrawal', (select count(distinct t.account_id) from public.transactions t
                        join public.prospects p on p.id = t.account_id
                        where t.account_kind='prospect' and t.type='withdrawal' and t.status='completed'
                          and p.created_at >= p_start and p.created_at < p_end)
  ) into v_funnel;

  -- Distribution paliers complétés (1..5) — global.
  with tier_counts as (
    select p.id,
           (case when pi.email is not null then 1 else 0 end) +
           (case when pl.adresse is not null then 1 else 0 end) +
           (case when pv.foyer is not null then 1 else 0 end) +
           (case when pp.poste is not null then 1 else 0 end) +
           (case when ppat.residence is not null then 1 else 0 end) as filled
      from public.prospects p
      left join public.prospect_identity pi on pi.prospect_id = p.id
      left join public.prospect_localisation pl on pl.prospect_id = p.id
      left join public.prospect_vie pv on pv.prospect_id = p.id
      left join public.prospect_pro pp on pp.prospect_id = p.id
      left join public.prospect_patrimoine ppat on ppat.prospect_id = p.id
  )
  select jsonb_object_agg(filled, n)
    into v_paliers
    from (select filled, count(*) as n from tier_counts group by filled) t;

  -- Score buckets
  select jsonb_object_agg(bucket, n) into v_score_buckets
    from (
      select width_bucket(bupp_score, 0, 1000, 5) as bucket, count(*) as n
        from public.prospects group by 1 order by 1
    ) t;

  -- Niveaux de vérification
  select jsonb_object_agg(verification, n) into v_verification
    from (select verification, count(*) as n from public.prospects group by 1) t;

  -- % téléphones vérifiés
  select round(
    100.0 * count(*) filter (where phone_verified_at is not null) / nullif(count(*),0),
    1
  )::numeric into v_phone_verified_pct
  from public.prospect_identity;

  -- Top 10 villes
  select coalesce(jsonb_agg(jsonb_build_object('ville', ville, 'n', n) order by n desc), '[]'::jsonb)
    into v_top_villes
    from (select ville, count(*) as n from public.prospect_localisation
           where ville is not null group by 1 order by n desc limit 10) t;

  -- Top 10 secteurs déclarés
  select coalesce(jsonb_agg(jsonb_build_object('secteur', secteur, 'n', n) order by n desc), '[]'::jsonb)
    into v_top_secteurs
    from (select secteur, count(*) as n from public.prospect_pro
           where secteur is not null group by 1 order by n desc limit 10) t;

  -- Top motifs de refus sur la période
  select coalesce(jsonb_agg(jsonb_build_object('reason', reason, 'n', n) order by n desc), '[]'::jsonb)
    into v_refusal_reasons
    from (select reason, count(*) as n from public.relation_feedback
           where created_at >= p_start and created_at < p_end group by 1 order by n desc limit 10) t;

  -- Founders + bonus appliqués
  select count(*) into v_founders from public.prospects where is_founder = true;
  select count(*), coalesce(sum(reward_cents)::numeric / 100, 0)
    into v_founders_bonus_count, v_founders_bonus_eur
    from public.relations
    where founder_bonus_applied = true and decided_at >= p_start and decided_at < p_end;

  -- € crédités prospects sur la période
  select coalesce(sum(amount_cents)::numeric / 100, 0)
    into v_credited_eur
    from public.transactions
    where type='credit' and account_kind='prospect' and status='completed'
      and created_at >= p_start and created_at < p_end;

  -- Retraits
  select count(*), coalesce(sum(abs(amount_cents))::numeric / 100, 0)
    into v_withdrawals_count, v_withdrawals_eur
    from public.transactions
    where type='withdrawal' and account_kind='prospect' and status='completed'
      and created_at >= p_start and created_at < p_end;

  -- Top parrains : count distinct emails côté prospects qui ont un ref_code en waitlist
  select coalesce(jsonb_agg(jsonb_build_object('refCode', ref_code, 'n', n) order by n desc), '[]'::jsonb)
    into v_top_referrers
    from (
      select w.ref_code, count(*) as n
        from public.waitlist w
        join public.prospect_identity pi on lower(pi.email) = lower(w.email)
       where w.ref_code is not null
       group by 1 order by n desc limit 10
    ) t;

  return jsonb_build_object(
    'funnel', v_funnel,
    'paliers', coalesce(v_paliers, '{}'::jsonb),
    'scoreBuckets', coalesce(v_score_buckets, '{}'::jsonb),
    'verification', coalesce(v_verification, '{}'::jsonb),
    'phoneVerifiedPct', coalesce(v_phone_verified_pct, 0),
    'topVilles', v_top_villes,
    'topSecteurs', v_top_secteurs,
    'refusalReasons', v_refusal_reasons,
    'founders', v_founders,
    'foundersBonusCount', v_founders_bonus_count,
    'foundersBonusEur', v_founders_bonus_eur,
    'creditedEur', v_credited_eur,
    'withdrawalsCount', v_withdrawals_count,
    'withdrawalsEur', v_withdrawals_eur,
    'topReferrers', v_top_referrers
  );
end;
$$;

revoke all on function public.admin_prospects_kpis(timestamptz, timestamptz) from public;
grant execute on function public.admin_prospects_kpis(timestamptz, timestamptz) to service_role;
```

Appliquer + regen types.

- [ ] **Step 2: Helper TS**

```ts
// lib/admin/queries/prospects.ts
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/admin/periods";

export type ProspectsKpis = {
  funnel: { waitlist: number; signup: number; tier1: number; phone: number; firstAccept: number; firstWithdrawal: number };
  paliers: Record<string, number>;
  scoreBuckets: Record<string, number>;
  verification: Record<string, number>;
  phoneVerifiedPct: number;
  topVilles: { ville: string; n: number }[];
  topSecteurs: { secteur: string; n: number }[];
  refusalReasons: { reason: string; n: number }[];
  founders: number;
  foundersBonusCount: number;
  foundersBonusEur: number;
  creditedEur: number;
  withdrawalsCount: number;
  withdrawalsEur: number;
  topReferrers: { refCode: string; n: number }[];
};

export async function fetchProspectsKpis(range: DateRange): Promise<ProspectsKpis> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_prospects_kpis", {
    p_start: range.start.toISOString(),
    p_end: range.end.toISOString(),
  });
  if (error) throw error;
  return data as unknown as ProspectsKpis;
}
```

- [ ] **Step 3: Route handler**

```ts
// app/api/admin/stats/prospects/route.ts
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { PERIOD_KEYS, rangeFor, type PeriodKey } from "@/lib/admin/periods";
import { fetchProspectsKpis } from "@/lib/admin/queries/prospects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const raw = url.searchParams.get("period") ?? "30d";
  const period = (PERIOD_KEYS as readonly string[]).includes(raw)
    ? (raw as PeriodKey) : ("30d" as PeriodKey);
  const data = await fetchProspectsKpis(rangeFor(period, new Date()));
  return NextResponse.json({ period, ...data }, { headers: { "cache-control": "no-store" } });
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260510150000_admin_prospects_rpc.sql \
        lib/admin/queries/prospects.ts \
        app/api/admin/stats/prospects/route.ts \
        lib/supabase/types.ts
git commit -m "feat(admin): admin_prospects_kpis RPC + endpoint"
```

---

### Task 3.2 — Page section Prospects

**Files:**
- Create: `app/buupp-admin/prospects/page.tsx`

- [ ] **Step 1: Implémenter**

```tsx
/**
 * Section Prospects du back-office BUUPP : funnel, paliers, scores,
 * vérification, top villes/secteurs, motifs refus, monétisation,
 * founders, parrainage. Toutes les distributions sont globales ; les
 * compteurs périodiques respectent le `?period=`.
 */
import { fetchProspectsKpis } from "@/lib/admin/queries/prospects";
import { PERIOD_KEYS, rangeFor, type PeriodKey } from "@/lib/admin/periods";

export const dynamic = "force-dynamic";

const fmt = new Intl.NumberFormat("fr-FR");
const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default async function ProspectsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const raw = sp.period ?? "30d";
  const period = (PERIOD_KEYS as readonly string[]).includes(raw)
    ? (raw as PeriodKey) : ("30d" as PeriodKey);
  const data = await fetchProspectsKpis(rangeFor(period, new Date()));

  return (
    <div className="space-y-6">
      <Section title="Funnel d'acquisition (sur la période)">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            ["Waitlist", data.funnel.waitlist],
            ["Signup", data.funnel.signup],
            ["Palier 1", data.funnel.tier1],
            ["Tél vérifié", data.funnel.phone],
            ["1ʳᵉ acceptation", data.funnel.firstAccept],
            ["1ᵉʳ retrait", data.funnel.firstWithdrawal],
          ].map(([label, n]) => (
            <Box key={label as string} label={label as string} value={fmt.format(n as number)} />
          ))}
        </div>
      </Section>

      <Section title="Distribution paliers complétés (global)">
        <Histo data={data.paliers} labelFor={(k) => `${k} paliers`} />
      </Section>

      <Section title="BUUPP score (global)">
        <Histo
          data={data.scoreBuckets}
          labelFor={(k) => {
            const i = Number(k);
            const lo = (i - 1) * 200;
            return `${lo}-${lo + 200}`;
          }}
        />
      </Section>

      <Section title="Vérification (global)">
        <Histo data={data.verification} labelFor={(k) => k} />
        <div className="text-xs text-neutral-500 mt-2">
          Téléphone vérifié : <strong>{data.phoneVerifiedPct}%</strong>
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Section title="Top villes (global)">
          <Table rows={data.topVilles.map((r) => [r.ville, fmt.format(r.n)])} />
        </Section>
        <Section title="Top secteurs (global)">
          <Table rows={data.topSecteurs.map((r) => [r.secteur, fmt.format(r.n)])} />
        </Section>
      </div>

      <Section title="Motifs de refus (sur la période)">
        <Table rows={data.refusalReasons.map((r) => [r.reason, fmt.format(r.n)])} />
      </Section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Box label="Crédité prospects" value={eur.format(data.creditedEur)} />
        <Box label="Retraits (count)" value={fmt.format(data.withdrawalsCount)} />
        <Box label="Retraits (€)" value={eur.format(data.withdrawalsEur)} />
        <Box label="Founders" value={fmt.format(data.founders)} />
        <Box label="Bonus founders (count)" value={fmt.format(data.foundersBonusCount)} />
        <Box label="Bonus founders (€)" value={eur.format(data.foundersBonusEur)} />
      </div>

      <Section title="Top parrains (refCode → conversions)">
        <Table rows={data.topReferrers.map((r) => [r.refCode, fmt.format(r.n)])} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{title}</h2>
      <div className="rounded-lg border border-neutral-200 bg-white p-4">{children}</div>
    </section>
  );
}
function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-200 bg-white p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
function Table({ rows }: { rows: [string, string][] }) {
  if (rows.length === 0) return <div className="text-sm text-neutral-500">Aucune donnée.</div>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-neutral-100 last:border-0">
            <td className="py-1">{k}</td>
            <td className="py-1 text-right tabular-nums">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function Histo({
  data,
  labelFor,
}: {
  data: Record<string, number>;
  labelFor: (k: string) => string;
}) {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return <div className="text-sm text-neutral-500">Aucune donnée.</div>;
  const max = Math.max(...entries.map(([, n]) => n), 1);
  return (
    <div className="space-y-1">
      {entries.map(([k, n]) => (
        <div key={k} className="flex items-center gap-2">
          <div className="w-24 text-xs text-neutral-600">{labelFor(k)}</div>
          <div className="flex-1 bg-neutral-100 h-3 rounded">
            <div className="bg-neutral-700 h-3 rounded" style={{ width: `${(n / max) * 100}%` }} />
          </div>
          <div className="w-12 text-right text-xs tabular-nums">{n}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Vérification**

Ouvrir `/buupp-admin/prospects?period=30d` → la page rend toutes les sections.

- [ ] **Step 3: Commit**

```bash
git add app/buupp-admin/prospects/page.tsx
git commit -m "feat(admin): prospects section page (funnel + distributions + €)"
```

---

### Task 3.3 — Liste prospects + fiche read-only

**Files:**
- Create: `app/api/admin/stats/prospects/list/route.ts`
- Create: `app/buupp-admin/prospects/[id]/page.tsx`
- Modify: `app/buupp-admin/prospects/page.tsx` (ajouter la table en bas)

- [ ] **Step 1: Endpoint liste paginée + filtres simples**

```ts
// app/api/admin/stats/prospects/list/route.ts
/**
 * GET /api/admin/stats/prospects/list?page=&size=&q=&minScore=&verification=&founder=
 *
 * Liste paginée des prospects avec champs résumés. `q` est appliqué en
 * full-text simple sur prénom/nom/email/ville (ilike). `founder` accepte
 * "true"/"false". Plafond 50/page pour limiter le coût.
 */
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const size = Math.min(50, Math.max(1, Number(url.searchParams.get("size") ?? "25")));
  const q = (url.searchParams.get("q") ?? "").trim();
  const minScore = Number(url.searchParams.get("minScore") ?? "0");
  const verification = url.searchParams.get("verification");
  const founder = url.searchParams.get("founder");

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("prospects")
    .select(
      "id, bupp_score, verification, is_founder, created_at, prospect_identity(prenom, nom, email), prospect_localisation(ville)",
      { count: "exact" },
    )
    .gte("bupp_score", isNaN(minScore) ? 0 : minScore)
    .order("created_at", { ascending: false })
    .range((page - 1) * size, page * size - 1);

  if (verification) query = query.eq("verification", verification);
  if (founder === "true") query = query.eq("is_founder", true);
  if (founder === "false") query = query.eq("is_founder", false);

  const { data, error, count } = await query;
  if (error) {
    console.error("[/api/admin/stats/prospects/list] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  let rows = (data ?? []).map((r: any) => {
    const id = Array.isArray(r.prospect_identity) ? r.prospect_identity[0] : r.prospect_identity;
    const loc = Array.isArray(r.prospect_localisation) ? r.prospect_localisation[0] : r.prospect_localisation;
    return {
      id: r.id,
      score: r.bupp_score,
      verification: r.verification,
      founder: r.is_founder,
      createdAt: r.created_at,
      prenom: id?.prenom ?? null,
      nom: id?.nom ?? null,
      email: id?.email ?? null,
      ville: loc?.ville ?? null,
    };
  });

  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((r) =>
      [r.prenom, r.nom, r.email, r.ville]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle)),
    );
  }

  return NextResponse.json({ page, size, total: count ?? 0, rows });
}
```

- [ ] **Step 2: Fiche prospect (read-only)**

```tsx
// app/buupp-admin/prospects/[id]/page.tsx
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProspectDetailAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: p } = await admin
    .from("prospects")
    .select("*, prospect_identity(*), prospect_localisation(*), prospect_vie(*), prospect_pro(*), prospect_patrimoine(*)")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const { data: relations } = await admin
    .from("relations")
    .select("id, status, sent_at, decided_at, settled_at, reward_cents, campaigns(name)")
    .eq("prospect_id", id)
    .order("sent_at", { ascending: false })
    .limit(50);

  const { data: tx } = await admin
    .from("transactions")
    .select("id, type, status, amount_cents, description, created_at")
    .eq("account_id", id)
    .eq("account_kind", "prospect")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Fiche prospect</h2>
      <pre className="text-xs bg-white border rounded p-4 overflow-auto">
        {JSON.stringify(p, null, 2)}
      </pre>
      <h3 className="text-sm font-semibold">Relations (50 dernières)</h3>
      <pre className="text-xs bg-white border rounded p-4 overflow-auto">
        {JSON.stringify(relations, null, 2)}
      </pre>
      <h3 className="text-sm font-semibold">Transactions (50 dernières)</h3>
      <pre className="text-xs bg-white border rounded p-4 overflow-auto">
        {JSON.stringify(tx, null, 2)}
      </pre>
    </div>
  );
}
```

- [ ] **Step 3: Ajouter la table en bas de `prospects/page.tsx`**

À la fin du return (avant `</div>` final), ajouter :

```tsx
<Section title="Liste prospects (50 plus récents)">
  <ProspectsTable />
</Section>
```

Et créer le composant client `app/buupp-admin/_components/ProspectsTable.tsx` qui fetch `/api/admin/stats/prospects/list` :

```tsx
// app/buupp-admin/_components/ProspectsTable.tsx
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  ville: string | null;
  score: number;
  verification: string;
  founder: boolean;
  createdAt: string;
};

export default function ProspectsTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats/prospects/list?page=1&size=50")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-neutral-500">Chargement…</div>;
  if (rows.length === 0) return <div className="text-sm text-neutral-500">Aucun prospect.</div>;

  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-neutral-500 uppercase">
        <tr>
          <th className="py-2">Email</th>
          <th>Prénom</th>
          <th>Ville</th>
          <th className="text-right">Score</th>
          <th>Vérif</th>
          <th>Founder</th>
          <th>Créé le</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-neutral-100">
            <td className="py-1">
              <Link className="underline" href={`/buupp-admin/prospects/${r.id}`}>
                {r.email ?? "(sans email)"}
              </Link>
            </td>
            <td>{r.prenom ?? "—"}</td>
            <td>{r.ville ?? "—"}</td>
            <td className="text-right tabular-nums">{r.score}</td>
            <td>{r.verification}</td>
            <td>{r.founder ? "✓" : ""}</td>
            <td className="text-xs text-neutral-500">{new Date(r.createdAt).toLocaleDateString("fr-FR")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

Et importer/utiliser dans `prospects/page.tsx` :

```tsx
import ProspectsTable from "../_components/ProspectsTable";
```

- [ ] **Step 4: Vérifier**

`/buupp-admin/prospects` → la table apparaît, cliquer → `/buupp-admin/prospects/[id]` rend la fiche JSON.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/stats/prospects/list/route.ts \
        app/buupp-admin/_components/ProspectsTable.tsx \
        app/buupp-admin/prospects/[id]/page.tsx \
        app/buupp-admin/prospects/page.tsx
git commit -m "feat(admin): prospects list endpoint + table + read-only detail"
```

---

## Lot 4 — Section Pros

### Task 4.1 — RPC + helper `pros`

**Files:**
- Create: `supabase/migrations/20260510160000_admin_pros_rpc.sql`
- Create: `lib/admin/queries/pros.ts`
- Create: `app/api/admin/stats/pros/route.ts`

- [ ] **Step 1: RPC SQL**

```sql
create or replace function public.admin_pros_kpis(
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signups int;
  v_by_plan jsonb;
  v_by_billing jsonb;
  v_top_secteurs jsonb;
  v_top_villes jsonb;
  v_topup_count int;
  v_topup_eur numeric;
  v_topup_avg_eur numeric;
  v_wallet_balance_eur numeric;
  v_reveals int;
  v_reveals_per_day jsonb;
begin
  select count(*) into v_signups from public.pro_accounts
   where created_at >= p_start and created_at < p_end;

  select coalesce(jsonb_object_agg(plan, n), '{}'::jsonb) into v_by_plan
    from (select plan, count(*) as n from public.pro_accounts group by 1) t;
  select coalesce(jsonb_object_agg(billing_status, n), '{}'::jsonb) into v_by_billing
    from (select billing_status, count(*) as n from public.pro_accounts group by 1) t;

  select coalesce(jsonb_agg(jsonb_build_object('secteur', secteur, 'n', n) order by n desc), '[]'::jsonb)
    into v_top_secteurs
    from (select secteur, count(*) as n from public.pro_accounts where secteur is not null group by 1 order by n desc limit 10) t;
  select coalesce(jsonb_agg(jsonb_build_object('ville', ville, 'n', n) order by n desc), '[]'::jsonb)
    into v_top_villes
    from (select ville, count(*) as n from public.pro_accounts where ville is not null group by 1 order by n desc limit 10) t;

  select count(*), coalesce(sum(amount_cents)::numeric / 100, 0),
         coalesce(avg(amount_cents)::numeric / 100, 0)
    into v_topup_count, v_topup_eur, v_topup_avg_eur
    from public.transactions
    where type='topup' and account_kind='pro' and status='completed'
      and created_at >= p_start and created_at < p_end;

  select coalesce(sum(wallet_balance_cents)::numeric / 100, 0) into v_wallet_balance_eur
    from public.pro_accounts;

  select count(*) into v_reveals from public.pro_contact_reveals
    where revealed_at >= p_start and revealed_at < p_end;

  select coalesce(jsonb_object_agg(d, n order by d), '{}'::jsonb)
    into v_reveals_per_day
    from (
      select date_trunc('day', revealed_at)::date::text as d, count(*) as n
        from public.pro_contact_reveals
        where revealed_at >= p_start and revealed_at < p_end
        group by 1
    ) t;

  return jsonb_build_object(
    'signups', v_signups,
    'byPlan', v_by_plan,
    'byBilling', v_by_billing,
    'topSecteurs', v_top_secteurs,
    'topVilles', v_top_villes,
    'topupCount', v_topup_count,
    'topupEur', v_topup_eur,
    'topupAvgEur', v_topup_avg_eur,
    'walletBalanceEur', v_wallet_balance_eur,
    'revealsCount', v_reveals,
    'revealsPerDay', v_reveals_per_day
  );
end;
$$;

revoke all on function public.admin_pros_kpis(timestamptz, timestamptz) from public;
grant execute on function public.admin_pros_kpis(timestamptz, timestamptz) to service_role;
```

Appliquer + regen types.

- [ ] **Step 2: Helper TS**

```ts
// lib/admin/queries/pros.ts
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/admin/periods";

export type ProsKpis = {
  signups: number;
  byPlan: Record<string, number>;
  byBilling: Record<string, number>;
  topSecteurs: { secteur: string; n: number }[];
  topVilles: { ville: string; n: number }[];
  topupCount: number;
  topupEur: number;
  topupAvgEur: number;
  walletBalanceEur: number;
  revealsCount: number;
  revealsPerDay: Record<string, number>;
};

export async function fetchProsKpis(range: DateRange): Promise<ProsKpis> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_pros_kpis", {
    p_start: range.start.toISOString(),
    p_end: range.end.toISOString(),
  });
  if (error) throw error;
  return data as unknown as ProsKpis;
}
```

- [ ] **Step 3: Endpoint**

```ts
// app/api/admin/stats/pros/route.ts
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { PERIOD_KEYS, rangeFor, type PeriodKey } from "@/lib/admin/periods";
import { fetchProsKpis } from "@/lib/admin/queries/pros";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const raw = url.searchParams.get("period") ?? "30d";
  const period = (PERIOD_KEYS as readonly string[]).includes(raw)
    ? (raw as PeriodKey) : ("30d" as PeriodKey);
  const data = await fetchProsKpis(rangeFor(period, new Date()));
  return NextResponse.json({ period, ...data }, { headers: { "cache-control": "no-store" } });
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260510160000_admin_pros_rpc.sql \
        lib/admin/queries/pros.ts \
        app/api/admin/stats/pros/route.ts \
        lib/supabase/types.ts
git commit -m "feat(admin): admin_pros_kpis RPC + endpoint"
```

---

### Task 4.2 — Page section Pros + liste + fiche

**Files:**
- Create: `app/buupp-admin/pros/page.tsx`
- Create: `app/buupp-admin/pros/[id]/page.tsx`
- Create: `app/buupp-admin/_components/ProsTable.tsx`
- Create: `app/api/admin/stats/pros/list/route.ts`

- [ ] **Step 1: Endpoint liste pros**

```ts
// app/api/admin/stats/pros/list/route.ts
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const size = Math.min(50, Math.max(1, Number(url.searchParams.get("size") ?? "25")));
  const plan = url.searchParams.get("plan");
  const billing = url.searchParams.get("billing");
  const secteur = url.searchParams.get("secteur");

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("pro_accounts")
    .select("id, raison_sociale, siren, secteur, ville, plan, billing_status, wallet_balance_cents, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * size, page * size - 1);
  if (plan) query = query.eq("plan", plan);
  if (billing) query = query.eq("billing_status", billing);
  if (secteur) query = query.eq("secteur", secteur);

  const { data, error, count } = await query;
  if (error) {
    console.error("[/api/admin/stats/pros/list] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  return NextResponse.json({ page, size, total: count ?? 0, rows: data ?? [] });
}
```

- [ ] **Step 2: Composant table client `ProsTable.tsx`**

```tsx
// app/buupp-admin/_components/ProsTable.tsx
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  raison_sociale: string;
  siren: string | null;
  secteur: string | null;
  ville: string | null;
  plan: string;
  billing_status: string;
  wallet_balance_cents: number;
  created_at: string;
};

export default function ProsTable() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    fetch("/api/admin/stats/pros/list?page=1&size=50").then((r) => r.json()).then((d) => setRows(d.rows ?? []));
  }, []);
  if (rows.length === 0) return <div className="text-sm text-neutral-500">Aucun pro.</div>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-neutral-500 uppercase">
        <tr><th>Raison sociale</th><th>SIREN</th><th>Secteur</th><th>Ville</th><th>Plan</th><th>Billing</th><th className="text-right">Solde €</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-neutral-100">
            <td className="py-1"><Link className="underline" href={`/buupp-admin/pros/${r.id}`}>{r.raison_sociale}</Link></td>
            <td>{r.siren ?? "—"}</td>
            <td>{r.secteur ?? "—"}</td>
            <td>{r.ville ?? "—"}</td>
            <td>{r.plan}</td>
            <td>{r.billing_status}</td>
            <td className="text-right tabular-nums">{(r.wallet_balance_cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: Page section Pros**

```tsx
// app/buupp-admin/pros/page.tsx
import { fetchProsKpis } from "@/lib/admin/queries/pros";
import { PERIOD_KEYS, rangeFor, type PeriodKey } from "@/lib/admin/periods";
import ProsTable from "../_components/ProsTable";

export const dynamic = "force-dynamic";

const fmt = new Intl.NumberFormat("fr-FR");
const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default async function ProsAdminPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const raw = sp.period ?? "30d";
  const period = (PERIOD_KEYS as readonly string[]).includes(raw) ? (raw as PeriodKey) : ("30d" as PeriodKey);
  const data = await fetchProsKpis(rangeFor(period, new Date()));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Box label="Signups (période)" value={fmt.format(data.signups)} />
        <Box label="Recharges (count)" value={fmt.format(data.topupCount)} />
        <Box label="Recharges (€)" value={eur.format(data.topupEur)} />
        <Box label="Panier moyen (€)" value={eur.format(data.topupAvgEur)} />
        <Box label="Wallet cumulé (€)" value={eur.format(data.walletBalanceEur)} />
        <Box label="Reveals contact" value={fmt.format(data.revealsCount)} />
      </div>

      <Section title="Plans">
        <pre className="text-xs">{JSON.stringify(data.byPlan, null, 2)}</pre>
      </Section>
      <Section title="Statuts billing">
        <pre className="text-xs">{JSON.stringify(data.byBilling, null, 2)}</pre>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Section title="Top secteurs"><Table rows={data.topSecteurs.map((r) => [r.secteur, fmt.format(r.n)])} /></Section>
        <Section title="Top villes"><Table rows={data.topVilles.map((r) => [r.ville, fmt.format(r.n)])} /></Section>
      </div>

      <Section title="Liste pros (50 plus récents)"><ProsTable /></Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{title}</h2><div className="rounded-lg border border-neutral-200 bg-white p-4">{children}</div></section>;
}
function Box({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-neutral-200 bg-white p-3"><div className="text-xs text-neutral-500">{label}</div><div className="text-lg font-semibold tabular-nums">{value}</div></div>;
}
function Table({ rows }: { rows: [string, string][] }) {
  if (rows.length === 0) return <div className="text-sm text-neutral-500">Aucune donnée.</div>;
  return <table className="w-full text-sm"><tbody>{rows.map(([k, v]) => (<tr key={k} className="border-b border-neutral-100"><td className="py-1">{k}</td><td className="py-1 text-right tabular-nums">{v}</td></tr>))}</tbody></table>;
}
```

- [ ] **Step 4: Fiche pro `pros/[id]/page.tsx`**

```tsx
// app/buupp-admin/pros/[id]/page.tsx
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProDetailAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: pro } = await admin.from("pro_accounts").select("*").eq("id", id).maybeSingle();
  if (!pro) notFound();
  const { data: campaigns } = await admin
    .from("campaigns")
    .select("id, name, status, type, budget_cents, spent_cents, created_at")
    .eq("pro_account_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  const { data: tx } = await admin
    .from("transactions")
    .select("id, type, status, amount_cents, description, created_at")
    .eq("account_id", id)
    .eq("account_kind", "pro")
    .order("created_at", { ascending: false })
    .limit(50);
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Fiche pro</h2>
      <pre className="text-xs bg-white border rounded p-4 overflow-auto">{JSON.stringify(pro, null, 2)}</pre>
      <h3 className="text-sm font-semibold">Campagnes</h3>
      <pre className="text-xs bg-white border rounded p-4 overflow-auto">{JSON.stringify(campaigns, null, 2)}</pre>
      <h3 className="text-sm font-semibold">Transactions</h3>
      <pre className="text-xs bg-white border rounded p-4 overflow-auto">{JSON.stringify(tx, null, 2)}</pre>
    </div>
  );
}
```

- [ ] **Step 5: Vérifier**

`/buupp-admin/pros?period=30d` rend la section + la table. Cliquer un pro → fiche.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/stats/pros/list/route.ts \
        app/buupp-admin/pros/page.tsx \
        app/buupp-admin/pros/[id]/page.tsx \
        app/buupp-admin/_components/ProsTable.tsx
git commit -m "feat(admin): pros section page + list + read-only detail"
```

---

## Lot 5 — Section Campagnes

### Task 5.1 — RPC + helper + endpoint + page

**Files:**
- Create: `supabase/migrations/20260510170000_admin_campaigns_rpc.sql`
- Create: `lib/admin/queries/campaigns.ts`
- Create: `app/api/admin/stats/campaigns/route.ts`
- Create: `app/buupp-admin/campagnes/page.tsx`
- Create: `app/buupp-admin/campagnes/[id]/page.tsx`

- [ ] **Step 1: RPC SQL**

```sql
create or replace function public.admin_campaigns_kpis(
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_by_status jsonb;
  v_created int;
  v_budget_eur numeric;
  v_spent_eur numeric;
  v_consumption_avg_pct numeric;
  v_cpc_avg_eur numeric;
  v_cpc_median_eur numeric;
  v_by_type jsonb;
  v_top_geo jsonb;
  v_top_categories jsonb;
  v_top_perf jsonb;
  v_flop_perf jsonb;
  v_auto_completed int;
  v_expiring_warned int;
begin
  select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) into v_by_status
    from (select status, count(*) as n from public.campaigns
           where created_at >= p_start and created_at < p_end group by 1) t;

  select count(*), coalesce(sum(budget_cents)::numeric / 100, 0),
         coalesce(sum(spent_cents)::numeric / 100, 0),
         coalesce(round(avg(case when budget_cents > 0 then 100.0 * spent_cents / budget_cents else 0 end)::numeric, 1), 0),
         coalesce(round(avg(cost_per_contact_cents)::numeric / 100, 2), 0),
         coalesce(round(percentile_cont(0.5) within group (order by cost_per_contact_cents)::numeric / 100, 2), 0)
    into v_created, v_budget_eur, v_spent_eur, v_consumption_avg_pct, v_cpc_avg_eur, v_cpc_median_eur
    from public.campaigns where created_at >= p_start and created_at < p_end;

  select coalesce(jsonb_object_agg(type, n), '{}'::jsonb) into v_by_type
    from (select type, count(*) as n from public.campaigns
           where created_at >= p_start and created_at < p_end group by 1) t;

  select coalesce(jsonb_agg(jsonb_build_object('geo', geo, 'n', n) order by n desc), '[]'::jsonb)
    into v_top_geo
    from (
      select g as geo, count(*) as n
        from public.campaigns c, jsonb_array_elements_text(coalesce(c.targeting->'geo','[]'::jsonb)) g
        where c.created_at >= p_start and c.created_at < p_end
        group by g order by n desc limit 10
    ) t;

  select coalesce(jsonb_agg(jsonb_build_object('cat', cat, 'n', n) order by n desc), '[]'::jsonb)
    into v_top_categories
    from (
      select g as cat, count(*) as n
        from public.campaigns c, jsonb_array_elements_text(coalesce(c.targeting->'categories','[]'::jsonb)) g
        where c.created_at >= p_start and c.created_at < p_end
        group by g order by n desc limit 10
    ) t;

  -- Top/Flop perf : taux d'acceptation par campagne (sur relations finales)
  with rel_stats as (
    select c.id, c.name,
           count(r.*) filter (where r.status in ('accepted','settled','refused','expired')) as finals,
           count(r.*) filter (where r.status in ('accepted','settled')) as wins
      from public.campaigns c
      left join public.relations r on r.campaign_id = c.id
      where c.created_at >= p_start and c.created_at < p_end
      group by c.id, c.name
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'pct', round(100.0 * wins / nullif(finals,0), 1)) order by wins::numeric / nullif(finals,0) desc nulls last), '[]'::jsonb)
    into v_top_perf
    from (select * from rel_stats where finals >= 5 order by wins::numeric / nullif(finals,0) desc nulls last limit 10) t;

  with rel_stats as (
    select c.id, c.name,
           count(r.*) filter (where r.status in ('accepted','settled','refused','expired')) as finals,
           count(r.*) filter (where r.status in ('accepted','settled')) as wins
      from public.campaigns c
      left join public.relations r on r.campaign_id = c.id
      where c.created_at >= p_start and c.created_at < p_end
      group by c.id, c.name
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'pct', round(100.0 * wins / nullif(finals,0), 1)) order by wins::numeric / nullif(finals,0) asc nulls last), '[]'::jsonb)
    into v_flop_perf
    from (select * from rel_stats where finals >= 5 order by wins::numeric / nullif(finals,0) asc nulls last limit 10) t;

  select count(*) into v_auto_completed from public.campaigns
   where status='completed' and ends_at >= p_start and ends_at < p_end;

  select count(*) into v_expiring_warned from public.campaigns
   where expiry_warning_sent = true and updated_at >= p_start and updated_at < p_end;

  return jsonb_build_object(
    'byStatus', v_by_status,
    'created', v_created,
    'budgetEur', v_budget_eur,
    'spentEur', v_spent_eur,
    'consumptionAvgPct', v_consumption_avg_pct,
    'cpcAvgEur', v_cpc_avg_eur,
    'cpcMedianEur', v_cpc_median_eur,
    'byType', v_by_type,
    'topGeo', v_top_geo,
    'topCategories', v_top_categories,
    'topPerf', v_top_perf,
    'flopPerf', v_flop_perf,
    'autoCompleted', v_auto_completed,
    'expiringWarned', v_expiring_warned
  );
end;
$$;

revoke all on function public.admin_campaigns_kpis(timestamptz, timestamptz) from public;
grant execute on function public.admin_campaigns_kpis(timestamptz, timestamptz) to service_role;
```

Appliquer + regen types.

- [ ] **Step 2: Helper + endpoint**

```ts
// lib/admin/queries/campaigns.ts
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/admin/periods";

export type CampaignsKpis = {
  byStatus: Record<string, number>;
  created: number;
  budgetEur: number;
  spentEur: number;
  consumptionAvgPct: number;
  cpcAvgEur: number;
  cpcMedianEur: number;
  byType: Record<string, number>;
  topGeo: { geo: string; n: number }[];
  topCategories: { cat: string; n: number }[];
  topPerf: { id: string; name: string; pct: number }[];
  flopPerf: { id: string; name: string; pct: number }[];
  autoCompleted: number;
  expiringWarned: number;
};

export async function fetchCampaignsKpis(range: DateRange): Promise<CampaignsKpis> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_campaigns_kpis", {
    p_start: range.start.toISOString(),
    p_end: range.end.toISOString(),
  });
  if (error) throw error;
  return data as unknown as CampaignsKpis;
}
```

```ts
// app/api/admin/stats/campaigns/route.ts
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { PERIOD_KEYS, rangeFor, type PeriodKey } from "@/lib/admin/periods";
import { fetchCampaignsKpis } from "@/lib/admin/queries/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const raw = url.searchParams.get("period") ?? "30d";
  const period = (PERIOD_KEYS as readonly string[]).includes(raw)
    ? (raw as PeriodKey) : ("30d" as PeriodKey);
  const data = await fetchCampaignsKpis(rangeFor(period, new Date()));
  return NextResponse.json({ period, ...data }, { headers: { "cache-control": "no-store" } });
}
```

- [ ] **Step 3: Page section + fiche**

```tsx
// app/buupp-admin/campagnes/page.tsx
import Link from "next/link";
import { fetchCampaignsKpis } from "@/lib/admin/queries/campaigns";
import { PERIOD_KEYS, rangeFor, type PeriodKey } from "@/lib/admin/periods";

export const dynamic = "force-dynamic";

const fmt = new Intl.NumberFormat("fr-FR");
const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default async function CampaignsAdminPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const raw = sp.period ?? "30d";
  const period = (PERIOD_KEYS as readonly string[]).includes(raw) ? (raw as PeriodKey) : ("30d" as PeriodKey);
  const d = await fetchCampaignsKpis(rangeFor(period, new Date()));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Box label="Créées" value={fmt.format(d.created)} />
        <Box label="Budget €" value={eur.format(d.budgetEur)} />
        <Box label="Dépensé €" value={eur.format(d.spentEur)} />
        <Box label="Consommation moy." value={`${d.consumptionAvgPct}%`} />
        <Box label="CPC moyen €" value={eur.format(d.cpcAvgEur)} />
        <Box label="CPC médian €" value={eur.format(d.cpcMedianEur)} />
        <Box label="Auto-completed" value={fmt.format(d.autoCompleted)} />
        <Box label="Expiry warned" value={fmt.format(d.expiringWarned)} />
      </div>

      <Section title="Par statut"><pre className="text-xs">{JSON.stringify(d.byStatus, null, 2)}</pre></Section>
      <Section title="Par type"><pre className="text-xs">{JSON.stringify(d.byType, null, 2)}</pre></Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Section title="Top zones géo"><List items={d.topGeo.map((r) => `${r.geo} (${r.n})`)} /></Section>
        <Section title="Top catégories"><List items={d.topCategories.map((r) => `${r.cat} (${r.n})`)} /></Section>
      </div>

      <Section title="Top 10 perf (>= 5 finals)">
        <ul className="text-sm">
          {d.topPerf.map((c) => (
            <li key={c.id} className="border-b border-neutral-100 py-1 flex justify-between">
              <Link className="underline" href={`/buupp-admin/campagnes/${c.id}`}>{c.name}</Link>
              <span className="tabular-nums">{c.pct}%</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Flop 10 perf (>= 5 finals)">
        <ul className="text-sm">
          {d.flopPerf.map((c) => (
            <li key={c.id} className="border-b border-neutral-100 py-1 flex justify-between">
              <Link className="underline" href={`/buupp-admin/campagnes/${c.id}`}>{c.name}</Link>
              <span className="tabular-nums">{c.pct}%</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{title}</h2><div className="rounded-lg border border-neutral-200 bg-white p-4">{children}</div></section>;
}
function Box({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-neutral-200 bg-white p-3"><div className="text-xs text-neutral-500">{label}</div><div className="text-lg font-semibold tabular-nums">{value}</div></div>;
}
function List({ items }: { items: string[] }) {
  if (items.length === 0) return <div className="text-sm text-neutral-500">Aucune donnée.</div>;
  return <ul className="text-sm">{items.map((s) => <li key={s} className="py-0.5">{s}</li>)}</ul>;
}
```

```tsx
// app/buupp-admin/campagnes/[id]/page.tsx
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CampaignDetailAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: campaign } = await admin
    .from("campaigns")
    .select("*, pro_accounts(raison_sociale, secteur)")
    .eq("id", id)
    .maybeSingle();
  if (!campaign) notFound();
  const { data: relations } = await admin
    .from("relations")
    .select("id, status, sent_at, decided_at, settled_at, reward_cents, prospects(prospect_identity(prenom, email))")
    .eq("campaign_id", id)
    .order("sent_at", { ascending: false })
    .limit(100);
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Fiche campagne</h2>
      <pre className="text-xs bg-white border rounded p-4 overflow-auto">{JSON.stringify(campaign, null, 2)}</pre>
      <h3 className="text-sm font-semibold">Relations (100 dernières)</h3>
      <pre className="text-xs bg-white border rounded p-4 overflow-auto">{JSON.stringify(relations, null, 2)}</pre>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260510170000_admin_campaigns_rpc.sql \
        lib/admin/queries/campaigns.ts \
        app/api/admin/stats/campaigns/route.ts \
        app/buupp-admin/campagnes/page.tsx \
        app/buupp-admin/campagnes/[id]/page.tsx \
        lib/supabase/types.ts
git commit -m "feat(admin): campaigns section page + RPC + read-only detail"
```

---

## Lot 6 — Transactions, Waitlist, Santé

### Task 6.1 — Page Transactions (journal filtrable)

**Files:**
- Create: `app/api/admin/stats/transactions/route.ts`
- Create: `app/buupp-admin/transactions/page.tsx`
- Create: `app/buupp-admin/_components/TransactionsTable.tsx`

- [ ] **Step 1: Endpoint paginé + filtres**

```ts
// app/api/admin/stats/transactions/route.ts
/**
 * GET /api/admin/stats/transactions?accountKind=&type=&status=&from=&to=&minEur=&maxEur=&page=&size=
 * Plafond 50 lignes par page.
 */
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const size = Math.min(50, Math.max(1, Number(url.searchParams.get("size") ?? "25")));
  const accountKind = url.searchParams.get("accountKind");
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const minEur = url.searchParams.get("minEur");
  const maxEur = url.searchParams.get("maxEur");

  const admin = createSupabaseAdminClient();
  let q = admin.from("transactions").select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * size, page * size - 1);

  if (accountKind) q = q.eq("account_kind", accountKind);
  if (type) q = q.eq("type", type);
  if (status) q = q.eq("status", status);
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to);
  if (minEur) q = q.gte("amount_cents", Math.round(Number(minEur) * 100));
  if (maxEur) q = q.lte("amount_cents", Math.round(Number(maxEur) * 100));

  const { data, error, count } = await q;
  if (error) {
    console.error("[/api/admin/stats/transactions] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  return NextResponse.json({ page, size, total: count ?? 0, rows: data ?? [] });
}
```

- [ ] **Step 2: Composant table client**

```tsx
// app/buupp-admin/_components/TransactionsTable.tsx
"use client";
import { useEffect, useState } from "react";

type Tx = {
  id: string;
  account_kind: string;
  type: string;
  status: string;
  amount_cents: number;
  description: string;
  created_at: string;
  campaign_id: string | null;
};

export default function TransactionsTable() {
  const [rows, setRows] = useState<Tx[]>([]);
  const [accountKind, setAccountKind] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ page: "1", size: "50" });
    if (accountKind) params.set("accountKind", accountKind);
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    fetch(`/api/admin/stats/transactions?${params}`).then((r) => r.json()).then((d) => setRows(d.rows ?? []));
  }, [accountKind, type, status]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select value={accountKind} onChange={(e) => setAccountKind(e.target.value)} className="border px-2 py-1 text-sm rounded">
          <option value="">Tous comptes</option><option value="prospect">Prospect</option><option value="pro">Pro</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="border px-2 py-1 text-sm rounded">
          <option value="">Tous types</option>
          {["credit", "escrow", "withdrawal", "topup", "campaign_charge", "referral_bonus", "refund"].map((t) =>
            <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border px-2 py-1 text-sm rounded">
          <option value="">Tous statuts</option>
          {["pending", "completed", "failed", "canceled"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-neutral-500 uppercase">
          <tr><th>Quand</th><th>Compte</th><th>Type</th><th>Statut</th><th className="text-right">Montant €</th><th>Description</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-neutral-100">
              <td className="py-1 text-xs text-neutral-500">{new Date(r.created_at).toLocaleString("fr-FR")}</td>
              <td>{r.account_kind}</td>
              <td>{r.type}</td>
              <td>{r.status}</td>
              <td className="text-right tabular-nums">{(r.amount_cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="truncate max-w-md">{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Page**

```tsx
// app/buupp-admin/transactions/page.tsx
import TransactionsTable from "../_components/TransactionsTable";

export const dynamic = "force-dynamic";

export default function TransactionsAdminPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Journal financier consolidé (prospects + pros). Filtres en haut, 50 lignes max par page.
      </p>
      <TransactionsTable />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/stats/transactions/route.ts \
        app/buupp-admin/_components/TransactionsTable.tsx \
        app/buupp-admin/transactions/page.tsx
git commit -m "feat(admin): transactions section (journal + filters)"
```

---

### Task 6.2 — Page Waitlist (compteurs + bouton lancement)

**Files:**
- Create: `app/buupp-admin/waitlist/page.tsx`
- Create: `app/buupp-admin/_components/WaitlistLaunchButton.tsx`

- [ ] **Step 1: Bouton client (POST avec confirmation)**

```tsx
// app/buupp-admin/_components/WaitlistLaunchButton.tsx
"use client";
import { useState } from "react";

export default function WaitlistLaunchButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function go() {
    if (!confirm("Envoyer le mail de lancement à TOUS les inscrits non encore notifiés ?")) return;
    setBusy(true);
    setResult(null);
    try {
      // Note : la route nécessite x-admin-secret pour l'instant. Tant qu'elle
      // n'est pas migrée vers requireAdminRequest, on ne peut pas l'appeler
      // depuis le navigateur (le secret ne doit pas être exposé). On
      // affiche le curl à exécuter manuellement.
      const cmd =
        "curl -X POST https://VOTRE-DOMAINE/api/admin/waitlist/launch-email " +
        "-H 'x-admin-secret: $BUUPP_ADMIN_SECRET'";
      setResult("Exécuter en CLI :\n" + cmd);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button onClick={go} disabled={busy} className="px-3 py-2 rounded bg-neutral-900 text-white text-sm disabled:opacity-50">
        Envoyer le mail de lancement
      </button>
      {result && <pre className="text-xs bg-neutral-50 border rounded p-2 whitespace-pre-wrap">{result}</pre>}
    </div>
  );
}
```

> Note : on documente le curl pour ne pas exposer `BUUPP_ADMIN_SECRET` côté navigateur. Le wiring "vrai bouton" se fait au Lot 9 quand on aura migré l'endpoint vers `requireAdminRequest` (qui accepte la session Clerk).

- [ ] **Step 2: Page**

```tsx
// app/buupp-admin/waitlist/page.tsx
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import WaitlistLaunchButton from "../_components/WaitlistLaunchButton";

export const dynamic = "force-dynamic";

export default async function WaitlistAdminPage() {
  const admin = createSupabaseAdminClient();
  const { count: total } = await admin.from("waitlist").select("id", { count: "exact", head: true });
  const { count: notified } = await admin
    .from("waitlist").select("id", { count: "exact", head: true })
    .not("launch_email_sent_at", "is", null);
  const { data: topVilles } = await admin
    .from("waitlist").select("ville").not("ville", "is", null).limit(1000);
  const villeCounts: Record<string, number> = {};
  for (const r of topVilles ?? []) villeCounts[r.ville!] = (villeCounts[r.ville!] ?? 0) + 1;
  const top = Object.entries(villeCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const { data: recent } = await admin
    .from("waitlist").select("prenom, email, ville, created_at, ref_code")
    .order("created_at", { ascending: false }).limit(50);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Box label="Total inscrits" value={String(total ?? 0)} />
        <Box label="Mails de lancement envoyés" value={String(notified ?? 0)} />
        <Box label="Restant à notifier" value={String((total ?? 0) - (notified ?? 0))} />
      </div>
      <Section title="Top 10 villes">
        <ul className="text-sm">{top.map(([v, n]) => <li key={v} className="border-b border-neutral-100 py-1 flex justify-between"><span>{v}</span><span className="tabular-nums">{n}</span></li>)}</ul>
      </Section>
      <Section title="Lancement officiel">
        <WaitlistLaunchButton />
      </Section>
      <Section title="50 inscrits les plus récents">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-neutral-500 uppercase"><tr><th>Quand</th><th>Email</th><th>Prénom</th><th>Ville</th><th>RefCode</th></tr></thead>
          <tbody>{(recent ?? []).map((r) => (<tr key={r.email + r.created_at}><td className="py-1 text-xs text-neutral-500">{new Date(r.created_at).toLocaleString("fr-FR")}</td><td>{r.email}</td><td>{r.prenom}</td><td>{r.ville}</td><td>{r.ref_code ?? "—"}</td></tr>))}</tbody>
        </table>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{title}</h2><div className="rounded-lg border border-neutral-200 bg-white p-4">{children}</div></section>;
}
function Box({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-neutral-200 bg-white p-3"><div className="text-xs text-neutral-500">{label}</div><div className="text-lg font-semibold tabular-nums">{value}</div></div>;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/buupp-admin/waitlist/page.tsx app/buupp-admin/_components/WaitlistLaunchButton.tsx
git commit -m "feat(admin): waitlist page (counters + top villes + launch CTA)"
```

---

### Task 6.3 — Page Santé

**Files:**
- Create: `lib/admin/queries/health.ts`
- Create: `app/api/admin/stats/health/route.ts`
- Create: `app/buupp-admin/sante/page.tsx`

- [ ] **Step 1: Helper santé**

```ts
// lib/admin/queries/health.ts
/**
 * Récupère un instantané de la santé technique de la plateforme :
 * compteurs d'events `system.*` sur 24 h, dernières exécutions cron
 * (settle / lifecycle), dernier digest envoyé.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const DAY = 86_400_000;

export type HealthSnapshot = {
  windowHours: number;
  emailFailed24h: number;
  stripeWebhookFailed24h: number;
  cronFailed24h: number;
  lastDigestAt: string | null;
  lastWaitlistLaunchAt: string | null;
};

export async function fetchHealthSnapshot(): Promise<HealthSnapshot> {
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - DAY).toISOString();

  const [emailFailed, stripeFailed, cronFailed, digest, launch] = await Promise.all([
    admin.from("admin_events").select("id", { count: "exact", head: true })
      .eq("type", "system.email_failed").gte("created_at", since),
    admin.from("admin_events").select("id", { count: "exact", head: true })
      .eq("type", "system.stripe_webhook_failed").gte("created_at", since),
    admin.from("admin_events").select("id", { count: "exact", head: true })
      .eq("type", "system.cron_failed").gte("created_at", since),
    admin.from("admin_events").select("created_at")
      .eq("type", "system.digest_sent").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("waitlist").select("launch_email_sent_at")
      .not("launch_email_sent_at", "is", null).order("launch_email_sent_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return {
    windowHours: 24,
    emailFailed24h: emailFailed.count ?? 0,
    stripeWebhookFailed24h: stripeFailed.count ?? 0,
    cronFailed24h: cronFailed.count ?? 0,
    lastDigestAt: digest.data?.created_at ?? null,
    lastWaitlistLaunchAt: launch.data?.launch_email_sent_at ?? null,
  };
}
```

- [ ] **Step 2: Endpoint**

```ts
// app/api/admin/stats/health/route.ts
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { fetchHealthSnapshot } from "@/lib/admin/queries/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;
  const data = await fetchHealthSnapshot();
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
```

- [ ] **Step 3: Page**

```tsx
// app/buupp-admin/sante/page.tsx
import { fetchHealthSnapshot } from "@/lib/admin/queries/health";

export const dynamic = "force-dynamic";

export default async function HealthAdminPage() {
  const h = await fetchHealthSnapshot();
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <Box label="Email failed (24h)" value={h.emailFailed24h} bad={h.emailFailed24h > 0} />
      <Box label="Stripe webhook failed (24h)" value={h.stripeWebhookFailed24h} bad={h.stripeWebhookFailed24h > 0} />
      <Box label="Cron failed (24h)" value={h.cronFailed24h} bad={h.cronFailed24h > 0} />
      <Box label="Dernier digest" value={h.lastDigestAt ? new Date(h.lastDigestAt).toLocaleString("fr-FR") : "Jamais"} />
      <Box label="Dernier mail waitlist" value={h.lastWaitlistLaunchAt ? new Date(h.lastWaitlistLaunchAt).toLocaleString("fr-FR") : "Jamais"} />
    </div>
  );
}
function Box({ label, value, bad }: { label: string; value: number | string; bad?: boolean }) {
  return <div className={`rounded border p-3 ${bad ? "border-rose-300 bg-rose-50" : "border-neutral-200 bg-white"}`}><div className="text-xs text-neutral-500">{label}</div><div className="text-lg font-semibold tabular-nums">{value}</div></div>;
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/admin/queries/health.ts app/api/admin/stats/health/route.ts app/buupp-admin/sante/page.tsx
git commit -m "feat(admin): health section (system events 24h + last cron)"
```

---

## Lot 7 — Live-feed SSE + cloche notifications

### Task 7.1 — Endpoint liste events `GET /api/admin/events`

**Files:**
- Create: `app/api/admin/events/route.ts`

- [ ] **Step 1: Implémenter**

```ts
// app/api/admin/events/route.ts
/**
 * GET /api/admin/events?since=<iso>&severity=&limit=
 * Liste paginée des events admin. `since` filtre `created_at > since`.
 * Plafond 100 par appel.
 */
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const severity = url.searchParams.get("severity");
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));

  const admin = createSupabaseAdminClient();
  let q = admin.from("admin_events").select("*").order("created_at", { ascending: false }).limit(limit);
  if (since) q = q.gt("created_at", since);
  if (severity) q = q.eq("severity", severity);
  const { data, error } = await q;
  if (error) {
    console.error("[/api/admin/events] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  return NextResponse.json({ events: data ?? [] }, { headers: { "cache-control": "no-store" } });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/events/route.ts
git commit -m "feat(admin): GET /api/admin/events list endpoint"
```

---

### Task 7.2 — SSE stream `GET /api/admin/events/stream`

**Files:**
- Create: `app/api/admin/events/stream/route.ts`

- [ ] **Step 1: Implémenter (souscription serveur Realtime + SSE)**

```ts
/**
 * GET /api/admin/events/stream — flux SSE des nouveaux admin_events.
 *
 * Ouvre un canal Supabase Realtime côté serveur (avec service_role) et
 * relaie chaque INSERT vers le navigateur via SSE. Garde la table
 * `admin_events` totalement fermée à toute policy : aucun client direct.
 *
 * Format SSE :
 *   data: {"type":"event","payload":{...}}\n\n
 *   : ping\n\n   (keepalive toutes les 25 s)
 *
 * Le client (cf. LiveFeed.tsx) ouvre une `EventSource` et concatène les
 * events à sa liste locale.
 */
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  const admin = createSupabaseAdminClient();
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(enc.encode(chunk)); } catch { /* socket closed */ }
      };

      // Greeting + initial backlog (10 derniers events) pour combler le SSR.
      send(": connected\n\n");

      admin.from("admin_events").select("*").order("created_at", { ascending: false }).limit(10).then((res) => {
        for (const ev of (res.data ?? []).reverse()) {
          send(`data: ${JSON.stringify({ type: "event", payload: ev })}\n\n`);
        }
      });

      // Souscription Realtime sur les INSERT.
      const channel = admin
        .channel("admin_events_stream")
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "admin_events" },
          (msg) => {
            send(`data: ${JSON.stringify({ type: "event", payload: msg.new })}\n\n`);
          })
        .subscribe();

      // Keepalive 25 s pour traverser les proxies.
      const pingId = setInterval(() => send(`: ping\n\n`), 25_000);

      // Fermeture propre quand le client coupe.
      const onAbort = () => {
        if (closed) return;
        closed = true;
        clearInterval(pingId);
        admin.removeChannel(channel).catch(() => {});
        try { controller.close(); } catch { /* already closed */ }
      };
      req.signal.addEventListener("abort", onAbort);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/events/stream/route.ts
git commit -m "feat(admin): SSE stream of admin_events backed by Realtime"
```

---

### Task 7.3 — Composant `LiveFeed` + intégration vue d'ensemble

**Files:**
- Create: `app/buupp-admin/_components/LiveFeed.tsx`
- Modify: `app/buupp-admin/page.tsx` (ajout panneau droit)

- [ ] **Step 1: Composant client**

```tsx
// app/buupp-admin/_components/LiveFeed.tsx
"use client";
import { useEffect, useState } from "react";

type AdminEvent = {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  payload: Record<string, unknown>;
  created_at: string;
};

const TONE: Record<string, string> = {
  info: "border-l-neutral-300 bg-white",
  warning: "border-l-amber-400 bg-amber-50",
  critical: "border-l-rose-500 bg-rose-50",
};

export default function LiveFeed() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    const es = new EventSource("/api/admin/events/stream");
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "event") {
          setEvents((cur) => [msg.payload, ...cur].slice(0, 200));
        }
      } catch { /* ignore */ }
    };
    es.onerror = () => {
      // Laisser EventSource gérer la reconnexion auto.
    };
    return () => es.close();
  }, []);

  const visible = filter ? events.filter((e) => e.severity === filter) : events;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 max-h-[600px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium">Live feed</div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="text-xs border px-2 py-1 rounded">
          <option value="">Tout</option><option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option>
        </select>
      </div>
      <ul className="space-y-1 overflow-auto">
        {visible.map((e) => (
          <li key={e.id} className={`border-l-4 ${TONE[e.severity]} px-2 py-1 text-xs`}>
            <div className="flex justify-between">
              <span className="font-mono">{e.type}</span>
              <span className="text-neutral-500">{new Date(e.created_at).toLocaleTimeString("fr-FR")}</span>
            </div>
            {Object.keys(e.payload).length > 0 && (
              <pre className="text-[10px] text-neutral-600 truncate">{JSON.stringify(e.payload)}</pre>
            )}
          </li>
        ))}
        {visible.length === 0 && <li className="text-xs text-neutral-500">Aucun event pour le moment.</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Intégrer dans `page.tsx`**

Modifier le JSX racine pour avoir une grille à 2 colonnes (KPI + chart à gauche, LiveFeed à droite) :

```tsx
import LiveFeed from "./_components/LiveFeed";

// … wrap le retour existant :
return (
  <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
    <div className="space-y-6">
      {/* … existing sections (KPI bandeau + 3 timeseries) … */}
    </div>
    <aside><LiveFeed /></aside>
  </div>
);
```

- [ ] **Step 3: Vérification**

Insérer un event manuellement. Deux options :

**Via le SQL Editor Supabase** (aucune env locale requise) :

```sql
insert into admin_events(type, severity, payload)
values ('test.manual', 'info', '{"hello":"world"}'::jsonb);
```

**Via curl + service_role** :

```bash
curl -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/admin_events" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"test.manual","severity":"info","payload":{"hello":"world"}}'
```

Le live-feed doit afficher la ligne en quasi temps-réel sur `/buupp-admin`.

- [ ] **Step 4: Commit**

```bash
git add app/buupp-admin/_components/LiveFeed.tsx app/buupp-admin/page.tsx
git commit -m "feat(admin): LiveFeed via EventSource + integration in overview"
```

---

### Task 7.4 — Mark-as-read endpoint + cloche

**Files:**
- Create: `app/api/admin/events/[id]/read/route.ts`
- Create: `app/buupp-admin/_components/NotificationBell.tsx`
- Modify: `app/buupp-admin/_components/AdminShell.tsx` (placer la cloche en topbar)

- [ ] **Step 1: Endpoint mark-as-read (PATCH `read_by`)**

```ts
// app/api/admin/events/[id]/read/route.ts
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createSupabaseAdminClient();
  // jsonb_set sans aller-retour : on lit, on merge, on écrit. Plus simple
  // qu'une RPC pour 1 ligne ; pas de race critique (1 user marque pour lui-même).
  const { data: row } = await admin.from("admin_events").select("read_by").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const next = { ...(row.read_by as Record<string, string>), [userId]: new Date().toISOString() };
  const { error } = await admin.from("admin_events").update({ read_by: next }).eq("id", id);
  if (error) return NextResponse.json({ error: "write_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Cloche notifs (compteur non-lus côté admin courant)**

```tsx
// app/buupp-admin/_components/NotificationBell.tsx
"use client";
import { useEffect, useState } from "react";

type AdminEvent = {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  read_by: Record<string, string>;
  created_at: string;
};

export default function NotificationBell({ adminUserId }: { adminUserId: string }) {
  const [events, setEvents] = useState<AdminEvent[]>([]);

  useEffect(() => {
    fetch("/api/admin/events?limit=100").then((r) => r.json()).then((d) => setEvents(d.events ?? []));
    const es = new EventSource("/api/admin/events/stream");
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "event") setEvents((cur) => [msg.payload, ...cur].slice(0, 200));
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, []);

  const unread = events.filter((e) => !e.read_by?.[adminUserId]);

  async function markAll() {
    await Promise.all(unread.map((e) => fetch(`/api/admin/events/${e.id}/read`, { method: "POST" })));
    setEvents((cur) =>
      cur.map((e) => ({ ...e, read_by: { ...(e.read_by || {}), [adminUserId]: new Date().toISOString() } })));
  }

  return (
    <div className="relative">
      <button onClick={markAll} className="relative px-3 py-1.5 rounded border border-neutral-300 text-sm bg-white">
        🔔 {unread.length > 0 && <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-xs rounded-full w-5 h-5 grid place-items-center">{unread.length}</span>}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Modifier `AdminShell.tsx` pour passer le userId Clerk**

Dans `layout.tsx`, récupérer le `userId` (déjà fait par `requireAdminUserOrNotFound`) et le passer à `AdminShell` :

```tsx
// app/buupp-admin/layout.tsx (extrait)
const { userId, email } = await requireAdminUserOrNotFound();
return <AdminShell adminEmail={email} adminUserId={userId}>{children}</AdminShell>;
```

```tsx
// app/buupp-admin/_components/AdminShell.tsx (signature + JSX)
import NotificationBell from "./NotificationBell";

export default function AdminShell({
  adminEmail, adminUserId, children,
}: {
  adminEmail: string;
  adminUserId: string;
  children: React.ReactNode;
}) {
  // … sidebar inchangée …
  // Topbar :
  return (
    <div className="… (idem) …">
      <aside>…</aside>
      <main className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">{/* … */}</h1>
          <div className="flex items-center gap-2">
            <NotificationBell adminUserId={adminUserId} />
            <PeriodPicker />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/events/[id]/read/route.ts \
        app/buupp-admin/_components/NotificationBell.tsx \
        app/buupp-admin/_components/AdminShell.tsx \
        app/buupp-admin/layout.tsx
git commit -m "feat(admin): notification bell + per-admin mark-as-read"
```

---

## Lot 8 — Mails admin (critical immédiat + digest cron)

### Task 8.1 — Templates mail `lib/email/admin-alert.ts` + `admin-digest.ts`

**Files:**
- Create: `lib/email/admin-alert.ts`
- Create: `lib/email/admin-digest.ts`

- [ ] **Step 1: `admin-alert.ts` (1 mail par event critical)**

```ts
/**
 * Mail d'alerte critique destiné aux admins (allowlist `ADMIN_EMAILS`).
 * Envoyé immédiatement (pas de digest) à chaque event severity = 'critical'.
 *
 * Si SMTP n'est pas configuré (cf. `lib/email/transport.ts`) ou si
 * `ADMIN_EMAILS` est vide, on log et on revient sans erreur.
 */
import { getFromAddress, getTransport } from "./transport";

export type AdminAlertParams = {
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export async function sendAdminCriticalAlert(p: AdminAlertParams): Promise<void> {
  const transport = getTransport();
  if (!transport) return;
  const recipients = (process.env.ADMIN_EMAILS ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (recipients.length === 0) {
    console.warn("[email/admin-alert] ADMIN_EMAILS vide — skip");
    return;
  }
  const subject = `[BUUPP CRITICAL] ${p.type}`;
  const text = [
    `Évènement critique détecté : ${p.type}`,
    `Reçu : ${p.createdAt}`,
    "",
    "Payload :",
    JSON.stringify(p.payload, null, 2),
    "",
    "Ouvrir le dashboard : /buupp-admin",
  ].join("\n");
  try {
    await transport.sendMail({
      from: getFromAddress(),
      to: recipients.join(", "),
      subject,
      text,
    });
  } catch (err) {
    console.error("[email/admin-alert] sendMail failed", err);
  }
}
```

- [ ] **Step 2: `admin-digest.ts` (groupage)**

```ts
/**
 * Mail digest destiné aux admins. Deux usages :
 *   - severity = 'warning' → digest horaire (cron à :55)
 *   - severity = 'info' → digest 2× par jour (cron à 08:00 et 18:00)
 *
 * Le contenu est un tableau "type → count" + 5 derniers events bruts par
 * type. Si aucun event sur la fenêtre, on n'envoie rien (return silent).
 */
import type { Database } from "@/lib/supabase/types";
import { getFromAddress, getTransport } from "./transport";

type EventRow = Database["public"]["Tables"]["admin_events"]["Row"];

export async function sendAdminDigest(params: {
  severity: "warning" | "info";
  windowStart: Date;
  windowEnd: Date;
  events: EventRow[];
}): Promise<void> {
  const { severity, windowStart, windowEnd, events } = params;
  if (events.length === 0) return;
  const transport = getTransport();
  if (!transport) return;
  const recipients = (process.env.ADMIN_EMAILS ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (recipients.length === 0) return;

  const byType = new Map<string, EventRow[]>();
  for (const e of events) {
    const arr = byType.get(e.type) ?? [];
    arr.push(e);
    byType.set(e.type, arr);
  }

  const lines: string[] = [];
  lines.push(`Digest BUUPP admin — sévérité ${severity}`);
  lines.push(`Fenêtre : ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);
  lines.push(`Total : ${events.length} events`);
  lines.push("");
  for (const [type, arr] of [...byType.entries()].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`• ${type} — ${arr.length}`);
    for (const e of arr.slice(0, 5)) {
      lines.push(`    - ${e.created_at} ${JSON.stringify(e.payload).slice(0, 160)}`);
    }
  }
  lines.push("");
  lines.push("Voir le dashboard : /buupp-admin");

  const subject = `[BUUPP DIGEST ${severity.toUpperCase()}] ${events.length} events`;

  try {
    await transport.sendMail({
      from: getFromAddress(),
      to: recipients.join(", "),
      subject,
      text: lines.join("\n"),
    });
  } catch (err) {
    console.error("[email/admin-digest] sendMail failed", err);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/email/admin-alert.ts lib/email/admin-digest.ts
git commit -m "feat(admin): admin-alert + admin-digest email templates"
```

---

### Task 8.2 — Brancher l'envoi critical sur `recordEvent`

**Files:**
- Modify: `lib/admin/events/record.ts`
- Test: `tests/lib/admin/events/record.test.ts` (ajouter un cas)

- [ ] **Step 1: Étendre le test**

Ajouter dans `tests/lib/admin/events/record.test.ts` :

```ts
import { sendAdminCriticalAlert } from "@/lib/email/admin-alert";
vi.mock("@/lib/email/admin-alert", () => ({
  sendAdminCriticalAlert: vi.fn(async () => {}),
}));

it("envoie un mail critical quand severity = critical", async () => {
  await recordEvent({
    type: "system.cron_failed",
    severity: "critical",
    payload: { what: "settle" },
  });
  // Le mail est fire-and-forget → micro-tâche, on attend une tick.
  await new Promise((r) => setTimeout(r, 0));
  expect(sendAdminCriticalAlert).toHaveBeenCalledWith({
    type: "system.cron_failed",
    payload: { what: "settle" },
    createdAt: expect.any(String),
  });
});

it("n'envoie PAS de mail pour severity info ou warning", async () => {
  (sendAdminCriticalAlert as any).mockClear();
  await recordEvent({ type: "prospect.signup" });
  await recordEvent({ type: "relation.expired", severity: "warning" });
  await new Promise((r) => setTimeout(r, 0));
  expect(sendAdminCriticalAlert).not.toHaveBeenCalled();
});

it("ne déclenche JAMAIS de mail pour system.email_failed (anti-boucle)", async () => {
  (sendAdminCriticalAlert as any).mockClear();
  await recordEvent({ type: "system.email_failed", severity: "warning" });
  await new Promise((r) => setTimeout(r, 0));
  expect(sendAdminCriticalAlert).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Modifier `lib/admin/events/record.ts`**

Avant le `return`, après l'INSERT, ajouter :

```ts
// Critical → mail immédiat (fire-and-forget). Garde anti-boucle :
// les events `system.email_failed` ne doivent JAMAIS déclencher d'envoi
// (sinon on aggrave la panne SMTP qu'on essaie de tracer).
if (input.severity === "critical" && input.type !== "system.email_failed") {
  void import("@/lib/email/admin-alert").then(({ sendAdminCriticalAlert }) =>
    sendAdminCriticalAlert({
      type: input.type,
      payload: input.payload ?? {},
      createdAt: new Date().toISOString(),
    }),
  );
}
```

- [ ] **Step 3: Re-run tests**

Run: `npm test -- tests/lib/admin/events/record.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 4: Commit**

```bash
git add lib/admin/events/record.ts tests/lib/admin/events/record.test.ts
git commit -m "feat(admin): wire recordEvent → sendAdminCriticalAlert (anti-loop guard)"
```

---

### Task 8.3 — Endpoint cron digest `POST /api/admin/digest`

**Files:**
- Create: `app/api/admin/digest/route.ts`

- [ ] **Step 1: Implémenter**

```ts
/**
 * POST /api/admin/digest?severity=warning|info
 *
 * Cron : warning toutes les heures (à :55), info à 08:00 et 18:00.
 * Lit les events de la fenêtre [now - durée, now[ correspondante,
 * envoie un mail de digest si non vide, et trace `system.digest_sent`
 * pour la page Santé.
 *
 * Auth : x-admin-secret (le cron tourne sans session Clerk).
 */
import { NextResponse } from "next/server";
import { hasAdminSecret } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendAdminDigest } from "@/lib/email/admin-digest";
import { recordEvent } from "@/lib/admin/events/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR = 3_600_000;
const TWELVE_HOURS = 12 * HOUR;

export async function POST(req: Request) {
  if (!hasAdminSecret(req)) return new Response("Not Found", { status: 404 });

  const url = new URL(req.url);
  const severity = url.searchParams.get("severity");
  if (severity !== "warning" && severity !== "info") {
    return NextResponse.json({ error: "bad_severity" }, { status: 400 });
  }

  const now = new Date();
  const windowMs = severity === "warning" ? HOUR : TWELVE_HOURS;
  const start = new Date(now.getTime() - windowMs);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("admin_events")
    .select("*")
    .eq("severity", severity)
    .gte("created_at", start.toISOString())
    .lt("created_at", now.toISOString())
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[/api/admin/digest] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  await sendAdminDigest({
    severity,
    windowStart: start,
    windowEnd: now,
    events: data ?? [],
  });

  void recordEvent({
    type: "system.digest_sent",
    severity: "info",
    payload: { severity, count: data?.length ?? 0 },
  });

  return NextResponse.json({ severity, count: data?.length ?? 0 });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/digest/route.ts
git commit -m "feat(admin): POST /api/admin/digest (warning hourly / info 2x daily)"
```

---

### Task 8.4 — Cron Vercel

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Créer `vercel.json` (ajouter l'auth via header — Vercel cron met automatiquement le user-agent et un secret côté Vercel ; on utilise `x-admin-secret` via redirect interne)**

> Note Vercel : l'authentification cron native passe par le header `Authorization: Bearer $CRON_SECRET`. Pour rester homogène avec `x-admin-secret`, on fait un petit handler-relais OU on accepte AUSSI `Authorization: Bearer` dans `hasAdminSecret`. Choix le plus simple ici : élargir `hasAdminSecret`.

Modifier `lib/admin/access.ts` (ajout dans `hasAdminSecret`) :

```ts
export function hasAdminSecret(req: Request): boolean {
  const expected = process.env.BUUPP_ADMIN_SECRET;
  if (!expected) return false;
  const provided =
    req.headers.get("x-admin-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
  return Boolean(provided) && provided === expected;
}
```

Puis créer `vercel.json` :

```json
{
  "crons": [
    { "path": "/api/admin/digest?severity=warning", "schedule": "55 * * * *" },
    { "path": "/api/admin/digest?severity=info", "schedule": "0 8,18 * * *" }
  ]
}
```

> Configuration : sur Vercel → Settings → Environment Variables, définir `BUUPP_ADMIN_SECRET` ET `CRON_SECRET = <même valeur>`. Vercel injecte automatiquement `Authorization: Bearer $CRON_SECRET` aux requêtes cron.

- [ ] **Step 2: Commit**

```bash
git add vercel.json lib/admin/access.ts
git commit -m "feat(admin): vercel cron for warning/info digests + Bearer auth alias"
```

---

## Lot 9 — Wiring `recordEvent` + polish

### Task 9.1 — Brancher `recordEvent` dans `ensureProspect` / `ensureProAccount`

**Files:**
- Modify: `lib/sync/prospects.ts`
- Modify: `lib/sync/pro-accounts.ts`

- [ ] **Step 1: `lib/sync/prospects.ts` — après l'INSERT dans `prospects`**

Juste avant `return created.id;`, ajouter :

```ts
void (async () => {
  const { recordEvent } = await import("@/lib/admin/events/record");
  await recordEvent({
    type: "prospect.signup",
    prospectId: created.id,
    payload: { email: input.email ?? null },
  });
})();
```

- [ ] **Step 2: `lib/sync/pro-accounts.ts` — symétrique**

Juste avant `return created.id;`, ajouter :

```ts
void (async () => {
  const { recordEvent } = await import("@/lib/admin/events/record");
  await recordEvent({
    type: "pro.signup",
    proAccountId: created.id,
    payload: { email: input.email ?? null },
  });
})();
```

- [ ] **Step 3: Commit**

```bash
git add lib/sync/prospects.ts lib/sync/pro-accounts.ts
git commit -m "feat(admin): emit prospect.signup / pro.signup events"
```

---

### Task 9.2 — Brancher `recordEvent` dans waitlist + lifecycle + settle

**Files:**
- Modify: `app/api/waitlist/route.ts`
- Modify: `lib/lifecycle/campaign.ts`
- Modify: `lib/settle/ripe.ts`

- [ ] **Step 1: Waitlist (après l'INSERT réussi)**

Dans `app/api/waitlist/route.ts`, juste après l'INSERT en base avant le retour HTTP, ajouter :

```ts
void (async () => {
  const { recordEvent } = await import("@/lib/admin/events/record");
  await recordEvent({
    type: "waitlist.signup",
    payload: { email, ville },
  });
})();
```

- [ ] **Step 2: Lifecycle des campagnes**

Dans `lib/lifecycle/campaign.ts`, après le bloc qui bascule des campagnes en `completed`, itérer sur `data` et émettre :

```ts
if (closedCampaigns?.length) {
  void (async () => {
    const { recordEvent } = await import("@/lib/admin/events/record");
    for (const c of closedCampaigns) {
      await recordEvent({ type: "campaign.completed", campaignId: c.id });
    }
  })();
}
```

(adapter le nom de la variable `closedCampaigns` à ce qui existe dans le fichier — on garde la sémantique).

- [ ] **Step 3: Settle ripe relations**

Dans `lib/settle/ripe.ts`, dans la boucle qui itère sur les rows settled :

```ts
void (async () => {
  const { recordEvent } = await import("@/lib/admin/events/record");
  for (const r of rows) {
    await recordEvent({
      type: "relation.settled",
      relationId: r.id,
      payload: { rewardCents: Number(r.reward_cents) },
    });
  }
})();
```

- [ ] **Step 4: Commit**

```bash
git add app/api/waitlist/route.ts lib/lifecycle/campaign.ts lib/settle/ripe.ts
git commit -m "feat(admin): emit waitlist/campaign.completed/relation.settled events"
```

---

### Task 9.3 — Brancher `recordEvent` dans Stripe webhook + payouts + tier

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`
- Modify: `app/api/prospect/payout/route.ts`
- Modify: `app/api/prospect/tier/route.ts`

- [ ] **Step 1: Stripe webhook**

Dans `app/api/stripe/webhook/route.ts`, dans le switch `event.type` :

```ts
// Au début du handler, après `event` validé :
const recordAdmin = (await import("@/lib/admin/events/record")).recordEvent;

// Dans chaque branche pertinente :
//  - case "checkout.session.completed" / "payment_intent.succeeded" → topup
void recordAdmin({ type: "transaction.topup", proAccountId, payload: { amountCents } });
//  - case "customer.subscription.updated" si status devient past_due
void recordAdmin({ type: "pro.billing.past_due", severity: "critical", proAccountId });
//  - canceled
void recordAdmin({ type: "pro.billing.canceled", severity: "warning", proAccountId });
//  - dans le catch global du webhook (avant le 500) :
void recordAdmin({ type: "system.stripe_webhook_failed", severity: "critical", payload: { message: String(err) } });
```

(adapter aux noms de variables et chemins de switch existants).

- [ ] **Step 2: Payout prospect**

Dans `app/api/prospect/payout/route.ts`, après le succès du transfer Stripe Connect :

```ts
void (await import("@/lib/admin/events/record")).recordEvent({
  type: "transaction.withdrawal",
  prospectId,
  payload: { amountCents },
});
```

- [ ] **Step 3: Tier completed**

Dans `app/api/prospect/tier/route.ts`, après un succès (palier rempli ou supprimé) :

```ts
void (await import("@/lib/admin/events/record")).recordEvent({
  type: "prospect.tier_completed",
  prospectId,
  payload: { tier, action },
});
```

- [ ] **Step 4: Commit**

```bash
git add app/api/stripe/webhook/route.ts app/api/prospect/payout/route.ts app/api/prospect/tier/route.ts
git commit -m "feat(admin): emit stripe/payout/tier events"
```

---

### Task 9.4 — Brancher `system.email_failed` dans le transport

**Files:**
- Modify: `lib/email/transport.ts`

- [ ] **Step 1: Wrapper `sendMail` en safe-mode**

Plutôt que de modifier chaque template, ajouter une utility export qui wrap les appels sendMail. Comme tous les templates appellent `transport.sendMail({...})` directement, on les laisse — ils ont chacun un try/catch qui log. On modifie chaque template pour qu'il appelle aussi `recordEvent("system.email_failed", warning)` dans le catch.

Pour éviter de modifier chaque fichier, on ajoute un helper `safeSendMail` dans `lib/email/transport.ts` :

```ts
import type { SendMailOptions } from "nodemailer";

export async function safeSendMail(opts: SendMailOptions): Promise<void> {
  const transport = getTransport();
  if (!transport) return;
  try {
    await transport.sendMail(opts);
  } catch (err) {
    console.error("[email/transport] sendMail failed", err);
    void (async () => {
      const { recordEvent } = await import("@/lib/admin/events/record");
      await recordEvent({
        type: "system.email_failed",
        severity: "warning",
        payload: { subject: String(opts.subject ?? ""), to: String(opts.to ?? ""), err: String(err) },
      });
    })();
  }
}
```

(les templates existants peuvent continuer à appeler `transport.sendMail` directement ; les **nouveaux** templates `admin-alert` et `admin-digest` s'en servent déjà via try/catch. La migration progressive des autres templates vers `safeSendMail` est hors scope V1 — flag dans `Open questions` du spec).

- [ ] **Step 2: Commit**

```bash
git add lib/email/transport.ts
git commit -m "feat(admin): safeSendMail helper that emits system.email_failed"
```

---

### Task 9.5 — Cache léger overview + rate-limit basique

**Files:**
- Create: `lib/admin/rate-limit.ts`
- Modify: `app/api/admin/stats/overview/route.ts`
- Modify: `lib/admin/queries/overview.ts` (ajouter cache 30 s)

- [ ] **Step 1: Cache 30 s sur overview**

Dans `lib/admin/queries/overview.ts`, en haut, ajouter un cache mémoire simple :

```ts
const cache = new Map<string, { at: number; data: OverviewKpis }>();
const TTL_MS = 30_000;

// Wrapper :
export async function fetchOverviewKpisCached(range: DateRange): Promise<OverviewKpis> {
  const key = `${range.start.toISOString()}|${range.end.toISOString()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const data = await fetchOverviewKpis(range);
  cache.set(key, { at: Date.now(), data });
  return data;
}
```

Et utiliser `fetchOverviewKpisCached` dans `app/api/admin/stats/overview/route.ts` ET dans `app/buupp-admin/page.tsx`.

- [ ] **Step 2: Rate-limit (in-memory, par IP)**

```ts
// lib/admin/rate-limit.ts
/**
 * Rate-limit naïf in-memory (60 req/min/IP). Suffit en V1 pour empêcher
 * un scrap massif si une session admin est volée. À remplacer par
 * Upstash/Redis si on déploie sur plusieurs instances.
 */
const buckets = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const LIMIT = 60;

export function rateLimit(req: Request): Response | null {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const now = Date.now();
  const arr = (buckets.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= LIMIT) {
    return new Response("Too Many Requests", { status: 429 });
  }
  arr.push(now);
  buckets.set(ip, arr);
  return null;
}
```

Et l'appliquer dans tous les `/api/admin/stats/**` et `/api/admin/events/**` :

```ts
import { rateLimit } from "@/lib/admin/rate-limit";

// Tout en haut de chaque GET/POST :
const limited = rateLimit(req);
if (limited) return limited;
```

- [ ] **Step 3: Commit**

```bash
git add lib/admin/rate-limit.ts lib/admin/queries/overview.ts \
        app/api/admin/stats/overview/route.ts app/api/admin/stats/overview/timeseries/route.ts \
        app/api/admin/stats/prospects/route.ts app/api/admin/stats/prospects/list/route.ts \
        app/api/admin/stats/pros/route.ts app/api/admin/stats/pros/list/route.ts \
        app/api/admin/stats/campaigns/route.ts app/api/admin/stats/transactions/route.ts \
        app/api/admin/stats/health/route.ts \
        app/api/admin/events/route.ts app/api/admin/events/[id]/read/route.ts \
        app/buupp-admin/page.tsx
git commit -m "feat(admin): overview cache 30s + naive rate-limit 60req/min/IP"
```

---

### Task 9.6 — README admin + `.env.example` complet

**Files:**
- Create: `docs/admin-setup.md`
- Modify: `.env.example`

- [ ] **Step 1: `.env.example`**

S'assurer qu'il contient (créer ou compléter) :

```
# ─── Back-office admin /buupp-admin ─────────────────────────────────
# Liste blanche d'emails admin (séparés par virgule, insensible à la casse).
# FAIL-CLOSED : si vide, personne ne peut accéder au dashboard.
ADMIN_EMAILS=jjlex64@gmail.com

# Secret partagé pour les déclencheurs machine (cron Vercel, scripts CLI).
# Vercel injecte automatiquement Authorization: Bearer $CRON_SECRET pour
# les jobs cron — mettre la même valeur dans CRON_SECRET côté Vercel.
BUUPP_ADMIN_SECRET=change-me-long-random-string
CRON_SECRET=change-me-long-random-string

# Take-rate utilisé pour estimer le revenu BUUPP affiché.
# Float entre 0 et 1. Defaut : 0.20.
BUUPP_TAKE_RATE=0.20
```

- [ ] **Step 2: `docs/admin-setup.md`**

```md
# Setup back-office BUUPP

## 1. Variables d'environnement

| Variable | Rôle |
|---|---|
| `ADMIN_EMAILS` | Liste blanche (CSV) des emails ayant accès à `/buupp-admin`. Fail-closed. |
| `BUUPP_ADMIN_SECRET` | Secret partagé pour les routes machine (`/api/admin/digest`, `/api/admin/waitlist/launch-email`). |
| `CRON_SECRET` | Mêmevaleur que `BUUPP_ADMIN_SECRET` — Vercel l'injecte en `Authorization: Bearer` sur les requêtes cron. |
| `BUUPP_TAKE_RATE` | Float, par défaut 0.20. Multiplié par `sum(transactions.campaign_charge)` pour le KPI "Revenu BUUPP". |

## 2. Migrations SQL

```bash
npx supabase db push
npx supabase gen types typescript --linked > lib/supabase/types.ts
```

Vérifier que `admin_events` est dans la publication `supabase_realtime` (la migration le fait, mais à re-vérifier en cas de doute) :

```sql
select * from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'admin_events';
```

## 3. Cron Vercel

`vercel.json` déclare deux crons. Sur Vercel → Settings → Environment Variables :
- `BUUPP_ADMIN_SECRET` = la même valeur en prod et preview
- `CRON_SECRET` = idem

## 4. Premier accès

1. Se connecter sur le site avec un email présent dans `ADMIN_EMAILS`.
2. Aller sur `https://<domaine>/buupp-admin`.
3. La sidebar doit s'afficher. Sinon → vérifier l'env + redéployer.

## 5. Réception des mails

- Critical → mail immédiat à toute la liste `ADMIN_EMAILS` via SMTP Gmail (`SMTP_USER` / `SMTP_PASS`).
- Warning → digest horaire par cron Vercel.
- Info → digest 2× par jour (08h / 18h Paris).

Si aucun mail n'arrive : vérifier `SMTP_USER` / `SMTP_PASS` (cf. `lib/email/transport.ts`) et la page `/buupp-admin/sante` (compteur "email failed 24h").
```

- [ ] **Step 3: Commit**

```bash
git add docs/admin-setup.md .env.example
git commit -m "docs(admin): setup README + .env.example for /buupp-admin"
```

---

### Task 9.7 — Vérification finale end-to-end

- [ ] **Step 1: Lancer l'app et faire un parcours complet**

```bash
npm run dev
```

Checklist manuelle :

- [ ] `/buupp-admin` non connecté → 404.
- [ ] Connecté avec un email non listé → 404.
- [ ] Connecté avec `ADMIN_EMAILS[0]` → dashboard rendu, sidebar OK.
- [ ] `/buupp-admin?period=30d` → KPI bandeau + 3 graphes + LiveFeed (vide).
- [ ] Insérer un event manuellement (cf. Task 7.3) → apparaît dans le LiveFeed sous 1 s.
- [ ] Cliquer la cloche → mark-as-read, le compteur passe à 0.
- [ ] `/buupp-admin/prospects` → funnel + distributions + table prospects.
- [ ] Cliquer un prospect → fiche read-only.
- [ ] `/buupp-admin/pros`, `/campagnes`, `/transactions`, `/waitlist`, `/sante` → toutes rendent.
- [ ] Changer `?period=` dans l'URL → toutes les sections respectent la période.
- [ ] `curl -X POST -H "Authorization: Bearer $BUUPP_ADMIN_SECRET" http://localhost:3000/api/admin/digest?severity=info` → réponse 200, mail reçu si SMTP configuré.
- [ ] Robots.txt / metadata → `view-source:/buupp-admin` contient `<meta name="robots" content="noindex, nofollow">`.

- [ ] **Step 2: Lancer la suite Vitest complète**

```bash
npm test
```
Expected: tous les tests PASS.

- [ ] **Step 3: Commit "checkpoint" si nécessaire (sinon rien à committer)**

---

## Récapitulatif des fichiers créés / modifiés

**Créés** (≈ 35) :
- `vitest.config.ts`, `tests/setup.ts`, `tests/lib/admin/access.test.ts`, `tests/lib/admin/events/record.test.ts`, `tests/lib/admin/periods.test.ts`, `tests/lib/admin/queries/overview.test.ts`
- `supabase/migrations/20260510{120000,130000,140000,150000,160000,170000}_*.sql`
- `lib/admin/access.ts`, `lib/admin/periods.ts`, `lib/admin/rate-limit.ts`
- `lib/admin/events/record.ts`
- `lib/admin/queries/{overview,overview-timeseries,prospects,pros,campaigns,health}.ts`
- `lib/email/{admin-alert,admin-digest}.ts`
- `app/buupp-admin/{layout,page}.tsx`
- `app/buupp-admin/{prospects,pros,campagnes,transactions,waitlist,sante}/page.tsx`
- `app/buupp-admin/{prospects,pros,campagnes}/[id]/page.tsx`
- `app/buupp-admin/_components/{AdminShell,PeriodPicker,KpiCard,Sparkline,Delta,TimeseriesChart,LiveFeed,NotificationBell,ProspectsTable,ProsTable,TransactionsTable,WaitlistLaunchButton}.tsx`
- `app/api/admin/stats/{overview,overview/timeseries,prospects,prospects/list,pros,pros/list,campaigns,transactions,health}/route.ts`
- `app/api/admin/events/{route,stream,[id]/read}.ts`
- `app/api/admin/digest/route.ts`
- `vercel.json`, `docs/admin-setup.md`, `.env.example`

**Modifiés** (≈ 8) :
- `package.json` (script `test`, deps Vitest)
- `proxy.ts` (garde `/buupp-admin`)
- `lib/email/transport.ts` (ajout `safeSendMail`)
- `lib/sync/{prospects,pro-accounts}.ts` (emit signup events)
- `app/api/waitlist/route.ts`, `lib/lifecycle/campaign.ts`, `lib/settle/ripe.ts` (emit events)
- `app/api/stripe/webhook/route.ts`, `app/api/prospect/{payout,tier}/route.ts` (emit events)
- `lib/supabase/types.ts` (regen après chaque migration)

