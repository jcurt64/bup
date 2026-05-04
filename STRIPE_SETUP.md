# Stripe Setup — BUUPP

Côté code, **tout est déjà branché** (recharge pro, retrait prospect via
Connect Express, webhooks, sync Supabase, sync Clerk). Il reste **3
choses à faire dans le Dashboard Stripe** pour activer le flow.

> Comptez 15 minutes. Tout se passe sur https://dashboard.stripe.com.

---

## 1. Activer Stripe Connect (Express)

Indispensable pour permettre aux prospects de retirer leurs gains sur
leur IBAN.

1. Dashboard Stripe → **Connect** → **Get started**.
2. Choisir **Platform or marketplace**.
3. Renseigner le profil de la plateforme (nom BUUPP, site, description,
   pays France, modèle "marketplace").
4. Aller dans **Connect → Settings → Branding** : ajouter le logo BUUPP,
   les couleurs (utilisé sur les pages d'onboarding hébergées Stripe).
5. **Connect → Settings → Express** :
   - Activer le type **Express**
   - Pays par défaut : **France**
   - Currency : **EUR**

> Le flux d'onboarding est entièrement hébergé par Stripe (KYC,
> justificatif d'identité, IBAN). BUUPP n'expose et ne stocke aucune
> donnée bancaire personnelle.

---

## 2. Configurer le webhook

1. Dashboard → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL :
   - **Prod** : `https://VOTRE-DOMAINE/api/stripe/webhook`
   - **Local (dev)** : utiliser `stripe listen --forward-to localhost:3000/api/stripe/webhook` (Stripe CLI) — il génère un Signing Secret de test à coller dans `.env.local`.
3. Listen to **events on your account** (pas Connect — les events Connect
   arrivent automatiquement sur le même endpoint).
4. Cocher exactement ces événements :

   | Événement | Rôle |
   |-----------|------|
   | `checkout.session.completed` | Recharge pro → crédite `pro_accounts.wallet_balance_cents` |
   | `account.updated` | Onboarding Connect → met à jour `prospects.stripe_payouts_enabled` |
   | `transfer.created` | Retrait prospect → passe la transaction à `completed` |
   | `transfer.reversed` | Retrait prospect → passe la transaction à `failed` |

5. Copier le **Signing Secret** (commence par `whsec_…`) → coller dans
   `.env.local` puis dans Vercel :
   ```
   STRIPE_WEBHOOK_SECRET=whsec_…
   ```

---

## 3. Variables d'environnement

Dans `.env.local` (dev) **et** Vercel Project Settings (prod) :

```bash
# Existantes (déjà configurées)
STRIPE_SECRET_KEY=sk_test_…           # ou sk_live_… en prod
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…

# URL publique de l'app (utilisée pour les success/cancel URLs Stripe)
NEXT_PUBLIC_APP_URL=https://VOTRE-DOMAINE   # ex. https://buupp.fr
```

> En dev local, mettre `NEXT_PUBLIC_APP_URL=http://localhost:3000`.

---

## Comment ça marche

### Recharge pro
1. Dans le dashboard pro → bouton **« Recharger le crédit »** ouvre la modale.
2. Le pro choisit un montant → clic **« Payer X € »** → POST sur `/api/stripe/checkout`.
3. Le serveur :
   - Crée (ou récupère) `pro_accounts` (helper `ensureProAccount`).
   - Crée (ou récupère) le `Customer` Stripe → persisté dans `pro_accounts.stripe_customer_id`.
   - Crée une **Checkout Session** avec metadata `kind=topup` + `proAccountId` + `amountCents`.
4. Le pro est redirigé vers la page de paiement hébergée Stripe.
5. À la fin du paiement → Stripe POST `checkout.session.completed` sur le webhook → le serveur :
   - INSERT `transactions(type=topup, status=completed)`
   - UPDATE `pro_accounts.wallet_balance_cents += amountCents`

### Retrait prospect (Connect Express)
1. Dans le portefeuille prospect → bouton **« Retirer mes gains »** ouvre la modale.
2. La modale fetch `/api/prospect/payout/status`.
3. **1er retrait** → bouton **« Activer mes retraits »** → POST `/api/prospect/payout/onboarding` :
   - Crée un Connect Express Account → persisté dans `prospects.stripe_connect_account_id`.
   - Crée un Account Link one-shot.
   - Le prospect est redirigé vers le tunnel KYC hébergé Stripe (justificatif + IBAN).
   - Au retour, Stripe envoie `account.updated` → on persiste `payouts_enabled = true`.
4. **Retraits suivants** → champ montant + **« Confirmer le retrait »** → POST `/api/prospect/payout/withdraw` :
   - Vérifie le solde disponible en base (gains crédités − retraits déjà faits).
   - INSERT `transactions(type=withdrawal, status=pending)`.
   - `stripe.transfers.create({amount, destination: connect_account_id})` avec metadata.
   - Webhook `transfer.created` → passe la transaction à `completed`.
   - Stripe initie automatiquement le payout vers l'IBAN du prospect (1–3 j ouvrés).

### Synchronisation Clerk ↔ Supabase
- L'auth Clerk gère l'identité ; le `userId` Clerk est la clé étrangère
  vers `prospects.clerk_user_id` et `pro_accounts.clerk_user_id`.
- Les helpers `ensureProspect` / `ensureProAccount` créent la row à la
  volée si elle n'existe pas (filet quand le webhook Clerk est en retard).
- Le webhook `user.deleted` Clerk supprime déjà la row prospect (cascade
  sur tous les paliers + RIB + score history).

---

## Test rapide local

```bash
# Terminal 1
npm run dev

# Terminal 2 — installer Stripe CLI puis :
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# → copier le whsec_ affiché dans .env.local, redémarrer npm run dev

# Tester la recharge pro
stripe trigger checkout.session.completed

# Tester le webhook account.updated
stripe trigger account.updated
```

> Pour tester un vrai paiement de bout-en-bout : utiliser la carte de
> test `4242 4242 4242 4242`, n'importe quelle date future, n'importe
> quel CVC.

---

## Checklist de mise en prod

- [ ] Connect activé sur le compte Stripe (étape 1)
- [ ] Webhook prod ajouté avec les 4 events (étape 2)
- [ ] Variables `STRIPE_*` + `NEXT_PUBLIC_APP_URL` setées sur Vercel
- [ ] Migration Supabase `20260504200000_prospects_stripe_connect.sql` appliquée (déjà fait)
- [ ] Test e2e : 1 recharge pro + 1 onboarding prospect + 1 retrait prospect
