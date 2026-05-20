# Espace Pro — Enregistrement d'une carte bancaire — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un pro sans carte enregistrée d'en enregistrer une (bouton dans la card « Carte enregistrée » → Stripe Checkout `mode:'setup'` → webhook + reconcile persistent `stripe_default_payment_method_id`).

**Architecture:** Réutilise le pattern recharge existant (Checkout hébergé en redirection, customer Stripe, webhook, reconcile au retour). Nouveau helper `ensureStripeCustomer`, route `POST /api/stripe/setup`, route `POST /api/pro/wallet/payment-method/reconcile`, branche webhook additive `mode:'setup'`, composant `CardSetupReconciler` (calque `TopupReconciler`), bouton dans `Pro.jsx`.

**Tech Stack:** Next.js 16 App Router, Stripe SDK `stripe@22` (`lib/stripe/server.ts` `getStripe()`), Clerk auth, Supabase service_role, prototype JSX (`Pro.jsx`). Vitest = `lib/` only.

**Référence spec :** `docs/superpowers/specs/2026-05-19-pro-enregistrement-carte-design.md`

**Notes transverses :**
- Nouvelles routes + branche webhook = **additives** ; flux paiement/topup/auto-recharge **inchangé** (conditions disjointes mode `payment` vs `setup`) → rétro-compatible, **aucune casse mobile**. `stripe_default_payment_method_id`/`stripe_customer_id` existent déjà → **aucune migration**.
- Stripe en mode TEST → carte de test ; fonctionne tel quel en LIVE.
- Commits **file-scopés** : jamais `git add -A` (working tree contient des changements perf/docs non liés).
- Routes Stripe non testées unitairement dans ce repo (norme) → pas de nouveau Vitest ; vérif `tsc`/`eslint`/`vitest` non-régression + manuelle.

---

## File Structure

- Create: `lib/stripe/customer.ts` — `ensureStripeCustomer(proId)`.
- Create: `app/api/stripe/setup/route.ts` — `POST` crée la Checkout Session setup.
- Create: `app/api/pro/wallet/payment-method/reconcile/route.ts` — `POST` reconcile au retour.
- Modify: `app/api/stripe/webhook/route.ts` — branche `mode:'setup'`/`card_setup`.
- Create: `app/_components/CardSetupReconciler.tsx` — réconciliateur retour (calque `TopupReconciler`).
- Modify: `app/pro/page.tsx` — monter `<CardSetupReconciler />`.
- Modify: `public/prototype/components/Pro.jsx` — bouton « Enregistrer une carte » quand `payCard === null` + extension du listener `pro:wallet-changed` pour re-fetch la carte.

---

## Task 1: Helper `ensureStripeCustomer`

**Files:**
- Create: `lib/stripe/customer.ts`

- [ ] **Step 1: Créer le helper**

Créer `lib/stripe/customer.ts` avec EXACTEMENT :

```ts
/**
 * Retourne le `stripe_customer_id` d'un pro, en créant le Customer
 * Stripe + le persistant s'il n'existe pas encore. 1 Customer par
 * compte pro, réutilisé (recharge, reçus, carte enregistrée).
 *
 * Logique reprise de app/api/stripe/checkout/route.ts (création inline)
 * pour rester DRY ; cette route n'est volontairement pas modifiée.
 */

import { getStripe } from "@/lib/stripe/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function ensureStripeCustomer(opts: {
  proId: string;
  clerkUserId: string;
  email: string | null;
}): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data: pro } = await admin
    .from("pro_accounts")
    .select("id, raison_sociale, stripe_customer_id")
    .eq("id", opts.proId)
    .single();

  if (pro?.stripe_customer_id) return pro.stripe_customer_id;

  const stripe = await getStripe();
  const customer = await stripe.customers.create({
    email: opts.email ?? undefined,
    name: pro?.raison_sociale ?? undefined,
    metadata: { clerkUserId: opts.clerkUserId, proAccountId: opts.proId },
  });
  await admin
    .from("pro_accounts")
    .update({ stripe_customer_id: customer.id })
    .eq("id", opts.proId);
  return customer.id;
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint lib/stripe/customer.ts`
Expected: exit 0, 0 erreur. (Pas de test unitaire : I/O Stripe+DB, non testé dans ce repo — cohérent avec `lib/stripe/*` existant.)

- [ ] **Step 3: Commit**

```bash
git add lib/stripe/customer.ts
git commit -m "feat(stripe): helper ensureStripeCustomer"
```

---

## Task 2: Route `POST /api/stripe/setup`

**Files:**
- Create: `app/api/stripe/setup/route.ts`

- [ ] **Step 1: Créer la route**

Créer `app/api/stripe/setup/route.ts` avec EXACTEMENT :

```ts
/**
 * POST /api/stripe/setup — Checkout Session `mode:'setup'` pour
 * enregistrer une carte (0 €, aucun paiement). Au retour, le webhook
 * (`checkout.session.completed`, mode setup) + le reconcile persistent
 * `stripe_default_payment_method_id`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { getStripe } from "@/lib/stripe/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { ensureStripeCustomer } from "@/lib/stripe/customer";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;

  const proId = await ensureProAccount({ clerkUserId: userId, email });

  try {
    const customer = await ensureStripeCustomer({
      proId,
      clerkUserId: userId,
      email,
    });
    const stripe = await getStripe();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer,
      payment_method_types: ["card"],
      success_url: `${appUrl}/pro?card_setup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pro?card_setup=cancel`,
      metadata: {
        kind: "card_setup",
        proAccountId: proId,
        clerkUserId: userId,
      },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "stripe_failed";
    console.error("[/api/stripe/setup] échec :", msg);
    return NextResponse.json({ error: "stripe_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Vérifier imports**

Run:
```bash
grep -n "export async function ensureStripeCustomer" lib/stripe/customer.ts
grep -n "export async function ensureProAccount\|export function ensureProAccount" lib/sync/pro-accounts.ts
grep -n "export async function getStripe" lib/stripe/server.ts
```
Expected: les 3 exports présents.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint app/api/stripe/setup/route.ts`
Expected: exit 0, 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add app/api/stripe/setup/route.ts
git commit -m "feat(stripe): route POST /api/stripe/setup (Checkout mode=setup)"
```

---

## Task 3: Route `POST /api/pro/wallet/payment-method/reconcile`

**Files:**
- Create: `app/api/pro/wallet/payment-method/reconcile/route.ts`

- [ ] **Step 1: Créer la route**

Créer `app/api/pro/wallet/payment-method/reconcile/route.ts` avec EXACTEMENT :

```ts
/**
 * POST /api/pro/wallet/payment-method/reconcile
 *
 * Filet de sécurité au retour de Checkout `mode:'setup'`
 * (`?card_setup=success&session_id=...`) si le webhook tarde. Vérifie
 * la session Stripe (preuve : seul Stripe renvoie une session setup
 * complétée), l'ownership (`metadata.clerkUserId` == user authentifié),
 * puis persiste `stripe_default_payment_method_id` (idempotent).
 *
 * Body : { sessionId: string }
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/clerk/server";
import { getStripe } from "@/lib/stripe/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    sessionId?: string;
  };
  const sessionId = body.sessionId?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  }

  const stripe = await getStripe();
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["setup_intent"],
    });

    if (
      session.metadata?.kind !== "card_setup" ||
      session.mode !== "setup" ||
      session.metadata?.clerkUserId !== userId ||
      session.status !== "complete"
    ) {
      return NextResponse.json({ ok: false });
    }

    const proAccountId = session.metadata.proAccountId;
    const si = session.setup_intent;
    const pmId =
      si && typeof si === "object"
        ? typeof si.payment_method === "string"
          ? si.payment_method
          : (si.payment_method?.id ?? null)
        : null;
    if (!proAccountId || !pmId) {
      return NextResponse.json({ ok: false });
    }

    const admin = createSupabaseAdminClient();
    await admin
      .from("pro_accounts")
      .update({ stripe_default_payment_method_id: pmId })
      .eq("id", proAccountId);

    const pm = await stripe.paymentMethods.retrieve(pmId);
    const card = pm.card
      ? {
          brand: pm.card.brand ?? null,
          last4: pm.card.last4 ?? null,
          expMonth: pm.card.exp_month ?? null,
          expYear: pm.card.exp_year ?? null,
        }
      : null;
    return NextResponse.json({ ok: true, card });
  } catch (err) {
    console.error(
      "[/api/pro/wallet/payment-method/reconcile] échec :",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ ok: false });
  }
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "app/api/pro/wallet/payment-method/reconcile/route.ts"`
Expected: exit 0, 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add "app/api/pro/wallet/payment-method/reconcile/route.ts"
git commit -m "feat(pro): route reconcile carte enregistrée (filet webhook)"
```

---

## Task 4: Branche webhook `mode:'setup'`

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Insérer la branche setup**

Dans `app/api/stripe/webhook/route.ts`, trouver EXACTEMENT :
```ts
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const md = session.metadata ?? {};
        if (md.kind !== "topup") break; // ignore les Checkout d'autres usages
```
Remplacer par :
```ts
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const md = session.metadata ?? {};

        // Enregistrement de carte (Checkout mode:'setup'). Branche
        // disjointe du flux topup/paiement ci-dessous (mode 'payment').
        if (session.mode === "setup" && md.kind === "card_setup") {
          const proAccountId = md.proAccountId;
          const siId =
            typeof session.setup_intent === "string"
              ? session.setup_intent
              : (session.setup_intent?.id ?? null);
          if (proAccountId && siId) {
            const stripe = await getStripe();
            const si = await stripe.setupIntents.retrieve(siId);
            const pmId =
              typeof si.payment_method === "string"
                ? si.payment_method
                : (si.payment_method?.id ?? null);
            if (pmId) {
              const update: Record<string, unknown> = {
                stripe_default_payment_method_id: pmId,
              };
              if (session.customer) {
                update.stripe_customer_id =
                  typeof session.customer === "string"
                    ? session.customer
                    : session.customer.id;
              }
              await admin
                .from("pro_accounts")
                .update(update)
                .eq("id", proAccountId);
            }
          } else {
            console.warn("[stripe webhook] card_setup metadata incomplet", md);
          }
          break;
        }

        if (md.kind !== "topup") break; // ignore les Checkout d'autres usages
```

- [ ] **Step 2: Vérifier que `getStripe` est importé dans ce fichier**

Run: `grep -n "import .*getStripe\|from \"@/lib/stripe/server\"" app/api/stripe/webhook/route.ts`
Expected: `getStripe` est déjà importé (utilisé pour `constructEvent`). Si l'import est `import { getStripe } from "@/lib/stripe/server";` → OK, rien à faire. Sinon (import nommé différent), adapter l'appel `await getStripe()` au symbole réellement exporté/importé.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint app/api/stripe/webhook/route.ts`
Expected: exit 0, 0 erreur.

- [ ] **Step 4: Vérifier non-régression topup (lecture)**

Run: `grep -n "md.kind !== \"topup\"\|session.mode === \"setup\"\|case \"payment_intent.succeeded\"" app/api/stripe/webhook/route.ts`
Expected: la branche setup apparaît AVANT le `if (md.kind !== "topup") break;` ; le `case "payment_intent.succeeded"` et le reste du switch sont intacts. La logique topup n'est atteinte que si `mode !== 'setup'` → comportement paiement/topup inchangé.

- [ ] **Step 5: Commit**

```bash
git add app/api/stripe/webhook/route.ts
git commit -m "feat(stripe): webhook gère checkout.session.completed mode=setup (carte)"
```

---

## Task 5: Bouton « Enregistrer une carte » (Pro.jsx)

**Files:**
- Modify: `public/prototype/components/Pro.jsx` (fonction `Facturation`)

- [ ] **Step 1: État de chargement du bouton**

Trouver (≈ ligne 5966, ajouté au Lot B) :
```jsx
  // undefined = chargement, null = aucune carte, objet = carte Stripe.
  const [payCard, setPayCard] = useState(undefined);
```
Remplacer par :
```jsx
  // undefined = chargement, null = aucune carte, objet = carte Stripe.
  const [payCard, setPayCard] = useState(undefined);
  const [cardSetupLoading, setCardSetupLoading] = useState(false);
  const startCardSetup = () => {
    if (cardSetupLoading) return;
    setCardSetupLoading(true);
    fetch('/api/stripe/setup', { method: 'POST' })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j && j.url) { window.top.location.href = j.url; }
        else { setCardSetupLoading(false); alert("Impossible d'ouvrir l'enregistrement de carte. Réessayez."); }
      })
      .catch(() => { setCardSetupLoading(false); alert("Erreur réseau. Réessayez."); });
  };
```

- [ ] **Step 2: Re-fetch de la carte sur `pro:wallet-changed`**

Trouver (≈ ligne 5989, fin de l'effet Facturation, ajouté/présent depuis Lot B) :
```jsx
    const onChange = () => refresh();
    window.addEventListener('pro:wallet-changed', onChange);
```
Remplacer par :
```jsx
    const onChange = () => {
      refresh();
      fetch('/api/pro/wallet/payment-method', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : { card: null })
        .then(j => { if (!cancelled) setPayCard(j.card ?? null); })
        .catch(() => { if (!cancelled) setPayCard(null); });
    };
    window.addEventListener('pro:wallet-changed', onChange);
```

- [ ] **Step 3: Afficher le bouton quand aucune carte**

Trouver le bloc de l'entrée card « Carte enregistrée » (≈ lignes 6022-6031, posé au Lot B) :
```jsx
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
```
Remplacer par :
```jsx
          [
            'Carte enregistrée',
            payCard === undefined
              ? '…'
              : (payCard
                  ? `${payCard.brand ? payCard.brand.charAt(0).toUpperCase() + payCard.brand.slice(1) : 'Carte'} ••${payCard.last4 ?? '????'}`
                  : 'Aucune carte enregistrée'),
            payCard === null
              ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={cardSetupLoading}
                    onClick={startCardSetup}
                    style={{ marginTop: 4 }}
                  >
                    {cardSetupLoading ? '…' : 'Enregistrer une carte'}
                  </button>
                )
              : (payCard && payCard.expMonth && payCard.expYear)
                ? `Expire ${String(payCard.expMonth).padStart(2, '0')}/${payCard.expYear}`
                : '—',
          ],
```
(Le renderer enveloppe déjà `r[2]` dans un `<div>` ; un nœud `<button>` y est valide. Quand une carte existe → expiration affichée comme avant ; chargement → `'…'`.)

- [ ] **Step 4: Vérifier**

Run:
```bash
grep -n "cardSetupLoading\|startCardSetup\|/api/stripe/setup\|Enregistrer une carte\|payment-method', { cache" public/prototype/components/Pro.jsx | head
npx tsc --noEmit
```
Expected: refs présentes ; `tsc` exit 0. Relire les 3 régions remplacées : équilibre JSX (le `<button>` est bien dans la branche `payCard === null` de l'expression du `r[2]`, virgules de l'array intactes, `.map((r, i) =>` inchangé en aval).

- [ ] **Step 5: Commit**

```bash
git add public/prototype/components/Pro.jsx
git commit -m "feat(pro): bouton « Enregistrer une carte » quand aucune carte"
```

---

## Task 6: Réconciliateur retour + montage

**Files:**
- Create: `app/_components/CardSetupReconciler.tsx`
- Modify: `app/pro/page.tsx`

- [ ] **Step 1: Créer le composant (calque TopupReconciler)**

Créer `app/_components/CardSetupReconciler.tsx` avec EXACTEMENT :

```tsx
"use client";

/**
 * Monté sur /pro. Au retour de Checkout `mode:'setup'`
 * (`?card_setup=success&session_id=cs_…`), POST le reconcile (cookie
 * Clerk présent côté parent), nettoie l'URL, puis notifie l'iframe
 * prototype (postMessage `wallet-refresh`) pour qu'elle re-fetch la
 * carte. `?card_setup=cancel` → on nettoie juste l'URL (no-op).
 * Idempotent : le reconcile no-op si déjà enregistré.
 */

import { useEffect, useRef } from "react";

export default function CardSetupReconciler() {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const state = params.get("card_setup");
    if (state !== "success" && state !== "cancel") return;
    const sessionId = params.get("session_id");

    let cancelled = false;

    const cleanupUrl = () => {
      try {
        const next = new URL(window.location.href);
        next.searchParams.delete("card_setup");
        next.searchParams.delete("session_id");
        const search = next.searchParams.toString();
        const cleaned =
          next.pathname + (search ? "?" + search : "") + next.hash;
        window.history.replaceState({}, "", cleaned);
      } catch {
        /* no-op */
      }
    };

    const notifyIframe = () => {
      const iframes =
        document.querySelectorAll<HTMLIFrameElement>("iframe");
      iframes.forEach((f) => {
        try {
          f.contentWindow?.postMessage({ bupp: "wallet-refresh" }, "*");
        } catch {
          /* cross-origin : silencieux */
        }
      });
    };

    if (state === "cancel" || !sessionId) {
      cleanupUrl();
      return;
    }

    (async () => {
      try {
        const r = await fetch(
          "/api/pro/wallet/payment-method/reconcile",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sessionId }),
          },
        );
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          console.warn("[card-setup-reconcile] échec", r.status, j);
        }
      } catch (e) {
        console.warn("[card-setup-reconcile] network error", e);
      }
      if (cancelled) return;
      notifyIframe();
      cleanupUrl();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
```

- [ ] **Step 2: Monter dans /pro**

Dans `app/pro/page.tsx`, trouver :
```tsx
import TopupReconciler from "../_components/TopupReconciler";
```
Ajouter dessous :
```tsx
import CardSetupReconciler from "../_components/CardSetupReconciler";
```
Puis trouver :
```tsx
      <TopupReconciler />
      <PrototypeFrame route="pro" version={PROTOTYPE_VERSION} />
```
Remplacer par :
```tsx
      <TopupReconciler />
      <CardSetupReconciler />
      <PrototypeFrame route="pro" version={PROTOTYPE_VERSION} />
```

- [ ] **Step 3: Vérifier le pont `wallet-refresh` → `pro:wallet-changed`**

Run: `grep -n "wallet-refresh\|pro:wallet-changed" public/prototype/components/Pro.jsx public/prototype/shell.html | head`
Expected: il existe déjà un handler `message` qui, sur `bupp:"wallet-refresh"`, déclenche un `pro:wallet-changed` (ou équivalent) — c'est ce que le flux topup utilise. Si présent → la carte se rafraîchira via l'extension du listener faite en Task 5 Step 2 (rien à coder). Si AUCUN pont n'existe (improbable car le topup fonctionne), signaler DONE_WITH_CONCERNS en décrivant le mécanisme réel observé pour adaptation.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint app/_components/CardSetupReconciler.tsx app/pro/page.tsx`
Expected: exit 0, 0 erreur.

- [ ] **Step 5: Commit**

```bash
git add app/_components/CardSetupReconciler.tsx app/pro/page.tsx
git commit -m "feat(pro): CardSetupReconciler au retour de Checkout setup"
```

---

## Task 7: Vérification globale & non-régression

**Files:** aucun (vérification seule)

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Lint des fichiers touchés (hors Pro.jsx)**

Run:
```bash
npx eslint lib/stripe/customer.ts app/api/stripe/setup/route.ts "app/api/pro/wallet/payment-method/reconcile/route.ts" app/api/stripe/webhook/route.ts app/_components/CardSetupReconciler.tsx app/pro/page.tsx
```
Expected: exit 0, 0 erreur.

- [ ] **Step 3: Pro.jsx — aucune nouvelle erreur ESLint**

Run:
```bash
git show main:public/prototype/components/Pro.jsx > /tmp/Pb.jsx && cp /tmp/Pb.jsx public/prototype/components/.Pb.jsx
B=$(npx eslint public/prototype/components/.Pb.jsx 2>&1 | grep -oE '[0-9]+ problems \([0-9]+ errors' | head -1)
C=$(npx eslint public/prototype/components/Pro.jsx 2>&1 | grep -oE '[0-9]+ problems \([0-9]+ errors' | head -1)
rm -f public/prototype/components/.Pb.jsx
echo "BASE(main): $B"; echo "BRANCHE   : $C"
```
Expected: nombre d'erreurs BRANCHE ≤ BASE (aucune nouvelle erreur introduite ; bruit prototype non-module pré-existant).

- [ ] **Step 4: Tests (non-régression)**

Run: `npx vitest run`
Expected: tous verts (65, inchangé — aucun nouveau test, cohérent avec la norme repo Stripe).

- [ ] **Step 5: Vérification manuelle (non bloquante, mode TEST Stripe)**

Avec `npm run dev`, connecté en pro **sans carte** :
1. Facturation → card « Carte enregistrée » affiche « Aucune carte enregistrée » + bouton « Enregistrer une carte ».
2. Clic → redirection page Stripe Checkout (setup). Saisir `4242 4242 4242 4242`, date future, CVC quelconque, valider.
3. Retour `/pro?card_setup=success&session_id=cs_…` → l'URL est nettoyée → la card affiche `Visa ••4242 / Expire MM/AAAA` sans rechargement manuel (reconcile + `wallet-refresh`).
4. Refaire le parcours mais **Annuler** sur Stripe → retour `?card_setup=cancel` → URL nettoyée, card inchangée (bouton toujours présent).
5. Non-régression : une recharge wallet (flux topup existant) fonctionne toujours (crédit visible).

- [ ] **Step 6: Commit éventuel de corrections**

Si Steps 1-4 ont nécessité une correction (scopée aux fichiers de cette feature) :
```bash
git add lib/stripe/customer.ts app/api/stripe/setup/route.ts "app/api/pro/wallet/payment-method/reconcile/route.ts" app/api/stripe/webhook/route.ts app/_components/CardSetupReconciler.tsx app/pro/page.tsx public/prototype/components/Pro.jsx
git commit -m "fix(pro): corrections post-vérification enregistrement carte"
```

---

## Self-Review (effectuée)

- **Couverture spec :** helper `ensureStripeCustomer` (T1) ; route setup `mode:'setup'` + metadata `kind/proAccountId/clerkUserId` (T2) ; reconcile avec garde ownership `clerkUserId` + idempotent + renvoi carte (T3) ; branche webhook setup disjointe, topup inchangé (T4) ; bouton quand `payCard===null` + redirection `window.top` + extension listener re-fetch carte (T5) ; CardSetupReconciler calque TopupReconciler + montage /pro + cancel no-op (T6) ; vérif + manuel carte test (T7). Tous les points du spec sont couverts. Hors périmètre (modifier/supprimer carte, Elements, refacto checkout) respecté.
- **Placeholders :** aucun « TBD/TODO » ; code complet old/new partout.
- **Cohérence types/noms :** `ensureStripeCustomer({proId,clerkUserId,email})` défini T1, appelé T2 à l'identique ; metadata `kind:'card_setup'`/`proAccountId`/`clerkUserId` posées T2, lues T3 (reconcile) et T4 (webhook) à l'identique ; param URL `card_setup`/`session_id` posés T2 (success_url/cancel_url), lus T6 ; message `bupp:'wallet-refresh'` réutilisé (canal topup existant) consommé via l'extension du listener `pro:wallet-changed` (T5 Step 2). Endpoint reconcile `/api/pro/wallet/payment-method/reconcile` identique T3 (création) et T6 (appel).
- **Ordre :** T1 helper → T2 setup (dépend T1) → T3 reconcile → T4 webhook → T5 bouton (dépend T2) → T6 reconciler (dépend T3) → T7 vérif. Cohérent.
