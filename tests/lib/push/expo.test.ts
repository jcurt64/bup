import { describe, expect, it } from "vitest";
import { buildClassicPayload, buildFlashPayload } from "@/lib/push/expo";

describe("buildClassicPayload", () => {
  it("compose le payload Expo classique avec emoji 👋", () => {
    const msg = buildClassicPayload({
      token: "ExponentPushToken[abc]",
      proName: "Coiffure Lola",
      rewardEur: 3.4,
      durationKey: "24h",
      relationId: "rel-1",
    });
    expect(msg).toEqual({
      to: "ExponentPushToken[abc]",
      title: "👋 Une nouvelle sollicitation",
      body: "Coiffure Lola · +3,40 € · expire dans 24h",
      data: { type: "classic", relationId: "rel-1", screen: "relations" },
      sound: "default",
      badge: 1,
      channelId: "solicitations-classic",
    });
  });

  it("formate les centimes en euros avec virgule française", () => {
    const msg = buildClassicPayload({
      token: "ExponentPushToken[abc]",
      proName: "X",
      rewardEur: 12,
      durationKey: "7d",
      relationId: "r",
    });
    expect(msg.body).toBe("X · +12,00 € · expire dans 7 jours");
  });
});

describe("buildFlashPayload", () => {
  it("compose le payload flash avec emoji ⚡, priority high, ttl 3600", () => {
    const msg = buildFlashPayload({
      token: "ExponentPushToken[xyz]",
      proName: "Garage Marc",
      rewardEur: 5.2,
      relationId: "rel-2",
      campaignId: "camp-9",
    });
    expect(msg).toEqual({
      to: "ExponentPushToken[xyz]",
      title: "⚡ Flash deal — 1h pour saisir",
      body: "Garage Marc · +5,20 € · prime ×2 jusqu'à la fin du flash",
      data: {
        type: "flash",
        relationId: "rel-2",
        campaignId: "camp-9",
        screen: "flash-deals",
      },
      sound: "default",
      badge: 1,
      channelId: "solicitations-flash",
      priority: "high",
      ttl: 3600,
    });
  });
});
