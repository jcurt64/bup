# Pro Dashboard Live Data — Phase B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace remaining hardcoded values in the BUUPP pro dashboard (ProHeader, Vue d'ensemble Performance chart, Campagnes list, Mes informations) with live DB-backed data, and activate the 7J/30J/90J period chips on the Performance chart.

**Architecture:** Same patterns as the campaign acceptance work (Tasks 1–14 of the prior plan): Next.js route handlers with `service_role` Supabase client + Clerk auth + ensureProAccount, consumed by JSX components in `public/prototype/components/Pro.jsx` via `fetch`. No new tables, no migrations.

**Tech Stack:** Next.js 16 route handlers, Supabase Postgres (service_role), Clerk auth, React 18 (Babel-standalone in `public/prototype/components/Pro.jsx`).

**Spec:** `docs/superpowers/specs/2026-05-04-pro-dashboard-live-data-phase-b-design.md`

**Note on testing:** the project has no Jest/Vitest. Verification uses `npx tsc --noEmit`, `npm run lint`, `node -e require('@babel/parser').parse(...)` for JSX, and manual smoke via the dev server.

---

## File Structure

**Create:**
- `app/api/pro/timeseries/route.ts`
- `app/api/pro/campaigns/[id]/route.ts` (PATCH only)
- `app/api/pro/info/route.ts` (GET + PATCH)

**Modify:**
- `app/api/pro/overview/route.ts` (add 2 fields)
- `app/api/pro/campaigns/route.ts` (add GET handler alongside the existing POST)
- `lib/campaigns/mapping.ts` (add `objectiveLabel`)
- `public/prototype/components/Pro.jsx` (ProHeader, Overview/BarChart, Campagnes, ProDashboard, MesInformations)

---

## Task 1: Extend `/api/pro/overview` with monthly + active counts

**Files:**
- Modify: `app/api/pro/overview/route.ts`

- [ ] **Step 1: Read the current file**

```bash
cat /Users/mjlk_blockchain/Desktop/buupp/app/api/pro/overview/route.ts | head -120
```

Confirm the structure: `GET` handler that fetches relations once, computes
KPIs, returns `{ contactsAccepted30d, acceptanceRate, avgCostCents,
lastAcceptances, tierBreakdown }`.

- [ ] **Step 2: Add 2 new computations + 1 small extra query for active campaigns count**

Edit `app/api/pro/overview/route.ts`. After the `since` constant declaration, add a `monthStart` constant:

Find:
```ts
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
```

Replace with:
```ts
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString();
```

Then, just before the relations query, add a parallel query for the active-campaigns count. Find:
```ts
  const { data, error } = await admin
    .from("relations")
    .select(
      `id, status, reward_cents, decided_at,
```

Replace with:
```ts
  const [{ data, error }, { count: activeCampaignsCount }] = await Promise.all([
    admin
      .from("relations")
      .select(
        `id, status, reward_cents, decided_at,
```

(Keep the same select block.)

Then find the closing of the relations query (the line `.order("decided_at", { ascending: false });`) and replace with:
```ts
      .order("decided_at", { ascending: false }),
    admin
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("pro_account_id", proId)
      .eq("status", "active"),
  ]);
```

Now in the response, after computing `wins30d`, `acceptanceRate`, etc., add the `contactsAcceptedThisMonth` computation. Find:
```ts
  const wins30d = rows.filter(
    (r) => isWin(r.status) && r.decided_at && r.decided_at >= since,
  );
```

After that line, add:
```ts
  const winsThisMonth = rows.filter(
    (r) => isWin(r.status) && r.decided_at && r.decided_at >= monthStart,
  );
```

Finally, in the `return NextResponse.json(...)` block, add the 2 new fields. Find:
```ts
  return NextResponse.json({
    contactsAccepted30d: wins30d.length,
    acceptanceRate,
    avgCostCents,
    lastAcceptances,
    tierBreakdown,
  });
```

Replace with:
```ts
  return NextResponse.json({
    contactsAccepted30d: wins30d.length,
    contactsAcceptedThisMonth: winsThisMonth.length,
    activeCampaignsCount: activeCampaignsCount ?? 0,
    acceptanceRate,
    avgCostCents,
    lastAcceptances,
    tierBreakdown,
  });
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep "app/api/pro/overview"`
Expected: empty (no errors).

- [ ] **Step 4: Commit**

```bash
git add app/api/pro/overview/route.ts
git commit -m "feat(api/pro/overview): add contactsAcceptedThisMonth + activeCampaignsCount"
```

---

## Task 2: Wire ProHeader to /api/pro/overview

**Files:**
- Modify: `public/prototype/components/Pro.jsx` (ProHeader, lines ~89-158)

- [ ] **Step 1: Read the current ProHeader**

```bash
sed -n '85,160p' /Users/mjlk_blockchain/Desktop/buupp/public/prototype/components/Pro.jsx
```

- [ ] **Step 2: Add overview fetch + replace hardcoded numbers**

Find this section (around line 132-148):

```jsx
  const balanceText = wallet
    ? _eurFmt.format(Number(wallet.walletBalanceEur ?? 0))
    : '…';

  return (
    <div style={{ padding: '24px 40px 28px', borderTop: '1px solid var(--line)' }}>
      <div className="row between" style={{ alignItems: 'flex-start', gap: 32, flexWrap: 'wrap' }}>
        <div>
          <div className="mono caps muted" style={{ marginBottom: 8 }}>— {raison} · Menuiserie sur mesure</div>
          <div className="serif" style={{ fontSize: 32, letterSpacing: '-0.015em' }}>
            <em>{balanceText}</em> de crédit actif · 24 contacts ce mois
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            2 campagnes actives · taux d'acceptation moyen 62% · ROI estimé ×3,8
          </div>
        </div>
```

Replace with:

```jsx
  const balanceText = wallet
    ? _eurFmt.format(Number(wallet.walletBalanceEur ?? 0))
    : '…';

  // Overview stats — fetched live from /api/pro/overview.
  const [overview, setOverview] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/pro/overview', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled) setOverview(j); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const contactsThisMonth = overview?.contactsAcceptedThisMonth ?? null;
  const activeCampaigns = overview?.activeCampaignsCount ?? null;
  const acceptanceRate = overview?.acceptanceRate ?? null;
  const k1 = overview?.contactsAccepted30d ?? 0;
  const roi = k1 === 0 ? '—' : '×' + (1 + k1 * 0.15).toFixed(1).replace('.', ',');

  return (
    <div style={{ padding: '24px 40px 28px', borderTop: '1px solid var(--line)' }}>
      <div className="row between" style={{ alignItems: 'flex-start', gap: 32, flexWrap: 'wrap' }}>
        <div>
          <div className="mono caps muted" style={{ marginBottom: 8 }}>— {raison} · Menuiserie sur mesure</div>
          <div className="serif" style={{ fontSize: 32, letterSpacing: '-0.015em' }}>
            <em>{balanceText}</em> de crédit actif · {contactsThisMonth ?? '…'} contact{contactsThisMonth === 1 ? '' : 's'} ce mois
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            {activeCampaigns ?? '…'} campagne{activeCampaigns === 1 ? '' : 's'} active{activeCampaigns === 1 ? '' : 's'} · taux d'acceptation moyen {acceptanceRate ?? '…'}% · ROI estimé {roi}
          </div>
        </div>
```

- [ ] **Step 3: Verify JSX parses**

```bash
node -e 'require("@babel/parser").parse(require("fs").readFileSync("public/prototype/components/Pro.jsx","utf8"),{sourceType:"module",plugins:["jsx"]})' && echo OK
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add public/prototype/components/Pro.jsx
git commit -m "feat(pro/header): wire stats to /api/pro/overview (contacts-month, active campaigns, acceptance, ROI)"
```

---

## Task 3: GET /api/pro/timeseries

**Files:**
- Create: `app/api/pro/timeseries/route.ts`

- [ ] **Step 1: Write the handler**

Create `app/api/pro/timeseries/route.ts` with:

```ts
/**
 * GET /api/pro/timeseries?range=7d|30d|90d — bucketized acceptance counts.
 *
 * Renvoie une série temporelle des relations gagnées (status accepted ou
 * settled) du pro courant, découpée en buckets selon la fenêtre demandée.
 *
 *  - 7d  → 7 buckets quotidiens, label = jour FR (Lun, Mar, …, Dim)
 *  - 30d → 10 buckets de 3 jours, label = "J-27", "J-24", …, "J-0"
 *  - 90d → 13 buckets hebdo (91 jours), label = "S1"…"S13"
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

export const runtime = "nodejs";

type Range = "7d" | "30d" | "90d";

const DAY_MS = 86_400_000;

const DAY_LABELS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function rangeStart(range: Range): Date {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 91;
  return new Date(Date.now() - days * DAY_MS);
}

type Bucket = { start: string; end: string; label: string; count: number };

function buildBuckets(range: Range, now: Date): Bucket[] {
  const buckets: Bucket[] = [];
  if (range === "7d") {
    // 7 daily buckets, oldest first.
    for (let i = 6; i >= 0; i--) {
      const start = new Date(now.getTime() - (i + 1) * DAY_MS + 1);
      const end = new Date(now.getTime() - i * DAY_MS);
      buckets.push({
        start: start.toISOString(),
        end: end.toISOString(),
        label: DAY_LABELS_FR[end.getDay()],
        count: 0,
      });
    }
  } else if (range === "30d") {
    // 10 buckets of 3 days, oldest first. Labels J-27, J-24, …, J-0.
    for (let i = 9; i >= 0; i--) {
      const start = new Date(now.getTime() - (i * 3 + 3) * DAY_MS + 1);
      const end = new Date(now.getTime() - i * 3 * DAY_MS);
      buckets.push({
        start: start.toISOString(),
        end: end.toISOString(),
        label: `J-${i * 3}`,
        count: 0,
      });
    }
  } else {
    // 13 weekly buckets, label S1..S13 (S13 = current week).
    for (let i = 12; i >= 0; i--) {
      const start = new Date(now.getTime() - (i + 1) * 7 * DAY_MS + 1);
      const end = new Date(now.getTime() - i * 7 * DAY_MS);
      buckets.push({
        start: start.toISOString(),
        end: end.toISOString(),
        label: `S${13 - i}`,
        count: 0,
      });
    }
  }
  return buckets;
}

function bucketIndex(decidedAt: string, buckets: Bucket[]): number {
  const t = new Date(decidedAt).getTime();
  for (let i = 0; i < buckets.length; i++) {
    const s = new Date(buckets[i].start).getTime();
    const e = new Date(buckets[i].end).getTime();
    if (t >= s && t <= e) return i;
  }
  return -1;
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const rangeParam = url.searchParams.get("range");
  const range: Range = rangeParam === "7d" || rangeParam === "90d" ? rangeParam : "30d";

  const user = await currentUser();
  const email = user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const sinceIso = rangeStart(range).toISOString();

  const { data, error } = await admin
    .from("relations")
    .select("status, decided_at")
    .eq("pro_account_id", proId)
    .in("status", ["accepted", "settled"])
    .gte("decided_at", sinceIso);

  if (error) {
    console.error("[/api/pro/timeseries] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const now = new Date();
  const buckets = buildBuckets(range, now);
  for (const r of (data ?? [])) {
    if (!r.decided_at) continue;
    const idx = bucketIndex(r.decided_at, buckets);
    if (idx >= 0) buckets[idx].count++;
  }

  return NextResponse.json({ range, buckets });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "app/api/pro/timeseries"
```
Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add app/api/pro/timeseries/route.ts
git commit -m "feat(api): GET /api/pro/timeseries with 7d/30d/90d buckets"
```

---

## Task 4: Refactor BarChart + wire Overview chart

**Files:**
- Modify: `public/prototype/components/Pro.jsx` (BarChart ~ line 248, Overview chart card ~ lines 197-211)

- [ ] **Step 1: Refactor `BarChart` to accept `buckets` prop**

Find the existing `BarChart` function (around line 248):

```jsx
function BarChart() {
  const data = [4, 7, 5, 9, 6, 8, 12, 10, 13, 9, 14, 11];
  const labels = ['S1','S2','S3','S4','S5','S6','S7','S8','S9','S10','S11','S12'];
  const max = 16, H = 180, W = 560, P = 16;
  const bw = (W - 2*P) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H+28}`} style={{ width: '100%', height: 210 }}>
      {[4, 8, 12, 16].map(v => {
        const y = P + (1 - v/max) * (H - 2*P);
        return <g key={v}><line x1={P} x2={W-P} y1={y} y2={y} stroke="var(--line)" strokeDasharray="2 4"/>
          <text x={W-P+2} y={y+3} fontSize="9" fill="var(--ink-5)" fontFamily="monospace">{v}</text></g>;
      })}
      {data.map((v, i) => {
        const h = (v / max) * (H - 2*P);
        const x = P + i * bw + 4;
        const y = H - P - h;
        return <g key={i}>
          <rect x={x} y={y} width={bw - 8} height={h} fill={i === data.length - 1 ? 'var(--accent)' : 'var(--ink-2)'} rx="2"/>
          <text x={x + (bw-8)/2} y={H+4} textAnchor="middle" fontSize="9" fill="var(--ink-5)" fontFamily="monospace">{labels[i]}</text>
        </g>;
      })}
    </svg>
  );
}
```

Replace with:

```jsx
function BarChart({ buckets }) {
  const data = (buckets || []).map(b => Number(b.count) || 0);
  const labels = (buckets || []).map(b => b.label);
  const rawMax = Math.max(...data, 1);
  // Round up to a nice grid value.
  const step = rawMax <= 4 ? 1 : rawMax <= 10 ? 2 : rawMax <= 25 ? 5 : 10;
  const max = Math.ceil(rawMax / step) * step;
  const gridLines = [];
  for (let v = step; v <= max; v += step) gridLines.push(v);
  const H = 180, W = 560, P = 16;
  const bw = data.length > 0 ? (W - 2*P) / data.length : 0;
  return (
    <svg viewBox={`0 0 ${W} ${H+28}`} style={{ width: '100%', height: 210 }}>
      {gridLines.map(v => {
        const y = P + (1 - v/max) * (H - 2*P);
        return <g key={v}><line x1={P} x2={W-P} y1={y} y2={y} stroke="var(--line)" strokeDasharray="2 4"/>
          <text x={W-P+2} y={y+3} fontSize="9" fill="var(--ink-5)" fontFamily="monospace">{v}</text></g>;
      })}
      {data.map((v, i) => {
        const h = (v / max) * (H - 2*P);
        const x = P + i * bw + 4;
        const y = H - P - h;
        return <g key={i}>
          <rect x={x} y={y} width={Math.max(0, bw - 8)} height={Math.max(0, h)} fill={i === data.length - 1 ? 'var(--accent)' : 'var(--ink-2)'} rx="2"/>
          <text x={x + (bw-8)/2} y={H+4} textAnchor="middle" fontSize="9" fill="var(--ink-5)" fontFamily="monospace">{labels[i]}</text>
        </g>;
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Wire the Overview chart card to fetch + range state**

Find the chart card in `Overview()` (around lines 197-211):

```jsx
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 28 }}>
          <div className="row between" style={{ marginBottom: 16 }}>
            <div>
              <div className="serif" style={{ fontSize: 22 }}>Performance des campagnes</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Contacts obtenus, 30 derniers jours</div>
            </div>
            <div className="row gap-2">
              {['7J', '30J', '90J'].map((t, i) => (
                <button key={t} className="chip" style={{ cursor: 'pointer', background: i === 1 ? 'var(--ink)' : 'var(--ivory-2)', color: i === 1 ? 'var(--paper)' : 'var(--ink-3)', border: 0 }}>{t}</button>
              ))}
            </div>
          </div>
          <BarChart/>
        </div>
```

Replace with:

```jsx
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <PerformanceCard/>
```

Then add this new component just above `function Overview` (or just below `BarChart`):

```jsx
const RANGE_LABELS = { '7d': '7 derniers jours', '30d': '30 derniers jours', '90d': '90 derniers jours' };

function PerformanceCard() {
  const [range, setRange] = React.useState('30d');
  const [series, setSeries] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    setSeries(null);
    fetch(`/api/pro/timeseries?range=${range}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled) setSeries(j); })
      .catch(() => { if (!cancelled) setSeries(null); });
    return () => { cancelled = true; };
  }, [range]);
  const buckets = series?.buckets || [];
  const totalCount = buckets.reduce((acc, b) => acc + (Number(b.count) || 0), 0);
  return (
    <div className="card" style={{ padding: 28 }}>
      <div className="row between" style={{ marginBottom: 16 }}>
        <div>
          <div className="serif" style={{ fontSize: 22 }}>Performance des campagnes</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Contacts obtenus, {RANGE_LABELS[range]}
            {series && ` · ${totalCount} acceptation${totalCount === 1 ? '' : 's'}`}
          </div>
        </div>
        <div className="row gap-2">
          {[['7d', '7J'], ['30d', '30J'], ['90d', '90J']].map(([k, l]) => {
            const active = range === k;
            return (
              <button key={k} onClick={() => setRange(k)} className="chip" style={{
                cursor: 'pointer',
                background: active ? 'var(--ink)' : 'var(--ivory-2)',
                color: active ? 'var(--paper)' : 'var(--ink-3)',
                border: 0,
              }}>{l}</button>
            );
          })}
        </div>
      </div>
      {series === null ? (
        <div className="muted" style={{ fontSize: 13, padding: 32, textAlign: 'center' }}>Chargement…</div>
      ) : (
        <BarChart buckets={buckets}/>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify JSX parses**

```bash
node -e 'require("@babel/parser").parse(require("fs").readFileSync("public/prototype/components/Pro.jsx","utf8"),{sourceType:"module",plugins:["jsx"]})' && echo OK
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add public/prototype/components/Pro.jsx
git commit -m "feat(pro/overview): live BarChart + active 7J/30J/90J chips via /api/pro/timeseries"
```

---

## Task 5: Add `objectiveLabel` helper

**Files:**
- Modify: `lib/campaigns/mapping.ts`

- [ ] **Step 1: Append the new helper**

Open `lib/campaigns/mapping.ts` and add after the existing `objectiveToCampaignType` function:

```ts
const OBJECTIVE_TO_LABEL: Record<string, string> = {
  contact: "Prise de contact direct",
  rdv: "Prise de rendez-vous",
  evt: "Événementiel & inscription",
  dl: "Contenus à télécharger",
  survey: "Études & collecte d'avis",
  promo: "Promotions & fidélisation",
  addigital: "Publicité digitale",
};

export function objectiveLabel(objectiveId: string | null | undefined): string {
  if (!objectiveId) return "Campagne";
  return OBJECTIVE_TO_LABEL[objectiveId] ?? "Campagne";
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "lib/campaigns/mapping"
```
Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add lib/campaigns/mapping.ts
git commit -m "feat(campaigns/mapping): add objectiveLabel for human-readable names"
```

---

## Task 6: GET /api/pro/campaigns

**Files:**
- Modify: `app/api/pro/campaigns/route.ts` (add GET method alongside POST)

- [ ] **Step 1: Append the GET handler**

Open `app/api/pro/campaigns/route.ts`. At the bottom of the file (after the existing `POST` and `randomCode` helper), add:

```ts
import { objectiveLabel } from "@/lib/campaigns/mapping";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const [{ data: camps, error: campErr }, { data: rels, error: relErr }] = await Promise.all([
    admin
      .from("campaigns")
      .select("id, name, status, targeting, budget_cents, spent_cents, cost_per_contact_cents, created_at")
      .eq("pro_account_id", proId)
      .order("created_at", { ascending: false }),
    admin
      .from("relations")
      .select("campaign_id, status")
      .eq("pro_account_id", proId)
      .in("status", ["accepted", "settled"]),
  ]);

  if (campErr) {
    console.error("[/api/pro/campaigns GET] read campaigns failed", campErr);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  if (relErr) {
    console.error("[/api/pro/campaigns GET] read relations failed", relErr);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const contactsByCampaign = new Map<string, number>();
  for (const r of (rels ?? [])) {
    contactsByCampaign.set(r.campaign_id, (contactsByCampaign.get(r.campaign_id) ?? 0) + 1);
  }

  type Targeting = { objectiveId?: string };
  const campaigns = (camps ?? []).map((c) => {
    const targeting = (c.targeting as Targeting | null) ?? null;
    return {
      id: c.id as string,
      name: c.name as string,
      status: c.status as string,
      objectiveLabel: objectiveLabel(targeting?.objectiveId),
      budgetEur: Number(c.budget_cents ?? 0) / 100,
      spentEur: Number(c.spent_cents ?? 0) / 100,
      contactsCount: contactsByCampaign.get(c.id as string) ?? 0,
      createdAt: c.created_at as string,
      avgCostEur: Number(c.cost_per_contact_cents ?? 0) / 100,
    };
  });

  return NextResponse.json({ campaigns });
}
```

Note: the `import { objectiveLabel }` line goes at the top of the file
with the other imports. Move it there.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "app/api/pro/campaigns"
```
Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add app/api/pro/campaigns/route.ts
git commit -m "feat(api): GET /api/pro/campaigns — pro's campaign list with contacts count"
```

---

## Task 7: Wire Campagnes() to live list

**Files:**
- Modify: `public/prototype/components/Pro.jsx` (Campagnes function ~ line 317)

- [ ] **Step 1: Replace the body of `Campagnes()` to fetch + render real campaigns**

Find:

```jsx
function Campagnes({ onCreate, onDetail }) {
  const [filter, setFilter] = useState('all');
  const camps = [
    ['Bilan postural — Lyon', 'active', 300, 218, 42, 'Prise de RDV', '02 avr.', '4,20'],
    ['Devis aménagement', 'active', 400, 147, 21, 'Prise de contact', '10 avr.', '6,80'],
    ['Portes ouvertes mai', 'paused', 150, 82, 11, 'Événement', '28 mars', '3,40'],
    ['Promo printemps', 'done', 200, 200, 38, 'Prise de contact', '14 fév.', '5,20'],
  ];
  const filtered = camps.filter(c => filter === 'all' || c[1] === filter);
```

Replace with:

```jsx
function Campagnes({ onCreate, onDetail }) {
  const [filter, setFilter] = useState('all');
  const [camps, setCamps] = useState(null); // null = loading
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setCamps(null);
    fetch('/api/pro/campaigns', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { campaigns: [] })
      .then(j => { if (!cancelled) setCamps(j.campaigns || []); })
      .catch(() => { if (!cancelled) setCamps([]); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const ALL = camps || [];
  // Bucket "done" regroupe completed + canceled (les deux sont terminales).
  const isDone = (s) => s === 'completed' || s === 'canceled';
  const counts = {
    all: ALL.length,
    active: ALL.filter(c => c.status === 'active').length,
    paused: ALL.filter(c => c.status === 'paused').length,
    done: ALL.filter(c => isDone(c.status)).length,
  };
  const filtered = ALL.filter(c =>
    filter === 'all' ||
    (filter === 'done' ? isDone(c.status) : c.status === filter)
  );
```

- [ ] **Step 2: Replace the JSX rendering of the campaign cards**

Find:

```jsx
      <div className="row gap-2">
        {[['all', 'Toutes (4)'], ['active', 'Actives (2)'], ['paused', 'En pause (1)'], ['done', 'Terminées (1)']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className="chip" style={{
            cursor: 'pointer', padding: '6px 12px', fontSize: 12,
            background: filter === k ? 'var(--ink)' : 'var(--paper)',
            color: filter === k ? 'var(--paper)' : 'var(--ink-3)',
            borderColor: filter === k ? 'var(--ink)' : 'var(--line-2)'
          }}>{l}</button>
        ))}
      </div>
      <div className="col gap-3">
        {filtered.map((c, i) => (
          <div key={i} className="card" style={{ padding: 24 }}>
            <div className="row between" style={{ alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div className="row center gap-3" style={{ marginBottom: 10 }}>
                  <div className="serif" style={{ fontSize: 22 }}>{c[0]}</div>
                  <span className={'chip ' + (c[1] === 'active' ? 'chip-good' : c[1] === 'paused' ? 'chip-warn' : '')}>
                    {c[1] === 'active' ? 'Active' : c[1] === 'paused' ? 'En pause' : 'Terminée'}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>{c[5]} · créée le {c[6]} · coût unitaire moyen {c[7]} €</div>
                <div className="row gap-6" style={{ marginTop: 16, flexWrap: 'wrap' }}>
                  <div><div className="muted mono caps" style={{ fontSize: 10 }}>Budget</div><div className="serif tnum" style={{ fontSize: 20 }}>{c[3]} / {c[2]} €</div></div>
                  <div><div className="muted mono caps" style={{ fontSize: 10 }}>Contacts</div><div className="serif tnum" style={{ fontSize: 20 }}>{c[4]}</div></div>
                  <div style={{ flex: 1, minWidth: 180, alignSelf: 'flex-end' }}>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 6 }}>Budget consommé</div>
                    <Progress value={c[3]/c[2]}/>
                  </div>
                </div>
              </div>
              <div className="row gap-2">
                <button className="btn btn-ghost btn-sm">
                  <Icon name={c[1] === 'active' ? 'pause' : 'play'} size={12}/>
                  {c[1] === 'active' ? 'Pause' : 'Relancer'}
                </button>
                <button className="btn btn-ghost btn-sm"><Icon name="copy" size={12}/> Dupliquer</button>
                <button className="btn btn-ghost btn-sm" onClick={() => onDetail(c)}>Détails <Icon name="arrow" size={12}/></button>
              </div>
            </div>
          </div>
        ))}
      </div>
```

Replace with:

```jsx
      <div className="row gap-2">
        {[
          ['all', `Toutes (${counts.all})`],
          ['active', `Actives (${counts.active})`],
          ['paused', `En pause (${counts.paused})`],
          ['done', `Terminées (${counts.done})`],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className="chip" style={{
            cursor: 'pointer', padding: '6px 12px', fontSize: 12,
            background: filter === k ? 'var(--ink)' : 'var(--paper)',
            color: filter === k ? 'var(--paper)' : 'var(--ink-3)',
            borderColor: filter === k ? 'var(--ink)' : 'var(--line-2)'
          }}>{l}</button>
        ))}
      </div>
      <div className="col gap-3">
        {camps === null && (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: 13 }}>Chargement…</div>
          </div>
        )}
        {camps !== null && camps.length === 0 && (
          <div className="card" style={{ padding: 28, textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
              Aucune campagne pour le moment.
            </div>
            <button className="btn btn-primary btn-sm" onClick={onCreate}>
              <Icon name="plus" size={12}/> Créer votre première campagne
            </button>
          </div>
        )}
        {camps !== null && camps.length > 0 && filtered.length === 0 && (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: 13 }}>Aucune campagne ne correspond à ce filtre.</div>
          </div>
        )}
        {filtered.map((c) => {
          const statusLabel = c.status === 'active' ? 'Active' : c.status === 'paused' ? 'En pause' : 'Terminée';
          const statusChip = c.status === 'active' ? 'chip-good' : c.status === 'paused' ? 'chip-warn' : '';
          const dateStr = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(c.createdAt));
          const fmt2 = v => Number(v ?? 0).toFixed(2).replace('.', ',');
          const isActive = c.status === 'active';
          const canToggle = c.status === 'active' || c.status === 'paused';
          return (
            <div key={c.id} className="card" style={{ padding: 24 }}>
              <div className="row between" style={{ alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div className="row center gap-3" style={{ marginBottom: 10 }}>
                    <div className="serif" style={{ fontSize: 22 }}>{c.name}</div>
                    <span className={'chip ' + statusChip}>{statusLabel}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {c.objectiveLabel} · créée le {dateStr} · coût unitaire moyen {fmt2(c.avgCostEur)} €
                  </div>
                  <div className="row gap-6" style={{ marginTop: 16, flexWrap: 'wrap' }}>
                    <div><div className="muted mono caps" style={{ fontSize: 10 }}>Budget</div><div className="serif tnum" style={{ fontSize: 20 }}>{fmt2(c.spentEur)} / {fmt2(c.budgetEur)} €</div></div>
                    <div><div className="muted mono caps" style={{ fontSize: 10 }}>Contacts</div><div className="serif tnum" style={{ fontSize: 20 }}>{c.contactsCount}</div></div>
                    <div style={{ flex: 1, minWidth: 180, alignSelf: 'flex-end' }}>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 6 }}>Budget consommé</div>
                      <Progress value={c.budgetEur > 0 ? c.spentEur / c.budgetEur : 0}/>
                    </div>
                  </div>
                </div>
                <div className="row gap-2">
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={!canToggle}
                    style={!canToggle ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                    onClick={async () => {
                      if (!canToggle) return;
                      const next = isActive ? 'paused' : 'active';
                      try {
                        const r = await fetch(`/api/pro/campaigns/${c.id}`, {
                          method: 'PATCH',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ status: next }),
                        });
                        if (!r.ok) {
                          const j = await r.json().catch(() => ({}));
                          alert("Échec : " + (j?.error || r.status));
                          return;
                        }
                        setReloadKey(k => k + 1);
                      } catch (e) {
                        alert("Erreur réseau : " + (e.message || ''));
                      }
                    }}
                  >
                    <Icon name={isActive ? 'pause' : 'play'} size={12}/>
                    {isActive ? 'Pause' : 'Relancer'}
                  </button>
                  <button className="btn btn-ghost btn-sm"><Icon name="copy" size={12}/> Dupliquer</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => onDetail(c)}>Détails <Icon name="arrow" size={12}/></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
```

- [ ] **Step 2: Verify JSX parses**

```bash
node -e 'require("@babel/parser").parse(require("fs").readFileSync("public/prototype/components/Pro.jsx","utf8"),{sourceType:"module",plugins:["jsx"]})' && echo OK
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add public/prototype/components/Pro.jsx
git commit -m "feat(pro/campagnes): wire list to /api/pro/campaigns + pause/play action"
```

---

## Task 8: PATCH /api/pro/campaigns/[id] (status toggle)

**Files:**
- Create: `app/api/pro/campaigns/[id]/route.ts`

- [ ] **Step 1: Write the handler**

Create `app/api/pro/campaigns/[id]/route.ts` with:

```ts
/**
 * PATCH /api/pro/campaigns/[id] — toggle status (active ↔ paused).
 *
 * Body : { status: 'active' | 'paused' }
 *
 * Vérifications :
 *  - auth Clerk
 *  - ownership : la campagne appartient au pro courant
 *  - transition autorisée :
 *      active → paused   ✓
 *      paused → active   ✓ si campaigns.ends_at > now()
 *      autres            → 409 invalid_transition
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  let body: { status?: string };
  try { body = (await req.json()) as { status?: string }; }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  if (body.status !== "active" && body.status !== "paused") {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const targetStatus = body.status;

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const { data: camp, error: readErr } = await admin
    .from("campaigns")
    .select("id, status, ends_at, pro_account_id")
    .eq("id", id)
    .single();
  if (readErr || !camp) {
    return NextResponse.json({ error: "campaign_not_found" }, { status: 404 });
  }
  if (camp.pro_account_id !== proId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const valid =
    (camp.status === "active" && targetStatus === "paused") ||
    (camp.status === "paused" && targetStatus === "active");
  if (!valid) {
    return NextResponse.json({ error: "invalid_transition" }, { status: 409 });
  }
  if (targetStatus === "active" && camp.ends_at && new Date(camp.ends_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "campaign_expired" }, { status: 410 });
  }

  const { error: updateErr } = await admin
    .from("campaigns")
    .update({ status: targetStatus })
    .eq("id", id)
    .eq("status", camp.status); // TOCTOU guard
  if (updateErr) {
    console.error("[/api/pro/campaigns/PATCH] update failed", updateErr);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: targetStatus });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "app/api/pro/campaigns/\[id\]"
```
Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add app/api/pro/campaigns/\[id\]/route.ts
git commit -m "feat(api): PATCH /api/pro/campaigns/[id] — toggle active/paused with TOCTOU guard"
```

---

## Task 9: GET /api/pro/info

**Files:**
- Create: `app/api/pro/info/route.ts`

- [ ] **Step 1: Write GET + PATCH in the same file**

Create `app/api/pro/info/route.ts` with:

```ts
/**
 * /api/pro/info — informations société du pro courant.
 *
 *   GET   → { raisonSociale, adresse, ville, codePostal, siren, secteur }
 *   PATCH → applique un update partiel sur pro_accounts (mêmes champs).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

export const runtime = "nodejs";

type InfoBody = {
  raisonSociale?: string | null;
  adresse?: string | null;
  ville?: string | null;
  codePostal?: string | null;
  siren?: string | null;
  secteur?: string | null;
};

const FIELD_MAP: Record<keyof InfoBody, string> = {
  raisonSociale: "raison_sociale",
  adresse: "adresse",
  ville: "ville",
  codePostal: "code_postal",
  siren: "siren",
  secteur: "secteur",
};

const SIREN_REGEX = /^[0-9]{9}$/;

async function getProId(): Promise<{ proId?: string; resp?: NextResponse }> {
  const { userId } = await auth();
  if (!userId) {
    return { resp: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });
  return { proId };
}

export async function GET() {
  const { proId, resp } = await getProId();
  if (resp) return resp;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("pro_accounts")
    .select("raison_sociale, adresse, ville, code_postal, siren, secteur")
    .eq("id", proId!)
    .single();
  if (error || !data) {
    console.error("[/api/pro/info GET] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  return NextResponse.json({
    raisonSociale: data.raison_sociale ?? "",
    adresse: data.adresse ?? "",
    ville: data.ville ?? "",
    codePostal: data.code_postal ?? "",
    siren: data.siren ?? "",
    secteur: data.secteur ?? "",
  });
}

export async function PATCH(req: Request) {
  const { proId, resp } = await getProId();
  if (resp) return resp;

  let body: InfoBody;
  try { body = (await req.json()) as InfoBody; }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  // Build the partial update — only include keys actually present in the body.
  const update: Record<string, string | null> = {};
  for (const uiKey of Object.keys(FIELD_MAP) as Array<keyof InfoBody>) {
    if (uiKey in body) {
      const dbKey = FIELD_MAP[uiKey];
      const value = body[uiKey];
      if (value == null || value === "") {
        update[dbKey] = null;
      } else if (typeof value === "string") {
        update[dbKey] = value.trim().slice(0, 200);
      }
    }
  }

  if (update.siren != null && update.siren !== "" && !SIREN_REGEX.test(update.siren)) {
    return NextResponse.json({ error: "invalid_siren" }, { status: 400 });
  }
  // raison_sociale is NOT NULL in DB — don't allow erasing it.
  if ("raison_sociale" in update && (update.raison_sociale == null || update.raison_sociale === "")) {
    return NextResponse.json({ error: "raison_sociale_required" }, { status: 400 });
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("pro_accounts")
    .update(update)
    .eq("id", proId!);
  if (error) {
    console.error("[/api/pro/info PATCH] update failed", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, updated: Object.keys(update).length });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "app/api/pro/info"
```
Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add app/api/pro/info/route.ts
git commit -m "feat(api): GET/PATCH /api/pro/info — fetch and update company info"
```

---

## Task 10: Wire MesInformations + ProDashboard to live info

**Files:**
- Modify: `public/prototype/components/Pro.jsx` (ProDashboard ~ line 13, MesInformations ~ line 2881)

- [ ] **Step 1: Replace the hardcoded `companyInfo` initial state with a fetched one**

Find in `ProDashboard` (around lines 32-39):

```jsx
  const [companyInfo, setCompanyInfo] = useState({
    raisonSociale: 'Atelier Mercier',
    adresse: '12 rue des Artisans',
    ville: 'Lyon',
    siren: '',
  });
```

Replace with:

```jsx
  const [companyInfo, setCompanyInfoState] = useState({
    raisonSociale: '',
    adresse: '',
    ville: '',
    codePostal: '',
    siren: '',
    secteur: '',
  });
  // Hydrate from /api/pro/info on mount.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/pro/info', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled && j) setCompanyInfoState(prev => ({ ...prev, ...j })); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  // Wrapper that persists each update via PATCH and notifies subscribers.
  const setCompanyInfo = React.useCallback((updater) => {
    setCompanyInfoState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const diff = {};
      for (const key of Object.keys(next)) {
        if (next[key] !== prev[key]) diff[key] = next[key];
      }
      if (Object.keys(diff).length > 0) {
        fetch('/api/pro/info', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(diff),
        })
          .then(async r => {
            if (!r.ok) {
              const j = await r.json().catch(() => ({}));
              console.warn('[pro/info] PATCH failed', r.status, j);
              return;
            }
            try { window.dispatchEvent(new Event('pro:info-changed')); } catch {}
          })
          .catch(e => console.warn('[pro/info] PATCH error', e));
      }
      return next;
    });
  }, []);
```

- [ ] **Step 2: Verify JSX parses**

```bash
node -e 'require("@babel/parser").parse(require("fs").readFileSync("public/prototype/components/Pro.jsx","utf8"),{sourceType:"module",plugins:["jsx"]})' && echo OK
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add public/prototype/components/Pro.jsx
git commit -m "feat(pro/info): hydrate companyInfo from /api/pro/info + persist on edit"
```

---

## Task 11: Final validation

**Files:** none (validation only)

- [ ] **Step 1: TypeScript check**

```bash
cd /Users/mjlk_blockchain/Desktop/buupp && npx tsc --noEmit 2>&1 | grep -E "app/api/pro|lib/campaigns/mapping" | head -20
```
Expected: no errors.

- [ ] **Step 2: JSX parse**

```bash
cd /Users/mjlk_blockchain/Desktop/buupp && node -e 'require("@babel/parser").parse(require("fs").readFileSync("public/prototype/components/Pro.jsx","utf8"),{sourceType:"module",plugins:["jsx"]})' && echo OK
```
Expected: `OK`

- [ ] **Step 3: Lint check**

```bash
cd /Users/mjlk_blockchain/Desktop/buupp && npx eslint \
  app/api/pro/overview/route.ts \
  app/api/pro/campaigns/route.ts \
  app/api/pro/campaigns/\[id\]/route.ts \
  app/api/pro/timeseries/route.ts \
  app/api/pro/info/route.ts \
  lib/campaigns/mapping.ts
```
Expected: exit code 0, no errors.

- [ ] **Step 4: Build check**

```bash
cd /Users/mjlk_blockchain/Desktop/buupp && npm run build
```
Expected: build succeeds. New routes appear in the output.

- [ ] **Step 5: Manual smoke (controller / human)**

Boot `npm run dev`, sign in as a pro account. Verify:

1. ProHeader shows real "X contacts ce mois · Y campagnes actives · Z%" instead of hardcoded.
2. Vue d'ensemble Performance card → click 7J/30J/90J chips → BarChart re-renders with new buckets and the active chip is highlighted in dark.
3. Onglet Campagnes → real campaigns appear (not 4 fakes). Empty state shows CTA if zero.
4. Click "Pause" on an active campaign → status flips to "En pause" and the icon swaps. Click "Relancer" → flips back.
5. Onglet Mes informations → shows the real raison sociale (whatever was persisted earlier or a blank). Edit a field → close modal → header reflects new raison sociale.

- [ ] **Step 6: Final commit if any cleanups**

```bash
cd /Users/mjlk_blockchain/Desktop/buupp && git add -A && git diff --cached --quiet || git commit -m "chore(pro/phase-b): post-smoke fixes"
```
