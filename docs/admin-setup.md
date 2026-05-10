# Setup back-office BUUPP

## 1. Variables d'environnement

| Variable | Rôle |
|---|---|
| `ADMIN_EMAILS` | Liste blanche (CSV) des emails ayant accès à `/buupp-admin`. Fail-closed. |
| `BUUPP_ADMIN_SECRET` | Secret partagé pour les routes machine (`/api/admin/digest`, `/api/admin/waitlist/launch-email`). |
| `CRON_SECRET` | Même valeur que `BUUPP_ADMIN_SECRET` — Vercel l'injecte en `Authorization: Bearer` sur les requêtes cron. |
| `BUUPP_TAKE_RATE` | Float, par défaut 0.20. Multiplié par `sum(transactions.campaign_charge)` pour le KPI "Revenu BUUPP". |

## 2. Migrations SQL

```bash
npx supabase db push
npx supabase gen types typescript --linked > lib/supabase/types.ts
```

Vérifier que `admin_events` est dans la publication `supabase_realtime` (la migration le fait, mais à re-vérifier en cas de doute) :

```sql
select * from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'admin_events';
```

## 3. Cron Vercel

`vercel.json` déclare deux crons. Sur Vercel → Settings → Environment Variables :
- `BUUPP_ADMIN_SECRET` = la même valeur en prod et preview
- `CRON_SECRET` = idem

## 4. Premier accès

1. Se connecter sur le site avec un email présent dans `ADMIN_EMAILS`.
2. Aller sur `https://<domaine>/buupp-admin`.
3. La sidebar doit s'afficher. Sinon → vérifier l'env + redéployer.

## 5. Réception des mails

- Critical → mail immédiat à toute la liste `ADMIN_EMAILS` via SMTP Gmail (`SMTP_USER` / `SMTP_PASS`).
- Warning → digest horaire par cron Vercel.
- Info → digest 2× par jour (08h / 18h Paris).

Si aucun mail n'arrive : vérifier `SMTP_USER` / `SMTP_PASS` (cf. `lib/email/transport.ts`) et la page `/buupp-admin/sante` (compteur "email failed 24h").
