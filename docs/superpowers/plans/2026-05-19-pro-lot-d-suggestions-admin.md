# Espace Pro — Lot D : suggestions persistées + triage admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persister chaque suggestion utilisateur en base et offrir une page admin de triage (liste + filtres + KPIs + actions lu/résolu/rouvrir), l'e-mail devenant une notification best-effort.

**Architecture:** Nouvelle table `public.suggestions` (service_role only) ; `POST /api/me/suggestions` insère la row après tentative e-mail non bloquante ; module `lib/admin/queries/suggestions.ts` + page server `/buupp-admin/suggestions` + `PATCH /api/admin/suggestions`, calqués 1:1 sur le pattern existant `signalements`/`reports`.

**Tech Stack:** Next.js 16 (App Router, server components), Supabase (service_role client), Clerk auth, Vitest (tests `lib/` uniquement), TypeScript strict.

**Référence spec :** `docs/superpowers/specs/2026-05-19-pro-lot-d-suggestions-admin-design.md`

**Notes transverses :**
- `POST /api/me/suggestions` est **partagé avec le mobile** ; le contrat de réponse (`{ ok:true }`) ne change pas → aucune modif mobile. Effet de bord positif : suggestions mobiles aussi capturées.
- La migration porte sur la **base partagée** (prod commune web/mobile). Application **manuelle** via SQL Editor Supabase + `supabase migration repair`, **jamais `db push`** (local/remote divergés — cf. mémoire `supabase-migrations`).
- Le prototype/pages ne sont pas testés unitairement (cohérent repo) ; seul `lib/admin/queries/suggestions.ts` est testé (TDD), comme `reports.ts`.

---

## File Structure

- Create: `supabase/migrations/<YYYYMMDDHHMMSS>_user_suggestions.sql` — table `suggestions`.
- Create: `lib/admin/queries/suggestions.ts` — lecture admin (liste + KPIs).
- Create: `tests/lib/admin/queries/suggestions.test.ts` — tests TDD du module ci-dessus.
- Modify: `lib/email/user-suggestion.ts` — retour `{ ok, messageId? }`, destinataire `BUUPP_SUGGESTIONS_INBOX` || `ADMIN_EMAILS`.
- Modify: `app/api/me/suggestions/route.ts` — persistance + e-mail best-effort + `recordEvent`.
- Create: `app/api/admin/suggestions/route.ts` — `PATCH` mark-read/resolve/reopen.
- Create: `app/buupp-admin/suggestions/page.tsx` — page de triage.
- Create: `app/buupp-admin/suggestions/_components/SuggestionCard.tsx` — carte item.
- Create: `app/buupp-admin/suggestions/_components/SuggestionActions.tsx` — boutons client (calque `ResolveButton`).
- Modify: `app/buupp-admin/_components/AdminShell.tsx:9-21` — ajout entrée nav « Suggestions ».

---

## Task 1: Migration table `suggestions`

**Files:**
- Create: `supabase/migrations/<YYYYMMDDHHMMSS>_user_suggestions.sql`

- [ ] **Step 1: Générer le timestamp et créer le fichier**

Run: `date -u +%Y%m%d%H%M%S`
Utiliser la valeur obtenue comme `<TS>`. Créer `supabase/migrations/<TS>_user_suggestions.sql` avec EXACTEMENT ce contenu :

```sql
-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Suggestions/feedback utilisateurs (onglet « Vos suggestions »)
-- ════════════════════════════════════════════════════════════════════
-- Append-only. Insérée par POST /api/me/suggestions après tentative
-- d'envoi e-mail (réussie ou non). Lue par /buupp-admin/suggestions.
-- RLS activé, AUCUNE policy → accès service_role uniquement (pattern
-- relation_reports).
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  from_email text,
  from_name  text,
  from_role  text check (from_role is null or from_role in ('prospect','pro')),
  subject    text check (subject is null or length(subject) <= 120),
  message    text not null check (length(message) <= 4000),
  email_sent_at    timestamptz,
  email_message_id text,
  read_at          timestamptz,
  read_by_clerk_id text,
  resolved_at          timestamptz,
  resolved_by_clerk_id text,
  resolved_note text check (resolved_note is null or length(resolved_note) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists suggestions_created_at_idx
  on public.suggestions (created_at desc);
create index if not exists suggestions_unread_idx
  on public.suggestions (created_at desc) where read_at is null;

alter table public.suggestions enable row level security;
-- aucune policy : service_role only
```

- [ ] **Step 2: Validation syntaxique locale (lecture seule)**

Run: `grep -c "create table if not exists public.suggestions" supabase/migrations/<TS>_user_suggestions.sql`
Expected: `1`. Relire le fichier : équilibre des parenthèses, `;` terminaux, pas de virgule traînante avant `)`.

- [ ] **Step 3: Application MANUELLE (étape humaine — NE PAS automatiser)**

⚠️ Ne PAS exécuter `supabase db push`. Coller le contenu du fichier dans le **SQL Editor Supabase** (projet prod), exécuter, puis :
Run: `npx supabase migration repair --status applied <TS>`
Expected: confirmation que la migration `<TS>` est marquée `applied`. (Si l'environnement d'exécution n'a pas accès au projet Supabase distant, marquer cette étape comme bloquée et la déléguer à l'utilisateur — le reste du plan peut être codé sans, mais la vérif manuelle finale la requiert.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/<TS>_user_suggestions.sql
git commit -m "feat(suggestions): migration table public.suggestions"
```

---

## Task 2: Module de lecture admin `lib/admin/queries/suggestions.ts` (TDD)

**Files:**
- Create: `tests/lib/admin/queries/suggestions.test.ts`
- Create: `lib/admin/queries/suggestions.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/lib/admin/queries/suggestions.test.ts` avec EXACTEMENT (calqué sur `tests/lib/admin/queries/reports.test.ts`) :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const builderState: {
  filters: Array<[string, unknown]>;
  gte: string | null;
  range: [number, number] | null;
  orderDesc: boolean;
} = { filters: [], gte: null, range: null, orderDesc: false };
const resultRowsRef: { rows: unknown[] } = { rows: [] };

const builder = {
  select: vi.fn(() => builder),
  eq: vi.fn((col: string, val: unknown) => {
    builderState.filters.push([col, val]);
    return builder;
  }),
  is: vi.fn((col: string, val: unknown) => {
    builderState.filters.push([col, val]);
    return builder;
  }),
  not: vi.fn((col: string, _op: string, val: unknown) => {
    builderState.filters.push([col, val]);
    return builder;
  }),
  gte: vi.fn((_col: string, val: string) => {
    builderState.gte = val;
    return builder;
  }),
  order: vi.fn(() => {
    builderState.orderDesc = true;
    return builder;
  }),
  range: vi.fn((a: number, b: number) => {
    builderState.range = [a, b];
    return Promise.resolve({ data: resultRowsRef.rows, error: null });
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({
    from: () => builder,
  }),
}));

import { fetchSuggestionsList } from "@/lib/admin/queries/suggestions";

beforeEach(() => {
  builderState.filters = [];
  builderState.gte = null;
  builderState.range = null;
  builderState.orderDesc = false;
  resultRowsRef.rows = [];
  builder.select.mockClear();
  builder.eq.mockClear();
  builder.is.mockClear();
  builder.not.mockClear();
  builder.gte.mockClear();
  builder.order.mockClear();
  builder.range.mockClear();
});

describe("fetchSuggestionsList", () => {
  it("status=unread → is(read_at, null)", async () => {
    await fetchSuggestionsList({ status: "unread", period: "all", page: 0 });
    expect(builderState.filters).toEqual(
      expect.arrayContaining([["read_at", null]]),
    );
  });

  it("status=resolved → not(resolved_at, is, null)", async () => {
    await fetchSuggestionsList({ status: "resolved", period: "all", page: 0 });
    expect(builder.not).toHaveBeenCalled();
  });

  it("status=all → ni is(read_at) ni not(resolved_at)", async () => {
    await fetchSuggestionsList({ status: "all", period: "all", page: 0 });
    expect(builder.is).not.toHaveBeenCalled();
    expect(builder.not).not.toHaveBeenCalled();
  });

  it("period=7d → gte sur created_at ~7j", async () => {
    await fetchSuggestionsList({ status: "all", period: "7d", page: 0 });
    expect(builderState.gte).not.toBeNull();
    const ageMs = Date.now() - new Date(builderState.gte!).getTime();
    expect(ageMs).toBeGreaterThanOrEqual(7 * 86_400_000 - 5000);
    expect(ageMs).toBeLessThanOrEqual(7 * 86_400_000 + 5000);
  });

  it("pagination via range(page*50, page*50+49)", async () => {
    await fetchSuggestionsList({ status: "all", period: "all", page: 2 });
    expect(builderState.range).toEqual([100, 149]);
  });

  it("mappe snake_case → camelCase", async () => {
    resultRowsRef.rows = [
      {
        id: "s1",
        from_email: "a@b.c",
        from_name: "Atelier",
        from_role: "pro",
        subject: "Idée",
        message: "Coucou",
        email_sent_at: "2026-05-19T10:00:00.000Z",
        email_message_id: "mid-1",
        read_at: null,
        read_by_clerk_id: null,
        resolved_at: null,
        resolved_by_clerk_id: null,
        resolved_note: null,
        created_at: "2026-05-19T09:00:00.000Z",
      },
    ];
    const out = await fetchSuggestionsList({ status: "all", period: "all", page: 0 });
    expect(out).toEqual([
      {
        id: "s1",
        fromEmail: "a@b.c",
        fromName: "Atelier",
        fromRole: "pro",
        subject: "Idée",
        message: "Coucou",
        emailSentAt: "2026-05-19T10:00:00.000Z",
        readAt: null,
        readByClerkId: null,
        resolvedAt: null,
        resolvedByClerkId: null,
        resolvedNote: null,
        createdAt: "2026-05-19T09:00:00.000Z",
      },
    ]);
  });

  it("retourne [] si erreur Supabase", async () => {
    builder.range.mockImplementationOnce((a: number, b: number) => {
      builderState.range = [a, b];
      return Promise.resolve({ data: null, error: { message: "boom" } });
    });
    const out = await fetchSuggestionsList({ status: "all", period: "all", page: 0 });
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Lancer le test → échec attendu**

Run: `npx vitest run tests/lib/admin/queries/suggestions.test.ts`
Expected: FAIL (module `@/lib/admin/queries/suggestions` introuvable).

- [ ] **Step 3: Implémenter le module**

Créer `lib/admin/queries/suggestions.ts` avec EXACTEMENT :

```ts
/**
 * Queries pour la page admin `/buupp-admin/suggestions`.
 *
 * - fetchSuggestionsList : liste filtrée (statut, période) + pagination.
 * - fetchSuggestionsKpis : non lues / résolues / total période / e-mail
 *   échoué.
 *
 * Lecture pure Supabase service_role. Pattern calqué sur
 * lib/admin/queries/reports.ts. Les types Supabase générés ne
 * contiennent pas encore `suggestions` (migration manuelle) → cast any.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type SuggestionStatus = "unread" | "resolved" | "all";
export type SuggestionPeriod = "7d" | "30d" | "90d" | "all";

export type SuggestionListItem = {
  id: string;
  fromEmail: string | null;
  fromName: string | null;
  fromRole: string | null;
  subject: string | null;
  message: string;
  emailSentAt: string | null;
  readAt: string | null;
  readByClerkId: string | null;
  resolvedAt: string | null;
  resolvedByClerkId: string | null;
  resolvedNote: string | null;
  createdAt: string;
};

export type SuggestionsKpis = {
  unread: number;
  resolved: number;
  totalPeriod: number;
  emailFailed: number;
};

function periodCutoffIso(period: SuggestionPeriod): string | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

const PAGE_SIZE = 50;

export async function fetchSuggestionsList(opts: {
  status: SuggestionStatus;
  period: SuggestionPeriod;
  page: number;
}): Promise<SuggestionListItem[]> {
  const admin = createSupabaseAdminClient();
  let q = admin
    .from("suggestions")
    .select(
      `id, from_email, from_name, from_role, subject, message,
       email_sent_at, email_message_id,
       read_at, read_by_clerk_id,
       resolved_at, resolved_by_clerk_id, resolved_note, created_at`,
    )
    .order("created_at", { ascending: false });

  if (opts.status === "unread") {
    q = q.is("read_at", null);
  } else if (opts.status === "resolved") {
    q = q.not("resolved_at", "is", null);
  }
  const cutoff = periodCutoffIso(opts.period);
  if (cutoff) {
    q = q.gte("created_at", cutoff);
  }
  const from = opts.page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, error } = await q.range(from, to);
  if (error || !data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => ({
    id: r.id,
    fromEmail: r.from_email ?? null,
    fromName: r.from_name ?? null,
    fromRole: r.from_role ?? null,
    subject: r.subject ?? null,
    message: r.message ?? "",
    emailSentAt: r.email_sent_at ?? null,
    readAt: r.read_at ?? null,
    readByClerkId: r.read_by_clerk_id ?? null,
    resolvedAt: r.resolved_at ?? null,
    resolvedByClerkId: r.resolved_by_clerk_id ?? null,
    resolvedNote: r.resolved_note ?? null,
    createdAt: r.created_at,
  }));
}

export async function fetchSuggestionsKpis(opts: {
  period: SuggestionPeriod;
}): Promise<SuggestionsKpis> {
  const admin = createSupabaseAdminClient();
  const cutoff = periodCutoffIso(opts.period);

  const withPeriod = <T extends { gte: (col: string, val: string) => T }>(
    q: T,
  ): T => (cutoff ? q.gte("created_at", cutoff) : q);

  const baseQuery = () =>
    admin.from("suggestions").select("id", { count: "exact", head: true });

  const [unreadRes, resolvedRes, totalRes, failedRes] = await Promise.all([
    withPeriod(baseQuery().is("read_at", null)),
    withPeriod(baseQuery().not("resolved_at", "is", null)),
    withPeriod(baseQuery()),
    withPeriod(baseQuery().is("email_sent_at", null)),
  ]);

  return {
    unread: unreadRes.count ?? 0,
    resolved: resolvedRes.count ?? 0,
    totalPeriod: totalRes.count ?? 0,
    emailFailed: failedRes.count ?? 0,
  };
}
```

- [ ] **Step 4: Lancer le test → succès attendu**

Run: `npx vitest run tests/lib/admin/queries/suggestions.test.ts`
Expected: PASS (7 tests verts).

- [ ] **Step 5: Commit**

```bash
git add tests/lib/admin/queries/suggestions.test.ts lib/admin/queries/suggestions.ts
git commit -m "feat(suggestions): module de lecture admin (TDD)"
```

---

## Task 3: `sendUserSuggestion` renvoie `messageId` + destinataire explicite

**Files:**
- Modify: `lib/email/user-suggestion.ts`

- [ ] **Step 1: Type de retour + destinataire**

Dans `lib/email/user-suggestion.ts`, remplacer la signature :

Old:
```ts
export async function sendUserSuggestion(params: SuggestionParams): Promise<{
  ok: boolean;
}> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email/user-suggestion] transport indisponible — suggestion ignorée");
    return { ok: false };
  }

  const inbox = process.env.BUUPP_SUGGESTIONS_INBOX || "jjlex64@gmail.com";
```
New:
```ts
export async function sendUserSuggestion(params: SuggestionParams): Promise<{
  ok: boolean;
  messageId?: string;
}> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email/user-suggestion] transport indisponible — suggestion ignorée");
    return { ok: false };
  }

  // Destinataire explicite : inbox dédiée si définie, sinon la liste
  // ADMIN_EMAILS (séparée par virgules). Plus de repli codé en dur.
  const inbox =
    process.env.BUUPP_SUGGESTIONS_INBOX ||
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(",");
  if (!inbox) {
    console.warn("[email/user-suggestion] aucun destinataire (BUUPP_SUGGESTIONS_INBOX / ADMIN_EMAILS) — e-mail sauté");
    return { ok: false };
  }
```

- [ ] **Step 2: Capturer le messageId du transport**

Dans le même fichier, remplacer le bloc `try` d'envoi :

Old:
```ts
  try {
    await transport.sendMail({
      from: getFromAddress(),
      to: inbox,
      replyTo: fromEmail ?? undefined,
      subject: subjectLine,
      text,
      html,
    });
    return { ok: true };
  } catch (err) {
```
New:
```ts
  try {
    const info: unknown = await transport.sendMail({
      from: getFromAddress(),
      to: inbox,
      replyTo: fromEmail ?? undefined,
      subject: subjectLine,
      text,
      html,
    });
    const messageId =
      info && typeof info === "object" && "messageId" in info
        ? String((info as { messageId: unknown }).messageId)
        : undefined;
    return { ok: true, messageId };
  } catch (err) {
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add lib/email/user-suggestion.ts
git commit -m "feat(suggestions): sendUserSuggestion renvoie messageId + destinataire explicite"
```

---

## Task 4: `POST /api/me/suggestions` — persistance + e-mail best-effort

**Files:**
- Modify: `app/api/me/suggestions/route.ts`

- [ ] **Step 1: Importer recordEvent**

Old (haut du fichier, bloc imports) :
```ts
import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendUserSuggestion } from "@/lib/email/user-suggestion";
```
New:
```ts
import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendUserSuggestion } from "@/lib/email/user-suggestion";
import { recordEvent } from "@/lib/admin/events/record";
```

- [ ] **Step 2: Remplacer la fin de la fonction (envoi → persistance)**

Old (à partir de `const { ok } = await sendUserSuggestion(...)` jusqu'à la fin de `POST`) :
```ts
  const { ok } = await sendUserSuggestion({
    fromEmail,
    fromName,
    fromRole,
    subject,
    message,
  });
  if (!ok) {
    return NextResponse.json(
      {
        error: "email_failed",
        message:
          "Envoi impossible pour le moment. Réessayez dans un instant, ou écrivez-nous directement à jjlex64@gmail.com.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
```
New:
```ts
  // E-mail = notification best-effort. La base est la source de vérité :
  // on n'échoue PAS la requête si l'e-mail tombe.
  const { ok: emailOk, messageId } = await sendUserSuggestion({
    fromEmail,
    fromName,
    fromRole,
    subject,
    message,
  });

  const nowIso = new Date().toISOString();
  const { data: inserted, error: insertError } = await admin
    .from("suggestions")
    .insert({
      from_email: fromEmail,
      from_name: fromName,
      from_role: fromRole,
      subject,
      message,
      email_sent_at: emailOk ? nowIso : null,
      email_message_id: emailOk ? (messageId ?? null) : null,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    void recordEvent({
      type: "suggestions.persist_failed",
      severity: "critical",
      payload: { fromEmail, error: insertError?.message ?? "unknown" },
    });
    return NextResponse.json(
      {
        error: "persist_failed",
        message:
          "Enregistrement impossible pour le moment. Réessayez dans un instant.",
      },
      { status: 502 },
    );
  }

  if (!emailOk) {
    void recordEvent({
      type: "suggestions.email_failed",
      severity: "warning",
      payload: { fromEmail, suggestionId: inserted.id },
    });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Mettre à jour la docstring d'en-tête**

Old (lignes 8-11, le passage « Pas de stockage en DB pour la v1 ») :
```ts
 * Anti-spam minimal : taille du body bornée + rate-limit léger côté Clerk
 * (chaque requête authentifiée passe par le middleware). Pas de stockage
 * en DB pour la v1 — l'email reste la source de vérité.
 */
```
New:
```ts
 * Anti-spam minimal : taille du body bornée + rate-limit léger côté Clerk
 * (chaque requête authentifiée passe par le middleware). Persistée en
 * table `public.suggestions` (source de vérité, lue par l'admin) ;
 * l'e-mail est une notification best-effort non bloquante.
 */
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint app/api/me/suggestions/route.ts`
Expected: exit 0, 0 erreur.

- [ ] **Step 5: Commit**

```bash
git add app/api/me/suggestions/route.ts
git commit -m "feat(suggestions): persistance DB + e-mail best-effort + recordEvent"
```

---

## Task 5: Route admin `PATCH /api/admin/suggestions`

**Files:**
- Create: `app/api/admin/suggestions/route.ts`

- [ ] **Step 1: Créer la route**

Créer `app/api/admin/suggestions/route.ts` avec EXACTEMENT :

```ts
/**
 * PATCH /api/admin/suggestions — actions de triage sur une suggestion.
 * Auth admin via requireAdminRequest (404 sinon, pas de fuite).
 * Body: { id, action: 'mark-read' | 'resolve' | 'reopen', note? }
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdminRequest } from "@/lib/admin/access";

export const runtime = "nodejs";

type Body = {
  id?: string;
  action?: "mark-read" | "resolve" | "reopen";
  note?: string | null;
};

export async function PATCH(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const { userId } = await auth();
  const nowIso = new Date().toISOString();

  let update: Record<string, unknown>;
  if (body.action === "mark-read") {
    update = { read_at: nowIso, read_by_clerk_id: userId ?? null };
  } else if (body.action === "resolve") {
    const note = (body.note ?? "").trim().slice(0, 1000) || null;
    update = {
      resolved_at: nowIso,
      resolved_by_clerk_id: userId ?? null,
      resolved_note: note,
      // Résoudre vaut lecture : on renseigne read_* si encore vide.
      read_at: nowIso,
      read_by_clerk_id: userId ?? null,
    };
  } else if (body.action === "reopen") {
    update = {
      resolved_at: null,
      resolved_by_clerk_id: null,
      resolved_note: null,
    };
  } else {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("suggestions")
    .update(update)
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Vérifier les helpers importés existent**

Run: `grep -n "export async function requireAdminRequest" lib/admin/access.ts && grep -n "export function createSupabaseAdminClient\|export const createSupabaseAdminClient" lib/supabase/server.ts`
Expected: les deux exports existent. (Si `requireAdminRequest` a une autre signature que `(req: Request) => Promise<Response | null>`, adapter l'appel en conséquence — il renvoie une `Response` de refus ou `null`/falsy si autorisé.)

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint app/api/admin/suggestions/route.ts`
Expected: exit 0, 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/suggestions/route.ts
git commit -m "feat(suggestions): route admin PATCH (lu/résolu/rouvrir)"
```

---

## Task 6: Page admin + carte + actions + entrée nav

**Files:**
- Create: `app/buupp-admin/suggestions/page.tsx`
- Create: `app/buupp-admin/suggestions/_components/SuggestionCard.tsx`
- Create: `app/buupp-admin/suggestions/_components/SuggestionActions.tsx`
- Modify: `app/buupp-admin/_components/AdminShell.tsx` (tableau `NAV`)

- [ ] **Step 1: Composant d'actions client**

Créer `app/buupp-admin/suggestions/_components/SuggestionActions.tsx` (calque `signalements/_components/ResolveButton.tsx`) :

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function SuggestionActions({
  id,
  isRead,
  isResolved,
}: {
  id: string;
  isRead: boolean;
  isResolved: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const call = (action: "mark-read" | "resolve" | "reopen", noteVal?: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await fetch("/api/admin/suggestions", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, action, note: noteVal?.trim() || undefined }),
        });
        if (!r.ok) {
          setError("Échec de la mise à jour.");
          return;
        }
        setOpen(false);
        setNote("");
        router.refresh();
      } catch {
        setError("Échec de la mise à jour.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex gap-2">
        {!isRead && !isResolved && (
          <button
            type="button"
            onClick={() => call("mark-read")}
            disabled={pending}
            className="text-xs rounded px-3 py-1.5 transition-colors disabled:opacity-60 cursor-pointer"
            style={{
              background: "var(--ivory-2)",
              color: "var(--ink-2)",
              border: "1px solid var(--line)",
            }}
          >
            {pending ? "…" : "Marquer lu"}
          </button>
        )}
        {!isResolved ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={pending}
            className="text-xs rounded px-3 py-1.5 transition-colors cursor-pointer"
            style={{
              background: "var(--ink)",
              color: "var(--paper)",
              border: "1px solid var(--ink)",
            }}
          >
            Résoudre
          </button>
        ) : (
          <button
            type="button"
            onClick={() => call("reopen")}
            disabled={pending}
            className="text-xs rounded px-3 py-1.5 transition-colors disabled:opacity-60 cursor-pointer"
            style={{
              background: "var(--ivory-2)",
              color: "var(--ink-2)",
              border: "1px solid var(--line)",
            }}
          >
            {pending ? "…" : "Rouvrir"}
          </button>
        )}
      </div>
      {open && !isResolved && (
        <div
          className="mt-1 p-3 rounded w-full"
          style={{ background: "var(--ivory)", border: "1px solid var(--line)" }}
        >
          <label
            className="block text-[11px] mb-1.5"
            style={{
              color: "var(--ink-4)",
              fontFamily: "var(--mono)",
              letterSpacing: "0.06em",
            }}
          >
            NOTE INTERNE (facultatif)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 1000))}
            rows={2}
            className="w-full text-sm rounded p-2"
            style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
            placeholder="Décision, suite donnée…"
          />
          {error && (
            <div className="text-xs mt-2" style={{ color: "var(--danger)" }}>
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setNote("");
                setError(null);
              }}
              disabled={pending}
              className="text-xs rounded px-3 py-1.5 cursor-pointer"
              style={{
                background: "var(--paper)",
                color: "var(--ink-3)",
                border: "1px solid var(--line)",
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => call("resolve", note)}
              disabled={pending}
              className="text-xs rounded px-3 py-1.5 cursor-pointer disabled:opacity-60"
              style={{
                background: "var(--ink)",
                color: "var(--paper)",
                border: "1px solid var(--ink)",
              }}
            >
              {pending ? "Envoi…" : "Confirmer"}
            </button>
          </div>
        </div>
      )}
      {error && !open && (
        <div className="text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Carte item**

Créer `app/buupp-admin/suggestions/_components/SuggestionCard.tsx` :

```tsx
import type { SuggestionListItem } from "@/lib/admin/queries/suggestions";
import SuggestionActions from "./SuggestionActions";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function SuggestionCard({ s }: { s: SuggestionListItem }) {
  const isResolved = s.resolvedAt != null;
  const isRead = s.readAt != null;
  const statusLabel = isResolved ? "Résolu" : isRead ? "Lu" : "Non lu";
  const statusTone = isResolved
    ? { bg: "color-mix(in oklab, var(--good) 12%, var(--paper))", color: "var(--good)" }
    : isRead
      ? { bg: "var(--ivory-2)", color: "var(--ink-2)" }
      : { bg: "color-mix(in oklab, var(--warn) 14%, var(--paper))", color: "var(--warn)" };

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className="text-[11px] rounded px-2 py-0.5"
              style={{ background: statusTone.bg, color: statusTone.color }}
            >
              {statusLabel}
            </span>
            <span
              className="text-[11px] rounded px-2 py-0.5"
              style={
                s.emailSentAt
                  ? { background: "var(--ivory-2)", color: "var(--ink-3)" }
                  : {
                      background:
                        "color-mix(in oklab, var(--danger) 12%, var(--paper))",
                      color: "var(--danger)",
                    }
              }
            >
              {s.emailSentAt ? "E-mail envoyé ✓" : "E-mail échec ✗"}
            </span>
            <span className="text-xs" style={{ color: "var(--ink-4)" }}>
              {fmtDate(s.createdAt)}
            </span>
          </div>
          <div className="text-sm" style={{ color: "var(--ink-3)" }}>
            {s.fromName ?? "—"}
            {s.fromEmail ? ` · ${s.fromEmail}` : ""}
            {s.fromRole ? ` · ${s.fromRole}` : ""}
          </div>
          {s.subject && (
            <div
              className="mt-2 text-base"
              style={{ fontFamily: "var(--serif)" }}
            >
              {s.subject}
            </div>
          )}
          <div
            className="mt-1 text-sm"
            style={{ color: "var(--ink-2)", whiteSpace: "pre-wrap" }}
          >
            {s.message}
          </div>
          {s.resolvedNote && (
            <div
              className="mt-2 text-xs rounded p-2"
              style={{
                background: "var(--ivory)",
                border: "1px solid var(--line)",
                color: "var(--ink-3)",
              }}
            >
              Note : {s.resolvedNote}
            </div>
          )}
        </div>
        <SuggestionActions id={s.id} isRead={isRead} isResolved={isResolved} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Page de triage**

Créer `app/buupp-admin/suggestions/page.tsx` :

```tsx
/**
 * /buupp-admin/suggestions — triage des suggestions utilisateurs.
 * Filtres GET (statut / période), KPI, liste SuggestionCard, pagination.
 */

import {
  fetchSuggestionsList,
  fetchSuggestionsKpis,
  type SuggestionStatus,
  type SuggestionPeriod,
} from "@/lib/admin/queries/suggestions";
import SuggestionCard from "./_components/SuggestionCard";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: Array<{ value: SuggestionStatus; label: string }> = [
  { value: "unread", label: "Non lues" },
  { value: "resolved", label: "Résolues" },
  { value: "all", label: "Toutes" },
];
const PERIOD_OPTIONS: Array<{ value: SuggestionPeriod; label: string }> = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
  { value: "all", label: "Tout" },
];

function asStatus(v: string | undefined): SuggestionStatus {
  if (v === "resolved" || v === "all") return v;
  return "unread";
}
function asPeriod(v: string | undefined): SuggestionPeriod {
  if (v === "7d" || v === "90d" || v === "all") return v;
  return "30d";
}
function buildHref(o: {
  status: SuggestionStatus;
  period: SuggestionPeriod;
  page: number;
}): string {
  const u = new URLSearchParams();
  u.set("status", o.status);
  u.set("period", o.period);
  if (o.page > 0) u.set("page", String(o.page));
  return `/buupp-admin/suggestions?${u.toString()}`;
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
    >
      <div
        className="text-[11px] uppercase mb-1"
        style={{
          color: "var(--ink-4)",
          fontFamily: "var(--mono)",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div className="text-2xl" style={{ fontFamily: "var(--serif)" }}>
        {new Intl.NumberFormat("fr-FR").format(value)}
      </div>
    </div>
  );
}

function Select<T extends string>({
  name,
  value,
  options,
  label,
}: {
  name: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="text-[10px] uppercase"
        style={{
          color: "var(--ink-4)",
          fontFamily: "var(--mono)",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="text-sm rounded px-2 py-1.5"
        style={{
          background: "var(--paper)",
          color: "var(--ink)",
          border: "1px solid var(--line)",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function SuggestionsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; period?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = asStatus(sp.status);
  const period = asPeriod(sp.period);
  const pageRaw = Number(sp.page ?? "0");
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0;

  const [items, kpis] = await Promise.all([
    fetchSuggestionsList({ status, period, page }),
    fetchSuggestionsKpis({ period }),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div
          className="text-[11px] uppercase"
          style={{
            color: "var(--ink-4)",
            fontFamily: "var(--mono)",
            letterSpacing: "0.06em",
          }}
        >
          Retours utilisateurs
        </div>
        <h1 className="text-xl font-medium" style={{ letterSpacing: "-0.01em" }}>
          Suggestions
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-3)", maxWidth: 720 }}>
          Messages envoyés depuis l'onglet « Vos suggestions » des dashboards
          prospect et pro. Marque une suggestion « lue » puis « résolue » quand
          tu l'as traitée.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Non lues" value={kpis.unread} />
        <Kpi label="Résolues" value={kpis.resolved} />
        <Kpi label="Total période" value={kpis.totalPeriod} />
        <Kpi label="E-mail échoué" value={kpis.emailFailed} />
      </section>

      <form
        method="GET"
        className="flex flex-wrap gap-2 items-end"
        style={{ color: "var(--ink-3)" }}
      >
        <Select name="status" value={status} options={STATUS_OPTIONS} label="Statut" />
        <Select name="period" value={period} options={PERIOD_OPTIONS} label="Période" />
        <button
          type="submit"
          className="text-xs rounded px-3 py-1.5 cursor-pointer"
          style={{
            background: "var(--ink)",
            color: "var(--paper)",
            border: "1px solid var(--ink)",
          }}
        >
          Filtrer
        </button>
      </form>

      <section className="space-y-3">
        {items.length === 0 ? (
          <div
            className="rounded-lg p-6 text-center text-sm"
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              color: "var(--ink-3)",
            }}
          >
            Aucune suggestion pour ces filtres.
          </div>
        ) : (
          items.map((s) => <SuggestionCard key={s.id} s={s} />)
        )}
      </section>

      <nav className="flex justify-between items-center text-xs">
        {page > 0 ? (
          <a
            href={buildHref({ status, period, page: page - 1 })}
            className="underline"
            style={{ color: "var(--ink)" }}
          >
            ← Page précédente
          </a>
        ) : (
          <span />
        )}
        {items.length === 50 && (
          <a
            href={buildHref({ status, period, page: page + 1 })}
            className="underline"
            style={{ color: "var(--ink)" }}
          >
            Page suivante →
          </a>
        )}
      </nav>
    </div>
  );
}
```

- [ ] **Step 4: Ajouter l'entrée de navigation**

Dans `app/buupp-admin/_components/AdminShell.tsx`, tableau `NAV`, ajouter l'entrée juste après la ligne Signalements :

Old:
```tsx
  { href: "/buupp-admin/signalements", label: "Signalements" },
  { href: "/buupp-admin/contact-actions", label: "Activité pros" },
```
New:
```tsx
  { href: "/buupp-admin/signalements", label: "Signalements" },
  { href: "/buupp-admin/suggestions", label: "Suggestions" },
  { href: "/buupp-admin/contact-actions", label: "Activité pros" },
```

- [ ] **Step 5: Typecheck + lint**

Run:
```bash
npx tsc --noEmit && npx eslint app/buupp-admin/suggestions/page.tsx app/buupp-admin/suggestions/_components/SuggestionCard.tsx app/buupp-admin/suggestions/_components/SuggestionActions.tsx app/buupp-admin/_components/AdminShell.tsx
```
Expected: exit 0, 0 erreur.

- [ ] **Step 6: Commit**

```bash
git add app/buupp-admin/suggestions/ app/buupp-admin/_components/AdminShell.tsx
git commit -m "feat(suggestions): page admin de triage + carte + actions + nav"
```

---

## Task 7: Vérification globale & non-régression

**Files:** aucun (vérification seule)

- [ ] **Step 1: Typecheck complet**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Lint des fichiers touchés**

Run:
```bash
npx eslint lib/admin/queries/suggestions.ts lib/email/user-suggestion.ts app/api/me/suggestions/route.ts app/api/admin/suggestions/route.ts app/buupp-admin/suggestions/page.tsx app/buupp-admin/suggestions/_components/SuggestionCard.tsx app/buupp-admin/suggestions/_components/SuggestionActions.tsx app/buupp-admin/_components/AdminShell.tsx
```
Expected: exit 0, 0 erreur.

- [ ] **Step 3: Suite de tests complète**

Run: `npx vitest run`
Expected: tous verts (51 existants + 7 nouveaux = 58).

- [ ] **Step 4: Vérification manuelle (non bloquante, nécessite la migration appliquée — Task 1 Step 3)**

Avec `npm run dev` et la migration appliquée :
1. Connecté prospect/pro, onglet « Vos suggestions » → envoyer un message → réponse OK côté UI.
2. Connecté admin (`ADMIN_EMAILS`), aller sur `/buupp-admin/suggestions` (lien nav « Suggestions ») → la suggestion apparaît sous filtre « Non lues », badge e-mail correct.
3. « Marquer lu » → le badge passe « Lu ». « Résoudre » + note → filtre « Résolues » la montre avec la note ; « Rouvrir » l'enlève des résolues.
4. (Optionnel) Mettre une `BREVO_API_KEY` invalide → renvoyer une suggestion : elle est quand même persistée (visible admin) avec badge « E-mail échec ✗» et un event `suggestions.email_failed` dans le flux admin.

- [ ] **Step 5: Commit éventuel de corrections**

Si Steps 1-3 ont nécessité une correction, la committer :
```bash
git add -A && git commit -m "fix(suggestions): corrections post-vérification Lot D"
```

---

## Self-Review (effectuée)

- **Couverture spec :** table (T1) ; persistance + e-mail best-effort + recordEvent + sémantique 502/critical & warning (T3+T4) ; destinataire ADMIN_EMAILS sans repli codé (T3) ; module lecture + filtres/période/pagination/shaping + dégradation `[]` (T2, testé) ; KPIs unread/resolved/total/emailFailed (T2) ; page + filtres + KPIs + pagination (T6) ; carte + statut + badge e-mail (T6) ; actions mark-read/resolve/reopen + note (T5+T6) ; nav admin (T6) ; contrat réponse inchangé → mobile (T4, vérifié : renvoie toujours `{ ok:true }`) ; migration manuelle explicitée (T1 Step 3). Tous les points du spec sont couverts.
- **Placeholders :** `<YYYYMMDDHHMMSS>`/`<TS>` = valeur générée par commande explicite (Task 1 Step 1), pas un TODO. Aucun « TBD ».
- **Cohérence types/noms :** `SuggestionListItem`/`SuggestionStatus`/`SuggestionPeriod`/`fetchSuggestionsList`/`fetchSuggestionsKpis` identiques entre T2 (def + test), T6 (page/carte). Colonnes SQL (T1) ⇔ select & mapping (T2) ⇔ insert (T4) ⇔ update (T5) cohérentes (`read_at`, `read_by_clerk_id`, `resolved_at`, `resolved_by_clerk_id`, `resolved_note`, `email_sent_at`, `email_message_id`). `recordEvent` signature conforme à `lib/admin/events/record.ts`.
- **Ordre :** T1 (table) → T2 (lecture) → T3 (email helper) → T4 (route POST, dépend de T3) → T5 (route admin) → T6 (UI, dépend de T2/T5) → T7 (vérif). Cohérent.
