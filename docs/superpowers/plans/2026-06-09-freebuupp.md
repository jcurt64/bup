# FREEBUUPP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire FREEBUUPP — un service de tirage au sort lancé par un pro (10 € → panel 30/50/80, 2/5/10 gagnants), avec vitrine publique d'inscription, tirage aléatoire vérifiable, et révélation du téléphone des gagnants au pro — sans le déployer (branche `feat/freebuupp`, flag `freebuupp_enabled=false`).

**Architecture :** Nouveau domaine isolé des `campaigns`. Deux tables (`freebuupps`, `freebuupp_participants`). Logique métier pure dans `lib/freebuupp/` (draw vérifiable, eligibility, pricing) testée par Vitest. Route handlers Next.js (App Router, runtime nodejs) pour pro/prospect/public. Backstop via le cron quotidien existant (`/api/admin/digest`). UI web en `.jsx` prototype + parité mobile dans le worktree.

**Tech Stack :** Next.js 16 (App Router), React 19, Supabase (service_role admin client), Clerk (auth), Brevo (mail), Expo push, Vitest, `node:crypto` (sha256 pour le tirage vérifiable).

**Spec de référence :** `docs/superpowers/specs/2026-06-09-freebuupp-design.md`

---

## Conventions du projet (à respecter dans chaque tâche)

- ⚠️ **NE PAS DÉPLOYER.** Branche `feat/freebuupp` uniquement, jamais `main`.
- ⚠️ **Migrations Supabase** : écrire le fichier dans `supabase/migrations/`, **NE PAS** `db push`. L'application au remote se fera plus tard via SQL Editor + `migration repair` (cf. mémoire `supabase-migrations`). Le plan crée le fichier SQL ; il ne l'applique pas.
- Read avant d'écrire : `node_modules/next/dist/docs/` si doute sur une API Next 16.
- Patterns existants : admin client = `createSupabaseAdminClient()` de `@/lib/supabase/server` ; pro = `ensureProAccount({ clerkUserId, email })` ; auth = `auth()` / `currentUser()` de `@/lib/clerk/server`.
- Tests : `npm test` (vitest run), `npm run test:watch`.
- Commits fréquents, un par étape verte.

---

## File Structure

**Créés :**
- `supabase/migrations/20260609120000_freebuupp.sql` — tables + flag + colonne transactions
- `lib/freebuupp/draw.ts` — tirage vérifiable (pur)
- `lib/freebuupp/pricing.ts` — montant + remboursement (pur)
- `lib/freebuupp/eligibility.ts` — gardes participation (pur)
- `lib/freebuupp/mail.ts` — mails gagnant / clôture (Brevo)
- `lib/freebuupp/lifecycle.ts` — transitions + backstop cron
- `lib/freebuupp/types.ts` — types partagés du domaine
- `tests/freebuupp/draw.test.ts`, `pricing.test.ts`, `eligibility.test.ts`
- `app/api/pro/freebuupps/route.ts` (POST create, GET list)
- `app/api/pro/freebuupps/[id]/route.ts` (GET detail)
- `app/api/pro/freebuupps/[id]/draw/route.ts` (POST draw)
- `app/api/prospect/freebuupps/route.ts` (GET feed)
- `app/api/prospect/freebuupps/[id]/join/route.ts` (POST join)
- `app/api/prospect/freebuupps/mine/route.ts` (GET mine)
- `app/api/freebuupps/route.ts` (GET public list)
- `app/api/freebuupps/[code]/route.ts` (GET public detail)
- `app/freebuupp/page.tsx` + `app/freebuupp/[code]/page.tsx` (public)
- UI prototype `.jsx` : pro create/detail, prospect feed/ticket/results (sous `app/_components` ou le dossier prototype suivant le pattern repo)

**Modifiés :**
- `lib/supabase/types.ts` — types des nouvelles tables (régénérés ou ajoutés à la main)
- `app/api/admin/digest/route.ts` — appel `freebuuppLifecycleTick(admin)`
- `app/cgv/...` — section FREEBUUPP

---

## Task 1: Migration SQL (tables, flag, colonne transactions)

**Files:**
- Create: `supabase/migrations/20260609120000_freebuupp.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- ════════════════════════════════════════════════════════════════════
-- FREEBUUPP — tirage au sort lancé par un pro (NON déployé)
-- ════════════════════════════════════════════════════════════════════
-- Domaine isolé des campagnes : un pro paie 10 € pour ouvrir un panel
-- (30/50/80), des prospects s'inscrivent pendant 24 h, puis un tirage
-- vérifiable désigne 2/5/10 gagnants. Le pro ne récupère que le
-- téléphone des gagnants.
-- ⚠️ Migration à appliquer plus tard via SQL Editor + `migration repair`.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.freebuupps (
  id                 uuid primary key default gen_random_uuid(),
  pro_account_id     uuid not null references public.pro_accounts(id) on delete cascade,
  code               text not null unique,
  title              text not null,
  prize_description  text not null,
  brand_name         text not null,
  panel_size         int  not null check (panel_size in (30, 50, 80)),
  winners_count      int  not null check (winners_count in (2, 5, 10)),
  geo                text not null default 'national',
  geo_target         jsonb,
  status             text not null default 'open'
                       check (status in ('open','closed','drawn','canceled')),
  opens_at           timestamptz not null default now(),
  closes_at          timestamptz not null,
  drawn_at           timestamptz,
  seed_hash          text not null,
  seed               text,
  fee_cents          bigint not null default 1000,
  refunded           boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint freebuupps_winners_lt_panel check (winners_count < panel_size)
);

create index if not exists freebuupps_pro_idx on public.freebuupps (pro_account_id);
create index if not exists freebuupps_open_idx on public.freebuupps (status) where status = 'open';
create index if not exists freebuupps_closes_idx on public.freebuupps (closes_at);

create trigger freebuupps_set_updated_at
  before update on public.freebuupps
  for each row execute function public.tg_set_updated_at();

alter table public.freebuupps enable row level security;

-- Le pro propriétaire gère ses freebuupps ; la lecture publique passe par
-- l'API en service_role (pas d'exposition directe).
create policy "freebuupps_owner_all" on public.freebuupps
  for all to authenticated
  using (exists (
    select 1 from public.pro_accounts a
    where a.id = freebuupps.pro_account_id
      and a.clerk_user_id = (select public.clerk_user_id())))
  with check (exists (
    select 1 from public.pro_accounts a
    where a.id = freebuupps.pro_account_id
      and a.clerk_user_id = (select public.clerk_user_id())));

create table if not exists public.freebuupp_participants (
  id                  uuid primary key default gen_random_uuid(),
  freebuupp_id        uuid not null references public.freebuupps(id) on delete cascade,
  prospect_id         uuid not null references public.prospects(id) on delete cascade,
  participant_number  int  not null,
  is_winner           boolean not null default false,
  created_at          timestamptz not null default now(),
  constraint freebuupp_participants_unique_prospect unique (freebuupp_id, prospect_id),
  constraint freebuupp_participants_unique_number   unique (freebuupp_id, participant_number)
);

create index if not exists freebuupp_participants_fb_idx
  on public.freebuupp_participants (freebuupp_id);
create index if not exists freebuupp_participants_prospect_idx
  on public.freebuupp_participants (prospect_id);

alter table public.freebuupp_participants enable row level security;

create policy "freebuupp_participants_select_own" on public.freebuupp_participants
  for select to authenticated
  using (exists (
    select 1 from public.prospects p
    where p.id = freebuupp_participants.prospect_id
      and p.clerk_user_id = (select public.clerk_user_id())));

-- Traçabilité wallet : on relie les transactions au freebuupp (miroir de campaign_id).
alter table public.transactions
  add column if not exists freebuupp_id uuid
    references public.freebuupps(id) on delete set null;

-- Flag d'activation (défaut false) — activable plus tard sans redéploiement.
alter table public.app_config
  add column if not exists freebuupp_enabled boolean not null default false;
```

- [ ] **Step 2: Vérifier la syntaxe localement (dry, sans push)**

Run: `npx supabase db lint --file supabase/migrations/20260609120000_freebuupp.sql` (si dispo) ou simple relecture.
Expected: pas d'erreur de syntaxe. **NE PAS** lancer `supabase db push`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260609120000_freebuupp.sql
git commit -m "feat(freebuupp): migration tables + flag + transactions.freebuupp_id (non appliquée)"
```

---

## Task 2: Types du domaine

**Files:**
- Create: `lib/freebuupp/types.ts`

- [ ] **Step 1: Écrire les types**

```ts
// Domaine FREEBUUPP — types partagés (DTO API + logique métier).

export type FreebuuppStatus = "open" | "closed" | "drawn" | "canceled";
export type PanelSize = 30 | 50 | 80;
export type WinnersCount = 2 | 5 | 10;

export const PANEL_SIZES: PanelSize[] = [30, 50, 80];
export const WINNERS_COUNTS: WinnersCount[] = [2, 5, 10];

export type GeoTarget =
  | { type: "ville"; nom: string; code: string; codesPostaux: string[] }
  | { type: "dept"; nom: string; code: string }
  | { type: "region"; nom: string; code: string; deptCodes: string[] }
  | null;

/** Participant tel que figé pour le tirage : seul le numéro compte. */
export interface DrawParticipant {
  participantNumber: number;
}

/** Résultat d'un tirage vérifiable. */
export interface DrawResult {
  winners: number[]; // participant_number des gagnants, ordre du tirage
  seed: string;
  seedHash: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/freebuupp/types.ts
git commit -m "feat(freebuupp): types du domaine"
```

---

## Task 3: Tirage vérifiable (`lib/freebuupp/draw.ts`) — TDD

**Files:**
- Create: `tests/freebuupp/draw.test.ts`
- Create: `lib/freebuupp/draw.ts`

- [ ] **Step 1: Écrire les tests d'abord**

```ts
import { describe, it, expect } from "vitest";
import { generateSeed, hashSeed, drawWinners, verifyDraw } from "@/lib/freebuupp/draw";

const nums = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("freebuupp/draw", () => {
  it("hashSeed est déterministe et = sha256 hex 64 chars", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("drawWinners renvoie le bon nombre de gagnants distincts", () => {
    const seed = "deadbeef";
    const r = drawWinners({ seed, participants: nums(30), winnersCount: 5 });
    expect(r.winners).toHaveLength(5);
    expect(new Set(r.winners).size).toBe(5);
    r.winners.forEach((w) => expect(nums(30)).toContain(w));
  });

  it("est déterministe : même seed + mêmes participants => mêmes gagnants", () => {
    const a = drawWinners({ seed: "s1", participants: nums(50), winnersCount: 10 });
    const b = drawWinners({ seed: "s1", participants: nums(50), winnersCount: 10 });
    expect(a.winners).toEqual(b.winners);
  });

  it("seeds différents => tirages (généralement) différents", () => {
    const a = drawWinners({ seed: "s1", participants: nums(80), winnersCount: 10 });
    const b = drawWinners({ seed: "s2", participants: nums(80), winnersCount: 10 });
    expect(a.winners).not.toEqual(b.winners);
  });

  it("plafonne les gagnants au nombre de participants", () => {
    const r = drawWinners({ seed: "s", participants: nums(3), winnersCount: 5 });
    expect(r.winners).toHaveLength(3);
  });

  it("0 participant => aucun gagnant", () => {
    const r = drawWinners({ seed: "s", participants: [], winnersCount: 5 });
    expect(r.winners).toEqual([]);
  });

  it("verifyDraw confirme un tirage honnête et rejette un trucage", () => {
    const seed = generateSeed();
    const participants = nums(50);
    const r = drawWinners({ seed, participants, winnersCount: 5 });
    expect(verifyDraw({
      seed, seedHash: hashSeed(seed), participants, winnersCount: 5, claimedWinners: r.winners,
    })).toBe(true);
    // seed hash incohérent
    expect(verifyDraw({
      seed, seedHash: hashSeed("autre"), participants, winnersCount: 5, claimedWinners: r.winners,
    })).toBe(false);
    // gagnants trafiqués
    const tampered = [...r.winners.slice(0, -1), 999];
    expect(verifyDraw({
      seed, seedHash: hashSeed(seed), participants, winnersCount: 5, claimedWinners: tampered,
    })).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests (doivent échouer)**

Run: `npm test -- tests/freebuupp/draw.test.ts`
Expected: FAIL — modules/fonctions non définis.

- [ ] **Step 3: Implémenter `lib/freebuupp/draw.ts`**

```ts
import { createHash, randomBytes } from "node:crypto";
import type { DrawResult } from "./types";

/** Graine aléatoire 32 octets hex — générée à la CRÉATION du freebuupp. */
export function generateSeed(): string {
  return randomBytes(32).toString("hex");
}

export function hashSeed(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

/** Score déterministe d'un participant pour un seed donné. */
function score(seed: string, participantNumber: number): string {
  return createHash("sha256").update(`${seed}:${participantNumber}`).digest("hex");
}

/**
 * Tirage vérifiable : on ordonne les participants par sha256(seed:numéro)
 * et on prend les `min(winnersCount, participants.length)` premiers.
 * Pas de Math.random — entièrement reproductible à partir du seed.
 */
export function drawWinners(opts: {
  seed: string;
  participants: number[];
  winnersCount: number;
}): DrawResult {
  const { seed, participants, winnersCount } = opts;
  const ordered = [...participants].sort((a, b) => {
    const sa = score(seed, a);
    const sb = score(seed, b);
    return sa < sb ? -1 : sa > sb ? 1 : a - b;
  });
  const take = Math.max(0, Math.min(winnersCount, participants.length));
  return { winners: ordered.slice(0, take), seed, seedHash: hashSeed(seed) };
}

/** Rejoue le tirage et compare — utilisé par l'API publique de vérification. */
export function verifyDraw(opts: {
  seed: string;
  seedHash: string;
  participants: number[];
  winnersCount: number;
  claimedWinners: number[];
}): boolean {
  if (hashSeed(opts.seed) !== opts.seedHash) return false;
  const recomputed = drawWinners({
    seed: opts.seed,
    participants: opts.participants,
    winnersCount: opts.winnersCount,
  }).winners;
  if (recomputed.length !== opts.claimedWinners.length) return false;
  return recomputed.every((w, i) => w === opts.claimedWinners[i]);
}
```

- [ ] **Step 4: Lancer les tests (doivent passer)**

Run: `npm test -- tests/freebuupp/draw.test.ts`
Expected: PASS (tous).

- [ ] **Step 5: Commit**

```bash
git add lib/freebuupp/draw.ts tests/freebuupp/draw.test.ts
git commit -m "feat(freebuupp): tirage vérifiable (provably-fair) + tests"
```

---

## Task 4: Pricing (`lib/freebuupp/pricing.ts`) — TDD

**Files:**
- Create: `tests/freebuupp/pricing.test.ts`
- Create: `lib/freebuupp/pricing.ts`

- [ ] **Step 1: Tests**

```ts
import { describe, it, expect } from "vitest";
import { FREEBUUPP_FEE_CENTS, shouldRefund } from "@/lib/freebuupp/pricing";

describe("freebuupp/pricing", () => {
  it("le tarif est 10 € fixe", () => {
    expect(FREEBUUPP_FEE_CENTS).toBe(1000);
  });
  it("rembourse si et seulement si 0 inscrit", () => {
    expect(shouldRefund(0)).toBe(true);
    expect(shouldRefund(1)).toBe(false);
    expect(shouldRefund(30)).toBe(false);
  });
});
```

- [ ] **Step 2: Run (fail)** — `npm test -- tests/freebuupp/pricing.test.ts` → FAIL.

- [ ] **Step 3: Implémenter**

```ts
/** Frais forfaitaire d'un FREEBUUPP : 10 € (décidé côté serveur). */
export const FREEBUUPP_FEE_CENTS = 1000;

/** Remboursement uniquement si aucun prospect ne s'est inscrit. */
export function shouldRefund(participantCount: number): boolean {
  return participantCount === 0;
}
```

- [ ] **Step 4: Run (pass)** — `npm test -- tests/freebuupp/pricing.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/freebuupp/pricing.ts tests/freebuupp/pricing.test.ts
git commit -m "feat(freebuupp): pricing (10 € fixe + règle remboursement) + tests"
```

---

## Task 5: Eligibility (`lib/freebuupp/eligibility.ts`) — TDD

Garde pure (entrées déjà résolues par l'API) : décide si un prospect peut s'inscrire.

**Files:**
- Create: `tests/freebuupp/eligibility.test.ts`
- Create: `lib/freebuupp/eligibility.ts`

- [ ] **Step 1: Tests**

```ts
import { describe, it, expect } from "vitest";
import { canJoin } from "@/lib/freebuupp/eligibility";

const base = {
  status: "open" as const,
  phoneVerified: true,
  alreadyJoined: false,
  participantCount: 10,
  panelSize: 30,
  geoEligible: true,
};

describe("freebuupp/eligibility.canJoin", () => {
  it("accepte un prospect valide", () => {
    expect(canJoin(base)).toEqual({ ok: true });
  });
  it("refuse si téléphone non vérifié", () => {
    expect(canJoin({ ...base, phoneVerified: false })).toEqual({ ok: false, reason: "phone_unverified" });
  });
  it("refuse si déjà inscrit", () => {
    expect(canJoin({ ...base, alreadyJoined: true })).toEqual({ ok: false, reason: "already_joined" });
  });
  it("refuse si la campagne n'est pas ouverte", () => {
    expect(canJoin({ ...base, status: "closed" })).toEqual({ ok: false, reason: "not_open" });
  });
  it("refuse si le panel est plein", () => {
    expect(canJoin({ ...base, participantCount: 30, panelSize: 30 })).toEqual({ ok: false, reason: "panel_full" });
  });
  it("refuse si hors zone géographique", () => {
    expect(canJoin({ ...base, geoEligible: false })).toEqual({ ok: false, reason: "geo_ineligible" });
  });
  it("priorité : not_open avant les autres", () => {
    expect(canJoin({ ...base, status: "drawn", phoneVerified: false })).toEqual({ ok: false, reason: "not_open" });
  });
});
```

- [ ] **Step 2: Run (fail)** — `npm test -- tests/freebuupp/eligibility.test.ts` → FAIL.

- [ ] **Step 3: Implémenter**

```ts
import type { FreebuuppStatus } from "./types";

export type JoinDenyReason =
  | "not_open" | "phone_unverified" | "already_joined" | "panel_full" | "geo_ineligible";

export type JoinDecision = { ok: true } | { ok: false; reason: JoinDenyReason };

/** Gardes ordonnées (état campagne d'abord, puis prospect, puis capacité). */
export function canJoin(input: {
  status: FreebuuppStatus;
  phoneVerified: boolean;
  alreadyJoined: boolean;
  participantCount: number;
  panelSize: number;
  geoEligible: boolean;
}): JoinDecision {
  if (input.status !== "open") return { ok: false, reason: "not_open" };
  if (!input.geoEligible) return { ok: false, reason: "geo_ineligible" };
  if (!input.phoneVerified) return { ok: false, reason: "phone_unverified" };
  if (input.alreadyJoined) return { ok: false, reason: "already_joined" };
  if (input.participantCount >= input.panelSize) return { ok: false, reason: "panel_full" };
  return { ok: true };
}
```

- [ ] **Step 4: Run (pass)** — `npm test -- tests/freebuupp/eligibility.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/freebuupp/eligibility.ts tests/freebuupp/eligibility.test.ts
git commit -m "feat(freebuupp): garde d'éligibilité participation + tests"
```

---

## Task 6: Types Supabase

**Files:**
- Modify: `lib/supabase/types.ts`

- [ ] **Step 1: Régénérer ou ajouter à la main**

Si la CLI est liée au projet : `npx supabase gen types typescript --linked > lib/supabase/types.ts` (⚠️ vérifier qu'aucune autre table n'est perdue ; sinon ajouter à la main).
Sinon, ajouter manuellement les entrées `freebuupps` et `freebuupp_participants` au type `Database["public"]["Tables"]`, et la colonne `freebuupp_id: string | null` à `transactions.Row/Insert/Update`, et `freebuupp_enabled: boolean` à `app_config`.

- [ ] **Step 2: Vérifier le typecheck**

Run: `npx tsc --noEmit`
Expected: pas d'erreur liée à ces tables.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat(freebuupp): types Supabase des nouvelles tables"
```

---

## Task 7: API pro — créer & lister (`app/api/pro/freebuupps/route.ts`)

**Files:**
- Create: `app/api/pro/freebuupps/route.ts`

**Comportement POST :** valider body (panel ∈ {30,50,80}, winners ∈ {2,5,10}, winners<panel, title/prize non vides, geo), `ensureProAccount`, lire wallet + raison sociale/ville (garde `missing_company_info` 422 comme `/api/pro/campaigns`), vérifier solde dispo ≥ `FREEBUUPP_FEE_CENTS` (402 sinon), générer `seed`+`seedHash`+`code`, INSERT `freebuupps` (`closes_at = now()+24h`), débiter 10 € (`wallet_balance_cents -= 1000`) + INSERT `transactions(type:'buupp_commission', amount_cents:-1000, freebuupp_id, description)`, fire-and-forget auto-recharge. Retour `{ id, code }`.

**Comportement GET :** liste les freebuupps du pro (avec `participantCount` via count sur `freebuupp_participants`), recalcule `status` effectif (`open`→`closed` si `now>closes_at`).

- [ ] **Step 1: Implémenter** (s'inspirer de `app/api/pro/campaigns/route.ts` pour les patterns wallet/garde société)

```ts
import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { FREEBUUPP_FEE_CENTS } from "@/lib/freebuupp/pricing";
import { generateSeed, hashSeed } from "@/lib/freebuupp/draw";
import { PANEL_SIZES, WINNERS_COUNTS } from "@/lib/freebuupp/types";

export const runtime = "nodejs";

const ALLOWED_GEO = ["ville", "dept", "region", "national"] as const;

function fbCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `FB-${s}`;
}

type Body = {
  title?: string; prizeDescription?: string;
  panelSize?: number; winnersCount?: number;
  geo?: string; geoTarget?: unknown;
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const title = (body.title ?? "").trim();
  const prize = (body.prizeDescription ?? "").trim();
  const panel = Number(body.panelSize);
  const winners = Number(body.winnersCount);
  if (!title || !prize ||
      !PANEL_SIZES.includes(panel as 30) ||
      !WINNERS_COUNTS.includes(winners as 2) ||
      winners >= panel) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const geo = (ALLOWED_GEO as readonly string[]).includes(body.geo ?? "")
    ? (body.geo as string) : "national";

  const user = await currentUser();
  const email = user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });
  const admin = createSupabaseAdminClient();

  const { data: pro } = await admin.from("pro_accounts")
    .select("wallet_balance_cents, wallet_reserved_cents, raison_sociale, ville")
    .eq("id", proId).single();
  if (!pro) return NextResponse.json({ error: "pro_not_found" }, { status: 404 });

  const rawRaison = (pro.raison_sociale ?? "").trim();
  const hasRaison = rawRaison.length > 0 && !rawRaison.includes("@");
  const hasVille = !!(pro.ville ?? "").trim();
  if (!hasRaison || !hasVille) {
    return NextResponse.json({ error: "missing_company_info",
      message: "Renseignez votre raison sociale et votre ville avant de lancer un FREEBUUPP.",
      missing: { raisonSociale: !hasRaison, ville: !hasVille } }, { status: 422 });
  }

  const available = Number(pro.wallet_balance_cents) - Number(pro.wallet_reserved_cents ?? 0);
  if (available < FREEBUUPP_FEE_CENTS) {
    return NextResponse.json({ error: "insufficient_funds",
      walletAvailableCents: available, neededCents: FREEBUUPP_FEE_CENTS }, { status: 402 });
  }

  const seed = generateSeed();
  const { data: fb, error } = await admin.from("freebuupps").insert({
    pro_account_id: proId, code: fbCode(), title, prize_description: prize,
    brand_name: rawRaison, panel_size: panel, winners_count: winners,
    geo, geo_target: (body.geoTarget ?? null) as never,
    status: "open", seed_hash: hashSeed(seed), seed,
    opens_at: new Date().toISOString(),
    closes_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    fee_cents: FREEBUUPP_FEE_CENTS,
  }).select("id, code").single();
  if (error || !fb) {
    console.error("[/api/pro/freebuupps] insert failed", error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  await admin.from("pro_accounts")
    .update({ wallet_balance_cents: Number(pro.wallet_balance_cents) - FREEBUUPP_FEE_CENTS })
    .eq("id", proId);
  await admin.from("transactions").insert({
    account_id: proId, account_kind: "pro", type: "buupp_commission",
    status: "completed", amount_cents: -FREEBUUPP_FEE_CENTS,
    freebuupp_id: fb.id, description: `FREEBUUPP — ${title}`,
  });

  void (async () => {
    try {
      const { maybeTriggerAutoRecharge } = await import("@/lib/stripe/auto-recharge");
      await maybeTriggerAutoRecharge(proId);
    } catch (e) { console.warn("[freebuupp] auto-recharge non-blocking", e); }
  })();

  return NextResponse.json({ id: fb.id, code: fb.code });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });
  const admin = createSupabaseAdminClient();

  const { data: rows } = await admin.from("freebuupps")
    .select("id, code, title, prize_description, panel_size, winners_count, status, opens_at, closes_at, drawn_at, geo")
    .eq("pro_account_id", proId).order("created_at", { ascending: false });

  const ids = (rows ?? []).map((r) => r.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: parts } = await admin.from("freebuupp_participants")
      .select("freebuupp_id").in("freebuupp_id", ids);
    for (const p of parts ?? []) counts.set(p.freebuupp_id, (counts.get(p.freebuupp_id) ?? 0) + 1);
  }
  const now = Date.now();
  const freebuupps = (rows ?? []).map((r) => ({
    ...r,
    participantCount: counts.get(r.id) ?? 0,
    effectiveStatus: r.status === "open" && new Date(r.closes_at).getTime() <= now ? "closed" : r.status,
  }));
  return NextResponse.json({ freebuupps });
}
```

- [ ] **Step 2: Vérifier le typecheck** — `npx tsc --noEmit` → pas d'erreur.

- [ ] **Step 3: Commit**

```bash
git add app/api/pro/freebuupps/route.ts
git commit -m "feat(freebuupp): API pro créer + lister"
```

---

## Task 8: API pro — détail (`app/api/pro/freebuupps/[id]/route.ts`)

**Files:**
- Create: `app/api/pro/freebuupps/[id]/route.ts`

**Comportement :** détail d'un freebuupp du pro (vérifie ownership), nombre de participants ; si `status='drawn'`, renvoie les gagnants = `{ participantNumber, telephone }` en lisant `prospect_identity.telephone` des prospects gagnants (révélation limitée au téléphone). Avant tirage, pas de téléphone.

- [ ] **Step 1: Implémenter**

```ts
import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });
  const admin = createSupabaseAdminClient();

  const { data: fb } = await admin.from("freebuupps")
    .select("id, code, title, prize_description, panel_size, winners_count, status, opens_at, closes_at, drawn_at, seed, seed_hash, geo")
    .eq("id", id).eq("pro_account_id", proId).single();
  if (!fb) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: parts } = await admin.from("freebuupp_participants")
    .select("participant_number, is_winner, prospect_id")
    .eq("freebuupp_id", id).order("participant_number");

  let winners: { participantNumber: number; telephone: string | null }[] = [];
  if (fb.status === "drawn") {
    const winnerRows = (parts ?? []).filter((p) => p.is_winner);
    const pids = winnerRows.map((w) => w.prospect_id);
    const phoneByProspect = new Map<string, string | null>();
    if (pids.length) {
      const { data: idents } = await admin.from("prospect_identity")
        .select("prospect_id, telephone").in("prospect_id", pids);
      for (const it of idents ?? []) phoneByProspect.set(it.prospect_id, it.telephone ?? null);
    }
    winners = winnerRows.map((w) => ({
      participantNumber: w.participant_number,
      telephone: phoneByProspect.get(w.prospect_id) ?? null,
    }));
  }

  const now = Date.now();
  const effectiveStatus = fb.status === "open" && new Date(fb.closes_at).getTime() <= now ? "closed" : fb.status;
  return NextResponse.json({
    freebuupp: { ...fb, participantCount: parts?.length ?? 0, effectiveStatus, winners },
  });
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit**

```bash
git add "app/api/pro/freebuupps/[id]/route.ts"
git commit -m "feat(freebuupp): API pro détail (+ téléphones gagnants si drawn)"
```

---

## Task 9: Lifecycle + tirage exécuté (`lib/freebuupp/lifecycle.ts`)

Centralise : fermeture (`open`→`closed`), exécution du tirage (idempotent), remboursement 0-inscrit, backstop. Réutilisé par l'API draw ET le cron.

**Files:**
- Create: `lib/freebuupp/lifecycle.ts`

- [ ] **Step 1: Implémenter**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { drawWinners } from "./draw";
import { shouldRefund, FREEBUUPP_FEE_CENTS } from "./pricing";

type Admin = SupabaseClient<never>;

/**
 * Exécute le tirage d'un freebuupp `closed` (ou `open` expiré). Idempotent :
 * ne fait rien si déjà `drawn`/`canceled`. Met `is_winner`, passe en `drawn`,
 * renvoie les numéros gagnants. Si 0 inscrit → `canceled` + remboursement.
 * Notifications/mails déclenchés par l'appelant (API/cron) après succès.
 */
export async function executeDraw(admin: Admin, freebuuppId: string): Promise<
  { status: "drawn"; winners: number[] } |
  { status: "canceled" } |
  { status: "noop"; reason: string }
> {
  const { data: fb } = await admin.from("freebuupps")
    .select("id, pro_account_id, status, seed, winners_count, fee_cents, refunded")
    .eq("id", freebuuppId).single();
  if (!fb) return { status: "noop", reason: "not_found" };
  if (fb.status === "drawn" || fb.status === "canceled") return { status: "noop", reason: "already_final" };

  const { data: parts } = await admin.from("freebuupp_participants")
    .select("id, participant_number").eq("freebuupp_id", freebuuppId);
  const participants = (parts ?? []).map((p) => p.participant_number);

  if (shouldRefund(participants.length)) {
    // Remboursement : recrédit wallet + transaction inverse + canceled.
    const { data: pro } = await admin.from("pro_accounts")
      .select("wallet_balance_cents").eq("id", fb.pro_account_id).single();
    if (pro) {
      await admin.from("pro_accounts")
        .update({ wallet_balance_cents: Number(pro.wallet_balance_cents) + Number(fb.fee_cents) })
        .eq("id", fb.pro_account_id);
      await admin.from("transactions").insert({
        account_id: fb.pro_account_id, account_kind: "pro", type: "buupp_commission",
        status: "completed", amount_cents: Number(fb.fee_cents),
        freebuupp_id: fb.id, description: "Remboursement FREEBUUPP (aucun inscrit)",
      });
    }
    await admin.from("freebuupps")
      .update({ status: "canceled", refunded: true, drawn_at: new Date().toISOString() })
      .eq("id", fb.id);
    return { status: "canceled" };
  }

  const result = drawWinners({ seed: fb.seed!, participants, winnersCount: fb.winners_count });
  const winnerSet = new Set(result.winners);
  const winnerIds = (parts ?? []).filter((p) => winnerSet.has(p.participant_number)).map((p) => p.id);
  if (winnerIds.length) {
    await admin.from("freebuupp_participants").update({ is_winner: true }).in("id", winnerIds);
  }
  await admin.from("freebuupps")
    .update({ status: "drawn", drawn_at: new Date().toISOString() })
    .eq("id", fb.id);
  return { status: "drawn", winners: result.winners };
}

/**
 * Backstop quotidien (appelé par /api/admin/digest) :
 *  - ferme les `open` expirés (closes_at <= now) → `closed`
 *  - exécute le tirage des `closed` depuis > 48 h (pro inactif)
 */
export async function freebuuppLifecycleTick(admin: Admin): Promise<{ closed: number; drawn: number }> {
  const now = Date.now();
  let closed = 0, drawn = 0;

  const { data: toClose } = await admin.from("freebuupps")
    .select("id").eq("status", "open").lte("closes_at", new Date(now).toISOString());
  for (const r of toClose ?? []) {
    await admin.from("freebuupps").update({ status: "closed" }).eq("id", r.id);
    closed++;
  }

  const cutoff = new Date(now - 48 * 3600 * 1000).toISOString();
  const { data: toDraw } = await admin.from("freebuupps")
    .select("id").eq("status", "closed").lte("closes_at", cutoff);
  for (const r of toDraw ?? []) {
    const res = await executeDraw(admin, r.id);
    if (res.status === "drawn" || res.status === "canceled") drawn++;
    // Notifications gagnants gérées ici en option (cf. Task 11) ou par un sweep séparé.
  }
  return { closed, drawn };
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit**

```bash
git add lib/freebuupp/lifecycle.ts
git commit -m "feat(freebuupp): lifecycle (executeDraw idempotent + backstop cron)"
```

---

## Task 10: API pro — lancer le tirage (`app/api/pro/freebuupps/[id]/draw/route.ts`)

**Files:**
- Create: `app/api/pro/freebuupps/[id]/draw/route.ts`

**Comportement :** POST, vérifie ownership, force `closed` si `open` expiré, appelle `executeDraw`, puis déclenche les notifications gagnants/perdants (Task 11). Refuse (409) si déjà `drawn`/`canceled`.

- [ ] **Step 1: Implémenter**

```ts
import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { executeDraw } from "@/lib/freebuupp/lifecycle";
import { notifyFreebuuppResults } from "@/lib/freebuupp/mail";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });
  const admin = createSupabaseAdminClient();

  const { data: fb } = await admin.from("freebuupps")
    .select("id, status, closes_at").eq("id", id).eq("pro_account_id", proId).single();
  if (!fb) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (fb.status === "drawn" || fb.status === "canceled")
    return NextResponse.json({ error: "already_drawn" }, { status: 409 });
  if (fb.status === "open" && new Date(fb.closes_at).getTime() > Date.now())
    return NextResponse.json({ error: "not_closed_yet" }, { status: 409 });

  if (fb.status === "open") await admin.from("freebuupps").update({ status: "closed" }).eq("id", id);

  const res = await executeDraw(admin, id);
  if (res.status === "drawn") {
    void notifyFreebuuppResults(admin, id).catch((e) =>
      console.error("[freebuupp draw] notify failed", e));
  }
  return NextResponse.json({ result: res });
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit**

```bash
git add "app/api/pro/freebuupps/[id]/draw/route.ts"
git commit -m "feat(freebuupp): API pro lancer le tirage"
```

---

## Task 11: Notifications gagnants/perdants (`lib/freebuupp/mail.ts`)

Mail Brevo aux gagnants + notif in-app gagnants/perdants + push Expo gagnants. S'appuie sur les helpers existants (`lib/brevo`, table notifications, `lib/push/expo`).

**Files:**
- Create: `lib/freebuupp/mail.ts`

> ⚠️ Avant d'écrire : lire un usage existant de l'envoi de mail Brevo (`lib/email/relation.ts`) et de la création de notification in-app + push (`lib/push/expo.ts`, recherche `from("notifications")`) pour réutiliser exactement les signatures. Adapter les appels ci-dessous aux helpers réels.

- [ ] **Step 1: Implémenter `notifyFreebuuppResults`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendBrevoEmail } from "@/lib/brevo"; // adapter au helper réel
import { sendBatch, type ExpoPushMessage } from "@/lib/push/expo";

type Admin = SupabaseClient<never>;

/**
 * Après un tirage `drawn` : prévient gagnants (notif + mail + push) et
 * perdants (notif in-app seule). Idempotent au mieux (à appeler une fois).
 */
export async function notifyFreebuuppResults(admin: Admin, freebuuppId: string): Promise<void> {
  const { data: fb } = await admin.from("freebuupps")
    .select("id, code, title, brand_name").eq("id", freebuuppId).single();
  if (!fb) return;

  const { data: parts } = await admin.from("freebuupp_participants")
    .select("prospect_id, participant_number, is_winner").eq("freebuupp_id", freebuuppId);
  const all = parts ?? [];
  if (!all.length) return;

  const pids = all.map((p) => p.prospect_id);
  const { data: prospects } = await admin.from("prospects")
    .select("id, clerk_user_id").in("id", pids);
  const clerkByProspect = new Map<string, string>();
  for (const p of prospects ?? []) if (p.clerk_user_id) clerkByProspect.set(p.id, p.clerk_user_id);

  // 1. Notifications in-app (table notifications — adapter au schéma réel).
  const notifRows = all.map((p) => ({
    user_id: clerkByProspect.get(p.prospect_id) ?? null,
    kind: p.is_winner ? "freebuupp_won" : "freebuupp_lost",
    title: p.is_winner ? "🎉 Tu as gagné un FREEBUUPP !" : "Tirage FREEBUUPP terminé",
    body: p.is_winner
      ? `Bravo ! Tu remportes « ${fb.title} » de ${fb.brand_name}. ${fb.brand_name} va te contacter par téléphone.`
      : `Pas cette fois pour « ${fb.title} ». Tente le prochain FREEBUUPP !`,
    data: { freebuuppId: fb.id, code: fb.code, participantNumber: p.participant_number },
  })).filter((r) => r.user_id);
  if (notifRows.length) await admin.from("notifications").insert(notifRows as never);

  // 2. Mails gagnants (Brevo) — emails via Clerk/prospect_identity selon le projet.
  const winners = all.filter((p) => p.is_winner);
  // (résoudre les emails des gagnants comme dans lib/email/relation.ts, puis :)
  // for (const w of winners) await sendBrevoEmail({ to, subject, html });

  // 3. Push Expo gagnants (résoudre push_tokens.user_id = clerk_user_id).
  const winnerClerks = winners.map((w) => clerkByProspect.get(w.prospect_id)).filter(Boolean) as string[];
  if (winnerClerks.length) {
    const { data: tokens } = await admin.from("push_tokens")
      .select("user_id, expo_token").in("user_id", winnerClerks);
    const messages: ExpoPushMessage[] = (tokens ?? []).map((t) => ({
      to: t.expo_token,
      title: "🎉 Tu as gagné un FREEBUUPP !",
      body: `Tu remportes « ${fb.title} » de ${fb.brand_name}.`,
      data: { type: "freebuupp_won", freebuuppId: fb.id, code: fb.code },
    }));
    if (messages.length) await sendBatch(admin, messages);
  }
}
```

- [ ] **Step 2: Typecheck + ajuster aux helpers réels** — `npx tsc --noEmit`. Corriger imports/signatures (`sendBrevoEmail`, schéma `notifications`, `ExpoPushMessage`) selon le code existant.

- [ ] **Step 3: Commit**

```bash
git add lib/freebuupp/mail.ts
git commit -m "feat(freebuupp): notifications gagnants/perdants (notif + mail + push)"
```

---

## Task 12: API prospect — feed, join, mine

**Files:**
- Create: `app/api/prospect/freebuupps/route.ts` (GET feed)
- Create: `app/api/prospect/freebuupps/[id]/join/route.ts` (POST join)
- Create: `app/api/prospect/freebuupps/mine/route.ts` (GET mine)

**Feed :** liste les freebuupps `open` non expirés, éligibles géo pour ce prospect, avec `participantCount`, `placesLeft`, `alreadyJoined`. (Pour l'éligibilité géo, réutiliser la logique CP du matching campagnes ; à défaut au lancement, filtrer `geo='national'` + même département que le prospect — documenter le choix dans le code.)

**Join :** résout prospectId (via clerk), lit `prospect_identity.phone_verified_at` (vérifié ?), `status` effectif, `alreadyJoined`, `participantCount` vs `panel_size`, `geoEligible` → `canJoin()`. Si ok : attribue `participant_number = participantCount+1` et INSERT (gère la course via contrainte unique → 409 retry). Retourne `{ participantNumber }`.

- [ ] **Step 1: Implémenter le join** (cœur)

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { canJoin } from "@/lib/freebuupp/eligibility";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createSupabaseAdminClient();

  const { data: prospect } = await admin.from("prospects")
    .select("id").eq("clerk_user_id", userId).single();
  if (!prospect) return NextResponse.json({ error: "no_prospect" }, { status: 404 });

  const { data: fb } = await admin.from("freebuupps")
    .select("id, status, closes_at, panel_size, geo, geo_target").eq("id", id).single();
  if (!fb) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const status = fb.status === "open" && new Date(fb.closes_at).getTime() <= Date.now()
    ? "closed" : fb.status;

  const { data: ident } = await admin.from("prospect_identity")
    .select("phone_verified_at").eq("prospect_id", prospect.id).maybeSingle();
  const phoneVerified = !!ident?.phone_verified_at;

  const { data: existing } = await admin.from("freebuupp_participants")
    .select("participant_number").eq("freebuupp_id", id).eq("prospect_id", prospect.id).maybeSingle();
  const alreadyJoined = !!existing;

  const { count } = await admin.from("freebuupp_participants")
    .select("id", { count: "exact", head: true }).eq("freebuupp_id", id);
  const participantCount = count ?? 0;

  // Éligibilité géo : à implémenter via la logique CP existante. Par défaut true
  // pour 'national' ; sinon comparer le département du prospect à geo_target.
  const geoEligible = true; // TODO Task 12b — câbler la vraie règle géo.

  const decision = canJoin({
    status: status as "open", phoneVerified, alreadyJoined,
    participantCount, panelSize: fb.panel_size, geoEligible,
  });
  if (!decision.ok) {
    const code = decision.reason === "phone_unverified" ? 403 : 409;
    return NextResponse.json({ error: decision.reason }, { status: code });
  }

  const number = participantCount + 1;
  const { error } = await admin.from("freebuupp_participants").insert({
    freebuupp_id: id, prospect_id: prospect.id, participant_number: number,
  });
  if (error) {
    // 23505 = course (numéro/prospect déjà pris) → demander un retry.
    return NextResponse.json({ error: "conflict_retry" }, { status: 409 });
  }
  return NextResponse.json({ participantNumber: number });
}
```

- [ ] **Step 2: Implémenter feed + mine** (GET), mêmes patterns. `mine` joint `freebuupp_participants` + `freebuupps` pour rendre `{ code, title, brandName, status, participantNumber, isWinner }`.

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit`.
- [ ] **Step 4: Commit**

```bash
git add app/api/prospect/freebuupps
git commit -m "feat(freebuupp): API prospect feed + join + mine"
```

> **Task 12b (suivi) :** câbler la vraie éligibilité géo (extraire la logique CP de `lib/campaigns/matching.ts` dans un helper partagé réutilisable par le feed et le join). Tant que non fait, `geoEligible=true` est un raccourci documenté.

---

## Task 13: API publique — mur + détail vérifiable

**Files:**
- Create: `app/api/freebuupps/route.ts` (GET liste)
- Create: `app/api/freebuupps/[code]/route.ts` (GET détail)

**Pas d'auth.** Mur : freebuupps `open` (en cours, avec compte à rebours/places) + `drawn` récents. Détail par `code` : marque, lot, numéros gagnants, `seed`+`seed_hash` si `drawn` (badge vérifiable), liste publique des numéros de participants (pour permettre le recalcul). **Aucune donnée perso.**

- [ ] **Step 1: Implémenter le détail public**

```ts
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const admin = createSupabaseAdminClient();
  const { data: fb } = await admin.from("freebuupps")
    .select("code, title, prize_description, brand_name, panel_size, winners_count, status, opens_at, closes_at, drawn_at, seed, seed_hash, geo")
    .eq("code", code).single();
  if (!fb) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: parts } = await admin.from("freebuupp_participants")
    .select("participant_number, is_winner").eq("freebuupp_id", undefined as never); // remplacer par id
  // NB : récupérer d'abord l'id via une seconde requête ou select id ci-dessus.

  const isDrawn = fb.status === "drawn";
  return NextResponse.json({
    freebuupp: {
      code: fb.code, title: fb.title, prize: fb.prize_description, brand: fb.brand_name,
      panelSize: fb.panel_size, winnersCount: fb.winners_count, status: fb.status,
      opensAt: fb.opens_at, closesAt: fb.closes_at, drawnAt: fb.drawn_at,
      // Vérifiable : on n'expose le seed qu'après tirage.
      seedHash: fb.seed_hash, seed: isDrawn ? fb.seed : null,
      participantNumbers: (parts ?? []).map((p) => p.participant_number),
      winningNumbers: isDrawn ? (parts ?? []).filter((p) => p.is_winner).map((p) => p.participant_number) : [],
    },
  });
}
```

> ⚠️ Corriger la requête participants : d'abord `select("id")` du freebuupp, puis filtrer `freebuupp_id = id`. Le squelette ci-dessus marque l'endroit à finaliser.

- [ ] **Step 2: Implémenter le mur** (liste) — `open` + `drawn` récents, sans seed pour les `open`.
- [ ] **Step 3: Typecheck** — `npx tsc --noEmit`.
- [ ] **Step 4: Commit**

```bash
git add app/api/freebuupps
git commit -m "feat(freebuupp): API publique mur + détail vérifiable"
```

---

## Task 14: Brancher le backstop sur le cron quotidien

**Files:**
- Modify: `app/api/admin/digest/route.ts`

- [ ] **Step 1: Ajouter l'appel** près de `settleRipeRelationsAndNotify(admin)` :

```ts
import { freebuuppLifecycleTick } from "@/lib/freebuupp/lifecycle";
// ... dans le bloc try/catch du tick quotidien :
try {
  const fb = await freebuuppLifecycleTick(admin);
  console.log("[digest] freebuupp tick", fb);
} catch (err) {
  console.error("[digest] freebuupp tick failed", err);
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit**

```bash
git add app/api/admin/digest/route.ts
git commit -m "feat(freebuupp): backstop tirage/fermeture sur le cron quotidien"
```

---

## Task 15: UI web — pro (création + détail/tirage)

Suivre le pattern UI du repo (composants `.jsx` du prototype + pages App Router). Gardé **derrière le flag** `freebuupp_enabled` : pas d'entrée de menu visible tant que false.

**Files:**
- Create: page/section pro « Lancer un FREEBUUPP » (formulaire : titre, lot, panel 30/50/80, gagnants 2/5/10, géo) → POST `/api/pro/freebuupps`.
- Create: page détail pro : statut, compte à rebours, participants, bouton **« Lancer le tirage »** (quand `closed`) → POST `/api/pro/freebuupps/[id]/draw`, puis affiche gagnants (numéro + téléphone).

- [ ] **Step 1: Construire le formulaire de création** + appel API + gestion erreurs (`402 insufficient_funds`, `422 missing_company_info`).
- [ ] **Step 2: Construire le détail pro** + bouton tirage + liste gagnants.
- [ ] **Step 3: Vérification manuelle** — `npm run dev`, créer un FREEBUUPP de test (avec wallet suffisant), vérifier débit 10 €, statut `open`.
- [ ] **Step 4: Commit**

```bash
git add app/pro ... # chemins réels
git commit -m "feat(freebuupp): UI pro création + détail/tirage (gated)"
```

---

## Task 16: UI web — prospect (feed + ticket + résultats)

**Files:**
- Create: section prospect « FREEBUUPP 🎁 » (feed des tirages ouverts éligibles, carte marque/lot/compte à rebours/places/gagnants).
- Create: bouton « Je participe » → POST join → écran **ticket « Ton numéro : #N »**. Gérer `403 phone_unverified` (rediriger vers vérif téléphone).
- Create: vue « Mes participations » + résultats (gagné/perdu) via `/api/prospect/freebuupps/mine`.

- [ ] **Step 1: Feed + carte + compte à rebours.**
- [ ] **Step 2: Participation + écran ticket.**
- [ ] **Step 3: Mes participations / résultats.**
- [ ] **Step 4: Vérification manuelle** — s'inscrire à un FREEBUUPP de test, voir le numéro, lancer le tirage côté pro, voir le résultat.
- [ ] **Step 5: Commit**

```bash
git add app/prospect ...
git commit -m "feat(freebuupp): UI prospect feed + ticket + résultats (gated)"
```

---

## Task 17: UI web — page publique (mur + détail vérifiable)

**Files:**
- Create: `app/freebuupp/page.tsx` (mur, sans auth)
- Create: `app/freebuupp/[code]/page.tsx` (détail : marque, lot, numéros gagnants, badge « Tirage vérifié 🔒 » + seed/seed_hash, explication de la vérification)

- [ ] **Step 1: Mur public** (en cours + passés) via `/api/freebuupps`.
- [ ] **Step 2: Détail public** via `/api/freebuupps/[code]` + bloc « Comment vérifier le tirage » (sha256(seed)==seed_hash).
- [ ] **Step 3: Vérification manuelle** — ouvrir en navigation privée (sans login), vérifier l'absence de donnée perso.
- [ ] **Step 4: Commit**

```bash
git add app/freebuupp
git commit -m "feat(freebuupp): page publique mur + détail vérifiable"
```

---

## Task 18: CGV

**Files:**
- Modify: `app/cgv/...` (page CGV existante)

- [ ] **Step 1: Ajouter la section « FREEBUUPP »** : jeu/tirage sans obligation d'achat ; 10 € non remboursables sauf 0 inscrit ; tirage aléatoire vérifiable ; données révélées au pro = téléphone des gagnants uniquement ; lot fourni par le pro (BUUPP intermédiaire) ; conservation/suppression alignée RGPD.
- [ ] **Step 2: Commit**

```bash
git add app/cgv
git commit -m "docs(freebuupp): section CGV du service tirage au sort"
```

---

## Task 19: Parité mobile (worktree)

⚠️ Le mobile vit dans le worktree `worktree-mobile-app` (branche `worktree-mobile-app`, **non mergée**). À faire dans une session/worktree dédiée, **après** validation web. Même backend `/api/*` (déjà construit ci-dessus).

- [ ] **Step 1: Écrans prospect** : feed FREEBUUPP, participation, ticket « #N », résultats. Réutiliser `NeonBorder`, `GridBg`, thème (`useTheme().c`), tailles de police mobile (cf. mémoire).
- [ ] **Step 2: Écrans pro** : création FREEBUUPP, détail + bouton tirage + gagnants.
- [ ] **Step 3: Push gagnant** — vérifier le handler de notif `freebuupp_won`.
- [ ] **Step 4: Captures de validation** écran par écran (cf. préférence de validation visuelle progressive).
- [ ] **Step 5: Commit sur la branche mobile** (ne pas merger).

---

## Self-Review (effectuée)

**Couverture spec :** §3 tables → Task 1/6 ✓ · §4 cycle de vie → Task 9 ✓ · §5 économie → Task 7/9 ✓ · §6 tirage vérifiable → Task 3 ✓ · §7 parcours pro → Task 7/8/10/15 ✓ · §8 parcours prospect → Task 12/16 ✓ · §9 page publique → Task 13/17 ✓ · §10 API → Task 7-14 ✓ · §11 unités lib → Task 3/4/5/9/11 ✓ · §12 cross-plateforme → Task 15-19 ✓ · §13 CGV → Task 18 ✓ · §14 tests → Task 3/4/5 ✓ · §16 garde-fous non-déployé → branche + flag + migration non appliquée ✓.

**Cohérence des types :** `DrawResult.winners` (number[]), `canJoin` reasons alignées entre `eligibility.ts` et l'API join, `executeDraw` retours typés réutilisés par draw API + cron. `freebuupp_id` ajouté à `transactions` (Task 1) et utilisé Task 7/9.

**Points laissés explicitement ouverts (non-placeholders, raccourcis documentés) :**
- Task 12b : éligibilité géo réelle (CP) — `geoEligible=true` au lancement, à câbler.
- Task 11 : signatures Brevo/notifications/push à aligner sur les helpers réels (instruction de lecture préalable donnée).
- Task 13 : requête participants du détail public à finaliser (récupérer l'id d'abord).
