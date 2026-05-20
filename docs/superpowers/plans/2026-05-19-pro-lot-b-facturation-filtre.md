# Espace Pro — Lot B : Facturation données réelles + filtre contacts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher campagnes utilisées/restantes (card Abonnement), la vraie carte Stripe (card Carte enregistrée), et rendre le bouton « Filtrer » des contacts de campagne fonctionnel (Statut/Score/Période, côté serveur).

**Architecture:** Approche A — filtrage serveur via params **optionnels rétro-compatibles** sur `GET /api/pro/campaigns/[id]` (logique extraite dans un helper pur testé) ; nouvel endpoint additif `GET /api/pro/wallet/payment-method` (Stripe) ; card Abonnement = UI seule (données déjà dans `/api/pro/plan`).

**Tech Stack:** Next.js 16 App Router, Supabase service_role, Clerk auth, Stripe SDK (`lib/stripe/server.ts` `getStripe()`), prototype JSX (`Pro.jsx`, non testé unitairement), Vitest (`lib/` uniquement), TypeScript strict.

**Référence spec :** `docs/superpowers/specs/2026-05-19-pro-lot-b-facturation-filtre-design.md`

**Notes transverses :**
- `GET /api/pro/campaigns/[id]` est **partagé avec le mobile** ; params optionnels → appel sans param **inchangé** (aucune casse mobile). Ajout du champ `status` aux contacts = **additif** (non-breaking).
- `GET /api/pro/wallet/payment-method` = endpoint **nouveau/additif**.
- `/api/pro/plan` **inchangé**. **Aucune migration / aucun schéma.**
- Commits **file-scopés** : ne jamais `git add -A` (working tree contient des changements perf non liés).

---

## File Structure

- Create: `lib/pro/filterCampaignContacts.ts` — helper pur de filtrage (Statut/Score/Période).
- Create: `tests/lib/pro/filterCampaignContacts.test.ts` — tests TDD du helper.
- Create: `app/api/pro/wallet/payment-method/route.ts` — GET carte Stripe.
- Modify: `app/api/pro/campaigns/[id]/route.ts` — parse params + `status` dans contacts + appel helper.
- Modify: `public/prototype/components/Pro.jsx` — card Abonnement, card Carte (fetch), panneau Filtrer (fetch paramétré).

---

## Task 1: Helper pur `filterCampaignContacts` (TDD)

**Files:**
- Create: `tests/lib/pro/filterCampaignContacts.test.ts`
- Create: `lib/pro/filterCampaignContacts.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/lib/pro/filterCampaignContacts.test.ts` avec EXACTEMENT :

```ts
import { describe, it, expect } from "vitest";
import {
  filterCampaignContacts,
  type CampaignContact,
} from "@/lib/pro/filterCampaignContacts";

function c(over: Partial<CampaignContact>): CampaignContact {
  return {
    id: "r1",
    prospectId: "p1",
    name: "Alice",
    score: 700,
    tierLabel: "P1 · Identification",
    decidedAt: new Date().toISOString(),
    statusLabel: "Crédité",
    statusChip: "good",
    status: "settled",
    ...over,
  };
}

describe("filterCampaignContacts", () => {
  it("status=all garde accepted + settled", () => {
    const list = [c({ status: "accepted" }), c({ status: "settled" })];
    const out = filterCampaignContacts(list, {
      status: "all",
      scoreMin: null,
      period: "all",
    });
    expect(out).toHaveLength(2);
  });

  it("status=accepted ne garde que accepted", () => {
    const list = [c({ status: "accepted" }), c({ status: "settled" })];
    const out = filterCampaignContacts(list, {
      status: "accepted",
      scoreMin: null,
      period: "all",
    });
    expect(out.map((x) => x.status)).toEqual(["accepted"]);
  });

  it("status=settled ne garde que settled", () => {
    const list = [c({ status: "accepted" }), c({ status: "settled" })];
    const out = filterCampaignContacts(list, {
      status: "settled",
      scoreMin: null,
      period: "all",
    });
    expect(out.map((x) => x.status)).toEqual(["settled"]);
  });

  it("scoreMin exclut les scores inférieurs et les scores null", () => {
    const list = [
      c({ id: "a", score: 800 }),
      c({ id: "b", score: 500 }),
      c({ id: "z", score: null }),
    ];
    const out = filterCampaignContacts(list, {
      status: "all",
      scoreMin: 600,
      period: "all",
    });
    expect(out.map((x) => x.id)).toEqual(["a"]);
  });

  it("period=7d exclut les contacts plus vieux que 7 jours", () => {
    const recent = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const old = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const list = [
      c({ id: "new", decidedAt: recent }),
      c({ id: "old", decidedAt: old }),
    ];
    const out = filterCampaignContacts(list, {
      status: "all",
      scoreMin: null,
      period: "7d",
    });
    expect(out.map((x) => x.id)).toEqual(["new"]);
  });

  it("combine les trois filtres", () => {
    const recent = new Date(Date.now() - 1 * 86_400_000).toISOString();
    const old = new Date(Date.now() - 40 * 86_400_000).toISOString();
    const list = [
      c({ id: "keep", status: "settled", score: 900, decidedAt: recent }),
      c({ id: "badStatus", status: "accepted", score: 900, decidedAt: recent }),
      c({ id: "badScore", status: "settled", score: 100, decidedAt: recent }),
      c({ id: "badDate", status: "settled", score: 900, decidedAt: old }),
    ];
    const out = filterCampaignContacts(list, {
      status: "settled",
      scoreMin: 500,
      period: "30d",
    });
    expect(out.map((x) => x.id)).toEqual(["keep"]);
  });

  it("liste vide → []", () => {
    expect(
      filterCampaignContacts([], { status: "all", scoreMin: null, period: "all" }),
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Lancer le test → échec attendu**

Run: `npx vitest run tests/lib/pro/filterCampaignContacts.test.ts`
Expected: FAIL (module `@/lib/pro/filterCampaignContacts` introuvable).

- [ ] **Step 3: Implémenter le helper**

Créer `lib/pro/filterCampaignContacts.ts` avec EXACTEMENT :

```ts
/**
 * Filtrage pur de la liste « Contacts obtenus » d'une campagne.
 * Utilisé par GET /api/pro/campaigns/[id] (filtres optionnels Statut /
 * Score / Période). Pur & déterministe → testé unitairement.
 *
 * Note : seuls les statuts « accepted » (En séquestre) et « settled »
 * (Crédité) constituent la liste des contacts (les autres relations ne
 * sont pas des contacts obtenus). `status=all` = ces deux-là.
 */

export type ContactStatusFilter = "all" | "accepted" | "settled";
export type ContactPeriodFilter = "7d" | "30d" | "90d" | "all";

export type CampaignContact = {
  id: string;
  prospectId: string;
  name: string;
  score: number | null;
  tierLabel: string;
  decidedAt: string;
  statusLabel: string;
  statusChip: string;
  status: string;
};

function periodCutoffMs(period: ContactPeriodFilter): number | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return Date.now() - days * 86_400_000;
}

export function filterCampaignContacts(
  contacts: CampaignContact[],
  opts: {
    status: ContactStatusFilter;
    scoreMin: number | null;
    period: ContactPeriodFilter;
  },
): CampaignContact[] {
  const cutoff = periodCutoffMs(opts.period);
  return contacts.filter((c) => {
    if (opts.status === "accepted" && c.status !== "accepted") return false;
    if (opts.status === "settled" && c.status !== "settled") return false;
    if (opts.scoreMin != null && (c.score == null || c.score < opts.scoreMin)) {
      return false;
    }
    if (cutoff != null) {
      const t = new Date(c.decidedAt).getTime();
      if (!Number.isFinite(t) || t < cutoff) return false;
    }
    return true;
  });
}
```

- [ ] **Step 4: Lancer le test → succès attendu**

Run: `npx vitest run tests/lib/pro/filterCampaignContacts.test.ts`
Expected: PASS (7 tests verts).

- [ ] **Step 5: Commit**

```bash
git add lib/pro/filterCampaignContacts.ts tests/lib/pro/filterCampaignContacts.test.ts
git commit -m "feat(pro): helper pur filterCampaignContacts (TDD)"
```

---

## Task 2: Endpoint `GET /api/pro/wallet/payment-method`

**Files:**
- Create: `app/api/pro/wallet/payment-method/route.ts`

- [ ] **Step 1: Créer la route**

Créer `app/api/pro/wallet/payment-method/route.ts` avec EXACTEMENT :

```ts
/**
 * GET /api/pro/wallet/payment-method — carte bancaire enregistrée.
 *
 * Lit `pro_accounts.stripe_default_payment_method_id` puis récupère la
 * PaymentMethod côté Stripe pour exposer marque / 4 derniers /
 * expiration. Dégradé : toute erreur (pas de PM, Stripe KO) → { card:
 * null } (la page Facturation ne casse jamais). Jamais de 500.
 *
 * En mode TEST : renvoie la carte de test enregistrée. En LIVE : la
 * vraie carte, sans changement de code.
 *
 * Réponse : { card: { brand, last4, expMonth, expYear } | null }
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;

  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const { data: pro } = await admin
    .from("pro_accounts")
    .select("stripe_default_payment_method_id")
    .eq("id", proId)
    .single();

  const pmId = pro?.stripe_default_payment_method_id ?? null;
  if (!pmId) {
    return NextResponse.json({ card: null });
  }

  try {
    const stripe = await getStripe();
    const pm = await stripe.paymentMethods.retrieve(pmId);
    const card = pm.card
      ? {
          brand: pm.card.brand ?? null,
          last4: pm.card.last4 ?? null,
          expMonth: pm.card.exp_month ?? null,
          expYear: pm.card.exp_year ?? null,
        }
      : null;
    return NextResponse.json({ card });
  } catch (err) {
    console.error(
      "[/api/pro/wallet/payment-method] Stripe retrieve échoué :",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ card: null });
  }
}
```

- [ ] **Step 2: Vérifier les imports**

Run:
```bash
grep -n "export async function getStripe" lib/stripe/server.ts
grep -n "export async function ensureProAccount\|export function ensureProAccount" lib/sync/pro-accounts.ts
```
Expected: les deux exports existent. Si `ensureProAccount` n'a pas la signature `({ clerkUserId, email }) => Promise<string>`, l'adapter en s'alignant sur `app/api/pro/wallet/route.ts` (même préambule).

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint app/api/pro/wallet/payment-method/route.ts`
Expected: exit 0, 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add app/api/pro/wallet/payment-method/route.ts
git commit -m "feat(pro): endpoint GET /api/pro/wallet/payment-method (carte Stripe)"
```

---

## Task 3: Étendre `GET /api/pro/campaigns/[id]` avec les filtres

**Files:**
- Modify: `app/api/pro/campaigns/[id]/route.ts`

- [ ] **Step 1: Importer le helper**

Trouver le bloc d'imports en tête de `app/api/pro/campaigns/[id]/route.ts` :
```ts
import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { objectiveLabel } from "@/lib/campaigns/mapping";
```
Le remplacer par (ajout d'une ligne) :
```ts
import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { objectiveLabel } from "@/lib/campaigns/mapping";
import {
  filterCampaignContacts,
  type ContactStatusFilter,
  type ContactPeriodFilter,
} from "@/lib/pro/filterCampaignContacts";
```

- [ ] **Step 2: Lire les query params (signature GET)**

Trouver :
```ts
export async function GET(_req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
```
Le remplacer par :
```ts
export async function GET(req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  // Filtres optionnels de la liste « Contacts obtenus » (rétro-compat :
  // aucun param = comportement historique). Valeur invalide → défaut.
  const sp = new URL(req.url).searchParams;
  const rawStatus = sp.get("cstatus");
  const contactStatus: ContactStatusFilter =
    rawStatus === "accepted" || rawStatus === "settled" ? rawStatus : "all";
  const rawScoreMin = Number(sp.get("cscoremin"));
  const contactScoreMin =
    Number.isFinite(rawScoreMin) && rawScoreMin >= 0
      ? Math.floor(rawScoreMin)
      : null;
  const rawPeriod = sp.get("cperiod");
  const contactPeriod: ContactPeriodFilter =
    rawPeriod === "7d" || rawPeriod === "30d" || rawPeriod === "90d"
      ? rawPeriod
      : "all";
```

- [ ] **Step 3: Ajouter `status` au contact mappé + appliquer le helper**

Trouver le bloc de construction des contacts (≈ lignes 176-201) :
```ts
  const contacts = rows
    .filter((r) => r.status === "accepted" || r.status === "settled")
    .slice(0, 50)
    .map((r) => {
      const ident = r.prospects?.prospect_identity ?? null;
      const prenom = ident?.prenom?.trim() || "";
      const nom = ident?.nom?.trim() || "";
      const fullName = [prenom, nom].filter(Boolean).join(" ") || "Prospect";
      const tierLabel = (() => {
        const targeting = (camp.targeting as Targeting | null) ?? null;
        const tiers = targeting?.requiredTiers;
        if (!Array.isArray(tiers) || tiers.length === 0) return "—";
        const max = Math.max(...tiers.map((n) => Number(n) || 0));
        return TIER_NUM_TO_LABEL[max] ?? "—";
      })();
      return {
        id: r.id,
        prospectId: r.prospect_id,
        name: fullName,
        score: r.prospects?.bupp_score ?? null,
        tierLabel,
        decidedAt: r.decided_at ?? r.sent_at,
        statusLabel: r.status === "settled" ? "Crédité" : "En séquestre",
        statusChip: r.status === "settled" ? "good" : "warn",
      };
    });
```
Le remplacer par (map complet d'abord, puis filtre helper, puis slice 50 ; ajout du champ `status`) :
```ts
  const allContacts = rows
    .filter((r) => r.status === "accepted" || r.status === "settled")
    .map((r) => {
      const ident = r.prospects?.prospect_identity ?? null;
      const prenom = ident?.prenom?.trim() || "";
      const nom = ident?.nom?.trim() || "";
      const fullName = [prenom, nom].filter(Boolean).join(" ") || "Prospect";
      const tierLabel = (() => {
        const targeting = (camp.targeting as Targeting | null) ?? null;
        const tiers = targeting?.requiredTiers;
        if (!Array.isArray(tiers) || tiers.length === 0) return "—";
        const max = Math.max(...tiers.map((n) => Number(n) || 0));
        return TIER_NUM_TO_LABEL[max] ?? "—";
      })();
      return {
        id: r.id,
        prospectId: r.prospect_id,
        name: fullName,
        score: r.prospects?.bupp_score ?? null,
        tierLabel,
        decidedAt: r.decided_at ?? r.sent_at,
        statusLabel: r.status === "settled" ? "Crédité" : "En séquestre",
        statusChip: r.status === "settled" ? "good" : "warn",
        status: r.status,
      };
    });
  // Filtres optionnels appliqués À LA LISTE CONTACTS UNIQUEMENT.
  // `funnel` et `activity` restent calculés sur l'ensemble non filtré
  // (stats globales de la campagne, pas la vue filtrée).
  const contacts = filterCampaignContacts(allContacts, {
    status: contactStatus,
    scoreMin: contactScoreMin,
    period: contactPeriod,
  }).slice(0, 50);
```

- [ ] **Step 4: Vérifier qu'aucune autre référence à l'ancien `contacts`/`_req` ne casse**

Run:
```bash
grep -n "_req\|allContacts\|filterCampaignContacts\| contacts\b" "app/api/pro/campaigns/[id]/route.ts" | head -20
npx tsc --noEmit
npx eslint "app/api/pro/campaigns/[id]/route.ts"
```
Expected: `tsc` exit 0 ; `eslint` 0 erreur ; plus aucune occurrence de `_req` (renommé `req`) ; `contacts` toujours référencé dans la réponse JSON finale (inchangé en aval).

- [ ] **Step 5: Commit**

```bash
git add "app/api/pro/campaigns/[id]/route.ts"
git commit -m "feat(pro): filtres Statut/Score/Période sur contacts campagne (params optionnels)"
```

---

## Task 4: Card « Abonnement actuel » + « Carte enregistrée » (Pro.jsx)

**Files:**
- Modify: `public/prototype/components/Pro.jsx` (fonction `Facturation`)

- [ ] **Step 1: Ajouter l'état `payCard`**

Trouver (≈ ligne 5964) :
```jsx
  const [planInfo, setPlanInfo] = useState(null);
```
Le remplacer par :
```jsx
  const [planInfo, setPlanInfo] = useState(null);
  // undefined = chargement, null = aucune carte, objet = carte Stripe.
  const [payCard, setPayCard] = useState(undefined);
```

- [ ] **Step 2: Fetch de la carte dans l'effet existant**

Trouver le bloc (≈ lignes 5977-5982) :
```jsx
    fetch('/api/pro/plan', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled && j) setPlanInfo(j); })
      .catch(() => {});
```
Le remplacer par :
```jsx
    fetch('/api/pro/plan', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled && j) setPlanInfo(j); })
      .catch(() => {});
    fetch('/api/pro/wallet/payment-method', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { card: null })
      .then(j => { if (!cancelled) setPayCard(j.card ?? null); })
      .catch(() => { if (!cancelled) setPayCard(null); });
```

- [ ] **Step 3: Recomposer les deux cards**

Trouver le tableau des cards (≈ lignes 6006-6016) :
```jsx
        {[
          [
            'Abonnement actuel',
            planInfo ? planInfo.label : '…',
            planInfo
              ? `${Number(planInfo.monthlyEur).toFixed(0)} € / ${planInfo.maxCampaigns ?? (planInfo.plan === 'pro' ? 10 : 2)} campagnes`
              : '—',
          ],
          ['Carte enregistrée', 'Visa ••4521', 'Expire 08/28'],
        ].map((r, i) => (
```
Le remplacer par :
```jsx
        {[
          [
            'Abonnement actuel',
            planInfo ? planInfo.label : '…',
            (planInfo && Number.isFinite(Number(planInfo.cycleCount)) && Number.isFinite(Number(planInfo.cap)))
              ? `${Number(planInfo.cycleCount)}/${Number(planInfo.cap)} campagnes utilisées · ${Math.max(0, Number(planInfo.cap) - Number(planInfo.cycleCount))} restante(s)`
              : '—',
          ],
          [
            'Carte enregistrée',
            payCard === undefined
              ? '…'
              : (payCard
                  ? `${payCard.brand ? payCard.brand.charAt(0).toUpperCase() + payCard.brand.slice(1) : 'Carte'} ••${payCard.last4 ?? '????'}`
                  : 'Aucune carte enregistrée'),
            (payCard && payCard.expMonth && payCard.expYear)
              ? `Expire ${String(payCard.expMonth).padStart(2, '0')}/${payCard.expYear}`
              : '—',
          ],
        ].map((r, i) => (
```

- [ ] **Step 4: Vérifier**

Run:
```bash
grep -n "payCard\|cycleCount\|payment-method" public/prototype/components/Pro.jsx | head
npx tsc --noEmit
```
Expected: les nouvelles refs présentes ; `tsc` exit 0 (le prototype n'est pas typecheck mais le projet doit rester vert).

- [ ] **Step 5: Commit**

```bash
git add public/prototype/components/Pro.jsx
git commit -m "feat(pro): card Abonnement (utilisées/restantes) + Carte enregistrée réelle (Stripe)"
```

---

## Task 5: Panneau « Filtrer » fonctionnel (Pro.jsx, CampaignDetail)

**Files:**
- Modify: `public/prototype/components/Pro.jsx` (fonction `CampaignDetail`)

- [ ] **Step 1: États du filtre**

Trouver (≈ lignes 6487-6493, début de `CampaignDetail`) :
```jsx
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  // Modale de confirmation prolongation (one-time +10 €).
  const [extendOpen, setExtendOpen] = useState(false);
  // Modale d'info pause 48 h (réservée aux campagnes 7d, une seule fois).
  const [pauseOpen, setPauseOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
```
Le remplacer par :
```jsx
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  // Modale de confirmation prolongation (one-time +10 €).
  const [extendOpen, setExtendOpen] = useState(false);
  // Modale d'info pause 48 h (réservée aux campagnes 7d, une seule fois).
  const [pauseOpen, setPauseOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Filtres « Contacts obtenus ». `draft` = saisie en cours dans le
  // panneau ; `applied` = filtres réellement envoyés à l'API (déclenche
  // le re-fetch). Défauts = comportement historique (aucun param).
  const [cFilterOpen, setCFilterOpen] = useState(false);
  const [cDraft, setCDraft] = useState({ status: 'all', scoreMin: '', period: 'all' });
  const [cApplied, setCApplied] = useState({ status: 'all', scoreMin: '', period: 'all' });
  const cFilterActive =
    cApplied.status !== 'all' || cApplied.scoreMin !== '' || cApplied.period !== 'all';
```

- [ ] **Step 2: Paramétrer le fetch du détail**

Trouver l'effet (≈ lignes 6522-6538) :
```jsx
  useEffect(() => {
    if (!campId) return;
    let cancelled = false;
    setData(null);
    setLoadError(null);
    fetch(`/api/pro/campaigns/${campId}`, { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j?.error || ('HTTP ' + r.status));
        }
        return r.json();
      })
      .then(j => { if (!cancelled) setData(j); })
      .catch(e => { if (!cancelled) setLoadError(e.message || 'load_failed'); });
    return () => { cancelled = true; };
  }, [campId, reloadKey]);
```
Le remplacer par :
```jsx
  useEffect(() => {
    if (!campId) return;
    let cancelled = false;
    setData(null);
    setLoadError(null);
    const qs = new URLSearchParams();
    if (cApplied.status !== 'all') qs.set('cstatus', cApplied.status);
    if (cApplied.scoreMin !== '' && Number.isFinite(Number(cApplied.scoreMin))) {
      qs.set('cscoremin', String(Math.max(0, Math.floor(Number(cApplied.scoreMin)))));
    }
    if (cApplied.period !== 'all') qs.set('cperiod', cApplied.period);
    const q = qs.toString();
    fetch(`/api/pro/campaigns/${campId}${q ? `?${q}` : ''}`, { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j?.error || ('HTTP ' + r.status));
        }
        return r.json();
      })
      .then(j => { if (!cancelled) setData(j); })
      .catch(e => { if (!cancelled) setLoadError(e.message || 'load_failed'); });
    return () => { cancelled = true; };
  }, [campId, reloadKey, cApplied]);
```

- [ ] **Step 3: Brancher le bouton + panneau**

Trouver le bloc en-tête de la section contacts (≈ lignes 6940-6952) :
```jsx
            <div className="row gap-2">
              <button className="btn btn-ghost btn-sm"><Icon name="filter" size={12}/> Filtrer</button>
            </div>
          </div>
```
Le remplacer par :
```jsx
            <div className="row gap-2">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setCFilterOpen(o => !o)}
                style={cFilterActive ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
              >
                <Icon name="filter" size={12}/> Filtrer{cFilterActive ? ' •' : ''}
              </button>
            </div>
          </div>
          {cFilterOpen && (
            <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', background: 'var(--ivory)' }}>
              <label className="col" style={{ gap: 4 }}>
                <span className="mono caps muted" style={{ fontSize: 10 }}>Statut</span>
                <select className="input" value={cDraft.status}
                  onChange={e => setCDraft(d => ({ ...d, status: e.target.value }))}>
                  <option value="all">Tous</option>
                  <option value="accepted">En séquestre</option>
                  <option value="settled">Crédité</option>
                </select>
              </label>
              <label className="col" style={{ gap: 4 }}>
                <span className="mono caps muted" style={{ fontSize: 10 }}>Score min.</span>
                <input className="input mono" type="number" min="0" inputMode="numeric"
                  value={cDraft.scoreMin} placeholder="—"
                  onChange={e => setCDraft(d => ({ ...d, scoreMin: e.target.value }))}
                  style={{ width: 110 }}/>
              </label>
              <label className="col" style={{ gap: 4 }}>
                <span className="mono caps muted" style={{ fontSize: 10 }}>Période</span>
                <select className="input" value={cDraft.period}
                  onChange={e => setCDraft(d => ({ ...d, period: e.target.value }))}>
                  <option value="all">Tout</option>
                  <option value="7d">7 jours</option>
                  <option value="30d">30 jours</option>
                  <option value="90d">90 jours</option>
                </select>
              </label>
              <button className="btn btn-ghost btn-sm"
                onClick={() => { setCApplied(cDraft); }}>
                Appliquer
              </button>
              <button className="btn btn-ghost btn-sm"
                onClick={() => {
                  const reset = { status: 'all', scoreMin: '', period: 'all' };
                  setCDraft(reset); setCApplied(reset);
                }}>
                Réinitialiser
              </button>
            </div>
          )}
```

- [ ] **Step 4: Vérifier**

Run:
```bash
grep -n "cFilterOpen\|cApplied\|cDraft\|cstatus" public/prototype/components/Pro.jsx | head
npx tsc --noEmit
```
Expected: refs présentes ; `tsc` exit 0.

- [ ] **Step 5: Commit**

```bash
git add public/prototype/components/Pro.jsx
git commit -m "feat(pro): panneau Filtrer fonctionnel sur contacts campagne"
```

---

## Task 6: Vérification globale & non-régression

**Files:** aucun (vérification seule)

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Lint des fichiers touchés**

Run:
```bash
npx eslint lib/pro/filterCampaignContacts.ts tests/lib/pro/filterCampaignContacts.test.ts app/api/pro/wallet/payment-method/route.ts "app/api/pro/campaigns/[id]/route.ts"
```
Expected: exit 0, 0 erreur. (`Pro.jsx` est sous `public/` ; comme pour les lots précédents, ESLint y signale des faux positifs pré-existants non-module — comparer le compte d'erreurs `Pro.jsx` avant/après pour confirmer **aucune nouvelle** erreur introduite, comme fait au Lot A.)

- [ ] **Step 3: Tests**

Run: `npx vitest run`
Expected: tous verts (58 existants + 7 nouveaux = 65).

- [ ] **Step 4: Vérification manuelle (non bloquante)**

Avec `npm run dev` :
1. Facturation → card « Abonnement actuel » montre `x/cap campagnes utilisées · y restante(s)`.
2. Card « Carte enregistrée » : si un PM Stripe test est enregistré → `Visa ••4242 / Expire MM/AAAA` (vraies données test) ; sinon « Aucune carte enregistrée / — ».
3. Détail d'une campagne ayant des contacts → onglet « Contacts obtenus » → bouton « Filtrer » ouvre le panneau ; changer Statut/Score/Période + « Appliquer » → la liste se met à jour, le funnel/budget restent inchangés ; « Réinitialiser » restaure la liste complète ; sans filtre la liste est identique à avant.

- [ ] **Step 5: Commit éventuel de corrections**

Si Steps 1-3 ont nécessité une correction (scopée aux fichiers du Lot B) :
```bash
git add lib/pro/filterCampaignContacts.ts tests/lib/pro/filterCampaignContacts.test.ts app/api/pro/wallet/payment-method/route.ts "app/api/pro/campaigns/[id]/route.ts" public/prototype/components/Pro.jsx
git commit -m "fix(pro): corrections post-vérification Lot B"
```

---

## Self-Review (effectuée)

- **Couverture spec :** card Abonnement utilisées/restantes via `cycleCount`/`cap` (T4) ; card Carte réelle via nouvel endpoint Stripe + UI dégradée (T2+T4) ; filtres Statut/Score/Période côté serveur, params optionnels rétro-compatibles, helper pur testé (T1+T3+T5) ; funnel/activity non filtrés (T3) ; champ `status` additif (T3) ; prix retiré de la sous-ligne (T4). Tous les points du spec sont couverts. « Palier » volontairement absent (hors périmètre spec).
- **Placeholders :** aucun « TBD/TODO » ; tout le code old/new est explicite et complet.
- **Cohérence types/noms :** `CampaignContact`/`ContactStatusFilter`/`ContactPeriodFilter`/`filterCampaignContacts` identiques entre T1 (def+test) et T3 (import+usage) ; params API `cstatus`/`cscoremin`/`cperiod` identiques entre T3 (lecture) et T5 (écriture query) ; champ `status` ajouté au map (T3) consommé par le helper (T1). `getStripe`/`ensureProAccount` conformes aux usages existants vérifiés.
- **Ordre :** T1 (helper+test) → T2 (endpoint Stripe indépendant) → T3 (route, dépend de T1) → T4 (UI cards, dépend de T2) → T5 (UI filtre, dépend de T3) → T6 (vérif). Cohérent.
