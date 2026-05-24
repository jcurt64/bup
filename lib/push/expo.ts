// Wrapper Expo Push API (https://docs.expo.dev/push-notifications/sending-notifications).
// V1 : envoi par batch + cleanup des tokens invalides via receipts.
// Pas de dépendance NPM — l'API HTTP suffit (fetch natif Node 20+).

import type { SupabaseClient } from "@supabase/supabase-js";

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound?: "default";
  badge?: number;
  channelId?: string;
  priority?: "default" | "high";
  ttl?: number;
};

const DURATION_LABEL: Record<string, string> = {
  "1h": "1h",
  "24h": "24h",
  "7d": "7 jours",
  "30d": "30 jours",
};

function formatEur(amount: number): string {
  // Toujours 2 décimales, virgule française.
  return `${amount.toFixed(2).replace(".", ",")} €`;
}

function durationLabel(durationKey: string): string {
  return DURATION_LABEL[durationKey] ?? durationKey;
}

export function buildClassicPayload(args: {
  token: string;
  proName: string;
  rewardEur: number;
  durationKey: string;
  relationId: string;
}): ExpoPushMessage {
  return {
    to: args.token,
    title: "👋 Une nouvelle sollicitation",
    body: `${args.proName} · +${formatEur(args.rewardEur)} · expire dans ${durationLabel(args.durationKey)}`,
    data: {
      type: "classic",
      relationId: args.relationId,
      screen: "relations",
    },
    sound: "default",
    badge: 1,
    channelId: "solicitations-classic",
  };
}

export function buildFlashPayload(args: {
  token: string;
  proName: string;
  rewardEur: number;
  relationId: string;
  campaignId: string;
}): ExpoPushMessage {
  return {
    to: args.token,
    title: "⚡ Flash deal — 1h pour saisir",
    body: `${args.proName} · +${formatEur(args.rewardEur)} · prime ×2 jusqu'à la fin du flash`,
    data: {
      type: "flash",
      relationId: args.relationId,
      campaignId: args.campaignId,
      screen: "flash-deals",
    },
    sound: "default",
    badge: 1,
    channelId: "solicitations-flash",
    priority: "high",
    ttl: 3600,
  };
}

// ---------------------------------------------------------------------------
// sendBatch — envoi par chunks + cleanup tokens invalides via receipts
// ---------------------------------------------------------------------------

const EXPO_API = "https://exp.host/--/api/v2";
const CHUNK = 100;
const RECEIPT_POLL_DELAY_MS = 2000;

type Ticket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

type Receipt =
  | { status: "ok" }
  | { status: "error"; details?: { error?: string } };

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function deleteInvalidTokens(
  admin: SupabaseClient,
  tokens: string[],
): Promise<void> {
  if (tokens.length === 0) return;
  try {
    const { error } = await admin.from("push_tokens").delete().in("expo_token", tokens);
    if (error) {
      console.error("[push] cleanup tokens failed", error);
    }
  } catch (e) {
    console.error("[push] cleanup tokens threw", e);
  }
}

/**
 * Envoie un batch de messages Expo. Fire-and-forget côté caller —
 * on swallow toutes les erreurs réseau pour ne pas faire planter la
 * réponse de l'endpoint qui a déclenché l'envoi (POST campaigns).
 *
 * - Chunks de 100 (limite Expo).
 * - Sleep 2s puis poll /getReceipts pour récupérer les statuts finaux.
 * - Tokens en erreur "DeviceNotRegistered" → DELETE de push_tokens.
 */
export async function sendBatch(
  admin: SupabaseClient,
  messages: ExpoPushMessage[],
): Promise<void> {
  if (messages.length === 0) return;

  const invalidTokens: string[] = [];
  const ticketIdToToken = new Map<string, string>();

  for (const batch of chunk(messages, CHUNK)) {
    try {
      const res = await fetch(`${EXPO_API}/push/send`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN
            ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(batch),
      });
      const json = (await res.json()) as { data: Ticket[] };
      const tickets = json.data ?? [];
      tickets.forEach((tk, i) => {
        const msg = batch[i];
        if (tk.status === "error") {
          if (tk.details?.error === "DeviceNotRegistered") {
            invalidTokens.push(msg.to);
          } else {
            console.error("[push] ticket error", tk, "token=", msg.to);
          }
        } else if (tk.status === "ok") {
          ticketIdToToken.set(tk.id, msg.to);
        }
      });
    } catch (e) {
      console.error("[push] send batch failed", e);
    }
  }

  // Poll receipts (best-effort, après ~2s d'attente).
  if (ticketIdToToken.size > 0) {
    await new Promise((r) => setTimeout(r, RECEIPT_POLL_DELAY_MS));
    const ids = [...ticketIdToToken.keys()];
    for (const batch of chunk(ids, CHUNK)) {
      try {
        const res = await fetch(`${EXPO_API}/push/getReceipts`, {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            ...(process.env.EXPO_ACCESS_TOKEN
              ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
              : {}),
          },
          body: JSON.stringify({ ids: batch }),
        });
        const json = (await res.json()) as { data: Record<string, Receipt> };
        for (const [id, receipt] of Object.entries(json.data ?? {})) {
          if (receipt.status === "error" && receipt.details?.error === "DeviceNotRegistered") {
            const tok = ticketIdToToken.get(id);
            if (tok) invalidTokens.push(tok);
          }
        }
      } catch (e) {
        console.error("[push] getReceipts failed", e);
      }
    }
  }

  try {
    await deleteInvalidTokens(admin, [...new Set(invalidTokens)]);
  } catch (e) {
    console.error("[push] final cleanup failed", e);
  }
}
