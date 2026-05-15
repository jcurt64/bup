# relation-email-router (Cloudflare Email Worker)

Watermark cryptographique des emails révélés aux pros BUUPP.

## Pourquoi

Quand un pro clique pour révéler l'email d'un prospect dans `Mes contacts`,
l'API BUUPP ne lui retourne plus le vrai email — elle retourne un alias
unique de la forme `prospect+r{slug}@buupp.com`, propre à la relation.

Ce Worker reçoit les mails envoyés à ces alias, interroge l'API BUUPP pour
résoudre l'alias en vrai email, et forward le mail vers la boîte du
prospect. Si le prospect reçoit un mail venant d'une autre source que
l'alias BUUPP, on remonte instantanément au pro émetteur via la
`relation_id` — sans recoupement de logs nécessaire.

## Architecture DNS

La zone `buupp.com` est intégralement gérée par Cloudflare (changement de
nameservers chez le registrar IONOS). C'est sans risque pour BUUPP car
le site web est hébergé sur Vercel (`*.vercel.app`) et il n'y a pas de
boîte mail active sur le domaine.

## Prérequis

1. La zone `buupp.com` doit être active chez Cloudflare (les 2 nameservers
   CF doivent être déclarés chez IONOS et avoir propagé).
2. **Email Routing** doit être activé sur la zone `buupp.com`
   (Dashboard CF → Email → Email Routing → Enable).
3. La migration SQL `20260515120000_relation_email_aliases.sql` doit être
   appliquée (voir mémoire `supabase-migrations`).
4. La variable d'env `INBOUND_RELAY_SECRET` (≥ 32 chars) doit être
   définie côté Vercel ET côté Worker (mêmes valeurs des deux côtés).
5. La variable d'env `BUUPP_INBOUND_DOMAIN` côté Vercel doit valoir
   `buupp.com`.

## Déploiement

```bash
cd cloudflare-workers/relation-email-router
npm install

# Définir les secrets
npx wrangler secret put INBOUND_RELAY_SECRET   # même valeur que côté Vercel
npx wrangler secret put BUUPP_API_BASE         # ex. https://buupp.com

# Déployer
npx wrangler deploy
```

Puis dans le dashboard Cloudflare → zone `buupp.com` → Email → Email
Routing → **Routing rules**, créer une règle :

- Type : **Custom address**
- Address : `prospect+*@buupp.com` (catch-all sur les alias)
- Action : **Send to a Worker**
- Worker : `relation-email-router`

## Sécurité

- Le Worker authentifie chaque appel à `/api/inbound/relation/resolve`
  avec le header `x-inbound-secret`.
- Si l'alias est inconnu (forgé ou révoqué), le mail est rejeté (`setReject`)
  → le client mail du pro affichera "delivery failure".
- En cas d'indisponibilité de l'API BUUPP, le mail est rejeté (jamais
  délivré silencieusement).
- Le forward préserve le `From` original (l'email du pro) — cohérent avec
  le double consentement déjà donné par le prospect.

## Vérifier que ça marche

1. Côté API : tester l'endpoint résolve avec un alias bidon
   ```bash
   curl -H "x-inbound-secret: $INBOUND_RELAY_SECRET" \
     "https://buupp.com/api/inbound/relation/resolve?alias=deadbeef0000"
   # → 404 not_found (normal, l'alias n'existe pas)
   ```
2. Côté Worker : depuis n'importe quel client mail, envoyer un mail à
   `prospect+rXXXXXXXXXXXX@buupp.com` (slug d'une relation existante).
   Le mail doit arriver dans la boîte du prospect avec une mention
   `via buupp.com` dans les headers.
