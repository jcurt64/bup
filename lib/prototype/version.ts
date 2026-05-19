/**
 * Jeton de version du prototype (`/public/prototype`).
 *
 * Sert de cache-buster pour `shell.html` et les `.jsx` chargés dans
 * l'iframe. Auparavant `PrototypeFrame` utilisait `Date.now()` au
 * montage : unique à CHAQUE arrivée sur /prospect ou /pro → le
 * navigateur ne pouvait jamais réutiliser les `.jsx` en cache
 * (~820 Ko re-téléchargés + re-transpilés par Babel à chaque fois).
 *
 * Ici la valeur est **stable pour un déploiement donné** et ne change
 * qu'au déploiement suivant :
 *  - `VERCEL_DEPLOYMENT_ID` : change à chaque déploiement, même en cas
 *    de « redeploy » du même commit → bust le plus fiable.
 *  - `VERCEL_GIT_COMMIT_SHA` : repli si l'ID de déploiement est absent.
 *  - `BUILD_TIME` : repli local — figé au démarrage du process serveur
 *    (`next dev` / `next start`), donc stable pendant toute la session
 *    de dev et invalidé au redémarrage.
 *
 * Combiné au header `Cache-Control: public, max-age=31536000, immutable`
 * sur `/prototype/components/*` (cf. next.config.ts), les `.jsx` sont
 * mis en cache un an, l'URL `?v=<token>` garantissant un fetch neuf au
 * déploiement suivant.
 */
const BUILD_TIME = String(Date.now());

export const PROTOTYPE_VERSION =
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  BUILD_TIME;
