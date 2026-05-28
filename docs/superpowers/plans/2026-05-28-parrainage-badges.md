# Badges de parrainage (couronne) + numéro de fondateur — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher un badge couronne (cuivre/argent/or selon le nombre de filleuls) + un numéro de fondateur (popup au clic) sur le dashboard pro (web) et l'accueil prospect (mobile), et désactiver le lien de parrainage à 10 filleuls.

**Architecture:** Couche d'affichage au-dessus du parrainage existant. Une lib partagée (`lib/waitlist/referral.ts`) calcule palier + numéro depuis la table `waitlist` (par e-mail). Deux routes API thin la consomment. Le web (prototype React vanilla en iframe) et le mobile (RN/Expo, worktree `worktree-mobile-app`) rendent un badge + popup chacun avec leur stack.

**Tech Stack:** Next.js 16 (App Router, runtime nodejs), Supabase (service_role), Vitest. Mobile : Expo, React Query (`useGet`), NativeWind, `expo-linear-gradient`.

**Spec :** `docs/superpowers/specs/2026-05-28-parrainage-badges-design.md`

---

## File Structure

**Back-end (web repo, `/Users/mjlk_blockchain/Desktop/buupp`)**
- Create: `lib/waitlist/referral.ts` — `referralBadgeTier()` + `getReferralStatus()`
- Create: `tests/lib/waitlist/referral.test.ts`
- Modify: `app/api/prospect/parrainage/route.ts` — délègue à la lib + nouveaux champs
- Create: `app/api/me/referral/route.ts` — endpoint neutre pour l'espace pro
- Create: `tests/api/me/referral.test.ts`

**Front-end web (prototype)**
- Modify: `public/prototype/components/Pro.jsx` — helper fetch + `ReferralBadge` + `ReferralBadgePopup` + insertion dans `ProHeader`
- Modify: `public/prototype/components/Prospect.jsx` — désactivation du lien à `cap`

**Front-end mobile (`.claude/worktrees/mobile-app/mobile`)**
- Modify: `lib/queries.ts` — type `Parrainage` étendu
- Create: `components/referral-badge.tsx` — `ReferralBadge` (pastille gradient) + `ReferralBadgePopup` (Modal)
- Modify: `app/(prospect)/portefeuille.tsx` — badge dans le hero + ouverture popup
- Modify: `app/(prospect)/parrainage.tsx` — désactivation du lien à `cap`

> ⚠️ **Le mobile vit dans un worktree git séparé** (`.claude/worktrees/mobile-app`), branche `worktree-mobile-app`. Les commits des tâches mobiles se font **dans ce worktree** (`git -C .claude/worktrees/mobile-app/mobile ...` ou en s'y plaçant), pas sur `main`. Les tâches back-end + web se commitent sur `main`.

---

## Task 1: Lib — `referralBadgeTier()` (fonction pure)

**Files:**
- Create: `lib/waitlist/referral.ts`
- Test: `tests/lib/waitlist/referral.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// tests/lib/waitlist/referral.test.ts
import { describe, expect, it } from "vitest";
import { referralBadgeTier } from "@/lib/waitlist/referral";

describe("referralBadgeTier", () => {
  it("renvoie null à 0 filleul", () => {
    expect(referralBadgeTier(0)).toBeNull();
  });
  it("renvoie cuivre pour 1-2 filleuls", () => {
    expect(referralBadgeTier(1)).toBe("cuivre");
    expect(referralBadgeTier(2)).toBe("cuivre");
  });
  it("renvoie argent pour 3-9 filleuls", () => {
    expect(referralBadgeTier(3)).toBe("argent");
    expect(referralBadgeTier(9)).toBe("argent");
  });
  it("renvoie or à partir de 10 filleuls", () => {
    expect(referralBadgeTier(10)).toBe("or");
    expect(referralBadgeTier(11)).toBe("or");
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npm test -- tests/lib/waitlist/referral.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/waitlist/referral"`.

- [ ] **Step 3: Implémenter la fonction minimale**

```ts
// lib/waitlist/referral.ts
export type ReferralBadgeTier = "cuivre" | "argent" | "or";

/**
 * Palier de badge couronne selon le nombre de filleuls.
 *   0      → null (pas de badge)
 *   1-2    → cuivre
 *   3-9    → argent
 *   10+    → or
 * (10 = cap waitlist ; >10 impossible via le trigger Postgres, mais on
 *  borne quand même pour robustesse d'affichage.)
 */
export function referralBadgeTier(count: number): ReferralBadgeTier | null {
  if (count >= 10) return "or";
  if (count >= 3) return "argent";
  if (count >= 1) return "cuivre";
  return null;
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npm test -- tests/lib/waitlist/referral.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/waitlist/referral.ts tests/lib/waitlist/referral.test.ts
git commit -m "feat(parrainage): referralBadgeTier (palier badge selon filleuls)"
```

---

## Task 2: Lib — `getReferralStatus(admin, email)`

**Files:**
- Modify: `lib/waitlist/referral.ts`
- Test: `tests/lib/waitlist/referral.test.ts` (ajout d'un `describe`)

Contexte : la lib reçoit un client Supabase admin déjà construit (injection
= testable). Elle lit la row waitlist de l'utilisateur (par e-mail), compte
ses filleuls et calcule son rang d'inscription.

- [ ] **Step 1: Écrire le test qui échoue (mock du client Supabase)**

Ajouter en haut du fichier de test :

```ts
import { getReferralStatus } from "@/lib/waitlist/referral";

// Faux client Supabase admin paramétrable. getReferralStatus fait 3 appels
// distincts à .from("waitlist") :
//   1. .select("ref_code, created_at").ilike("email").maybeSingle()  → row user
//   2. .select("id", {count,head}).eq("referrer_ref_code")           → nb filleuls
//   3. .select("id", {count,head}).lte("created_at")                 → rang
// On distingue (1) des (2)/(3) via la présence du modifier `count`, puis
// .eq → filleulCount et .lte → rankCount.
function makeAdmin(opts: {
  waitlistRow?: { ref_code: string; created_at: string } | null;
  filleulCount?: number;
  rankCount?: number;
}) {
  const select = (_cols: string, modifiers?: { count?: string; head?: boolean }) => {
    if (!modifiers?.count) {
      return {
        ilike: () => ({
          maybeSingle: async () => ({ data: opts.waitlistRow ?? null, error: null }),
        }),
      };
    }
    return {
      eq: async () => ({ count: opts.filleulCount ?? 0, error: null }),
      lte: async () => ({ count: opts.rankCount ?? 0, error: null }),
    };
  };
  return {
    from(table: string) {
      if (table !== "waitlist") throw new Error("table inattendue: " + table);
      return { select };
    },
  } as any;
}

describe("getReferralStatus", () => {
  it("membre waitlist avec 5 filleuls, rang 23", async () => {
    const admin = makeAdmin({
      waitlistRow: { ref_code: "ABC1234", created_at: "2026-05-01T00:00:00Z" },
      filleulCount: 5,
      rankCount: 23,
    });
    const s = await getReferralStatus(admin, "a@b.com");
    expect(s.refCode).toBe("ABC1234");
    expect(s.count).toBe(5);
    expect(s.badgeTier).toBe("argent");
    expect(s.founderNumber).toBe(23);
    expect(s.isFounder).toBe(true);
    expect(s.cap).toBe(10);
    expect(s.remaining).toBe(5);
  });

  it("non inscrit waitlist → pas de badge, founderNumber null", async () => {
    const admin = makeAdmin({ waitlistRow: null });
    const s = await getReferralStatus(admin, "x@y.com");
    expect(s.isFounder).toBe(false);
    expect(s.founderNumber).toBeNull();
    expect(s.count).toBe(0);
    expect(s.badgeTier).toBeNull();
    expect(s.refCode).toMatch(/^[0-9A-Z]{7}$/); // dérivé de l'email
  });
});
```

> Note d'implémentation pour Step 3 : pour que les compteurs `eq` (filleuls)
> et `lte` (rang) soient distinguables sans heuristique fragile, on fera
> **deux appels `.from("waitlist")` séparés** dans `getReferralStatus` (un
> par compteur), chacun avec sa propre chaîne `.select(count).eq()` ou
> `.select(count).lte()`. Le mock ci-dessus résout `eq`→filleulCount et
> `lte`→rankCount, ce qui suffit.

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npm test -- tests/lib/waitlist/referral.test.ts`
Expected: FAIL — `getReferralStatus is not a function` / import non résolu.

- [ ] **Step 3: Implémenter `getReferralStatus`**

Ajouter dans `lib/waitlist/referral.ts` :

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { refCodeFromEmail } from "@/lib/waitlist/ref-code";

const REFERRER_CAP = 10;

export type ReferralStatus = {
  refCode: string;
  count: number;
  cap: number;
  remaining: number;
  badgeTier: ReferralBadgeTier | null;
  /** Rang d'inscription waitlist (1-based). null si l'e-mail n'est pas inscrit. */
  founderNumber: number | null;
  /** = présent dans la waitlist. Distinct de prospects.is_founder (cf. spec). */
  isFounder: boolean;
};

export async function getReferralStatus(
  admin: SupabaseClient<Database>,
  email: string,
): Promise<ReferralStatus> {
  // 1. Row waitlist de l'utilisateur (insensible à la casse).
  const { data: row } = await admin
    .from("waitlist")
    .select("ref_code, created_at")
    .ilike("email", email)
    .maybeSingle();

  const refCode = row?.ref_code ?? refCodeFromEmail(email);
  const isFounder = !!row;

  // 2. Nombre de filleuls (count head, pas de payload).
  const { count: filleulCount } = await admin
    .from("waitlist")
    .select("id", { count: "exact", head: true })
    .eq("referrer_ref_code", refCode);

  const count = filleulCount ?? 0;

  // 3. Rang d'inscription (uniquement si inscrit). Rang = nb de rows
  //    inscrites à <= ma date de création.
  let founderNumber: number | null = null;
  if (row?.created_at) {
    const { count: rank } = await admin
      .from("waitlist")
      .select("id", { count: "exact", head: true })
      .lte("created_at", row.created_at);
    founderNumber = rank ?? null;
  }

  return {
    refCode,
    count,
    cap: REFERRER_CAP,
    remaining: Math.max(0, REFERRER_CAP - count),
    badgeTier: referralBadgeTier(count),
    founderNumber,
    isFounder,
  };
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npm test -- tests/lib/waitlist/referral.test.ts`
Expected: PASS (6 tests au total).

- [ ] **Step 5: Commit**

```bash
git add lib/waitlist/referral.ts tests/lib/waitlist/referral.test.ts
git commit -m "feat(parrainage): getReferralStatus (palier + numéro fondateur)"
```

---

## Task 3: API — étendre `/api/prospect/parrainage`

**Files:**
- Modify: `app/api/prospect/parrainage/route.ts`

Objectif : déléguer le calcul à `getReferralStatus` **sans changer la forme
de réponse existante** (le mobile et l'écran Parrainage en dépendent), et
**ajouter** `badgeTier` + `founderNumber`. On conserve les champs VIP +
`launchAt` (lus comme avant).

- [ ] **Step 1: Ajouter l'import de la lib**

En haut de `app/api/prospect/parrainage/route.ts`, ajouter :

```ts
import { getReferralStatus } from "@/lib/waitlist/referral";
```

- [ ] **Step 2: Remplacer le corps du `GET` après la garde `no_email`**

Remplacer tout le bloc actuel (création du client + lecture row + filleuls +
`vipEligible` + `return`) par :

```ts
const supabase = createSupabaseAdminClient();
const status = await getReferralStatus(supabase, email);

const [filleulsRes, configRes] = await Promise.all([
  // Liste des filleuls : toujours filtrée par le ref_code de l'utilisateur.
  supabase
    .from("waitlist")
    .select("prenom, nom, ville, created_at")
    .eq("referrer_ref_code", status.refCode)
    .order("created_at", { ascending: false }),
  supabase.from("app_config").select("launch_at").eq("id", true).maybeSingle(),
]);

const list = filleulsRes.data ?? [];

return NextResponse.json({
  refCode: status.refCode,
  launchAt: configRes.data?.launch_at ?? null,
  cap: status.cap,
  count: status.count,
  remaining: status.remaining,
  // Nouveaux champs :
  badgeTier: status.badgeTier,
  founderNumber: status.founderNumber,
  isFounder: status.isFounder,
  // Champs VIP conservés (rétro-compat) :
  vipEligible: status.count >= VIP_FILLEUL_THRESHOLD,
  vipThreshold: VIP_FILLEUL_THRESHOLD,
  vipBudgetMinEur: VIP_BUDGET_MIN_CENTS / 100,
  vipFlatBonusEur: VIP_FLAT_BONUS_CENTS / 100,
  filleuls: list.map((f) => ({
    prenom: f.prenom,
    nom: f.nom,
    ville: f.ville,
    createdAt: f.created_at,
  })),
});
```

Supprimer ensuite les imports/constantes devenus inutiles dans ce fichier
(`refCodeFromEmail`, constante locale `REFERRER_CAP`) s'ils ne sont plus
référencés.

- [ ] **Step 3: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit`
Expected: aucune erreur sur `app/api/prospect/parrainage/route.ts`.

- [ ] **Step 4: Lancer la suite (non-régression)**

Run: `npm test`
Expected: PASS (aucun test existant cassé).

- [ ] **Step 5: Commit**

```bash
git add app/api/prospect/parrainage/route.ts
git commit -m "feat(parrainage): /api/prospect/parrainage renvoie badgeTier + founderNumber"
```

---

## Task 4: API — nouvel endpoint neutre `/api/me/referral`

**Files:**
- Create: `app/api/me/referral/route.ts`
- Test: `tests/api/me/referral.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// tests/api/me/referral.test.ts
import { describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const currentUserMock = vi.fn();
vi.mock("@/lib/clerk/server", () => ({
  auth: () => authMock(),
  currentUser: () => currentUserMock(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({}),
}));

const getReferralStatusMock = vi.fn();
vi.mock("@/lib/waitlist/referral", () => ({
  getReferralStatus: (...args: unknown[]) => getReferralStatusMock(...args),
}));

describe("GET /api/me/referral", () => {
  it("renvoie 401 sans session Clerk", async () => {
    authMock.mockResolvedValueOnce({ userId: null });
    const { GET } = await import("@/app/api/me/referral/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("renvoie badgeTier:null si pas d'e-mail primaire", async () => {
    authMock.mockResolvedValueOnce({ userId: "u1" });
    currentUserMock.mockResolvedValueOnce({ emailAddresses: [], primaryEmailAddressId: null });
    const { GET } = await import("@/app/api/me/referral/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.badgeTier).toBeNull();
    expect(json.founderNumber).toBeNull();
  });

  it("délègue à getReferralStatus et renvoie ses champs", async () => {
    authMock.mockResolvedValueOnce({ userId: "u1" });
    currentUserMock.mockResolvedValueOnce({
      emailAddresses: [{ id: "e1", emailAddress: "a@b.com" }],
      primaryEmailAddressId: "e1",
    });
    getReferralStatusMock.mockResolvedValueOnce({
      refCode: "ABC1234",
      count: 5,
      cap: 10,
      remaining: 5,
      badgeTier: "argent",
      founderNumber: 23,
      isFounder: true,
    });
    const { GET } = await import("@/app/api/me/referral/route");
    const res = await GET();
    const json = await res.json();
    expect(json).toEqual({
      refCode: "ABC1234",
      count: 5,
      cap: 10,
      remaining: 5,
      badgeTier: "argent",
      founderNumber: 23,
      isFounder: true,
    });
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npm test -- tests/api/me/referral.test.ts`
Expected: FAIL — import `@/app/api/me/referral/route` non résolu.

- [ ] **Step 3: Implémenter la route**

```ts
// app/api/me/referral/route.ts
/**
 * GET /api/me/referral — état de parrainage de l'utilisateur courant,
 * role-agnostique (utilisable depuis l'espace pro comme prospect).
 * Renvoie toujours 200 (badgeTier:null si pas d'e-mail / pas inscrit) pour
 * ne pas casser l'en-tête qui l'affiche.
 */
import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getReferralStatus } from "@/lib/waitlist/referral";

export const runtime = "nodejs";

const EMPTY = {
  refCode: "",
  count: 0,
  cap: 10,
  remaining: 10,
  badgeTier: null,
  founderNumber: null,
  isFounder: false,
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses?.find(
    (e) => e.id === user.primaryEmailAddressId,
  )?.emailAddress;

  if (!email) {
    return NextResponse.json(EMPTY);
  }

  const supabase = createSupabaseAdminClient();
  const status = await getReferralStatus(supabase, email);
  return NextResponse.json(status);
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npm test -- tests/api/me/referral.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/me/referral/route.ts tests/api/me/referral.test.ts
git commit -m "feat(parrainage): GET /api/me/referral (endpoint neutre badge/numéro)"
```

---

## Task 5: Web — badge couronne + popup dans `ProHeader`

**Files:**
- Modify: `public/prototype/components/Pro.jsx`

Insertions : (a) un helper fetch module-level `fetchReferral()` à côté de
`fetchProWallet` (≈ L227-258) ; (b) deux composants `ReferralBadge` /
`ReferralBadgePopup` ; (c) rendu dans `ProHeader` après le label
`— {raison}` (L400).

- [ ] **Step 1: Ajouter le helper fetch (après `invalidateProOverview`, ~L258)**

```jsx
// Cache module-level de l'état de parrainage (badge couronne + numéro).
let _referralCache = null;
let _referralPromise = null;
async function fetchReferral() {
  if (_referralCache) return _referralCache;
  if (_referralPromise) return _referralPromise;
  _referralPromise = fetch('/api/me/referral', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(j => { _referralCache = j; _referralPromise = null; return j; })
    .catch(() => { _referralPromise = null; return null; });
  return _referralPromise;
}
```

- [ ] **Step 2: Ajouter les composants `ReferralBadge` + `ReferralBadgePopup` (avant `function ProHeader`, ~L263)**

```jsx
// Couleurs des paliers (couronne). Cohérent avec le doré CoinBadge.
const REFERRAL_TIERS = [
  { tier: 'cuivre', label: 'Cuivre', range: '1–2 filleuls',  color: '#B87333', advantage: 'Avantage à venir' },
  { tier: 'argent', label: 'Argent', range: '3–9 filleuls',  color: '#9CA3AF', advantage: 'Avantage à venir' },
  { tier: 'or',     label: 'Or',     range: '10 filleuls',   color: '#D4AF37', advantage: 'Avantage à venir' },
];
const REFERRAL_TIER_COLOR = { cuivre: '#B87333', argent: '#9CA3AF', or: '#D4AF37' };

function CrownSvg({ color, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      style={{ display: 'block' }}>
      <path
        d="M3 7l4.5 4L12 4l4.5 7L21 7l-1.6 11.2a1 1 0 0 1-1 .8H5.6a1 1 0 0 1-1-.8L3 7z"
        fill={color} stroke="rgba(0,0,0,.25)" strokeWidth="0.8"
        strokeLinejoin="round" />
      <circle cx="3" cy="7" r="1.4" fill={color} />
      <circle cx="12" cy="4" r="1.4" fill={color} />
      <circle cx="21" cy="7" r="1.4" fill={color} />
    </svg>
  );
}

function ReferralBadgePopup({ tier, founderNumber, onClose }) {
  return (
    <div role="dialog" aria-modal="true"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--paper)', color: 'var(--ink)',
          borderRadius: 18, padding: 24, width: 'min(420px, 100%)',
          boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div className="row center gap-3" style={{ marginBottom: 4 }}>
          <CrownSvg color={REFERRAL_TIER_COLOR[tier] || '#9CA3AF'} size={28} />
          {founderNumber != null && (
            <span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
              Fondateur #{founderNumber}
            </span>
          )}
        </div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
          Votre palier de parrainage
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {REFERRAL_TIERS.map(t => {
            const current = t.tier === tier;
            return (
              <div key={t.tier} className="row center gap-3"
                style={{ padding: '12px 14px', borderRadius: 12,
                  border: current ? `2px solid ${t.color}` : '1px solid var(--line)',
                  background: current ? `color-mix(in oklab, ${t.color} 10%, var(--paper))` : 'transparent' }}>
                <CrownSvg color={t.color} size={22} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {t.label} <span className="muted" style={{ fontWeight: 400 }}>· {t.range}</span>
                    {current && <span style={{ marginLeft: 8, color: t.color, fontWeight: 700 }}>• Votre palier</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 12.5 }}>{t.advantage}</div>
                </div>
              </div>
            );
          })}
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 18, width: '100%' }} onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}

function ReferralBadge() {
  const [ref, setRef] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchReferral().then(j => { if (!cancelled) setRef(j); });
    return () => { cancelled = true; };
  }, []);
  if (!ref || !ref.badgeTier) return null;
  const color = REFERRAL_TIER_COLOR[ref.badgeTier] || '#9CA3AF';
  return (
    <>
      <button
        type="button"
        title="Votre badge de parrainage"
        onClick={() => setOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
          marginLeft: 8, padding: '2px 8px', borderRadius: 999,
          border: `1px solid ${color}`, background: `color-mix(in oklab, ${color} 14%, var(--paper))`,
          cursor: 'pointer' }}>
        <CrownSvg color={color} size={14} />
      </button>
      {open && (
        <ReferralBadgePopup tier={ref.badgeTier} founderNumber={ref.founderNumber} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
```

- [ ] **Step 3: Insérer le badge dans `ProHeader` (L400)**

Remplacer la ligne :

```jsx
<div className="mono caps muted" style={{ marginBottom: 8 }}>— {raison}{secteur ? ' · ' + secteur : ''}</div>
```

par :

```jsx
<div className="mono caps muted" style={{ marginBottom: 8, display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap' }}>
  — {raison}{secteur ? ' · ' + secteur : ''}
  <ReferralBadge />
</div>
```

- [ ] **Step 4: Tester dans le navigateur**

Run: `npm run dev` puis ouvrir `/pro` (connecté avec un compte dont l'e-mail
est sur la waitlist et a ≥ 1 filleul).
Expected :
- Couronne colorée (cuivre/argent/or selon le count) à droite de la raison sociale.
- Clic → popup avec les 3 paliers, le palier courant surligné, et
  « Fondateur #N » si l'utilisateur est inscrit waitlist.
- Compte sans filleul / hors waitlist → aucune couronne.

> Astuce cache prototype : si la couronne n'apparaît pas après modif, c'est
> le cache iframe — bump `PROTOTYPE_VERSION` ou redémarre `next dev`
> (cf. mémoire « Contrat cache prototype iframe »).

- [ ] **Step 5: Commit**

```bash
git add public/prototype/components/Pro.jsx
git commit -m "feat(pro): badge couronne parrainage + popup paliers dans ProHeader"
```

---

## Task 6: Web — désactiver le lien à 10 filleuls (`Prospect.jsx`)

**Files:**
- Modify: `public/prototype/components/Prospect.jsx` (fonction `Parrainage`, ~L6385-6413)

Le code a déjà un état `expired`. On ajoute `capReached`.

- [ ] **Step 1: Calculer `capReached` (près de la définition de `count`/`cap`, ~L6320)**

Après les lignes existantes `const cap = data?.cap ?? 10;` et
`const count = data?.count ?? filleuls.length;`, ajouter :

```jsx
const capReached = count >= cap;
const linkDisabled = expired || capReached;
```

- [ ] **Step 2: Mettre à jour le bouton « Copier » (L6394-6406)**

Remplacer `disabled`, `title`, `style`, le garde `onClick` et le label par
des versions tenant compte de `linkDisabled` / `capReached` :

```jsx
<button
  className="btn"
  disabled={loading || !data || linkDisabled}
  title={capReached ? 'Plafond de 10 filleuls atteint' : expired ? 'Lien expiré — la phase de pré-inscription est terminée' : undefined}
  style={{ background: 'var(--paper)', color: 'var(--ink)', opacity: (loading || linkDisabled) ? 0.5 : 1, cursor: linkDisabled ? 'not-allowed' : undefined }}
  onClick={async () => {
    if (linkDisabled) return;
    const ok = await copyTextRobust(link);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
    else { setCopyErr(true); setTimeout(() => setCopyErr(false), 2500); }
  }}>
  <Icon name="copy" size={14}/> {capReached ? 'Plafond atteint' : expired ? 'Lien expiré' : copied ? 'Copié !' : copyErr ? 'Échec — copiez à la main' : 'Copier'}
</button>
```

- [ ] **Step 3: Mettre à jour le bouton « Partager » (L6407-6412)**

```jsx
<button
  className="btn btn-ghost"
  disabled={linkDisabled}
  style={{ color: 'var(--paper)', borderColor: 'rgba(255,255,255,.3)', opacity: linkDisabled ? 0.5 : 1, cursor: linkDisabled ? 'not-allowed' : undefined }}>
  <Icon name="ext" size={14}/> Partager
</button>
```

- [ ] **Step 4: Ajouter un message « plafond atteint » sous la carte lien**

Juste après la fermeture du bloc `ref-link-head` (après `</div>` de L6414,
avant le bloc `hasLaunch && !expired`), ajouter :

```jsx
{capReached && (
  <div className="ref-cap-banner" style={{ marginTop: 18, padding: 14, borderRadius: 12,
    background: 'rgba(212,175,55,.14)', border: '1px solid #D4AF37', color: 'var(--paper)' }}>
    Plafond de {cap} filleuls atteint — votre lien de parrainage est désormais désactivé. Bravo !
  </div>
)}
```

- [ ] **Step 5: Tester dans le navigateur**

Run: `npm run dev`, ouvrir `/prospect` → onglet Parrainage avec un compte à
10 filleuls (ou forcer via DB de test). Expected : boutons Copier/Partager
grisés + libellé « Plafond atteint » + bannière dorée. Compte < 10 :
comportement inchangé.

- [ ] **Step 6: Commit**

```bash
git add public/prototype/components/Prospect.jsx
git commit -m "feat(prospect): désactive le lien de parrainage à 10 filleuls"
```

---

## Task 7: Mobile — étendre le type `Parrainage`

**Files:**
- Modify: `.claude/worktrees/mobile-app/mobile/lib/queries.ts` (type `Parrainage`, L127-143)

> Toutes les tâches mobiles se commitent dans le worktree. Se placer dedans :
> `cd .claude/worktrees/mobile-app/mobile` (ou préfixer `git -C`).

- [ ] **Step 1: Ajouter les champs au type**

Dans `type Parrainage`, ajouter après `remaining: number;` :

```ts
  badgeTier: "cuivre" | "argent" | "or" | null;
  founderNumber: number | null;
  isFounder: boolean;
```

- [ ] **Step 2: Vérifier la compilation TypeScript (worktree)**

Run: `cd .claude/worktrees/mobile-app/mobile && npx tsc --noEmit`
Expected: aucune nouvelle erreur (champs optionnels côté usage).

- [ ] **Step 3: Commit (dans le worktree)**

```bash
git -C .claude/worktrees/mobile-app/mobile add lib/queries.ts
git -C .claude/worktrees/mobile-app/mobile commit -m "feat(parrainage): type Parrainage + badgeTier/founderNumber"
```

---

## Task 8: Mobile — composant `ReferralBadge` + `ReferralBadgePopup`

**Files:**
- Create: `.claude/worktrees/mobile-app/mobile/components/referral-badge.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// components/referral-badge.tsx
// Badge couronne de parrainage (pastille LinearGradient) + popup paliers.
// Pas de react-native-svg : la couronne est un glyphe sur pastille gradient
// (même approche que CoinBadge).
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export type BadgeTier = "cuivre" | "argent" | "or";

const TIER_GRADIENT: Record<BadgeTier, [string, string]> = {
  cuivre: ["#D08B4F", "#8C5A2B"],
  argent: ["#D9DCE1", "#8A8F98"],
  or: ["#E8C767", "#B8860B"],
};

const TIERS: { tier: BadgeTier; label: string; range: string; advantage: string }[] = [
  { tier: "cuivre", label: "Cuivre", range: "1–2 filleuls", advantage: "Avantage à venir" },
  { tier: "argent", label: "Argent", range: "3–9 filleuls", advantage: "Avantage à venir" },
  { tier: "or", label: "Or", range: "10 filleuls", advantage: "Avantage à venir" },
];

function CrownPill({ tier, size = 22 }: { tier: BadgeTier; size?: number }) {
  return (
    <LinearGradient
      colors={TIER_GRADIENT[tier]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: 999, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontSize: size * 0.55 }}>👑</Text>
    </LinearGradient>
  );
}

export function ReferralBadge({
  tier,
  founderNumber,
}: {
  tier: BadgeTier;
  founderNumber: number | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityLabel="Votre badge de parrainage" onPress={() => setOpen(true)} hitSlop={8}>
        <CrownPill tier={tier} size={22} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <Pressable onPress={() => {}} className="w-full rounded-3xl bg-paper p-5" style={{ maxWidth: 420 }}>
            <View className="flex-row items-center gap-3">
              <CrownPill tier={tier} size={30} />
              {founderNumber != null && (
                <Text className="font-mono text-lg font-bold text-ink">Fondateur #{founderNumber}</Text>
              )}
            </View>
            <Text className="mt-1 text-[13px] text-ink-3">Votre palier de parrainage</Text>

            <View className="mt-4" style={{ gap: 10 }}>
              {TIERS.map((t) => {
                const current = t.tier === tier;
                return (
                  <View
                    key={t.tier}
                    className="flex-row items-center gap-3 rounded-2xl p-3"
                    style={{
                      borderWidth: current ? 2 : 1,
                      borderColor: current ? TIER_GRADIENT[t.tier][1] : "rgba(0,0,0,0.08)",
                    }}
                  >
                    <CrownPill tier={t.tier} size={22} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text className="font-semibold text-ink">
                        {t.label} <Text className="text-ink-3">· {t.range}</Text>
                        {current ? <Text style={{ color: TIER_GRADIENT[t.tier][1] }}>{"  • Votre palier"}</Text> : null}
                      </Text>
                      <Text className="text-[12.5px] text-ink-3">{t.advantage}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <Pressable className="mt-4 items-center rounded-full border border-ink/15 py-3" onPress={() => setOpen(false)}>
              <Text className="font-semibold text-ink">Fermer</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `cd .claude/worktrees/mobile-app/mobile && npx tsc --noEmit`
Expected: aucune erreur. (Si des classes NativeWind comme `text-ink-3`
n'existent pas, utiliser celles présentes dans `tailwind.config.js` — vérifier
et ajuster.)

- [ ] **Step 3: Commit (worktree)**

```bash
git -C .claude/worktrees/mobile-app/mobile add components/referral-badge.tsx
git -C .claude/worktrees/mobile-app/mobile commit -m "feat(parrainage): composant ReferralBadge + popup (mobile)"
```

---

## Task 9: Mobile — badge dans le hero d'accueil (`portefeuille.tsx`)

**Files:**
- Modify: `.claude/worktrees/mobile-app/mobile/app/(prospect)/portefeuille.tsx` (hero, L181-192)

- [ ] **Step 1: Importer le badge + le hook**

En haut du fichier, ajouter aux imports :

```tsx
import { ReferralBadge } from "@/components/referral-badge";
import { useParrainage } from "@/lib/queries";
```

(Si `useParrainage` est déjà importé, ne pas dupliquer.)

- [ ] **Step 2: Lire les données dans le composant**

Près des autres hooks de l'écran (au début du composant) :

```tsx
const parrainage = useParrainage();
const badgeTier = parrainage.data?.badgeTier ?? null;
const founderNumber = parrainage.data?.founderNumber ?? null;
```

- [ ] **Step 3: Afficher le badge à droite du greeting (L187-192)**

Remplacer le `<Text>` du greeting par une ligne flex contenant greeting + badge :

```tsx
<View className="mb-4 flex-row items-center gap-2">
  <Text className="flex-1 font-serif text-xl text-paper" numberOfLines={1}>
    {greeting}
  </Text>
  {badgeTier ? <ReferralBadge tier={badgeTier} founderNumber={founderNumber} /> : null}
</View>
```

(Le `mb-4` qui était sur le `<Text>` passe sur le conteneur `View`.)

- [ ] **Step 4: Tester sur simulateur/Expo**

Run: `cd .claude/worktrees/mobile-app/mobile && npx expo start`
Expected : sur l'accueil, couronne (couleur du palier) à droite du
« Bonjour … » ; tap → popup paliers + « Fondateur #N ». Compte sans filleul
→ pas de couronne.

- [ ] **Step 5: Commit (worktree)**

```bash
git -C .claude/worktrees/mobile-app/mobile add "app/(prospect)/portefeuille.tsx"
git -C .claude/worktrees/mobile-app/mobile commit -m "feat(parrainage): badge couronne dans le hero accueil (mobile)"
```

---

## Task 10: Mobile — désactiver le lien à 10 filleuls (`parrainage.tsx`)

**Files:**
- Modify: `.claude/worktrees/mobile-app/mobile/app/(prospect)/parrainage.tsx` (L92-127)

- [ ] **Step 1: Calculer `capReached` / `linkDisabled`**

Là où `expired` est défini dans le composant (rechercher `const expired`),
ajouter en dessous (avec accès à `d`/data) :

```tsx
const capReached = (d?.count ?? 0) >= (d?.cap ?? 10);
const linkDisabled = expired || capReached;
```

> Si `expired` est calculé hors du render-prop `(d) => ...`, calculer
> `capReached` à l'intérieur du render-prop où `d` est disponible, et
> dériver `linkDisabled` localement.

- [ ] **Step 2: Bouton « Copier » (L93-111) — remplacer `expired` par `linkDisabled`**

```tsx
<Pressable
  className="flex-1 items-center rounded-full bg-paper py-2.5"
  disabled={linkDisabled}
  style={linkDisabled ? { opacity: 0.5 } : undefined}
  onPress={async () => {
    if (linkDisabled) return;
    await Clipboard.setStringAsync(d.refCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }}
>
  <Text className="text-sm font-semibold text-ink">
    {capReached ? "Plafond atteint" : expired ? "Lien expiré" : copied ? "Copié ✓" : "Copier"}
  </Text>
</Pressable>
```

- [ ] **Step 3: Bouton « Partager » (L112-126)**

```tsx
<Pressable
  className="flex-1 items-center rounded-full border border-paper/30 py-2.5"
  disabled={linkDisabled}
  style={linkDisabled ? { opacity: 0.5 } : undefined}
  onPress={() => {
    if (linkDisabled) return;
    Share.share({
      message: `Rejoins BUUPP avec mon code ${d.refCode} : https://www.buupp.com/inscription/prospect?ref=${d.refCode}`,
    });
  }}
>
  <Text className="text-sm font-semibold text-paper">Partager</Text>
</Pressable>
```

- [ ] **Step 4: Message « plafond atteint » (après le bloc des boutons, après `</View>` L127)**

```tsx
{capReached ? (
  <Text className="mt-3 text-[12.5px] leading-5 text-paper/80">
    Plafond de {d.cap} filleuls atteint — votre lien est désormais désactivé. Bravo !
  </Text>
) : null}
```

- [ ] **Step 5: Tester sur simulateur**

Run: `cd .claude/worktrees/mobile-app/mobile && npx expo start`
Expected : compte à 10 filleuls → Copier/Partager grisés + « Plafond atteint »
+ message. Compte < 10 → inchangé.

- [ ] **Step 6: Commit (worktree)**

```bash
git -C .claude/worktrees/mobile-app/mobile add "app/(prospect)/parrainage.tsx"
git -C .claude/worktrees/mobile-app/mobile commit -m "feat(parrainage): désactive le lien à 10 filleuls (mobile)"
```

---

## Task 11: Vérification finale

**Files:** aucun (validation).

- [ ] **Step 1: Suite de tests web**

Run: `npm test`
Expected: PASS, incluant `tests/lib/waitlist/referral.test.ts` (6) et
`tests/api/me/referral.test.ts` (3).

- [ ] **Step 2: Typecheck web**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Typecheck mobile**

Run: `cd .claude/worktrees/mobile-app/mobile && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Revue manuelle croisée**

- Web `/pro` : badge couleur correcte selon le count, popup OK, pas de badge à 0.
- Web `/prospect` Parrainage : lien désactivé à 10.
- Mobile accueil : badge + popup ; mobile parrainage : lien désactivé à 10.
- Cohérence visuelle des 3 couleurs (cuivre/argent/or) entre web et mobile.

- [ ] **Step 5: (si worktree) résumé des branches**

Rappeler à l'utilisateur que le mobile est commité sur `worktree-mobile-app`
(non mergé sur `main`) et le back-end + web sur `main` — à pousser séparément
selon son flux habituel.

---

## Notes de portée / rappels

- **Aucune migration DB** : tout est dérivé à la lecture de `waitlist`.
- **Rétro-compat API** : `/api/prospect/parrainage` n'ajoute que des champs.
- **Avantages des paliers = placeholders** (« Avantage à venir ») à remplir
  plus tard par l'utilisateur, aux 2 endroits (`Pro.jsx` `REFERRAL_TIERS`,
  mobile `referral-badge.tsx` `TIERS`).
- **Badge sur l'espace pro** : visible seulement si l'e-mail du pro est dans
  la waitlist (sinon `badgeTier: null`).
- **Cache prototype** : en cas de modif `.jsx` non reflétée, bump
  `PROTOTYPE_VERSION` / redémarrer `next dev`.
