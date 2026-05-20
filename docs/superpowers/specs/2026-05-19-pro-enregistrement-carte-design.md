# Espace Pro — Enregistrement d'une carte bancaire — Design

Date : 2026-05-19
Statut : approuvé (design), prêt pour planification d'implémentation
Approche retenue : **A** (Stripe Checkout `mode:'setup'` + webhook + reconcile)

## Contexte

Suite du Lot B : la card « Carte enregistrée » affiche désormais la
vraie carte Stripe, ou « Aucune carte enregistrée » si aucune. Demande :
quand aucune carte n'est enregistrée, afficher un bouton pour en
enregistrer une, **et** implémenter le backend permettant cet
enregistrement.

Le codebase utilise déjà **Stripe Checkout hébergé en redirection** pour
la recharge wallet (aucun Stripe.js/Elements côté client ; le prototype
est une iframe Babel). Un customer Stripe est créé à la volée et le
webhook persiste `stripe_default_payment_method_id`. On réutilise ce
pattern éprouvé.

## Décisions validées

1. Approche A : Checkout Session `mode:'setup'` (saisie carte, 0 €, aucun
   paiement), redirection hébergée — cohérent avec la recharge, zéro
   Stripe.js client, PCI géré par Stripe.
2. Fiabilité du retour : **webhook + reconcile** (calque le pattern
   `/api/pro/topup/reconcile`) — la carte s'affiche immédiatement au
   retour même si le webhook a du retard.
3. Périmètre : bouton **uniquement** quand aucune carte enregistrée.
   « Modifier/remplacer une carte existante » = hors périmètre.

## Architecture

### 1. Helper `lib/stripe/customer.ts` (créer)

```ts
export async function ensureStripeCustomer(proId: string): Promise<string>;
```
- Lit `pro_accounts.stripe_customer_id` pour `proId` (admin client).
- Si présent → le retourne.
- Sinon → `stripe.customers.create({ metadata: { proAccountId: proId } })`,
  écrit `stripe_customer_id` sur `pro_accounts` (eq id proId), retourne
  l'id.
- Logique extraite de l'actuel inline de `app/api/stripe/checkout/route.ts`
  (lignes ~79-93) **sans modifier cette route** (DRY sans refacto
  risquée du flux recharge). Le helper est consommé uniquement par la
  nouvelle route setup.

### 2. Route `POST /api/stripe/setup` (créer)

`app/api/stripe/setup/route.ts`, `runtime = "nodejs"`.
Préambule pro standard : `auth()` → 401 si pas de `userId` ;
`currentUser()` email ; `ensureProAccount({clerkUserId,email})` →
`proId`.
- `const customer = await ensureStripeCustomer(proId);`
- `const stripe = await getStripe();`
- `APP_URL` résolu exactement comme dans `app/api/stripe/checkout/route.ts`.
- ```ts
  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer,
    payment_method_types: ["card"],
    success_url: `${APP_URL}/pro?card_setup=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/pro?card_setup=cancel`,
    metadata: { kind: "card_setup", proAccountId: proId },
  });
  ```
- Retour : `NextResponse.json({ url: session.url })`. Erreur Stripe →
  `{ error: "stripe_failed" }` status 502.

### 3. Webhook `app/api/stripe/webhook/route.ts` (branche additive)

Dans le handler `checkout.session.completed`, ajouter une branche
**disjointe** de la branche `enableAutoRecharge`/paiement existante :

```ts
if (session.mode === "setup" && session.metadata?.kind === "card_setup") {
  const proAccountId = session.metadata.proAccountId;
  const siId =
    typeof session.setup_intent === "string"
      ? session.setup_intent
      : session.setup_intent?.id;
  if (proAccountId && siId) {
    const si = await stripe.setupIntents.retrieve(siId);
    const pmId =
      typeof si.payment_method === "string"
        ? si.payment_method
        : si.payment_method?.id ?? null;
    if (pmId) {
      await admin
        .from("pro_accounts")
        .update({
          stripe_default_payment_method_id: pmId,
          ...(session.customer
            ? { stripe_customer_id:
                  typeof session.customer === "string"
                    ? session.customer
                    : session.customer.id }
            : {}),
        })
        .eq("id", proAccountId);
    }
  }
  return; // ou équivalent : ne pas tomber dans la logique topup
}
```
Idempotent (écrit la même valeur si rejoué). Le flux topup/auto-recharge
existant reste **inchangé** (condition mutuellement exclusive : mode
`payment` vs `setup`).

### 4. Route `POST /api/pro/wallet/payment-method/reconcile` (créer)

`app/api/pro/wallet/payment-method/reconcile/route.ts`,
`runtime = "nodejs"`. Calque `app/api/pro/topup/reconcile/route.ts`.
- Préambule pro → `proId`.
- Body `{ sessionId: string }` ; sessionId vide → 400 `{error:"missing_session"}`.
- `const stripe = await getStripe();`
- `const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["setup_intent"] });`
- Garde : `session.metadata?.proAccountId === proId` ET
  `session.mode === "setup"` ET `session.status === "complete"`. Sinon
  → `{ ok:false }` (200, pas d'erreur dure ; le webhook finira).
- Extraire `payment_method` du `setup_intent` (string|objet).
- Écrire `stripe_default_payment_method_id` (idempotent) sur
  `pro_accounts` eq id proId.
- Récupérer la carte (`stripe.paymentMethods.retrieve(pmId)`) et
  renvoyer `{ ok:true, card:{ brand,last4,expMonth,expYear } }` (même
  mapping que `/api/pro/wallet/payment-method`). Toute erreur Stripe →
  `{ ok:false }` (jamais 500).

### 5. UI `public/prototype/components/Pro.jsx` (Facturation)

La card « Carte enregistrée » : le renderer enveloppe déjà `r[2]` dans
un `<div>`. Quand `payCard === null` (aucune carte), `r[2]` devient un
`<button>` « Enregistrer une carte » au lieu de `'—'`. Le slot valeur
(`r[1]`) affiche `'Aucune carte enregistrée'` (inchangé) ;
`payCard === undefined` → `'…'` (inchangé) ; carte présente → affichage
actuel (aucun bouton).

État local `cardSetupLoading`. Au clic du bouton :
```js
fetch('/api/stripe/setup', { method:'POST' })
  .then(r => r.json())
  .then(j => { if (j.url) window.top.location.href = j.url; })
  .catch(()=>{ /* reset loading + message léger */ });
```
(calque `RechargeModal`, `Objectives.jsx:568`, `window.top.location.href`
pour sortir de l'iframe vers Stripe). Bouton désactivé + « … » pendant
l'appel.

### 6. Réconciliateur retour `app/_components/CardSetupReconciler.tsx` (créer)

Calque `app/_components/TopupReconciler.tsx`. Rendu dans
`app/pro/page.tsx` à côté de `<TopupReconciler />`. Client component.
Au montage :
- lit `useSearchParams()` ; si `card_setup === "success"` et
  `session_id` présent → `POST /api/pro/wallet/payment-method/reconcile`
  `{ sessionId }` ; puis nettoie l'URL (`router.replace('/pro')`) ; puis
  `window.dispatchEvent(new Event('pro:wallet-changed'))`.
- si `card_setup === "cancel"` → seulement nettoyer l'URL (no-op).
- one-shot (ne rejoue pas après strip).

Extension : l'effet de `Facturation` qui écoute déjà
`pro:wallet-changed` (refresh factures) est étendu pour **re-fetch
aussi `/api/pro/wallet/payment-method`** → la carte apparaît sans
rechargement manuel.

## Gestion d'erreurs

- `/api/stripe/setup` : erreur Stripe → 502 `{error:"stripe_failed"}` ;
  le bouton réaffiche son état normal + message léger.
- Webhook setup : si pas de pmId → ne rien écrire (le reconcile au
  retour rattrapera), ne jamais throw (cohérent avec le handler
  existant).
- `reconcile` : toute incohérence/erreur → `{ ok:false }` (200) ; le
  webhook reste le filet long terme. Jamais 500.
- UI : échec `setup` → bouton réactivé, message non bloquant.

## Tests

Vitest couvre `lib/`. Les routes Stripe/webhook ne sont pas testées
unitairement dans ce repo (`checkout`/`webhook`/`auto-recharge` ne le
sont pas — dépendances Stripe). On suit cette norme : **pas de nouveau
test Vitest**.
- Vérif globale : `tsc` 0, `eslint` 0 sur fichiers non-`Pro.jsx`
  touchés, `Pro.jsx` sans nouvelle erreur (compte avant/après), `vitest`
  inchangé (65 verts).
- Vérif manuelle (mode TEST Stripe, non bloquante) : compte pro sans
  carte → card affiche le bouton → clic → page Stripe setup → carte test
  `4242 4242 4242 4242` (date future, CVC quelconque) → retour
  `/pro?card_setup=success` → la card affiche `Visa ••4242 / Expire
  MM/AAAA` immédiatement (reconcile) ; annuler sur Stripe → retour
  `?card_setup=cancel` → card inchangée (bouton toujours là).

## Impact mobile / transverse (règle permanente)

- `/api/stripe/setup` + `/api/pro/wallet/payment-method/reconcile` :
  **nouvelles routes additives** (backend partagé ; le mobile pourra les
  réutiliser, non requis ici).
- Webhook : **branche additive** pour `mode:'setup'` ; le flux
  paiement/topup/auto-recharge existant n'est pas modifié (conditions
  disjointes) → **rétro-compatible, aucune casse mobile**.
- `pro_accounts.stripe_default_payment_method_id` / `stripe_customer_id`
  existent déjà → **aucune migration, aucun schéma**.
- UI = prototype web (`Pro.jsx`) + `app/pro/page.tsx`. Parité visuelle
  mobile éventuelle = demande explicite séparée.

## Hors périmètre

- Modifier/remplacer/supprimer une carte déjà enregistrée.
- Stripe.js/Elements embarqué.
- Refacto de `app/api/stripe/checkout/route.ts` pour utiliser le helper
  (le helper n'est consommé que par la nouvelle route setup).
- Passage Stripe LIVE (le code gère LIVE sans modification).
