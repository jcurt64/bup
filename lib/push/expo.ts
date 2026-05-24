// Wrapper Expo Push API (https://docs.expo.dev/push-notifications/sending-notifications).
// V1 : envoi par batch + cleanup des tokens invalides via receipts.
// Pas de dépendance NPM — l'API HTTP suffit (fetch natif Node 20+).

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
