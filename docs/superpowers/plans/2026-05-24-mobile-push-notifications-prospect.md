# Push notifications prospect — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Envoyer une notification push native à un prospect dès qu'une campagne le sollicite, avec un design différencié pour une sollicitation classique et un flash deal.

**Architecture:** Table `push_tokens` côté Supabase + endpoints REST `/api/me/push-token` pour register/unregister + hook fire-and-forget dans `POST /api/pro/campaigns` qui pousse via l'Expo Push Service. Côté mobile : permission demandée en fin d'onboarding (slide 4), handler + listeners au root layout, bannière in-app slide-down en foreground, deep links via query params (`focusRelation` / `openFlash`).

**Tech Stack:** Next.js 16 (route handlers Node), Supabase JS (`createSupabaseAdminClient`), Clerk auth (`auth()`), Expo SDK 54 (`expo-notifications`, `expo-secure-store`), expo-router 6, Reanimated 4, vitest pour les tests backend.

**Spec source :** [`docs/superpowers/specs/2026-05-24-mobile-push-notifications-prospect-design.md`](../specs/2026-05-24-mobile-push-notifications-prospect-design.md)

---

## Phase A — Backend (DB + endpoints + helper)

### Task 1 : Migration `push_tokens`

**Files:**
- Create: `supabase/migrations/20260524120000_push_tokens.sql`

- [ ] **Step 1 : Écrire le fichier de migration**

```sql
-- Table des tokens push Expo, un par device. Plusieurs rows possibles
-- pour un même user_id (multi-device toléré). RLS activée mais sans
-- policy : seul le service role lit/écrit (le client passe par
-- /api/me/push-token, jamais directement sur la table).

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text NOT NULL,
  expo_token    text NOT NULL UNIQUE,
  platform      text NOT NULL CHECK (platform IN ('ios','android')),
  app_version   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens (user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2 : Appliquer la migration côté remote**

Per mémoire projet `supabase-migrations.md` : **NE PAS** lancer `supabase db push`. Procédure :

1. Copier le SQL ci-dessus.
2. Ouvrir Supabase Dashboard → SQL Editor → coller → Run.
3. Marquer la migration comme appliquée localement :
   ```bash
   supabase migration repair --status applied 20260524120000
   ```

- [ ] **Step 3 : Vérifier la création**

Dans Supabase SQL Editor :

```sql
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'push_tokens'
 ORDER BY ordinal_position;
```

Expected : 7 lignes (id uuid, user_id text, expo_token text, platform text, app_version text, created_at timestamptz, last_seen_at timestamptz). RLS check :

```sql
SELECT relrowsecurity FROM pg_class WHERE relname = 'push_tokens';
```

Expected : `true`.

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/20260524120000_push_tokens.sql
git commit -m "feat(db): push_tokens table for Expo push notifications"
```

---

### Task 2 : Helper `lib/push/expo.ts` — builders de payloads (TDD)

**Files:**
- Create: `lib/push/expo.ts`
- Create: `tests/lib/push/expo.test.ts`

- [ ] **Step 1 : Écrire les tests pour `buildClassicPayload` et `buildFlashPayload`**

`tests/lib/push/expo.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { buildClassicPayload, buildFlashPayload } from "@/lib/push/expo";

describe("buildClassicPayload", () => {
  it("compose le payload Expo classique avec emoji 👋", () => {
    const msg = buildClassicPayload({
      token: "ExponentPushToken[abc]",
      proName: "Coiffure Lola",
      rewardEur: 3.4,
      durationKey: "24h",
      relationId: "rel-1",
    });
    expect(msg).toEqual({
      to: "ExponentPushToken[abc]",
      title: "👋 Une nouvelle sollicitation",
      body: "Coiffure Lola · +3,40 € · expire dans 24h",
      data: { type: "classic", relationId: "rel-1", screen: "relations" },
      sound: "default",
      badge: 1,
      channelId: "solicitations-classic",
    });
  });

  it("formate les centimes en euros avec virgule française", () => {
    const msg = buildClassicPayload({
      token: "ExponentPushToken[abc]",
      proName: "X",
      rewardEur: 12,
      durationKey: "7d",
      relationId: "r",
    });
    expect(msg.body).toBe("X · +12,00 € · expire dans 7 jours");
  });
});

describe("buildFlashPayload", () => {
  it("compose le payload flash avec emoji ⚡, priority high, ttl 3600", () => {
    const msg = buildFlashPayload({
      token: "ExponentPushToken[xyz]",
      proName: "Garage Marc",
      rewardEur: 5.2,
      relationId: "rel-2",
      campaignId: "camp-9",
    });
    expect(msg).toEqual({
      to: "ExponentPushToken[xyz]",
      title: "⚡ Flash deal — 1h pour saisir",
      body: "Garage Marc · +5,20 € · prime ×2 jusqu'à la fin du flash",
      data: {
        type: "flash",
        relationId: "rel-2",
        campaignId: "camp-9",
        screen: "flash-deals",
      },
      sound: "default",
      badge: 1,
      channelId: "solicitations-flash",
      priority: "high",
      ttl: 3600,
    });
  });
});
```

- [ ] **Step 2 : Lancer les tests (doivent échouer)**

```bash
npx vitest run tests/lib/push/expo.test.ts
```

Expected : FAIL — `Cannot find module '@/lib/push/expo'`.

- [ ] **Step 3 : Implémenter les builders**

`lib/push/expo.ts` :

```ts
// Wrapper Expo Push API (https://docs.expo.dev/push-notifications/sending-notifications).
// V1 : envoi par batch + cleanup des tokens invalides via receipts.
// Pas de dépendance NPM — l'API HTTP suffit (fetch natif Node 20+).

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound?: "default";
  badge?: number;
  channelId?: string;
  priority?: "default" | "high";
  ttl?: number;
};

const DURATION_LABEL: Record<string, string> = {
  "1h": "1h",
  "24h": "24h",
  "7d": "7 jours",
  "30d": "30 jours",
};

function formatEur(amount: number): string {
  // Toujours 2 décimales, virgule française.
  return `${amount.toFixed(2).replace(".", ",")} €`;
}

function durationLabel(durationKey: string): string {
  return DURATION_LABEL[durationKey] ?? durationKey;
}

export function buildClassicPayload(args: {
  token: string;
  proName: string;
  rewardEur: number;
  durationKey: string;
  relationId: string;
}): ExpoPushMessage {
  return {
    to: args.token,
    title: "👋 Une nouvelle sollicitation",
    body: `${args.proName} · +${formatEur(args.rewardEur)} · expire dans ${durationLabel(args.durationKey)}`,
    data: {
      type: "classic",
      relationId: args.relationId,
      screen: "relations",
    },
    sound: "default",
    badge: 1,
    channelId: "solicitations-classic",
  };
}

export function buildFlashPayload(args: {
  token: string;
  proName: string;
  rewardEur: number;
  relationId: string;
  campaignId: string;
}): ExpoPushMessage {
  return {
    to: args.token,
    title: "⚡ Flash deal — 1h pour saisir",
    body: `${args.proName} · +${formatEur(args.rewardEur)} · prime ×2 jusqu'à la fin du flash`,
    data: {
      type: "flash",
      relationId: args.relationId,
      campaignId: args.campaignId,
      screen: "flash-deals",
    },
    sound: "default",
    badge: 1,
    channelId: "solicitations-flash",
    priority: "high",
    ttl: 3600,
  };
}
```

- [ ] **Step 4 : Lancer les tests (doivent passer)**

```bash
npx vitest run tests/lib/push/expo.test.ts
```

Expected : 3 tests passent.

- [ ] **Step 5 : Commit**

```bash
git add lib/push/expo.ts tests/lib/push/expo.test.ts
git commit -m "feat(push): payload builders Expo (classique + flash deal)"
```

---

### Task 3 : Helper `lib/push/expo.ts` — `sendBatch` + cleanup receipts (TDD)

**Files:**
- Modify: `lib/push/expo.ts` (ajouter `sendBatch` et `cleanupInvalidTokens`)
- Modify: `tests/lib/push/expo.test.ts` (ajouter cas pour `sendBatch`)

- [ ] **Step 1 : Ajouter les tests sendBatch (mock fetch)**

Ajouter à `tests/lib/push/expo.test.ts` :

```ts
import { afterEach, beforeEach, vi } from "vitest";
import { sendBatch } from "@/lib/push/expo";

describe("sendBatch", () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    global.fetch = realFetch;
    vi.useRealTimers();
  });

  function fakeAdmin(deleteSpy: ReturnType<typeof vi.fn>) {
    return {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          in: deleteSpy,
        }),
      }),
    };
  }

  it("envoie en chunks de 100, log les tickets ok, et delete les tokens DeviceNotRegistered", async () => {
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/push/send")) {
        return new Response(
          JSON.stringify({
            data: [
              { status: "ok", id: "t1" },
              { status: "error", message: "DeviceNotRegistered", details: { error: "DeviceNotRegistered" } },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/push/getReceipts")) {
        return new Response(
          JSON.stringify({ data: { t1: { status: "ok" } } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error("unexpected url " + url);
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const deleteSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const admin = fakeAdmin(deleteSpy);

    const messages = [
      { to: "ExponentPushToken[good]", title: "t", body: "b", data: {} },
      { to: "ExponentPushToken[bad]", title: "t", body: "b", data: {} },
    ];

    const promise = sendBatch(admin as never, messages);
    // Avancer le setTimeout 2s entre /send et /getReceipts.
    await vi.advanceTimersByTimeAsync(2100);
    await promise;

    // 2 appels fetch attendus.
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Token "bad" supprimé (par message ticket en erreur immédiate).
    expect(deleteSpy).toHaveBeenCalledWith(["ExponentPushToken[bad]"]);
  });
});
```

- [ ] **Step 2 : Lancer les tests (doivent échouer)**

```bash
npx vitest run tests/lib/push/expo.test.ts
```

Expected : FAIL — `sendBatch is not exported`.

- [ ] **Step 3 : Implémenter `sendBatch`**

Ajouter à la fin de `lib/push/expo.ts` :

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

const EXPO_API = "https://exp.host/--/api/v2";
const CHUNK = 100;

type Ticket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

type Receipt =
  | { status: "ok" }
  | { status: "error"; details?: { error?: string } };

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function deleteInvalidTokens(
  admin: SupabaseClient,
  tokens: string[],
): Promise<void> {
  if (tokens.length === 0) return;
  const { error } = await admin.from("push_tokens").delete().in("expo_token", tokens);
  if (error) {
    console.error("[push] cleanup tokens failed", error);
  }
}

/**
 * Envoie un batch de messages Expo. Fire-and-forget côté caller —
 * on swallow toutes les erreurs réseau pour ne pas faire planter la
 * réponse de l'endpoint qui a déclenché l'envoi (POST campaigns).
 *
 * - Chunks de 100 (limite Expo).
 * - Sleep 2s puis poll /getReceipts pour récupérer les statuts finaux.
 * - Tokens en erreur "DeviceNotRegistered" → DELETE de push_tokens.
 */
export async function sendBatch(
  admin: SupabaseClient,
  messages: ExpoPushMessage[],
): Promise<void> {
  if (messages.length === 0) return;

  const invalidTokens: string[] = [];
  const ticketIdToToken = new Map<string, string>();

  for (const batch of chunk(messages, CHUNK)) {
    try {
      const res = await fetch(`${EXPO_API}/push/send`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN
            ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(batch),
      });
      const json = (await res.json()) as { data: Ticket[] };
      const tickets = json.data ?? [];
      tickets.forEach((tk, i) => {
        const msg = batch[i];
        if (tk.status === "error") {
          if (tk.details?.error === "DeviceNotRegistered") {
            invalidTokens.push(msg.to);
          } else {
            console.error("[push] ticket error", tk, "token=", msg.to);
          }
        } else if (tk.status === "ok") {
          ticketIdToToken.set(tk.id, msg.to);
        }
      });
    } catch (e) {
      console.error("[push] send batch failed", e);
    }
  }

  // Poll receipts (best-effort, après ~2s d'attente).
  if (ticketIdToToken.size > 0) {
    await new Promise((r) => setTimeout(r, 2000));
    const ids = [...ticketIdToToken.keys()];
    for (const batch of chunk(ids, CHUNK)) {
      try {
        const res = await fetch(`${EXPO_API}/push/getReceipts`, {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            ...(process.env.EXPO_ACCESS_TOKEN
              ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
              : {}),
          },
          body: JSON.stringify({ ids: batch }),
        });
        const json = (await res.json()) as { data: Record<string, Receipt> };
        for (const [id, receipt] of Object.entries(json.data ?? {})) {
          if (receipt.status === "error" && receipt.details?.error === "DeviceNotRegistered") {
            const tok = ticketIdToToken.get(id);
            if (tok) invalidTokens.push(tok);
          }
        }
      } catch (e) {
        console.error("[push] getReceipts failed", e);
      }
    }
  }

  await deleteInvalidTokens(admin, [...new Set(invalidTokens)]);
}
```

- [ ] **Step 4 : Lancer les tests (doivent passer)**

```bash
npx vitest run tests/lib/push/expo.test.ts
```

Expected : 4 tests passent.

- [ ] **Step 5 : Commit**

```bash
git add lib/push/expo.ts tests/lib/push/expo.test.ts
git commit -m "feat(push): sendBatch + cleanup DeviceNotRegistered via receipts"
```

---

### Task 4 : Endpoint `POST /api/me/push-token`

**Files:**
- Create: `app/api/me/push-token/route.ts`
- Create: `tests/api/me/push-token.test.ts`

- [ ] **Step 1 : Écrire les tests**

`tests/api/me/push-token.test.ts` :

```ts
import { describe, expect, it, vi } from "vitest";

// Mock Clerk + Supabase au niveau module.
const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

const upsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({
    from: vi.fn().mockReturnValue({ upsert: upsertSpy }),
  }),
}));

describe("POST /api/me/push-token", () => {
  it("renvoie 401 sans session Clerk", async () => {
    authMock.mockResolvedValueOnce({ userId: null });
    const { POST } = await import("@/app/api/me/push-token/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({
          token: "ExponentPushToken[abc]",
          platform: "ios",
        }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("renvoie 400 si token mal formé", async () => {
    authMock.mockResolvedValueOnce({ userId: "u1" });
    const { POST } = await import("@/app/api/me/push-token/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ token: "nope", platform: "ios" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("upsert le token avec user_id et renvoie 200", async () => {
    authMock.mockResolvedValueOnce({ userId: "u-clerk" });
    upsertSpy.mockClear();
    const { POST } = await import("@/app/api/me/push-token/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({
          token: "ExponentPushToken[xxx]",
          platform: "ios",
          appVersion: "1.0.0",
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u-clerk",
        expo_token: "ExponentPushToken[xxx]",
        platform: "ios",
        app_version: "1.0.0",
      }),
      expect.objectContaining({ onConflict: "expo_token" }),
    );
  });
});
```

- [ ] **Step 2 : Lancer les tests (doivent échouer)**

```bash
npx vitest run tests/api/me/push-token.test.ts
```

Expected : FAIL — `Cannot find module '@/app/api/me/push-token/route'`.

- [ ] **Step 3 : Implémenter la route**

`app/api/me/push-token/route.ts` :

```ts
/**
 * POST /api/me/push-token — upsert du token Expo de l'appareil
 * (un row par token). Multi-device toléré : N tokens par user_id.
 *
 * DELETE /api/me/push-token — nettoyage au sign-out / désinscription.
 */
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TOKEN_RE = /^ExponentPushToken\[[A-Za-z0-9_-]{10,}\]$/;

type Body = {
  token?: unknown;
  platform?: unknown;
  appVersion?: unknown;
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const platform = body.platform === "ios" || body.platform === "android" ? body.platform : "";
  if (!TOKEN_RE.test(token) || !platform) {
    return NextResponse.json({ error: "invalid_token_or_platform" }, { status: 400 });
  }
  const appVersion =
    typeof body.appVersion === "string" && body.appVersion.length < 32
      ? body.appVersion
      : null;

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from("push_tokens").upsert(
    {
      user_id: userId,
      expo_token: token,
      platform,
      app_version: appVersion,
      last_seen_at: now,
    },
    { onConflict: "expo_token" },
  );
  if (error) {
    console.error("[/api/me/push-token POST] upsert failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { token?: unknown };
  try {
    body = (await req.json()) as { token?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("push_tokens")
    .delete()
    .eq("expo_token", token)
    .eq("user_id", userId);
  if (error) {
    console.error("[/api/me/push-token DELETE] delete failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4 : Lancer les tests (doivent passer)**

```bash
npx vitest run tests/api/me/push-token.test.ts
```

Expected : 3 tests passent.

- [ ] **Step 5 : Commit**

```bash
git add app/api/me/push-token/route.ts tests/api/me/push-token.test.ts
git commit -m "feat(api): /api/me/push-token POST + DELETE (upsert/cleanup)"
```

---

### Task 5 : Hook push dans `POST /api/pro/campaigns`

**Files:**
- Modify: `app/api/pro/campaigns/route.ts` (autour de la ligne 487-508, après le bloc `void Promise.allSettled` des emails)

- [ ] **Step 1 : Ajouter l'import du helper**

Dans la zone des imports en haut du fichier `app/api/pro/campaigns/route.ts`, ajouter (sous `import { sendRelationInvitation } from "@/lib/email/relation";`) :

```ts
import { buildClassicPayload, buildFlashPayload, sendBatch, type ExpoPushMessage } from "@/lib/push/expo";
```

- [ ] **Step 2 : Injecter le call fire-and-forget après les emails**

Localiser le bloc `void Promise.allSettled(...)` du `sendRelationInvitation` (autour de la ligne 490). Juste **après** la fermeture du `Promise.allSettled` (après le `);` ligne ~508), ajouter :

```ts
  // Push notifications fire-and-forget — résolution des tokens Expo
  // (push_tokens.user_id = prospects.clerk_user_id) puis envoi batch.
  void (async () => {
    try {
      const isFlash = durationKey === "1h";
      const prospectIds = matched.map((m) => m.prospectId);
      if (prospectIds.length === 0) return;

      // 1. Map prospect_id → clerk_user_id.
      const { data: pRows, error: pErr } = await admin
        .from("prospects")
        .select("id, clerk_user_id")
        .in("id", prospectIds);
      if (pErr) {
        console.error("[/api/pro/campaigns push] prospects lookup failed", pErr);
        return;
      }
      const clerkByProspect = new Map<string, string>();
      for (const r of pRows ?? []) {
        if (r.clerk_user_id) clerkByProspect.set(r.id, r.clerk_user_id);
      }

      // 2. Récupère tous les tokens Expo de ces users.
      const clerkIds = [...new Set([...clerkByProspect.values()])];
      if (clerkIds.length === 0) return;
      const { data: tokens, error: tErr } = await admin
        .from("push_tokens")
        .select("user_id, expo_token")
        .in("user_id", clerkIds);
      if (tErr) {
        console.error("[/api/pro/campaigns push] tokens lookup failed", tErr);
        return;
      }

      // 3. Index tokens par user_id (multi-device).
      const tokensByClerk = new Map<string, string[]>();
      for (const row of tokens ?? []) {
        const list = tokensByClerk.get(row.user_id) ?? [];
        list.push(row.expo_token);
        tokensByClerk.set(row.user_id, list);
      }

      // 4. Construit un message par (prospect × token).
      const messages: ExpoPushMessage[] = [];
      for (const m of matched) {
        const clerk = clerkByProspect.get(m.prospectId);
        if (!clerk) continue;
        const userTokens = tokensByClerk.get(clerk) ?? [];
        if (userTokens.length === 0) continue;
        const relationId = relationIdByProspect.get(m.prospectId);
        if (!relationId) continue;
        const rewardEur = rewardForProspect(m) / 100;
        for (const token of userTokens) {
          messages.push(
            isFlash
              ? buildFlashPayload({
                  token,
                  proName,
                  rewardEur,
                  relationId,
                  campaignId: campaign.id,
                })
              : buildClassicPayload({
                  token,
                  proName,
                  rewardEur,
                  durationKey,
                  relationId,
                }),
          );
        }
      }

      await sendBatch(admin, messages);
    } catch (e) {
      console.error("[/api/pro/campaigns push] unexpected error", e);
    }
  })();
```

- [ ] **Step 3 : Re-lancer la suite de tests Vitest globale**

```bash
npx vitest run
```

Expected : tous les tests existants passent + les nouveaux. Aucune régression sur la route campaigns (les tests existants couvrent le payload de retour).

- [ ] **Step 4 : Smoke test manuel local (optionnel)**

1. `EXPO_ACCESS_TOKEN` non requis pour ce test (quota anonyme suffit).
2. INSERT manuellement une row push_tokens via SQL Editor :
   ```sql
   INSERT INTO push_tokens (user_id, expo_token, platform)
   VALUES ('test-clerk-user', 'ExponentPushToken[INVALID-TEST]', 'ios');
   ```
3. Lancer une campagne sur cet user via le UI pro.
4. Dans les logs Vercel (ou `npm run dev` local), vérifier qu'on voit
   `[push] ticket error ... InvalidCredentials` ou similaire (token bidon).
5. Vérifier que la row push_tokens a été supprimée (cleanup automatique sur DeviceNotRegistered) :
   ```sql
   SELECT * FROM push_tokens WHERE expo_token = 'ExponentPushToken[INVALID-TEST]';
   ```
   Note : InvalidCredentials ne déclenche pas le cleanup (seuls DeviceNotRegistered le fait). Pour vraiment tester le cleanup, il faut un token Expo qui a été révoqué (cas réel).

- [ ] **Step 5 : Commit**

```bash
git add app/api/pro/campaigns/route.ts
git commit -m "feat(api/campaigns): fire-and-forget push aux prospects matchés"
```

---

## Phase B — Mobile core (token + handler)

### Task 6 : Module `mobile/lib/push.ts`

**Files:**
- Create: `mobile/lib/push.ts`

- [ ] **Step 1 : Écrire le module**

`mobile/lib/push.ts` :

```ts
// Permission, registration et channels Android. Pas d'API publique
// React (pas de hook) — c'est consommé impérativement depuis _layout
// et l'écran d'onboarding.
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { apiBase } from "./api";

const TOKEN_KEY = "buupp.push.expo_token.v1";

export type PushStatus = "granted" | "denied" | "undetermined";

/**
 * Demande la permission OS si nécessaire, récupère le token Expo,
 * et l'enregistre côté backend via /api/me/push-token.
 *
 * Idempotent — peut être rappelée plusieurs fois sans risque (upsert
 * côté serveur, no-op si la permission est `denied`).
 *
 * @param getClerkToken — fonction async qui renvoie le JWT Clerk (cf. useAuth().getToken)
 */
export async function registerForPushNotifications(
  getClerkToken: () => Promise<string | null>,
): Promise<{ status: PushStatus; token?: string }> {
  const current = await Notifications.getPermissionsAsync();
  let status: PushStatus = current.granted
    ? "granted"
    : current.canAskAgain
      ? "undetermined"
      : "denied";

  if (status === "undetermined") {
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    status = asked.granted ? "granted" : "denied";
  }
  if (status !== "granted") return { status };

  let token: string;
  try {
    const projectId = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)
      ?.eas as { projectId?: string } | undefined;
    const result = await Notifications.getExpoPushTokenAsync(
      projectId?.projectId ? { projectId: projectId.projectId } : undefined,
    );
    token = result.data;
  } catch (e) {
    console.warn("[push] getExpoPushTokenAsync failed", e);
    return { status: "granted" };
  }

  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    /* best-effort */
  }

  // POST au backend (sans dépendre du hook useApi pour pouvoir être
  // appelée depuis un effet hors-React tree au cold start).
  try {
    const jwt = await getClerkToken();
    if (!jwt) return { status, token };
    await fetch(`${apiBase()}/api/me/push-token`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        token,
        platform: Platform.OS === "ios" ? "ios" : "android",
        appVersion: Constants.expoConfig?.version,
      }),
    });
  } catch (e) {
    console.warn("[push] register POST failed", e);
  }

  return { status, token };
}

/**
 * Supprime le token côté backend (sign-out). Best-effort — n'échoue
 * pas si la requête plante (le user voudrait quand même se déconnecter).
 */
export async function unregisterPushToken(
  getClerkToken: () => Promise<string | null>,
): Promise<void> {
  let token: string | null = null;
  try {
    token = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    /* swallow */
  }
  if (!token) return;
  try {
    const jwt = await getClerkToken();
    if (!jwt) return;
    await fetch(`${apiBase()}/api/me/push-token`, {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ token }),
    });
  } catch (e) {
    console.warn("[push] unregister DELETE failed", e);
  }
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* swallow */
  }
}

/**
 * Crée les channels Android (no-op iOS). À appeler au mount du root.
 */
export async function ensurePushChannelsAndroid(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("solicitations-classic", {
    name: "Sollicitations",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
    vibrationPattern: [0, 250],
    lightColor: "#7C5CFC",
  });
  await Notifications.setNotificationChannelAsync("solicitations-flash", {
    name: "Flash deals",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 300, 200, 300],
    lightColor: "#FF7A6B",
  });
}
```

- [ ] **Step 2 : Vérifier que TypeScript compile**

```bash
cd mobile && npm run typecheck
```

Expected : 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add mobile/lib/push.ts
git commit -m "feat(mobile/push): module register/unregister + channels Android"
```

---

### Task 7 : Provider + composant `InAppPushBanner`

**Files:**
- Create: `mobile/components/in-app-push-banner.tsx`

- [ ] **Step 1 : Écrire le composant**

`mobile/components/in-app-push-banner.tsx` :

```tsx
// Bannière in-app slide-down affichée quand un push arrive en
// foreground (le shouldShowBanner du handler est false, donc l'OS ne
// montre pas sa propre bannière). Auto-dismiss 4s + swipe-up.
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type PushBannerMessage = {
  type: "classic" | "flash";
  title: string;
  body: string;
  data: Record<string, unknown>;
};

type Ctx = {
  show: (msg: PushBannerMessage) => void;
  hide: () => void;
};

const PushBannerContext = createContext<Ctx | null>(null);

export function usePushBanner(): Ctx {
  const ctx = useContext(PushBannerContext);
  if (!ctx) throw new Error("usePushBanner hors PushBannerProvider");
  return ctx;
}

const AUTO_DISMISS_MS = 4000;
const SLIDE_MS = 280;

export function PushBannerProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<PushBannerMessage | null>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const ty = useSharedValue(-160);
  const op = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    ty.value = withTiming(-160, { duration: 200, easing: Easing.in(Easing.cubic) });
    op.value = withTiming(0, { duration: 180 }, (done) => {
      if (done) runOnJS(setMsg)(null);
    });
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, [op, ty]);

  const show = useCallback(
    (next: PushBannerMessage) => {
      setMsg(next);
      ty.value = withTiming(0, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) });
      op.value = withTiming(1, { duration: SLIDE_MS });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(hide, AUTO_DISMISS_MS);
    },
    [hide, op, ty],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
    opacity: op.value,
  }));

  const swipeUp = Gesture.Pan().onEnd((e) => {
    if (e.translationY < -20) runOnJS(hide)();
  });

  function onTap() {
    if (!msg) return;
    const screen = msg.data.screen as string | undefined;
    const relationId = msg.data.relationId as string | undefined;
    const campaignId = msg.data.campaignId as string | undefined;
    if (screen === "relations" && relationId) {
      router.push(`/(prospect)/relations?focusRelation=${encodeURIComponent(relationId)}`);
    } else if (screen === "flash-deals" && campaignId) {
      router.push(`/(prospect)/portefeuille?openFlash=${encodeURIComponent(campaignId)}`);
    }
    hide();
  }

  const ctxValue = useRef<Ctx>({ show, hide });
  ctxValue.current = { show, hide };

  return (
    <PushBannerContext.Provider value={ctxValue.current}>
      {children}
      {msg ? (
        <GestureDetector gesture={swipeUp}>
          <Animated.View
            pointerEvents="box-none"
            style={[
              {
                position: "absolute",
                top: insets.top + 8,
                left: 12,
                right: 12,
                zIndex: 1000,
              },
              aStyle,
            ]}
          >
            <Pressable
              onPress={onTap}
              accessibilityRole="button"
              accessibilityLabel={`${msg.title}. ${msg.body}. Touchez pour ouvrir.`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 16,
                borderLeftWidth: 4,
                backgroundColor: msg.type === "flash" ? "#0F1629" : "#FFFFFF",
                borderLeftColor: msg.type === "flash" ? "#FF7A6B" : "#7C5CFC",
                shadowColor: "#0F1629",
                shadowOpacity: 0.18,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: Platform.OS === "android" ? 6 : 0,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    msg.type === "flash" ? "rgba(255,122,107,0.18)" : "#EDE9FE",
                }}
              >
                <Text style={{ fontSize: 22 }}>
                  {msg.type === "flash" ? "⚡" : "👋"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontWeight: "600",
                    fontSize: 14,
                    color: msg.type === "flash" ? "#FFFFFF" : "#0F1629",
                  }}
                >
                  {msg.title}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 13,
                    marginTop: 2,
                    color: msg.type === "flash" ? "rgba(255,255,255,0.85)" : "#5B6478",
                  }}
                >
                  {msg.body}
                </Text>
              </View>
              <Pressable
                onPress={hide}
                hitSlop={10}
                accessibilityLabel="Fermer"
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={msg.type === "flash" ? "rgba(255,255,255,0.6)" : "#8A91A1"}
                />
              </Pressable>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      ) : null}
    </PushBannerContext.Provider>
  );
}
```

- [ ] **Step 2 : Vérifier que TypeScript compile**

```bash
cd mobile && npm run typecheck
```

Expected : 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add mobile/components/in-app-push-banner.tsx
git commit -m "feat(mobile/push): InAppPushBanner provider + composant slide-down"
```

---

### Task 8 : Wire-up dans `mobile/app/_layout.tsx`

**Files:**
- Modify: `mobile/app/_layout.tsx`

- [ ] **Step 1 : Lire le fichier pour repérer les zones à modifier**

```bash
cat mobile/app/_layout.tsx
```

Le but : ajouter (a) le handler global, (b) les channels Android, (c) les listeners de notification, (d) wrapper l'arbre avec `<PushBannerProvider>`, (e) re-poster le token au cold start si permission déjà accordée.

- [ ] **Step 2 : Insérer les imports**

Ajouter en haut du fichier, sous les imports existants :

```ts
import * as Notifications from "expo-notifications";
import { useAuth } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

import { PushBannerProvider, usePushBanner } from "../components/in-app-push-banner";
import { ensurePushChannelsAndroid, registerForPushNotifications } from "../lib/push";
```

(Garder les imports déjà présents — `useEffect`, etc.)

- [ ] **Step 3 : Configurer le handler global (hors du composant)**

Ajouter, juste sous les imports et avant le `export default function RootLayout()` :

```ts
// Handler global — bannière OS off en foreground (on a notre bannière
// in-app), mais on garde la notification dans la "Notification list"
// du centre de notifs (badge + son OK).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

- [ ] **Step 4 : Créer un composant interne `PushBridge` qui consomme les contextes (banner + auth + queryClient)**

Toujours dans `mobile/app/_layout.tsx`, ajouter avant `RootLayout` :

```ts
function PushBridge() {
  const banner = usePushBanner();
  const { getToken, isSignedIn } = useAuth();
  const qc = useQueryClient();

  // Setup Android channels une seule fois au mount.
  useEffect(() => {
    void ensurePushChannelsAndroid();
  }, []);

  // Au cold start signed-in : refresh silencieux du token (last_seen_at).
  useEffect(() => {
    if (!isSignedIn) return;
    void registerForPushNotifications(getToken);
  }, [isSignedIn, getToken]);

  // Foreground listener — bannière + refetch.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notif) => {
      const data = (notif.request.content.data ?? {}) as Record<string, unknown>;
      const type = data.type === "flash" ? "flash" : "classic";
      banner.show({
        type,
        title: notif.request.content.title ?? "",
        body: notif.request.content.body ?? "",
        data,
      });
      void qc.invalidateQueries({ queryKey: ["prospect", "relations"] });
      void qc.invalidateQueries({ queryKey: ["flash-deals"] });
    });
    return () => sub.remove();
  }, [banner, qc]);

  // Tap listener (warm + cold start).
  useEffect(() => {
    function handle(response: Notifications.NotificationResponse) {
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      const screen = data.screen as string | undefined;
      const relationId = data.relationId as string | undefined;
      const campaignId = data.campaignId as string | undefined;
      if (screen === "relations" && relationId) {
        router.push(`/(prospect)/relations?focusRelation=${encodeURIComponent(relationId)}`);
      } else if (screen === "flash-deals" && campaignId) {
        router.push(`/(prospect)/portefeuille?openFlash=${encodeURIComponent(campaignId)}`);
      }
    }
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) handle(r);
    });
    return () => sub.remove();
  }, []);

  return null;
}
```

- [ ] **Step 5 : Wrapper l'arbre existant**

Localiser le rendu de `RootLayout` (probablement un `<Stack>...</Stack>` ou `<QueryClientProvider>...`). Wrapper l'intérieur du QueryClientProvider (ou équivalent) avec `<PushBannerProvider>` et insérer `<PushBridge />` à l'intérieur. Exemple type :

```tsx
return (
  <ClerkProvider /* ... */>
    <QueryClientProvider client={queryClient}>
      <PushBannerProvider>
        <PushBridge />
        <Stack screenOptions={{ headerShown: false }} />
      </PushBannerProvider>
    </QueryClientProvider>
  </ClerkProvider>
);
```

Adapter à la structure réellement présente dans le fichier (sans changer l'ordre des providers ClerkProvider/QueryClientProvider qui existe déjà).

- [ ] **Step 6 : Vérifier typecheck + lancer Expo**

```bash
cd mobile && npm run typecheck
```

Expected : 0 erreur.

```bash
cd mobile && npm start
```

Recharger l'app sur ton appareil. **Aucun crash attendu**, même si la permission n'est pas encore demandée (le code est défensif : si denied, `registerForPushNotifications` no-op).

- [ ] **Step 7 : Commit**

```bash
git add mobile/app/_layout.tsx
git commit -m "feat(mobile/push): handler + listeners + bridge providers"
```

---

## Phase C — Mobile UX (onboarding + deep links + cleanup)

### Task 9 : 4e slide onboarding "Activer les notifications"

**Files:**
- Modify: `mobile/app/(onboarding)/index.tsx`

- [ ] **Step 1 : Ajouter l'import du module push**

En haut de `mobile/app/(onboarding)/index.tsx`, sous les imports existants :

```ts
import { useAuth } from "@clerk/clerk-expo";
import { registerForPushNotifications } from "../../lib/push";
```

- [ ] **Step 2 : Créer le composant art `PhonePushPreview` (mockup statique)**

Au-dessus de `const SLIDES: Slide[] = [` :

```tsx
// Mockup statique d'une notification BUUPP sur lockscreen — montre au
// prospect ce qu'il recevra. Pas d'animation : volontairement calme
// (la slide elle-même apparaît avec le fondu global de l'écran).
function PhonePushPreview() {
  return (
    <View className="h-64 w-full items-center justify-center">
      <View
        style={{
          width: 280,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 18,
          backgroundColor: "#FFFFFF",
          borderLeftWidth: 4,
          borderLeftColor: "#7C5CFC",
          shadowColor: "#0F1629",
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            backgroundColor: "#EDE9FE",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 22 }}>👋</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "600", fontSize: 14, color: "#0F1629" }}>
            Une nouvelle sollicitation
          </Text>
          <Text
            numberOfLines={2}
            style={{ fontSize: 13, marginTop: 2, color: "#5B6478" }}
          >
            Coiffure Lola · +3,40 € · expire dans 24h
          </Text>
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 3 : Ajouter la slide à `SLIDES`**

À la fin du tableau `SLIDES` (après le `buuppers`), ajouter :

```tsx
  {
    key: "notifications",
    eyebrow: "Une dernière chose",
    title: (
      <>
        Restez connecté aux <Accent>opportunités.</Accent>
      </>
    ),
    subtitle:
      "On vous prévient dès qu'un pro accepte de vous payer. Pas de spam — uniquement les sollicitations qui rapportent.",
    art: <PhonePushPreview />,
  },
```

- [ ] **Step 4 : Modifier le composant `Onboarding` pour gérer la permission sur la dernière slide**

Localiser `function next()` (vers la ligne 321) :

```ts
function next() {
  if (index >= last) return finish();
  listRef.current?.scrollToIndex({ index: index + 1, animated: true });
}
```

Remplacer par :

```ts
const { getToken } = useAuth();

async function finish() {
  await markOnboardingSeen();
  router.replace("/(auth)/sign-in");
}

async function activateThenFinish() {
  try {
    await registerForPushNotifications(getToken);
  } catch (e) {
    console.warn("[onboarding] register push failed (silent)", e);
  }
  await finish();
}

function next() {
  if (index >= last) return activateThenFinish();
  listRef.current?.scrollToIndex({ index: index + 1, animated: true });
}
```

**Important** : retirer la définition précédente de `finish` plus haut dans le fichier (la version actuelle). Le `useAuth()` + `activateThenFinish` les remplacent. Garder le `Pressable onPress={finish}` du bouton "Passer" — il reste fonctionnel sans permission.

- [ ] **Step 5 : Mettre à jour le label du bouton primaire**

Localiser le `<PrimaryButton label={index >= last ? "Commencer" : "Suivant"} ... />` (ligne ~399) :

```tsx
<PrimaryButton
  label={index >= last ? "Activer les notifications" : "Suivant"}
  arrow
  onPress={next}
/>
```

- [ ] **Step 6 : Vérifier sur device**

```bash
cd mobile && npm start
```

Reload, swipe entre les 4 slides. Sur la dernière, le label = "Activer les notifications". Tap → prompt iOS/Android apparaît. Accepter ou refuser → redirige vers /(auth)/sign-in. "Passer" (header) → finish() direct sans prompt.

- [ ] **Step 7 : Commit**

```bash
git add mobile/app/\(onboarding\)/index.tsx
git commit -m "feat(mobile/onboarding): slide 4 'Activer les notifications'"
```

---

### Task 10 : Deep link `focusRelation` dans `/relations`

**Files:**
- Modify: `mobile/app/(prospect)/relations.tsx`

- [ ] **Step 1 : Lire le fichier pour repérer le `FlatList` ou le rendu des cards**

Le fichier n'utilise pas de FlatList (vu en Session — c'est un `map` direct dans un `View`). On va :
- Lire `useLocalSearchParams().focusRelation`.
- Trouver l'index correspondant dans `filteredHistory`.
- Si trouvé, passer un flag `isFocused` à `HistoryRow` qui animera sa border violette pendant 1.5s, puis `setParams({ focusRelation: undefined })`.

Note importante : comme c'est un map direct sans virtualisation, le scroll auto n'est possible que via `measureLayout` ou en mesurant la position après render. Pour simplifier, on ne fera **pas de scroll auto** en v1 — seulement le **highlight visuel pulsé** (la card est visible sans scroll dans 80% des cas car peu d'historique). Le user pourra scroll manuellement si besoin.

- [ ] **Step 2 : Ajouter l'import `useLocalSearchParams` et modifier le composant**

En haut de `mobile/app/(prospect)/relations.tsx`, ajouter :

```ts
import { useLocalSearchParams, router } from "expo-router";
```

(Si `router` est déjà importé via une autre source, ne pas dupliquer.)

Dans `export default function Relations()`, juste après les `useState` :

```ts
const params = useLocalSearchParams<{ focusRelation?: string }>();
const focusRelationId = typeof params.focusRelation === "string" ? params.focusRelation : null;

// Clear le param après 2s pour éviter de re-déclencher l'animation
// au prochain focus.
useEffect(() => {
  if (!focusRelationId) return;
  const t = setTimeout(() => {
    router.setParams({ focusRelation: undefined });
  }, 2000);
  return () => clearTimeout(t);
}, [focusRelationId]);
```

- [ ] **Step 3 : Modifier `HistoryRow` pour accepter un flag `focused`**

Trouver la signature :

```ts
function HistoryRow({ r, onPress }: { r: Relation; onPress: () => void }) {
```

Remplacer par :

```ts
function HistoryRow({
  r,
  onPress,
  focused,
}: {
  r: Relation;
  onPress: () => void;
  focused?: boolean;
}) {
```

Puis, dans le `<LinearGradient style={{ ... borderColor: "#CBC7B9", borderWidth: 0.7, ... }}>`, faire varier borderColor / borderWidth selon `focused`. Plus simple : ajouter un effet de halo Animated. V1 minimaliste, sans Animated :

Remplacer juste les lignes `borderWidth: 0.7, borderColor: "#CBC7B9"` par :

```ts
borderWidth: focused ? 2 : 0.7,
borderColor: focused ? "#7C5CFC" : "#CBC7B9",
```

(Effet pulsé : on peut l'ajouter plus tard. V1 → border violette franche pendant 2s suffit pour signaler "c'est celle-là".)

- [ ] **Step 4 : Passer `focused` au mapping**

Trouver la boucle :

```tsx
{filteredHistory.map((r) => (
  <HistoryRow
    key={r.id}
    r={r}
    onPress={() => { setDetail(r); setDetailVisible(true); }}
  />
))}
```

Remplacer par :

```tsx
{filteredHistory.map((r) => (
  <HistoryRow
    key={r.id}
    r={r}
    focused={focusRelationId === r.id}
    onPress={() => { setDetail(r); setDetailVisible(true); }}
  />
))}
```

Note : le `focusRelation` désigne une relation reçue qui apparaîtra plutôt dans le bloc `pending` (demandes en attente) que dans `history`. Faire de même côté pending. Trouver la boucle `d.pending.map((r) => ...)` et ajouter un wrapper conditionnel. Plus simple : passer aussi `focused` à la `<Card>` pending. Si le composant `Card` n'accepte pas de prop border-override, on enveloppe :

```tsx
{d.pending.map((r) => (
  <View
    key={r.id}
    style={
      focusRelationId === r.id
        ? { borderWidth: 2, borderColor: "#7C5CFC", borderRadius: 18 }
        : undefined
    }
  >
    <Card badge={{ icon: "people-outline", tone: "coral" }}>
      {/* ... contenu inchangé ... */}
    </Card>
  </View>
))}
```

- [ ] **Step 5 : Test manuel**

Sur device : `npm start`, depuis n'importe quel autre écran de l'app, taper dans l'URL bar Metro (ou via deeplink Safari avec scheme `buupp://`) :

```
buupp://(prospect)/relations?focusRelation=<id-existant>
```

L'écran s'ouvre, la card cible a une bordure violette pendant 2s. Puis param effacé.

- [ ] **Step 6 : Commit**

```bash
git add mobile/app/\(prospect\)/relations.tsx
git commit -m "feat(mobile/relations): focusRelation deep-link (border violet 2s)"
```

---

### Task 11 : Deep link `openFlash` — context partagé pour `FlashDealsSheet`

**Files:**
- Create: `mobile/components/flash-sheet-context.tsx`
- Modify: `mobile/app/(prospect)/_layout.tsx` (wrap avec le provider)
- Modify: `mobile/components/app-header.tsx` (consomme le context)
- Modify: `mobile/app/(prospect)/portefeuille.tsx` (déclenche l'ouverture sur param)

- [ ] **Step 1 : Créer le context**

`mobile/components/flash-sheet-context.tsx` :

```tsx
import { createContext, useCallback, useContext, useState } from "react";

type Ctx = {
  /** true = sheet ouvert ; null = fermé */
  initialDealId: string | null;
  open: (dealId?: string) => void;
  close: () => void;
};

const FlashSheetCtx = createContext<Ctx | null>(null);

export function FlashSheetProvider({ children }: { children: React.ReactNode }) {
  const [initialDealId, setInitialDealId] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const open = useCallback((dealId?: string) => {
    setInitialDealId(dealId ?? null);
    setOpened(true);
  }, []);
  const close = useCallback(() => {
    setOpened(false);
    setInitialDealId(null);
  }, []);
  return (
    <FlashSheetCtx.Provider
      value={{ initialDealId: opened ? initialDealId : null, open, close }}
    >
      {children}
    </FlashSheetCtx.Provider>
  );
}

export function useFlashSheet(): Ctx {
  const ctx = useContext(FlashSheetCtx);
  if (!ctx) throw new Error("useFlashSheet hors FlashSheetProvider");
  return ctx;
}
```

- [ ] **Step 2 : Wrap `(prospect)/_layout.tsx` avec le provider**

Lire le fichier :

```bash
cat mobile/app/\(prospect\)/_layout.tsx
```

Localiser le `return <Tabs ... />` ou équivalent. Ajouter l'import :

```ts
import { FlashSheetProvider } from "../../components/flash-sheet-context";
```

Et wrapper le rendu :

```tsx
return (
  <FlashSheetProvider>
    {/* contenu existant inchangé : <Tabs />, etc. */}
  </FlashSheetProvider>
);
```

- [ ] **Step 3 : Modifier `app-header.tsx` pour piloter le sheet via le context**

Dans `mobile/components/app-header.tsx` :

Ajouter l'import :
```ts
import { useFlashSheet } from "./flash-sheet-context";
```

Dans `AppHeader()`, remplacer la ligne `const [showFlash, setShowFlash] = useState(false);` par :

```ts
const flashSheet = useFlashSheet();
const [openedFromHeader, setOpenedFromHeader] = useState(false);
// Sheet ouvert si tap header OU si deep-link openFlash a posé un initialDealId.
const sheetVisible = openedFromHeader || flashSheet.initialDealId !== null;

function handleOpenFromHeader() {
  setOpenedFromHeader(true);
}
function handleCloseSheet() {
  setOpenedFromHeader(false);
  flashSheet.close();
}
```

Puis dans le JSX, remplacer le `FlashHeaderButton` :
```tsx
<FlashHeaderButton onPress={handleOpenFromHeader} active={flashCount > 0} />
```

Et le `FlashDealsSheet` :
```tsx
<FlashDealsSheet
  visible={sheetVisible}
  initialDealId={flashSheet.initialDealId ?? undefined}
  onClose={handleCloseSheet}
/>
```

- [ ] **Step 4 : Modifier `FlashDealsSheet` pour accepter `initialDealId`**

Lire `mobile/components/flash-deals-sheet.tsx` (chemin à confirmer via `find mobile/components -name "flash-deals-sheet*"`). Ajouter à la signature :

```ts
type Props = {
  visible: boolean;
  onClose: () => void;
  initialDealId?: string;
};
```

Dans le body : si `initialDealId` est défini ET la liste de deals est chargée, scroll vers le deal correspondant (ou highlight). Si le composant utilise déjà un FlatList, appeler `scrollToIndex` quand `visible && initialDealId && deals.find(d => d.id === initialDealId)`. Si pas de FlatList, juste placer le deal cible en tête de liste pour cette session via un sort partial.

V1 minimaliste : ouvre simplement le sheet avec la liste normale, l'user voit ses deals dont celui cliqué. Le scroll-auto peut attendre une itération suivante.

- [ ] **Step 5 : Modifier `portefeuille.tsx` pour lire `openFlash` au mount**

Dans `mobile/app/(prospect)/portefeuille.tsx` (ouvrir le fichier pour repérer la structure) :

```ts
import { useLocalSearchParams, router } from "expo-router";
import { useEffect } from "react";

import { useFlashSheet } from "../../components/flash-sheet-context";
```

Dans le composant principal, ajouter au début (après autres hooks) :

```ts
const params = useLocalSearchParams<{ openFlash?: string }>();
const flashSheet = useFlashSheet();

useEffect(() => {
  if (typeof params.openFlash !== "string") return;
  flashSheet.open(params.openFlash);
  // Clear param pour éviter ré-ouverture au prochain focus.
  router.setParams({ openFlash: undefined });
}, [params.openFlash, flashSheet]);
```

- [ ] **Step 6 : Vérifier typecheck**

```bash
cd mobile && npm run typecheck
```

Expected : 0 erreur.

- [ ] **Step 7 : Test manuel**

```bash
cd mobile && npm start
```

Recharger, depuis Safari sur le device :
```
buupp://(prospect)/portefeuille?openFlash=<id-d-un-deal-actif>
```

L'écran portefeuille s'ouvre, le `FlashDealsSheet` s'ouvre automatiquement.

- [ ] **Step 8 : Commit**

```bash
git add mobile/components/flash-sheet-context.tsx mobile/app/\(prospect\)/_layout.tsx mobile/components/app-header.tsx mobile/components/flash-deals-sheet.tsx mobile/app/\(prospect\)/portefeuille.tsx
git commit -m "feat(mobile/flash): context FlashSheet + deep-link openFlash"
```

---

### Task 12 : Cleanup token au sign-out (drawer)

**Files:**
- Modify: `mobile/components/drawer-panel.tsx`

- [ ] **Step 1 : Ajouter l'import**

Sous l'import existant `import { resetOnboardingSeen } from "../lib/onboarding";` :

```ts
import { unregisterPushToken } from "../lib/push";
```

- [ ] **Step 2 : Appeler `unregisterPushToken` avant `signOut` dans les deux handlers**

Localiser `doSignOut` et `doDelete`. Modifier :

```ts
async function doSignOut() {
  setBusy(true);
  try {
    await unregisterPushToken(getToken).catch(() => {}); // best-effort
    await signOut();
    router.replace("/(auth)/sign-in");
  } catch {
    setBusy(false);
    Alert.alert("Erreur", "La déconnexion a échoué. Réessayez.");
  }
}
async function doDelete() {
  setBusy(true);
  try {
    await unregisterPushToken(getToken).catch(() => {});
    await del.mutateAsync();
    await signOut();
    router.replace("/(auth)/sign-in");
  } catch {
    setBusy(false);
    Alert.alert(
      "Erreur",
      "La suppression du compte a échoué. Réessayez plus tard.",
    );
  }
}
```

**Important** : ajouter `getToken` à la destructuration de `useAuth()` en haut du composant :

```ts
const { signOut, getToken } = useAuth();
```

- [ ] **Step 3 : Test manuel**

Sur device : se connecter, déclencher une notif (cf. task 13 pour le test E2E), puis se déconnecter. Vérifier dans Supabase :

```sql
SELECT * FROM push_tokens WHERE user_id = '<ton-clerk-id>';
```

Expected : 0 rows.

- [ ] **Step 4 : Commit**

```bash
git add mobile/components/drawer-panel.tsx
git commit -m "feat(mobile/drawer): unregisterPushToken au sign-out + delete account"
```

---

## Phase D — Vérification end-to-end

### Task 13 : Smoke test E2E sur device

**Files:** aucun (vérification opérationnelle uniquement).

- [ ] **Step 1 : Vérifier l'environnement**

- Variable Vercel `EXPO_ACCESS_TOKEN` (optionnelle mais recommandée) : créer via [https://expo.dev/accounts/<account>/settings/access-tokens](https://expo.dev/accounts/) et l'ajouter à Vercel `production`, `preview`, `development`. Sans elle, le quota anonyme suffira pour les tests.
- Mobile : `EXPO_PUBLIC_API_BASE_URL` pointe vers ton déploiement Vercel (déjà configuré).

- [ ] **Step 2 : Cas 1 — Permission accordée + sollicitation classique**

1. Sur device, lancer Expo Go → `npm start` dans `mobile/`, scanner le QR.
2. Drawer → "Revoir l'onboarding" → arriver à la slide 4 → tap "Activer les notifications" → accepter iOS prompt.
3. Vérifier Supabase :
   ```sql
   SELECT user_id, expo_token, platform FROM push_tokens ORDER BY created_at DESC LIMIT 5;
   ```
   Une nouvelle row existe avec le token Expo Go (`ExponentPushToken[...]`).
4. Depuis un autre user (un compte pro test), lancer une campagne **classique** (durationKey = "24h") qui match ton prospect.
5. Mettre l'app en background (home screen iOS).
6. Attendre quelques secondes → notification reçue : titre `👋 Une nouvelle sollicitation`, body `<ProName> · +X,XX € · expire dans 24h`.
7. Tap sur la notif → l'app s'ouvre directement sur `/(prospect)/relations` avec la card en pending entourée d'une bordure violette (param `focusRelation`).

- [ ] **Step 3 : Cas 2 — Flash deal**

1. Toujours signed-in.
2. Depuis le compte pro, lancer une campagne **flash** (durationKey = "1h").
3. Mettre l'app en background.
4. Notification reçue : titre `⚡ Flash deal — 1h pour saisir`, body avec `prime ×2`.
5. Tap → app ouvre `/(prospect)/portefeuille` + `FlashDealsSheet` ouvert automatiquement.

- [ ] **Step 4 : Cas 3 — Foreground (bannière in-app)**

1. Rester sur n'importe quel écran de l'app, app en foreground.
2. Lancer une campagne classique côté pro.
3. La bannière in-app slide down depuis le haut (fond paper, bord violet, emoji 👋), reste 4s, puis disparaît.
4. Tap dessus → navigation vers `/relations?focusRelation=...` comme cas 1.
5. Recommencer avec une campagne flash → bannière fond navy + bord coral + emoji ⚡.

- [ ] **Step 5 : Cas 4 — Sign-out cleanup**

1. Drawer → Déconnexion → confirmer.
2. Vérifier Supabase :
   ```sql
   SELECT * FROM push_tokens WHERE user_id = '<ton-clerk-id>';
   ```
   Expected : 0 row.

- [ ] **Step 6 : Cas 5 — Permission refusée**

1. Se reconnecter avec un autre compte test (ou réinitialiser onboarding + supprimer l'app pour réinitialiser la permission iOS).
2. Slide 4 → "Activer les notifications" → **refuser** iOS prompt.
3. Vérifier : aucune row dans `push_tokens` pour ce user.
4. Lancer une campagne le ciblant → aucune notif reçue. Logs serveur ne loggent pas d'erreur (juste pas de push envoyé).

- [ ] **Step 7 : Cas 6 — Token expiré (DeviceNotRegistered)**

Plus difficile à reproduire artificiellement. À tester si jamais on observe le cas en prod : un user désinstalle l'app → on continue de tenter le push → Expo retourne `DeviceNotRegistered` dans le receipt → cleanup auto serveur. Pas de bloquer en v1.

- [ ] **Step 8 : Vérifier les critères d'acceptation du spec**

Re-lire la section "Critères d'acceptation" du spec [`2026-05-24-mobile-push-notifications-prospect-design.md`](../specs/2026-05-24-mobile-push-notifications-prospect-design.md) et cocher chaque ligne.

- [ ] **Step 9 : Push commits & ouvrir PR (optionnel — au choix de l'utilisateur)**

```bash
git push origin worktree-mobile-app
# puis :
gh pr create --title "feat(mobile): push notifications prospect (classique + flash deal)" --body "$(cat <<'EOF'
## Summary
- Backend : table push_tokens, endpoints /api/me/push-token (POST/DELETE), helper lib/push/expo.ts, hook fire-and-forget dans /api/pro/campaigns
- Mobile : module lib/push.ts, handler global + listeners au _layout, bannière in-app PushBannerProvider, slide 4 onboarding "Activer les notifications", deep links focusRelation + openFlash, cleanup token au sign-out

## Test plan
- [ ] Slide 4 onboarding : "Activer" → permission OS prompt → row push_tokens créée
- [ ] Campagne classique → push 👋 → tap ouvre /relations + card highlight
- [ ] Campagne flash → push ⚡ → tap ouvre /portefeuille + FlashDealsSheet
- [ ] Foreground : bannière in-app slide-down (violet classique / navy flash)
- [ ] Sign-out → row push_tokens supprimée
- [ ] Permission refusée → aucun envoi, aucune erreur loggée

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Hors scope (rappels)

- Préférences fines (quiet hours, mute par type) — l'user gère via iOS Settings.
- Action buttons lockscreen (Accepter/Refuser sans ouvrir l'app).
- Push pour les pros (relation acceptée, contact révélé).
- Push pour les autres events prospect (gain crédité, message admin, campagne expire bientôt).
- Push riche (image attachment, son custom, badge color) — bloqué tant qu'on est sur Expo Go.
- Scroll-auto vers la card focusRelation / le deal openFlash (V1 : highlight visuel suffit).
- Pulse animé du highlight focusRelation (V1 : border statique 2s suffit).
