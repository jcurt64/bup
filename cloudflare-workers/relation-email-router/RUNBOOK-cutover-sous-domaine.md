# Runbook — Rétablir les alias de mise en relation sur `mail.buupp.com`

## Contexte (à jour 05/06/2026)

Depuis la migration IONOS, **`buupp.com` (apex) a ses MX chez IONOS** (boîtes
`support@`, `social@`) et **Cloudflare Email Routing est DÉSACTIVÉ sur l'apex**.

Conséquence : les alias anti-fraude `prospect+r{slug}@buupp.com` ne sont plus
routés → la fonction watermark est **HORS SERVICE**.

Ce runbook la rétablit **sans toucher à l'apex** (donc sans risque pour
`support@`/`social@`), en déplaçant les alias sur le **sous-domaine
`mail.buupp.com`**, qui aura son propre Email Routing + le worker existant.

## ✅ Code : RIEN à changer

Tout est déjà piloté par variable d'environnement :

- `lib/aliases/relation-email.ts` → `INBOUND_DOMAIN = process.env.BUUPP_INBOUND_DOMAIN ?? "buupp.com"`.
- Le worker (`src/index.ts`) matche `^prospect\+r([a-z0-9]{8,16})@` — **indépendant du domaine**.
- `/api/inbound/relation/resolve` ne dépend que du slug.

→ Le **seul** changement applicatif est de poser `BUUPP_INBOUND_DOMAIN=mail.buupp.com`
sur Vercel. Aucun déploiement de code requis (juste un redeploy pour prendre l'env).

---

## Procédure de cutover (≈ 20 min, à faire ensemble)

### 0. Prérequis (déjà OK)
- Table `relation_email_aliases` présente (migration `20260515120000`).
- Dossier worker présent + `npm install` faisable.
- Un secret `INBOUND_RELAY_SECRET` (≥ 32 caractères) — réutiliser celui déjà
  défini côté Vercel s'il existe, sinon en générer un.

### 1. Cloudflare — router `mail.buupp.com` SANS toucher l'apex

> ⚠️ **Ne PAS ré-activer Email Routing sur la zone `buupp.com`** : ça reposerait
> les MX Cloudflare sur l'apex et **casserait IONOS** (`support@`/`social@`).

**Méthode recommandée — sous-domaine en ZONE SÉPARÉE (zéro impact sur l'apex) :**
1. Cloudflare → **Add a Site / Domain** → `mail.buupp.com` (configuration en
   sous-domaine). Cloudflare attribue 2 nameservers à cette nouvelle zone.
2. Dans la zone **`buupp.com`** → DNS → ajouter 2 enregistrements **NS** :
   `mail` → chacun des 2 nameservers de la zone `mail.buupp.com` (DNS only).
3. Une fois la zone `mail.buupp.com` active : **Email → Email Routing → Enable**
   sur **cette zone**. Ça pose les MX `route*.mx.cloudflare.net` **uniquement sur
   `mail.buupp.com`** (l'apex `buupp.com` reste sur IONOS, intact).

*Alternative — fonctionnalité « Subdomains » d'Email Routing (zone `buupp.com`) :*
possible en théorie, mais **vérifier impérativement** que l'activation **n'ajoute
aucun MX sur l'apex**. Si Cloudflare veut re-poser des MX racine → **abandonner**
et utiliser la zone séparée ci-dessus.

### 2. Déployer le worker
```bash
cd cloudflare-workers/relation-email-router
npm install
npx wrangler login                       # auth interactive (compte CF)
npx wrangler secret put INBOUND_RELAY_SECRET   # MÊME valeur que côté Vercel
npx wrangler secret put BUUPP_API_BASE         # https://buupp.com
npx wrangler deploy
```

### 3. Règle de routage
Zone **`mail.buupp.com`** → Email → Email Routing → **Routing rules** :
- Type : **Custom address**
- Address : `prospect+*@mail.buupp.com`  (catch-all sur les alias)
- Action : **Send to a Worker** → `relation-email-router`

(Optionnel : une **catch-all** `*@mail.buupp.com` → Worker, par sécurité.)

### 4. Vercel (projet `bup`)
- `BUUPP_INBOUND_DOMAIN` = `mail.buupp.com`  *(Production)*
- `INBOUND_RELAY_SECRET` = même valeur que côté worker (vérifier qu'il existe)
- **Redeploy** pour prendre les variables.

### 5. Vérification
```bash
dig +short MX mail.buupp.com @1.1.1.1          # -> route*.mx.cloudflare.net
# resolve endpoint (doit renvoyer 404 sur un faux alias) :
curl -s -H "x-inbound-secret: <SECRET>" "https://buupp.com/api/inbound/relation/resolve?alias=deadbeef0000"
```
- Côté app : faire révéler un e-mail prospect par un pro → l'alias généré doit
  finir en **`@mail.buupp.com`**.
- Envoyer un mail à cet alias → doit arriver dans la vraie boîte du prospect.

---

## Notes
- Les **anciens** alias déjà distribués en `@buupp.com` resteront cassés
  (ils tombent désormais chez IONOS). Acceptable vu le faible volume en phase de
  lancement ; aucune action requise.
- SPF/DKIM : Email Routing pose sa propre config **sur `mail.buupp.com`** — sans
  effet sur le SPF/DKIM de l'apex (IONOS + Brevo).
- Rollback : remettre `BUUPP_INBOUND_DOMAIN=buupp.com` (ou retirer l'env) côté
  Vercel revient à l'état actuel (alias en `@buupp.com`, donc inertes).
