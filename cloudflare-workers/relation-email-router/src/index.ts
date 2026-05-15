/**
 * Cloudflare Email Worker — relation-email-router
 *
 * Reçoit les mails envoyés à `prospect+r{alias}@buupp.com`, résout
 * l'alias en interrogeant l'API BUUPP, et forward le mail vers le vrai
 * email du prospect.
 *
 * Si l'alias est invalide / révoqué, le mail est rejeté avec un message
 * SMTP explicite (le client mail du pro affichera "delivery failure").
 *
 * Variables d'env (à configurer via `wrangler secret put`) :
 *   - BUUPP_API_BASE       https://buupp.com (ou l'URL Vercel preview)
 *   - INBOUND_RELAY_SECRET secret partagé avec /api/inbound/relation/resolve
 *
 * Déploiement :
 *   cd cloudflare-workers/relation-email-router
 *   npm install
 *   npx wrangler secret put INBOUND_RELAY_SECRET
 *   npx wrangler deploy
 *
 * Puis dans le dashboard Cloudflare Email Routing :
 *   Routing rule : `prospect+*@buupp.com` → Worker `relation-email-router`
 */

export interface Env {
  BUUPP_API_BASE: string;
  INBOUND_RELAY_SECRET: string;
}

interface ResolveResponse {
  email: string;
  relationId: string;
}

const ALIAS_RE = /^prospect\+r([a-z0-9]{8,16})@/i;

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const to = message.to;
    const match = to.match(ALIAS_RE);
    if (!match) {
      message.setReject(`No relation alias in recipient ${to}`);
      return;
    }
    const alias = match[1].toLowerCase();

    const url = new URL("/api/inbound/relation/resolve", env.BUUPP_API_BASE);
    url.searchParams.set("alias", alias);

    let resp: Response;
    try {
      resp = await fetch(url.toString(), {
        headers: { "x-inbound-secret": env.INBOUND_RELAY_SECRET },
      });
    } catch (err) {
      message.setReject(`BUUPP relay unreachable: ${(err as Error).message}`);
      return;
    }

    if (resp.status === 404) {
      message.setReject(`Alias ${alias} unknown or revoked`);
      return;
    }
    if (!resp.ok) {
      message.setReject(`BUUPP relay error ${resp.status}`);
      return;
    }

    const body = (await resp.json()) as ResolveResponse;
    if (!body.email) {
      message.setReject(`Alias ${alias} has no destination`);
      return;
    }

    // Forward au vrai email. Cloudflare ajoute automatiquement les
    // headers nécessaires (Received, etc.). On préserve le from original
    // — le prospect verra l'email du pro en tant qu'expéditeur, ce qui
    // est cohérent avec le double consentement déjà donné.
    await message.forward(body.email);
  },
};

// Types Cloudflare Email Workers (extrait minimal de @cloudflare/workers-types)
interface ForwardableEmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream;
  readonly rawSize: number;
  setReject(reason: string): void;
  forward(rcptTo: string, headers?: Headers): Promise<void>;
}
